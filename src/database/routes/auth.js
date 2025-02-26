import express from 'express';
import connection from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/register', (req, res) => {
  const { username, email, password, first_name, last_name } = req.body;

  // Check that all required fields are provided
  if (!username || !email || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'All fields are required: username, email, password, first_name, last_name.' });
  }

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error('Error hashing password:', err);
      return res.status(500).json({ error: 'Error hashing password' });
    }
    const query = `
      INSERT INTO users (username, email, password_hash, first_name, last_name) 
      VALUES (?, ?, ?, ?, ?)
    `;
    connection.query(query, [username, email, hashedPassword, first_name, last_name], (err, results) => {
      if (err) {
        console.error('Error saving user:', err);
        // If the error is due to a duplicate email or username, you might want to handle it separately.
        return res.status(500).json({ error: 'Error saving user' });
      }
      res.json({ message: 'User registered successfully! Please return to the login screen to continue.' });
    });
  });
});

router.post('/login', (req, res) => {
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

export default router;
