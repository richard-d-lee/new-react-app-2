// routes/users.js
import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

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
