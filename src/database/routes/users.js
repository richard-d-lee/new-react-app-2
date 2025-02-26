import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper clause for filtering out users in a block relationship with current user
// currentUser is provided twice to cover both directions.
const blockFilter = (currentUser) => `
  AND user_id NOT IN (
    SELECT blocked_id FROM blocked_users WHERE blocker_id = ${currentUser}
    UNION
    SELECT blocker_id FROM blocked_users WHERE blocked_id = ${currentUser}
  )
`;

/**
 * GET /users/lookup - Lookup endpoint for mentions.
 * Retrieves a user by username, excluding those in a blocking relationship with the current user.
 */
router.get('/lookup', authenticateToken, (req, res) => {
  const { username } = req.query;
  const currentUser = req.user.userId;
  if (!username) {
    return res.status(400).json({ error: 'Username query parameter is required.' });
  }
  
  const sql = `
    SELECT user_id, username, profile_picture_url
    FROM users
    WHERE username = ?
      ${blockFilter(currentUser)}
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

// GET /users/blocked - Retrieve all users blocked by the current user
router.get('/blocked', authenticateToken, (req, res) => {
  const currentUser = req.user.userId;
  const query = `
    SELECT 
      u.user_id, 
      u.username, 
      u.profile_picture_url, 
      u.email
    FROM blocked_users bu
    JOIN users u ON bu.blocked_id = u.user_id
    WHERE bu.blocker_id = ?
  `;
  connection.query(query, [currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching blocked users:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});


/**
 * GET /users/birthday/:id - Retrieve birthday for a user.
 * If the requested user is not the current user, block results if in a blocking relationship.
 */
router.get('/birthday/:id', authenticateToken, (req, res) => {
  const requestedId = req.params.id;
  const currentUser = req.user.userId;
  let sql = 'SELECT date_of_birth FROM birthdays WHERE user_id = ?';
  let params = [requestedId];
  if (requestedId !== String(currentUser)) {
    sql += ` AND user_id NOT IN (
      SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
      UNION
      SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
    )`;
    params.push(currentUser, currentUser);
  }
  connection.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Birthday not found' });
    res.json(results[0]);
  });
});

/**
 * POST /users/block - Block a user.
 */
router.post('/block', authenticateToken, (req, res) => {
  const blockerId = req.user.userId;
  const { blockedId } = req.body;

  if (!blockedId) {
    return res.status(400).json({ error: 'Blocked user ID is required.' });
  }

  const insertQuery = `
    INSERT INTO blocked_users (blocker_id, blocked_id)
    VALUES (?, ?)
  `;
  connection.query(insertQuery, [blockerId, blockedId], (err, results) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'User is already blocked.' });
      }
      console.error('Error blocking user:', err);
      return res.status(500).json({ error: 'Database error while blocking user.' });
    }
    res.status(201).json({ message: 'User blocked successfully.' });
  });
});

/**
 * DELETE /users/block - Unblock a user.
 */
router.delete('/block', authenticateToken, (req, res) => {
  const blockerId = req.user.userId;
  const { blockedId } = req.body;
  if (!blockedId) {
    return res.status(400).json({ error: 'Blocked user ID is required.' });
  }
  const deleteQuery = `
    DELETE FROM blocked_users
    WHERE blocker_id = ? AND blocked_id = ?
  `;
  connection.query(deleteQuery, [blockerId, blockedId], (err, results) => {
    if (err) {
      console.error('Error unblocking user:', err);
      return res.status(500).json({ error: 'Database error while unblocking user.' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Block record not found.' });
    }
    res.json({ message: 'User unblocked successfully.' });
  });
});

/**
 * GET /users/profile-settings/:id - Retrieve profile settings for a user.
 * (Assumed to be accessible only by the user themselves; no block filtering applied.)
 */
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
    if (results.length === 0) {
      return res.status(404).json({ error: "No profile settings found for this user" });
    }
    const settings = {};
    results.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    res.json(settings);
  });
});

/**
 * GET /users/search - Search for users by username.
 * Excludes users in a block relationship with the current user.
 */
router.get('/search', authenticateToken, (req, res) => {
  const queryParam = req.query.query;
  const currentUser = req.user.userId;
  if (!queryParam) {
    return res.status(400).json({ error: 'Query parameter is required.' });
  }
  const sql = `
    SELECT user_id, username, profile_picture_url
    FROM users
    WHERE username LIKE ?
      ${blockFilter(currentUser)}
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

/**
 * GET /users/:id - Get user details.
 * If the requested user is not the current user, excludes users in a block relationship.
 */
router.get('/:id', authenticateToken, (req, res) => {
  const requestedId = req.params.id;
  const currentUser = req.user.userId;
  let query = 'SELECT user_id, username, email, first_name, last_name, profile_picture_url FROM users WHERE user_id = ?';
  let params = [requestedId];
  if (requestedId !== String(currentUser)) {
    query += ` ${blockFilter(currentUser)}`;
  }
  connection.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(results[0]);
  });
});

/**
 * PUT /users/settings/:id - Update user settings (names, email, birthday, profile display settings)
 */
router.put('/settings/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const { first_name, last_name, email, birthday, show_first_name, show_last_name, show_email, show_birthday } = req.body;

  const updateUserQuery = `
    UPDATE users
    SET first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        email = COALESCE(?, email)
    WHERE user_id = ?
  `;
  connection.query(updateUserQuery, [first_name, last_name, email, userId], (err) => {
    if (err) return res.status(500).json({ error: 'Database error updating user details' });

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

    function updateProfileSettings() {
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

/**
 * DELETE /users/settings/:id - Delete user account
 */
router.delete('/settings/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const query = `DELETE FROM users WHERE user_id = ?`;
  connection.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'User account deleted successfully' });
  });
});

export default router;
