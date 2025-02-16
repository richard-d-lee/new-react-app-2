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

// GET endpoint: /possible-friends
app.get('/possible-friends', authenticateToken, (req, res) => {
  const userId = req.user.userId; // Logged-in user's ID

  const query = `
    SELECT u.user_id, u.username, u.email, u.profile_picture_url
    FROM users u
    WHERE u.user_id != ? 
      AND u.user_id NOT IN (
        SELECT f.USER_ID_2
        FROM friends f
        WHERE f.USER_ID_1 = ?
      )
    ORDER BY u.username ASC
  `;

  connection.query(query, [userId, userId], (err, results) => {
    if (err) {
      console.error('Error retrieving possible friends:', err);
      return res.status(500).json({ error: 'Error retrieving possible friends' });
    }
    res.json(results);
  });
});

/*==============================
  Authentication Endpoints
===============================*/

// Register a new user
app.post('/register', (req, res) => {
  const { username, email, password, first_name, last_name } = req.body;
  console.log(req.body)
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({ error: 'Error hashing password' });
    const query = 'INSERT INTO users (username, email, password_hash, first_name, last_name) VALUES ("test", ?, ?, "test", "test")';
    connection.query(query, [email, hashedPassword], (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Error saving user' });
      }
      res.json({ message: 'User registered successfully' });
    });
  });
});

// Login endpoint
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = results[0];
    bcrypt.compare(password, user.password_hash, (err, isMatch) => {
      if (err || !isMatch) return res.status(401).json({ error: 'Invalid email or password' });
      
      // IMPORTANT: Ensure you're passing the correct field.
      // If your users table uses 'user_id' as the primary key, use that.
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
    console.log(results)
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
    JOIN users u ON c.user_id = u.id 
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
