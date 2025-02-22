import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Lookup endpoint for mentions
router.get('/lookup', authenticateToken, (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username query parameter is required.' });
  }
  
  const sql = `
    SELECT user_id, username, profile_picture_url
    FROM users
    WHERE username = ?
    LIMIT 1
  `;
  
  connection.query(sql, [username], (err, results) => {
    if (err) {
      console.error("Error looking up user:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(results[0]);
  });
});

// GET /users/search?query=...
router.get('/search', authenticateToken, (req, res) => {
  const queryParam = req.query.query;
  if (!queryParam) {
    return res.status(400).json({ error: 'Query parameter is required.' });
  }

  const sql = `
    SELECT user_id, username, profile_picture_url
    FROM users
    WHERE username LIKE ?
    LIMIT 10
  `;
  const sqlParam = `%${queryParam}%`;

  connection.query(sql, [sqlParam], (err, results) => {
    if (err) {
      console.error("Error searching users:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// Get user details
router.get('/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const query = 'SELECT user_id, username, email, first_name, last_name, profile_picture_url FROM users WHERE user_id = ?';
  connection.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(results[0]);
  });
});

// Update user settings (names & birthday)
router.put('/settings/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const { first_name, last_name, birthday } = req.body;
  
  if (!first_name || !last_name || !birthday) {
    return res.status(400).json({ error: 'First name, last name, and birthday are required' });
  }

  const updateUserQuery = `
    UPDATE users
    SET first_name = ?, last_name = ?
    WHERE user_id = ?
  `;
  connection.query(updateUserQuery, [first_name, last_name, userId], (err) => {
    if (err) return res.status(500).json({ error: 'Database error updating user names' });
    const checkBirthdayQuery = 'SELECT * FROM birthdays WHERE user_id = ?';
    connection.query(checkBirthdayQuery, [userId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error checking birthdays' });
      if (results.length > 0) {
        const updateBirthdayQuery = `
          UPDATE birthdays
          SET date_of_birth = ?
          WHERE user_id = ?
        `;
        connection.query(updateBirthdayQuery, [birthday, userId], (err) => {
          if (err) return res.status(500).json({ error: 'Database error updating birthday' });
          res.json({ message: 'User settings updated successfully' });
        });
      } else {
        const insertBirthdayQuery = `
          INSERT INTO birthdays (user_id, date_of_birth)
          VALUES (?, ?)
        `;
        connection.query(insertBirthdayQuery, [userId, birthday], (err) => {
          if (err) return res.status(500).json({ error: 'Database error inserting birthday' });
          res.json({ message: 'User settings updated successfully' });
        });
      }
    });
  });
});

// Delete user account
router.delete('/settings/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const query = `DELETE FROM users WHERE user_id = ?`;
  connection.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'User account deleted successfully' });
  });
});

export default router;

