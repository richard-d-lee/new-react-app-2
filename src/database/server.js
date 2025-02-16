import express from 'express'; 
import mysql from 'mysql2';
import cors from 'cors';
import password from './password.js';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: password,
  database: 'social_media_app',
});

connection.connect(err => {
  if (err) console.error("Database connection error:", err);
  else console.log("Connected to MySQL");
});

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Extract token from the Authorization header
  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token." });
    req.user = user;  // Attach user info (including userId) to the request object
    next();
  });
};

// Send a new message
app.post('/messages/send', authenticateToken, (req, res) => {
  const { receiver_id, content } = req.body;
  if (!receiver_id || !content) return res.status(400).json({ error: "Receiver ID and content are required." });

  const sender_id = req.user.userId;  // Get the sender's ID from the decoded token

  connection.query(
    'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
    [sender_id, receiver_id, content],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Message sent successfully", messageId: results.insertId });
    }
  );
});

// Get all received messages (inbox)
app.get('/messages/inbox', authenticateToken, (req, res) => {
  const userId = req.user.userId;  // Get the logged-in user ID from the token

  connection.query(
    'SELECT * FROM messages WHERE receiver_id = ? ORDER BY created_at DESC',
    [userId],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

// Get all sent messages
app.get('/messages/sent', authenticateToken, (req, res) => {
  const userId = req.user.userId;  // Get the logged-in user ID from the token

  connection.query(
    'SELECT * FROM messages WHERE sender_id = ? ORDER BY created_at DESC',
    [userId],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

// Get conversation history with a specific user
app.get('/messages/conversation/:userId', authenticateToken, (req, res) => {
  const userId = req.user.userId;  // Get the logged-in user ID from the token
  const { userId: targetUserId } = req.params;

  connection.query(
    `SELECT * FROM messages 
     WHERE (sender_id = ? AND receiver_id = ?) 
     OR (sender_id = ? AND receiver_id = ?) 
     ORDER BY created_at ASC`,
    [userId, targetUserId, targetUserId, userId],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

// Mark a message as read
app.patch('/messages/mark-read/:messageId', authenticateToken, (req, res) => {
  const messageId = req.params.messageId;
  const userId = req.user.userId;  // Get the logged-in user ID from the token

  connection.query(
    'UPDATE messages SET is_read = TRUE WHERE message_id = ? AND receiver_id = ?',
    [messageId, userId],
    (err, results) => {
      if (err) return res.status(500).json(err);
      if (results.affectedRows === 0) return res.status(404).json({ error: "Message not found or unauthorized." });
      res.json({ message: "Message marked as read." });
    }
  );
});

// Delete a message (only sender or receiver can delete)
app.delete('/messages/delete/:messageId', authenticateToken, (req, res) => {
  const messageId = req.params.messageId;
  const userId = req.user.userId;  // Get the logged-in user ID from the token

  connection.query(
    'DELETE FROM messages WHERE message_id = ? AND (sender_id = ? OR receiver_id = ?)',
    [messageId, userId, userId],
    (err, results) => {
      if (err) return res.status(500).json(err);
      if (results.affectedRows === 0) return res.status(404).json({ error: "Message not found or unauthorized." });
      res.json({ message: "Message deleted successfully." });
    }
  );
});

// Login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  connection.query('SELECT * FROM USERS WHERE EMAIL = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid email or password.' });

    const tempword = results[0].password_hash;
    bcrypt.compare(password, tempword, (err, isMatch) => {
      if (err || !isMatch) return res.status(401).json({ error: 'Invalid email or password.' });

      // Make sure the payload includes the userId property.
      const token = jwt.sign({ userId: results[0].user_id }, 'your_jwt_secret', { expiresIn: '1h' });
      res.json({ message: 'Login successful', token });
    });
  });
});



// Register route
app.post('/register', (req, res) => {
  const { email, password } = req.body;
  connection.query('SELECT * FROM USERS WHERE EMAIL = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length > 0) return res.status(400).json({ error: 'Email is already registered' });

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).json({ error: 'Error hashing password' });

      const query = 'INSERT INTO USERS (USERNAME, EMAIL, PASSWORD_HASH) VALUES (?, ?, ?)';
      connection.query(query, [email, email, hashedPassword], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error saving user' });
        res.status(200).json({ message: 'Account created successfully' });
      });
    });
  });
});

app.listen(5000, () => console.log("Server running on port 5000"));
