import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import password from './password.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('__dirname:', __dirname);

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Create MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: password,
  database: 'social_media_app'
});
connection.connect(err => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to MySQL');
});

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  jwt.verify(token, 'your_jwt_secret', (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

// Define the uploads directory relative to __dirname
const uploadsDir = path.join(__dirname, 'uploads');
console.log('Uploads directory (absolute):', uploadsDir);

// Ensure the uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory.');
} else {
  console.log('Uploads directory exists.');
}

// Configure Multer storage using diskStorage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);
    if (extName && mimeType) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpg, png, gif) are allowed'));
  }
});

// Serve static files from the uploads directory
app.use('/uploads', express.static(uploadsDir));
console.log(`Serving static files from ${uploadsDir} at /uploads`);

// ================================
// File Upload Endpoint
// ================================
app.post('/upload-profile-pic', authenticateToken, upload.single('profilePic'), (req, res) => {
  const userId = req.user.userId;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
  }
  
  // Construct new file URL
  const newFileUrl = `/uploads/${req.file.filename}`;
  
  // Query to check if the user already has a profile picture
  const getPicQuery = 'SELECT profile_picture_url FROM users WHERE user_id = ?';
  connection.query(getPicQuery, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching previous profile picture:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // If there's an existing picture, delete it from disk
    if (results.length > 0 && results[0].profile_picture_url) {
      // Assume the stored URL is like "/uploads/filename.ext" – remove the prefix and construct absolute path
      const oldFilePath = path.join(__dirname, results[0].profile_picture_url);
      // Check if file exists before deleting
      if (fs.existsSync(oldFilePath)) {
        fs.unlink(oldFilePath, (err) => {
          if (err) console.error('Error deleting old profile picture:', err);
          else console.log('Old profile picture deleted:', oldFilePath);
        });
      }
    }
    
    // Update the user's profile_picture_url in the database
    const updateQuery = 'UPDATE users SET profile_picture_url = ? WHERE user_id = ?';
    connection.query(updateQuery, [newFileUrl, userId], (err, results) => {
      if (err) {
        console.error('Error updating profile picture URL:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Profile picture updated successfully', fileUrl: newFileUrl });
    });
  });
});

// ================================
// User Endpoints
// ================================
app.get('/users/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const query = 'SELECT user_id, username, email, first_name, last_name, profile_picture_url FROM users WHERE user_id = ?';
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching user details:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(results[0]);
  });
});

// ================================
// Authentication Endpoints
// ================================
app.post('/register', (req, res) => {
  const { username, email, password, first_name, last_name } = req.body;
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({ error: 'Error hashing password' });
    const query = `
      INSERT INTO users (username, email, password_hash, first_name, last_name) 
      VALUES (?, ?, ?, ?, ?)
    `;
    connection.query(query, [username, email, hashedPassword, first_name, last_name], (err, results) => {
      if (err) return res.status(500).json({ error: 'Error saving user' });
      res.json({ message: 'User registered successfully! Please return to the login screen to continue.' });
    });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const query = 'SELECT * FROM users WHERE email = ? OR username = ?';
  connection.query(query, [email, email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid email/username or password' });
    const user = results[0];
    bcrypt.compare(password, user.password_hash, (err, isMatch) => {
      if (err || !isMatch) return res.status(401).json({ error: 'Invalid email/username or password' });
      const token = jwt.sign({ userId: user.user_id }, 'your_jwt_secret', { expiresIn: '1h' });
      res.json({ message: 'Login successful', token });
    });
  });
});

// ================================
// Posts Endpoints
// ================================
app.get('/posts', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      p.post_id, 
      p.user_id, 
      p.content, 
      p.created_at,
      u.username, 
      u.profile_picture_url
    FROM posts p
    JOIN users u ON p.user_id = u.user_id
    ORDER BY p.created_at DESC
  `;
  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching posts' });
    res.json(results);
  });
});

app.get('/posts/user/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT 
      p.post_id,
      p.user_id,
      p.content,
      p.created_at,
      u.username,
      u.profile_picture_url
    FROM posts p
    JOIN users u ON p.user_id = u.user_id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `;
  connection.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching posts' });
    res.json(results);
  });
});

