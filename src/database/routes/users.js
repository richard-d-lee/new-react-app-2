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

router.get('/birthday/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const sql = 'SELECT date_of_birth FROM birthdays WHERE user_id = ?';
  connection.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Birthday not found' });
    res.json(results[0]);
  });
});


// GET /users/profile-settings/:id
router.get('/profile-settings/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const sql = `
    SELECT setting_key, setting_value 
    FROM user_settings
    WHERE user_id = ?
  `;
  connection.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Error fetching profile settings:", err);
      return res.status(500).json({ error: "Database error" });
    }
    // If no settings found, you might want to return defaults or a 404.
    if (results.length === 0) {
      return res.status(404).json({ error: "No profile settings found for this user" });
    }
    // Convert the results array into an object.
    const settings = {};
    results.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    res.json(settings);
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

// Update user settings (names, email, birthday, and profile display settings)
router.put('/settings/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const { first_name, last_name, email, birthday, show_first_name, show_last_name, show_email, show_birthday } = req.body;

  // Update the users table; if a field is not provided, leave it unchanged.
  const updateUserQuery = `
    UPDATE users
    SET first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        email = COALESCE(?, email)
    WHERE user_id = ?
  `;
  connection.query(updateUserQuery, [first_name, last_name, email, userId], (err) => {
    if (err) return res.status(500).json({ error: 'Database error updating user details' });

    // Update or insert birthday in the birthdays table.
    const checkBirthdayQuery = 'SELECT * FROM birthdays WHERE user_id = ?';
    connection.query(checkBirthdayQuery, [userId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error checking birthdays' });
      if (results.length > 0) {
        const updateBirthdayQuery = `
          UPDATE birthdays
          SET date_of_birth = COALESCE(?, date_of_birth)
          WHERE user_id = ?
        `;
        connection.query(updateBirthdayQuery, [birthday, userId], (err) => {
          if (err) return res.status(500).json({ error: 'Database error updating birthday' });
          updateProfileSettings();
        });
      } else {
        const insertBirthdayQuery = `
          INSERT INTO birthdays (user_id, date_of_birth)
          VALUES (?, ?)
        `;
        connection.query(insertBirthdayQuery, [userId, birthday], (err) => {
          if (err) return res.status(500).json({ error: 'Database error inserting birthday' });
          updateProfileSettings();
        });
      }
    });

    // Function to update profile display settings if provided.
    function updateProfileSettings() {
      // Only update profile settings if they were provided in the request.
      if (
        show_first_name !== undefined &&
        show_last_name !== undefined &&
        show_email !== undefined &&
        show_birthday !== undefined
      ) {
        const settings = [
          { key: 'show_first_name', value: show_first_name },
          { key: 'show_last_name', value: show_last_name },
          { key: 'show_email', value: show_email },
          { key: 'show_birthday', value: show_birthday }
        ];

        let completed = 0;
        settings.forEach((s) => {
          const query = `
            INSERT INTO user_settings (user_id, setting_key, setting_value)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
          `;
          connection.query(query, [userId, s.key, s.value.toString()], (err) => {
            if (err) return res.status(500).json({ error: 'Database error updating profile settings' });
            completed++;
            if (completed === settings.length) {
              return res.json({ message: 'User settings updated successfully' });
            }
          });
        });
      } else {
        return res.json({ message: 'User settings updated successfully' });
      }
    }
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

