import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import password from './password.js'

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

// Middleware: Authenticate JWT token
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

// ======================
// GET /friends/outbound
// ======================
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

// POST /friends/decline
app.post('/friends/decline', authenticateToken, (req, res) => {
  const me = req.user.userId; // The logged-in user (recipient)
  const { friendId } = req.body; // The sender of the friend request
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


// ======================
// GET /possible-friends
// ======================
app.get('/possible-friends', authenticateToken, (req, res) => {
  const me = req.user.userId;

  // This query excludes users who have any row with me in either direction
  // where status is 'pending' or 'accepted'.
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


// ======================
// POST /add-friend
// ======================
app.post('/add-friend', authenticateToken, (req, res) => {
  const { friendEmail } = req.body;
  const me = req.user.userId;

  // 1) Look up the friend by email
  const findFriendQuery = 'SELECT user_id FROM users WHERE email = ? LIMIT 1';
  connection.query(findFriendQuery, [friendEmail], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const friendId = results[0].user_id;

    // 2) Check if there's already a row in either direction
    // with status = 'pending' or 'accepted'
    const checkQuery = `
      SELECT status FROM friends
      WHERE
        (
          (user_id_1 = ? AND user_id_2 = ?)
          OR
          (user_id_1 = ? AND user_id_2 = ?)
        )
        AND status IN ('pending', 'accepted')
      LIMIT 1
    `;
    connection.query(checkQuery, [me, friendId, friendId, me], (err, checkRes) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      // If we found any row, we cannot add a new friend request
      if (checkRes.length > 0) {
        // If it's accepted, they're already friends. If it's pending, there's a pending request
        return res.status(400).json({ error: 'Friend request or friendship already exists' });
      }

      // 3) Otherwise, insert a new row with status = 'pending'
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


// ======================
// POST /friends/cancel
// ======================
app.post('/friends/cancel', authenticateToken, (req, res) => {
  const userId = req.user.userId;  // the sender
  const { friendId } = req.body;   // the recipient
  const query = `
    DELETE FROM friends
    WHERE user_id_1 = ? AND user_id_2 = ? AND status = 'pending'
  `;
  connection.query(query, [userId, friendId], (err, results) => {
    if (err) {
      console.error('Error cancelling friend request:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'No pending friend request found' });
    }
    res.json({ message: 'Friend request cancelled' });
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

app.post('/friends/confirm', authenticateToken, (req, res) => {
  const userId = req.user.userId; // the one receiving request
  const { friendId } = req.body;  // the one who sent request
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



/*==============================
  Authentication Endpoints
===============================*/

// Register a new user
app.post('/register', (req, res) => {
  const { username, email, password, first_name, last_name } = req.body;
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ error: 'Error hashing password' });
    }
    const query = `
      INSERT INTO users (username, email, password_hash, first_name, last_name) 
      VALUES (?, ?, ?, ?, ?)
    `;
    connection.query(query, [username, email, hashedPassword, first_name, last_name], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Error saving user' });
      }
      res.json({ message: 'User registered successfully! Please return to the login screen to continue.' });
    });
  });
});


// Login endpoint
app.post('/login', (req, res) => {
  const { email, password } = req.body; // "email" may be an email address or username
  const query = 'SELECT * FROM users WHERE email = ? OR username = ?';
  connection.query(query, [email, email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid email/username or password' });
    const user = results[0];
    bcrypt.compare(password, user.password_hash, (err, isMatch) => {
      if (err || !isMatch) return res.status(401).json({ error: 'Invalid email/username or password' });
      
      // Use the correct primary key field (e.g., user.user_id)
      const token = jwt.sign({ userId: user.user_id }, 'your_jwt_secret', { expiresIn: '1h' });
      res.json({ message: 'Login successful', token });
    });
  });
});




/*==============================
         Posts Endpoints
===============================*/

// Get all posts with author info
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
    if (err) {
      return res.status(500).json({ error: 'Error fetching posts' });
    }
    // results will contain fields: post_id, user_id, content, created_at, username, profile_picture_url
    res.json(results);
  });
});

// Create a new post
app.post('/posts', authenticateToken, (req, res) => {
  const { content } = req.body;
  const userId = req.user.userId; // from the decoded JWT

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  connection.query(
    'INSERT INTO posts (user_id, content) VALUES (?, ?)',
    [userId, content],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Error creating post' });
      }
      // results.insertId will be the newly created post_id
      res.json({ 
        message: 'Post created successfully', 
        postId: results.insertId 
      });
    }
  );
});


/*==============================
      Comments Endpoints
===============================*/

// Get comments for a post
app.get('/posts/:id/comments', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const query = `
    SELECT c.*, u.username 
    FROM comments c 
    JOIN users u ON c.user_id = u.user_id 
    WHERE c.post_id = ? 
    ORDER BY c.created_at ASC`;
  connection.query(query, [postId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching comments' });
    res.json(results);
  });
});

// Create a new comment on a post
app.post('/posts/:id/comments', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const { content } = req.body;
  const userId = req.user.userId;
  if (!content) return res.status(400).json({ error: 'Content is required' });
  connection.query('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [postId, userId, content], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error creating comment' });
    res.json({ message: 'Comment added successfully', commentId: results.insertId });
  });
});

/*==============================
        Likes Endpoints
===============================*/

// GET endpoint: /posts/:id/likes/count
app.get('/posts/:id/likes/count', authenticateToken, (req, res) => {
  const postId = req.params.id;
  
  const query = 'SELECT COUNT(*) AS likeCount FROM likes WHERE post_id = ?';
  
  connection.query(query, [postId], (err, results) => {
    if (err) {
      console.error("Error fetching like count:", err);
      return res.status(500).json({ error: 'Error fetching like count' });
    }
    // results[0].likeCount will be the number of likes for the post
    res.json({ likeCount: results[0].likeCount });
  });
});

// Like a post
app.post('/posts/:id/like', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;
  connection.query('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [postId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error liking post' });
    res.json({ message: 'Post liked successfully' });
  });
});

// Unlike a post
app.delete('/posts/:id/like', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;
  connection.query('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [postId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error unliking post' });
    res.json({ message: 'Post unliked successfully' });
  });
});

/*==============================
       Messages Endpoints
===============================*/

// Get inbox messages for the logged-in user
app.get('/messages/inbox', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  connection.query('SELECT * FROM messages WHERE receiver_id = ? ORDER BY created_at DESC', [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching messages' });
    res.json(results);
  });
});

// Get conversation between logged-in user and another user
app.get('/messages/conversation/:otherUserId', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const otherUserId = req.params.otherUserId;
  const query = `
    SELECT * FROM messages 
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
    ORDER BY created_at ASC`;
  connection.query(query, [userId, otherUserId, otherUserId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching conversation' });
    res.json(results);
  });
});

// Send a message
app.post('/messages/send', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { receiver_id, content } = req.body;
  if (!receiver_id || !content) return res.status(400).json({ error: 'Receiver and content are required' });
  connection.query('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [userId, receiver_id, content], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error sending message' });
    res.json({ message: 'Message sent successfully', messageId: results.insertId });
  });
});

/* Additional endpoints for birthdays, sponsored content, and suggested friends can be added similarly. */

app.listen(5000, () => console.log('Server running on port 5000'));
