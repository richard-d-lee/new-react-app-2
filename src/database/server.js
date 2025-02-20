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

app.put('/users/settings/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const { first_name, last_name, birthday } = req.body;
  
  if (!first_name || !last_name || !birthday) {
    return res.status(400).json({ error: 'First name, last name, and birthday are required' });
  }

  // 1) Update users table (first_name, last_name)
  const updateUserQuery = `
    UPDATE users
    SET first_name = ?, last_name = ?
    WHERE user_id = ?
  `;

  connection.query(updateUserQuery, [first_name, last_name, userId], (err) => {
    if (err) {
      console.error("Error updating user settings (names):", err);
      return res.status(500).json({ error: 'Database error updating user names' });
    }

    // 2) Insert or update birthdays table for the user's date_of_birth
    const checkBirthdayQuery = 'SELECT * FROM birthdays WHERE user_id = ?';
    connection.query(checkBirthdayQuery, [userId], (err, results) => {
      if (err) {
        console.error("Error checking birthdays table:", err);
        return res.status(500).json({ error: 'Database error checking birthdays' });
      }

      if (results.length > 0) {
        // Already has a birthday record, so update it
        const updateBirthdayQuery = `
          UPDATE birthdays
          SET date_of_birth = ?
          WHERE user_id = ?
        `;
        connection.query(updateBirthdayQuery, [birthday, userId], (err) => {
          if (err) {
            console.error("Error updating birthday:", err);
            return res.status(500).json({ error: 'Database error updating birthday' });
          }
          res.json({ message: 'User settings updated successfully' });
        });
      } else {
        // No birthday record yet, insert a new one
        const insertBirthdayQuery = `
          INSERT INTO birthdays (user_id, date_of_birth)
          VALUES (?, ?)
        `;
        connection.query(insertBirthdayQuery, [userId, birthday], (err) => {
          if (err) {
            console.error("Error inserting birthday:", err);
            return res.status(500).json({ error: 'Database error inserting birthday' });
          }
          res.json({ message: 'User settings updated successfully' });
        });
      }
    });
  });
});


app.delete('/users/settings/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  
  const query = `
    DELETE FROM users
    WHERE user_id = ?
  `;
  
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error deleting user account:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'User account deleted successfully' });
  });
});


// ================================
// Groups Endpoints
// ================================