app.post('/posts', authenticateToken, (req, res) => {
  const { content } = req.body;
  const userId = req.user.userId;
  if (!content) return res.status(400).json({ error: 'Content is required' });
  connection.query(
    'INSERT INTO posts (user_id, content) VALUES (?, ?)',
    [userId, content],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Error creating post' });
      res.json({ message: 'Post created successfully', postId: results.insertId });
    }
  );
});

// ================================
// Comments Endpoints
// ================================
app.get('/posts/:id/comments', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const query = `
    SELECT c.*, u.username 
    FROM comments c 
    JOIN users u ON c.user_id = u.user_id 
    WHERE c.post_id = ? 
    ORDER BY c.created_at ASC
  `;
  connection.query(query, [postId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching comments' });
    res.json(results);
  });
});

app.post('/posts/:id/comments', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const { content } = req.body;
  const userId = req.user.userId;
  if (!content) return res.status(400).json({ error: 'Content is required' });
  connection.query(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
    [postId, userId, content],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Error creating comment' });
      res.json({ message: 'Comment added successfully', commentId: results.insertId });
    }
  );
});

// ================================
// Likes Endpoints
// ================================
app.get('/posts/:id/likes/count', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const query = 'SELECT COUNT(*) AS likeCount FROM likes WHERE post_id = ?';
  connection.query(query, [postId], (err, results) => {
    if (err) {
      console.error("Error fetching like count:", err);
      return res.status(500).json({ error: 'Error fetching like count' });
    }
    res.json({ likeCount: results[0].likeCount });
  });
});

app.post('/posts/:id/like', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;
  connection.query(
    'INSERT INTO likes (post_id, user_id) VALUES (?, ?)',
    [postId, userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Error liking post' });
      res.json({ message: 'Post liked successfully' });
    }
  );
});

app.delete('/posts/:id/like', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;
  connection.query(
    'DELETE FROM likes WHERE post_id = ? AND user_id = ?',
    [postId, userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Error unliking post' });
      res.json({ message: 'Post unliked successfully' });
    }
  );
});

app.get('/posts/:id/liked', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;
  const query = 'SELECT COUNT(*) AS liked FROM likes WHERE post_id = ? AND user_id = ?';
  connection.query(query, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error checking like status:", err);
      return res.status(500).json({ error: 'Error checking like status' });
    }
    res.json({ liked: results[0].liked > 0 });
  });
});