// POST /groups - Create a new group
app.post('/groups', authenticateToken, (req, res) => {
  const creatorId = req.user.userId;
  const { group_name, group_description, group_privacy, icon } = req.body;
  if (!group_name) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  const query = `
    INSERT INTO groups_table (group_name, group_description, group_privacy, icon, creator_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  connection.query(query, [group_name, group_description || '', group_privacy || 'public', icon || '👥', creatorId], (err, results) => {
    if (err) {
      console.error('Error creating group:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    const groupId = results.insertId;
    // Automatically add creator as owner
    const joinQuery = `
      INSERT INTO user_groups (user_id, group_id, role)
      VALUES (?, ?, 'owner')
    `;
    connection.query(joinQuery, [creatorId, groupId], (joinErr) => {
      if (joinErr) {
        console.error('Error joining group:', joinErr);
        return res.status(500).json({ error: 'Database error on join' });
      }
      res.json({ message: 'Group created successfully', groupId });
    });
  });
});

// GET /groups - Retrieve all groups
app.get('/groups', authenticateToken, (req, res) => {
  const query = `
    SELECT group_id, group_name, group_description, group_privacy, icon, creator_id, created_at
    FROM groups_table
    ORDER BY created_at DESC
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching groups:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// GET /groups/my - Retrieve groups the user is a member of
app.get('/groups/my', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT g.group_id, g.group_name, g.group_description, g.group_privacy, g.icon, g.creator_id, g.created_at, ug.role
    FROM groups_table g
    JOIN user_groups ug ON g.group_id = ug.group_id
    WHERE ug.user_id = ?
    ORDER BY g.created_at DESC
  `;
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching user groups:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// POST /groups/join - Join a group (user sends request to join a public group)
app.post('/groups/join', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { group_id } = req.body;
  if (!group_id) {
    return res.status(400).json({ error: 'Group ID is required' });
  }
  // For public groups, we allow immediate join. For private groups, you might need a request process.
  const query = `
    INSERT INTO user_groups (user_id, group_id, role)
    VALUES (?, ?, 'member')
  `;
  connection.query(query, [userId, group_id], (err, results) => {
    if (err) {
      console.error('Error joining group:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Joined group successfully' });
  });
});

// POST /groups/leave - Leave a group
app.post('/groups/leave', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { group_id } = req.body;
  if (!group_id) {
    return res.status(400).json({ error: 'Group ID is required' });
  }
  const query = `
    DELETE FROM user_groups
    WHERE user_id = ? AND group_id = ?
  `;
  connection.query(query, [userId, group_id], (err, results) => {
    if (err) {
      console.error('Error leaving group:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Not a member of this group' });
    }
    res.json({ message: 'Left group successfully' });
  });
});

// POST /groups/:groupId/posts - Create a new post in a group
app.post('/groups/:groupId/posts', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const userId = req.user.userId;
  const { content } = req.body;
  
  if (!content || content.trim() === "") {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  const query = 'INSERT INTO group_posts (group_id, user_id, content) VALUES (?, ?, ?)';
  connection.query(query, [groupId, userId, content], (err, results) => {
    if (err) {
      console.error("Error inserting group post:", err);
      return res.status(500).json({ error: 'Error posting in group' });
    }
    res.json({ message: 'Group post created successfully', postId: results.insertId });
  });
});

// PUT /groups/:groupId/logo - Update a group's logo
app.put('/groups/:groupId/logo', authenticateToken, upload.single('groupLogo'), (req, res) => {
  const groupId = req.params.groupId;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
  }
  const logoUrl = `/uploads/${req.file.filename}`;
  const query = 'UPDATE groups_table SET icon = ? WHERE group_id = ?';
  connection.query(query, [logoUrl, groupId], (err, results) => {
    if (err) {
      console.error('Error updating group logo:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Group logo updated successfully', logoUrl });
  });
});

// DELETE /groups/:groupId/posts/:postId - Delete a post in a group (only if the user is the author)
app.delete('/groups/:groupId/posts/:postId', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    DELETE FROM group_posts 
    WHERE group_post_id = ? 
      AND group_id = ? 
      AND user_id = ?
  `;
  connection.query(query, [postId, groupId, userId], (err, results) => {
    if (err) {
      console.error("Error deleting group post:", err);
      return res.status(500).json({ error: 'Error deleting post' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Post not found or not authorized' });
    }
    res.json({ message: 'Post deleted successfully' });
  });
});


// GET /groups/:groupId/members - Retrieve all members for a given group
app.get('/groups/:groupId/members', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const query = `
    SELECT u.user_id, u.username, u.email, u.profile_picture_url, ug.role
    FROM user_groups ug
    JOIN users u ON ug.user_id = u.user_id
    WHERE ug.group_id = ?
    ORDER BY u.username ASC
  `;
  connection.query(query, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching group members:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// GET /groups/:groupId/posts - Retrieve all posts for a given group
app.get('/groups/:groupId/posts', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const query = `
    SELECT gp.group_post_id AS post_id, gp.group_id, gp.user_id, gp.content, gp.created_at,
           u.username, u.profile_picture_url
    FROM group_posts gp
    JOIN users u ON gp.user_id = u.user_id
    WHERE gp.group_id = ?
    ORDER BY gp.created_at DESC
  `;
  connection.query(query, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching group posts:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// GET /groups/:groupId - Retrieve basic details for a specific group
app.get('/groups/:groupId', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const query = `
    SELECT group_id, group_name, group_description, group_privacy, icon, creator_id, created_at
    FROM groups_table
    WHERE group_id = ?
  `;
  connection.query(query, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching group details:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }
    res.json(results[0]);
  });
});

// DELETE /groups/:groupId/members/:userId - Remove a member from a group
app.delete('/groups/:groupId/members/:userId', authenticateToken, (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const requesterId = req.user.userId;
  // Check if the requester is owner or admin in this group
  const checkRoleQuery = 'SELECT role FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(checkRoleQuery, [groupId, requesterId], (err, results) => {
    if (err) {
      console.error('Error checking role:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0 || (results[0].role !== 'owner' && results[0].role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const deleteQuery = 'DELETE FROM user_groups WHERE group_id = ? AND user_id = ?';
    connection.query(deleteQuery, [groupId, targetUserId], (err, results) => {
      if (err) {
        console.error('Error removing member:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Member not found in group' });
      }
      res.json({ message: 'Member removed from group' });
    });
  });
});


// PUT /groups/:groupId/members/:userId/admin - Promote a member to admin
app.put('/groups/:groupId/members/:userId/admin', authenticateToken, (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const requesterId = req.user.userId;
  // Only group owner can promote to admin
  const checkRoleQuery = 'SELECT role FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(checkRoleQuery, [groupId, requesterId], (err, results) => {
    if (err) {
      console.error('Error checking role:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0 || results[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only group owner can promote members' });
    }
    const updateQuery = 'UPDATE user_groups SET role = "admin" WHERE group_id = ? AND user_id = ?';
    connection.query(updateQuery, [groupId, targetUserId], (err, results) => {
      if (err) {
        console.error('Error promoting member:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Member not found in group' });
      }
      res.json({ message: 'Member promoted to admin' });
    });
  });
});

// PUT /groups/:groupId/members/:userId/demote - Demote an admin to member
app.put('/groups/:groupId/members/:userId/demote', authenticateToken, (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const requesterId = req.user.userId;
  // Only group owner can demote an admin
  const checkRoleQuery = 'SELECT role FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(checkRoleQuery, [groupId, requesterId], (err, results) => {
    if (err) {
      console.error('Error checking role:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0 || results[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only group owner can demote admins' });
    }
    const updateQuery = 'UPDATE user_groups SET role = "member" WHERE group_id = ? AND user_id = ?';
    connection.query(updateQuery, [groupId, targetUserId], (err, results) => {
      if (err) {
        console.error('Error demoting admin:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Member not found in group' });
      }
      res.json({ message: 'Admin demoted to member' });
    });
  });
});

// DELETE /groups/:groupId/members/:userId/posts - Remove all posts by a member in a group
app.delete('/groups/:groupId/members/:userId/posts', authenticateToken, (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const requesterId = req.user.userId;
  // Check if requester is owner or admin
  const checkRoleQuery = 'SELECT role FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(checkRoleQuery, [groupId, requesterId], (err, results) => {
    if (err) {
      console.error('Error checking role:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0 || (results[0].role !== 'owner' && results[0].role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const deleteQuery = 'DELETE FROM group_posts WHERE group_id = ? AND user_id = ?';
    connection.query(deleteQuery, [groupId, targetUserId], (err, results) => {
      if (err) {
        console.error('Error deleting group posts:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'All posts by member removed from group' });
    });
  });
});

// GET /groups/:groupId/membership - Check if current user is a member of the group
app.get('/groups/:groupId/membership', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const userId = req.user.userId;
  const query = 'SELECT role, joined_at FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(query, [groupId, userId], (err, results) => {
    if (err) {
      console.error('Error checking group membership:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length > 0) {
      return res.json({ isMember: true, role: results[0].role, joinedAt: results[0].joined_at });
    }
    res.json({ isMember: false });
  });
});