// ================================
// Messages Endpoints
// ================================
// GET /messages/inbox - Retrieve all messages for the logged-in user
app.get('/messages/inbox', authenticateToken, (req, res) => {
  const userId = req.user.userId; // The ID of the logged-in user

  const query = `
    SELECT *
    FROM messages
    WHERE receiver_id = ?
    ORDER BY created_at DESC
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching messages:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    // Return the list of messages
    res.json(results);
  });
});

// GET /messages/inbox-summary - Returns a summary of conversations for the logged-in user
app.get('/messages/inbox-summary', authenticateToken, (req, res) => {
  const currentUser = req.user.userId;
  const query = `
    SELECT s.friend, u.username, m.content, m.created_at
    FROM (
      -- For each conversation (friend), get the most recent message time
      SELECT 
        CASE 
          WHEN sender_id = ? THEN receiver_id 
          ELSE sender_id 
        END AS friend,
        MAX(created_at) AS last_time
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?
      GROUP BY friend
    ) s
    JOIN messages m 
      ON m.created_at = s.last_time 
      AND (
        (m.sender_id = ? AND m.receiver_id = s.friend)
        OR 
        (m.sender_id = s.friend AND m.receiver_id = ?)
      )
    JOIN users u ON u.user_id = s.friend
    ORDER BY m.created_at DESC;
  `;
  connection.query(query, [currentUser, currentUser, currentUser, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching inbox summary:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// GET /messages/inbox-latest
// Returns all accepted friends for currentUser along with last_message and last_time if any exist
app.get('/messages/inbox-latest', authenticateToken, (req, res) => {
  const currentUser = req.user.userId;

  const query = `
    SELECT
      f.friend_id,
      u.username,
      u.profile_picture_url,
      (
        SELECT m.content
        FROM messages m
        WHERE 
          (m.sender_id = ? AND m.receiver_id = f.friend_id)
          OR
          (m.sender_id = f.friend_id AND m.receiver_id = ?)
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message,
      (
        SELECT m.created_at
        FROM messages m
        WHERE 
          (m.sender_id = ? AND m.receiver_id = f.friend_id)
          OR
          (m.sender_id = f.friend_id AND m.receiver_id = ?)
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_time
    FROM (
      -- Subquery: all accepted friends for currentUser
      SELECT 
        CASE WHEN user_id_1 = ? THEN user_id_2 ELSE user_id_1 END AS friend_id
      FROM friends
      WHERE status = 'accepted'
        AND (user_id_1 = ? OR user_id_2 = ?)
    ) f
    JOIN users u ON u.user_id = f.friend_id
    ORDER BY last_time IS NULL, last_time DESC
  `;

  connection.query(
    query,
    [
      // For last_message subselect
      currentUser, currentUser,
      // For last_time subselect
      currentUser, currentUser,
      // For the friends subquery
      currentUser, currentUser, currentUser
    ],
    (err, results) => {
      if (err) {
        console.error('Error fetching inbox-latest:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results);
    }
  );
});



app.post('/messages/send', authenticateToken, (req, res) => {
  const senderId = req.user.userId;
  // Accept either "receiver_id" or "receiverId"
  const receiver = req.body.receiver_id || req.body.receiverId;
  const content = req.body.content;
    
  // Validate required fields
  if (!receiver || !content || content.trim() === "") {
    console.error("Missing receiver or content:", { receiver, content });
    return res.status(400).json({ error: 'Receiver and content are required' });
  }
  
  const query = 'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)';
  connection.query(query, [senderId, receiver, content], (err, results) => {
    if (err) {
      console.error("Error inserting message:", err);
      return res.status(500).json({ error: 'Error sending message' });
    }
    res.json({ message: 'Message sent successfully', messageId: results.insertId });
  });
});




app.get('/messages/conversation/:otherUserId', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const otherUserId = req.params.otherUserId;
  const query = `
    SELECT *
    FROM messages 
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `;
  connection.query(query, [userId, otherUserId, otherUserId, userId], (err, results) => {
    if (err) {
      console.error('Error fetching conversation:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});


// ================================
// Friends Endpoints
// ================================
app.get('/friends/outbound', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT u.user_id, u.username, u.email, u.profile_picture_url
    FROM friends f
    JOIN users u ON f.user_id_2 = u.user_id
    WHERE f.user_id_1 = ? AND f.status = 'pending'
    ORDER BY u.username ASC
  `;
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching outbound requests:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

app.get('/friends/pending', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT u.user_id, u.username, u.email, u.profile_picture_url
    FROM friends f
    JOIN users u ON f.user_id_1 = u.user_id
    WHERE f.user_id_2 = ? AND f.status = 'pending'
    ORDER BY u.username ASC
  `;
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching inbound pending requests:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

app.get('/friends', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT u.user_id, u.username, u.email, u.profile_picture_url
    FROM friends f
    JOIN users u ON (f.user_id_1 = u.user_id OR f.user_id_2 = u.user_id)
    WHERE f.status = 'accepted'
      AND (f.user_id_1 = ? OR f.user_id_2 = ?)
      AND u.user_id != ?
    ORDER BY u.username ASC
  `;
  connection.query(query, [userId, userId, userId], (err, results) => {
    if (err) {
      console.error('Error fetching accepted friends:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

app.post('/friends/decline', authenticateToken, (req, res) => {
  const me = req.user.userId;
  const { friendId } = req.body;
  console.log(`Declining friend request from user ${friendId} to user ${me}`);
  const query = `
    DELETE FROM friends
    WHERE user_id_1 = ? AND user_id_2 = ? AND status = 'pending'
  `;
  connection.query(query, [friendId, me], (err, results) => {
    if (err) {
      console.error('Error declining friend request:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'No pending friend request found' });
    }
    res.json({ message: 'Friend request declined' });
  });
});

app.post('/friends/remove', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { friendId } = req.body;
  const query = `
    DELETE FROM friends
    WHERE status = 'accepted'
      AND (
        (user_id_1 = ? AND user_id_2 = ?)
        OR
        (user_id_1 = ? AND user_id_2 = ?)
      )
  `;
  connection.query(query, [userId, friendId, friendId, userId], (err, results) => {
    if (err) {
      console.error('Error removing friend:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'No friendship found' });
    }
    res.json({ message: 'Friend removed successfully' });
  });
});

app.post('/friends/confirm', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { friendId } = req.body;
  const query = `
    UPDATE friends
    SET status = 'accepted'
    WHERE user_id_1 = ? AND user_id_2 = ? AND status = 'pending'
  `;
  connection.query(query, [friendId, userId], (err, results) => {
    if (err) {
      console.error('Error confirming friend request:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'No pending request found' });
    }
    res.json({ message: 'Friend request confirmed' });
  });
});

// POST /friends/cancel - Cancel an outbound friend request
app.post('/friends/cancel', authenticateToken, (req, res) => {
  // The logged-in user's ID (the sender of the request)
  const userId = req.user.userId;

  // The recipient's user_id (the one who received the request)
  const { friendId } = req.body;

  // Delete the row where user_id_1 = sender, user_id_2 = recipient, status = 'pending'
  const query = `
    DELETE FROM friends
    WHERE user_id_1 = ? AND user_id_2 = ? AND status = 'pending'
  `;

  connection.query(query, [userId, friendId], (err, results) => {
    if (err) {
      console.error('Error cancelling friend request:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    // If no rows were affected, that means no matching pending request was found
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'No pending friend request found' });
    }
    res.json({ message: 'Friend request cancelled' });
  });
});


// ================================
// Possible Friends Endpoint
// ================================
app.get('/possible-friends', authenticateToken, (req, res) => {
  const me = req.user.userId;
  const query = `
    SELECT 
      u.user_id,
      u.username,
      u.email,
      u.profile_picture_url
    FROM users u
    WHERE 
      u.user_id != ?
      AND NOT EXISTS (
        SELECT 1
        FROM friends f
        WHERE (
          (f.user_id_1 = ? AND f.user_id_2 = u.user_id)
          OR
          (f.user_id_1 = u.user_id AND f.user_id_2 = ?)
        )
        AND f.status IN ('pending','accepted')
      )
    ORDER BY u.username ASC
  `;
  connection.query(query, [me, me, me], (err, results) => {
    if (err) {
      console.error('Error retrieving possible friends:', err);
      return res.status(500).json({ error: 'Error retrieving possible friends' });
    }
    res.json(results);
  });
});

// ================================
// Add Friend Endpoint
// ================================
app.post('/add-friend', authenticateToken, (req, res) => {
  const { friendEmail } = req.body;
  const me = req.user.userId;
  const findFriendQuery = 'SELECT user_id FROM users WHERE email = ? LIMIT 1';
  connection.query(findFriendQuery, [friendEmail], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    const friendId = results[0].user_id;
    const checkQuery = `
      SELECT status FROM friends
      WHERE (
          (user_id_1 = ? AND user_id_2 = ?)
          OR
          (user_id_1 = ? AND user_id_2 = ?)
      )
      AND status IN ('pending', 'accepted')
      LIMIT 1
    `;
    connection.query(checkQuery, [me, friendId, friendId, me], (err, checkRes) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (checkRes.length > 0) {
        return res.status(400).json({ error: 'Friend request or friendship already exists' });
      }
      const addFriendQuery = `
        INSERT INTO friends (user_id_1, user_id_2, status)
        VALUES (?, ?, 'pending')
      `;
      connection.query(addFriendQuery, [me, friendId], (err) => {
        if (err) {
          console.error('Error adding friend:', err);
          return res.status(500).json({ error: 'Error adding friend' });
        }
        res.json({ message: 'Friend request sent!' });
      });
    });
  });
});

// ================================
// Start the Server
// ================================
app.listen(5000, () => console.log('Server running on port 5000'));