// POST /groups/:groupId/join - Join a group
app.post('/groups/:groupId/join', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const userId = req.user.userId;
  // First, check if the user is already a member
  const checkQuery = 'SELECT * FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(checkQuery, [groupId, userId], (err, results) => {
    if (err) {
      console.error('Error checking membership:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length > 0) {
      return res.status(400).json({ error: 'Already a member' });
    }
    // Insert new membership row with default role "member"
    const insertQuery = 'INSERT INTO user_groups (group_id, user_id, role) VALUES (?, ?, "member")';
    connection.query(insertQuery, [groupId, userId], (err, results) => {
      if (err) {
        console.error('Error joining group:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Joined group successfully' });
    });
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

// DELETE /posts/:postId - Delete a post (and cascade delete its comments and likes)
app.delete('/posts/:postId', authenticateToken, (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.userId; // Ensure the user owns the post

  // Start a transaction
  connection.beginTransaction(err => {
    if (err) {
      console.error("Error starting transaction:", err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Delete likes related to the post
    connection.query('DELETE FROM likes WHERE post_id = ?', [postId], (err, results) => {
      if (err) {
        console.error("Error deleting likes:", err);
        return connection.rollback(() => {
          res.status(500).json({ error: 'Error deleting likes' });
        });
      }

      // Delete comments related to the post
      connection.query('DELETE FROM comments WHERE post_id = ?', [postId], (err, results) => {
        if (err) {
          console.error("Error deleting comments:", err);
          return connection.rollback(() => {
            res.status(500).json({ error: 'Error deleting comments' });
          });
        }

        // Finally, delete the post itself, but only if it belongs to the current user
        connection.query('DELETE FROM posts WHERE post_id = ? AND user_id = ?', [postId, userId], (err, results) => {
          if (err) {
            console.error("Error deleting post:", err);
            return connection.rollback(() => {
              res.status(500).json({ error: 'Error deleting post' });
            });
          }
          if (results.affectedRows === 0) {
            return connection.rollback(() => {
              res.status(404).json({ error: 'Post not found or unauthorized' });
            });
          }
          // Commit the transaction
          connection.commit(err => {
            if (err) {
              console.error("Error committing transaction:", err);
              return connection.rollback(() => {
                res.status(500).json({ error: 'Error committing transaction' });
              });
            }
            res.json({ message: 'Post deleted successfully' });
          });
        });
      });
    });
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

// POST /comments/:commentId/like - Like a comment
app.post('/comments/:commentId/like', authenticateToken, (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.userId;
  const query = 'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)';
  connection.query(query, [commentId, userId], (err, results) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Comment already liked by this user' });
      }
      console.error('Error liking comment:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ message: 'Comment liked successfully' });
  });
});

// DELETE /comments/:commentId/like - Unlike a comment
app.delete('/comments/:commentId/like', authenticateToken, (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.userId;
  const query = 'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?';
  connection.query(query, [commentId, userId], (err, results) => {
    if (err) {
      console.error('Error unliking comment:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'No like found to remove' });
    }
    res.json({ message: 'Comment unliked successfully' });
  });
});


// POST /comments/:commentId/reply - Reply to a comment
app.post('/comments/:commentId/reply', authenticateToken, (req, res) => {
  const parentCommentId = req.params.commentId;
  const userId = req.user.userId;
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Reply content is required' });
  }
  const query = `
    INSERT INTO comments (post_id, user_id, content, parent_comment_id)
    SELECT c.post_id, ?, ?, c.comment_id
    FROM comments c
    WHERE c.comment_id = ?
  `;
  connection.query(query, [userId, content, parentCommentId], (err, results) => {
    if (err) {
      console.error('Error creating reply:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Parent comment not found' });
    }
    res.json({ message: 'Reply posted successfully', commentId: results.insertId });
  });
});

// DELETE /comments/:commentId - Delete a comment (if user is author or admin)
app.delete('/comments/:commentId', authenticateToken, (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.userId;
  // For simplicity, let's assume authors or admins can delete
  // We'll do a quick check if the user is the comment's author or an admin
  // For now, let's just check if user is the author:
  const checkQuery = 'SELECT user_id FROM comments WHERE comment_id = ? LIMIT 1';
  connection.query(checkQuery, [commentId], (err, results) => {
    if (err) {
      console.error('Error finding comment:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const authorId = results[0].user_id;
    if (authorId !== userId) {
      // TODO: Check if user is admin of the post or group if needed
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }
    const deleteQuery = 'DELETE FROM comments WHERE comment_id = ?';
    connection.query(deleteQuery, [commentId], (err, delResults) => {
      if (err) {
        console.error('Error deleting comment:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (delResults.affectedRows === 0) {
        return res.status(404).json({ error: 'Comment not found or already deleted' });
      }
      res.json({ message: 'Comment deleted successfully' });
    });
  });
});

// GET /friends/search
// e.g. /friends/search?q=ja
// returns all accepted friends whose username starts with "ja"
app.get('/friends/search', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const queryString = req.query.q || '';
  const query = `
    SELECT u.username
    FROM friends f
    JOIN users u ON (f.user_id_1 = u.user_id AND f.user_id_2 = ?) 
                  OR (f.user_id_2 = u.user_id AND f.user_id_1 = ?)
    WHERE f.status = 'accepted'
      AND u.username LIKE CONCAT(?, '%')
    GROUP BY u.username
    LIMIT 10
  `;
  connection.query(query, [userId, userId, queryString], (err, results) => {
    if (err) {
      console.error("Error searching friends:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    // returns array of { username: 'James' } etc.
    res.json(results);
  });
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

// GET /friends/status - Retrieve friendship status between current user and other user
app.get('/friends/status', authenticateToken, (req, res) => {
  const currentUser = req.query.userId;
  const otherUser = req.query.otherId;
  const query = `
    SELECT user_id_1 AS sender, status, created_at AS friendAddedDate
    FROM friends
    WHERE ((user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?))
    LIMIT 1
  `;
  connection.query(query, [currentUser, otherUser, otherUser, currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching friend status:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.json({ status: 'none' });
    }
    const row = results[0];
    // Determine direction: if sender equals currentUser, then it's an outgoing (pending) request; otherwise incoming.
    const direction = row.sender == currentUser ? 'outgoing' : 'incoming';
    res.json({ status: row.status, direction, friendAddedDate: row.friendAddedDate });
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
