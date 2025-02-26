// routes/friends.js
import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../helpers/notificationsSideEffect.js';

const router = express.Router();

// GET /friends/outbound - Retrieve outbound friend requests
router.get('/outbound', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT u.user_id, u.username, u.email, u.profile_picture_url
    FROM friends f
    JOIN users u ON f.user_id_2 = u.user_id
    WHERE f.user_id_1 = ? AND f.status = 'pending'
      AND u.user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    ORDER BY u.username ASC
  `;
  connection.query(query, [userId, userId, userId], (err, results) => {
    if (err) {
      console.error('Error fetching outbound requests:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// GET /friends/status - Retrieve friendship status between current user and another user
router.get('/status', authenticateToken, (req, res) => {
  const currentUser = req.query.userId;
  const otherUser = req.query.otherId;
  const query = `
    SELECT user_id_1 AS sender, status, created_at AS friendAddedDate
    FROM friends
    WHERE ((user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?))
      AND NOT EXISTS (
        SELECT 1 FROM blocked_users
        WHERE (blocker_id = ? AND blocked_id = ?)
           OR (blocker_id = ? AND blocked_id = ?)
      )
    LIMIT 1
  `;
  connection.query(query, [
    currentUser, otherUser,
    otherUser, currentUser,
    currentUser, otherUser,
    otherUser, currentUser
  ], (err, results) => {
    if (err) {
      console.error("Error fetching friend status:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.json({ status: 'none' });
    }
    const row = results[0];
    const direction = row.sender == currentUser ? 'outgoing' : 'incoming';
    res.json({ status: row.status, direction, friendAddedDate: row.friendAddedDate });
  });
});

// GET /friends/incoming-count - Retrieve count of inbound pending friend requests
router.get('/incoming-count', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT COUNT(*) AS incomingRequests
    FROM friends
    WHERE user_id_2 = ? AND status = 'pending'
      AND user_id_1 NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
  `;
  connection.query(query, [userId, userId, userId], (err, results) => {
    if (err) {
      console.error('Error fetching incoming friend requests count:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ incomingRequests: results[0].incomingRequests });
  });
});

// GET /friends/pending - Retrieve inbound pending friend requests
router.get('/pending', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT u.user_id, u.username, u.email, u.profile_picture_url
    FROM friends f
    JOIN users u ON f.user_id_1 = u.user_id
    WHERE f.user_id_2 = ? AND f.status = 'pending'
      AND u.user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    ORDER BY u.username ASC
  `;
  connection.query(query, [userId, userId, userId], (err, results) => {
    if (err) {
      console.error('Error fetching inbound pending requests:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// GET /friends - Retrieve accepted friends
router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT u.user_id, u.username, u.email, u.profile_picture_url
    FROM friends f
    JOIN users u ON (f.user_id_1 = u.user_id OR f.user_id_2 = u.user_id)
    WHERE f.status = 'accepted'
      AND (f.user_id_1 = ? OR f.user_id_2 = ?)
      AND u.user_id != ?
      AND u.user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    ORDER BY u.username ASC
  `;
  connection.query(query, [userId, userId, userId, userId, userId], (err, results) => {
    if (err) {
      console.error('Error fetching accepted friends:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// GET /friends/possible-friends - Retrieve possible friends (users not already friends or pending)
router.get('/possible-friends', authenticateToken, (req, res) => {
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
      AND u.user_id NOT IN (
          SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
          UNION
          SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
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
  connection.query(query, [me, me, me, me, me], (err, results) => {
    if (err) {
      console.error('Error retrieving possible friends:', err);
      return res.status(500).json({ error: 'Error retrieving possible friends' });
    }
    res.json(results);
  });
});

// POST /friends/decline - Decline a friend request
router.post('/decline', authenticateToken, (req, res) => {
  const me = req.user.userId;
  const { friendId } = req.body;
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

// POST /friends/remove - Remove an accepted friend
router.post('/remove', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { friendId } = req.body;
  const query = `
    DELETE FROM friends
    WHERE status = 'accepted'
      AND ((user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?))
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

// POST /friends/confirm - Confirm an inbound friend request and notify the requester
router.post('/confirm', authenticateToken, (req, res) => {
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
    createNotification({
      user_id: friendId,
      notification_type: 'FRIEND_REQUEST_ACCEPTED',
      reference_id: userId,
      actor_id: userId,
      reference_type: 'user',
      message: 'Your friend request has been accepted'
    });
    res.json({ message: 'Friend request confirmed' });
  });
});

// POST /friends/cancel - Cancel an outbound friend request
router.post('/cancel', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { friendId } = req.body;
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

// GET /friends/possible-friends - Retrieve possible friends (users not already friends or pending)
router.get('/possible-friends', authenticateToken, (req, res) => {
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

// POST /friends/add-friend - Send a friend request by email
router.post('/add-friend', authenticateToken, (req, res) => {
  const { friendEmail } = req.body;
  const me = req.user.userId;
  const findFriendQuery = 'SELECT user_id FROM users WHERE email = ? LIMIT 1';
  connection.query(findFriendQuery, [friendEmail], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    const friendId = results[0].user_id;
    const checkQuery = `
      SELECT status FROM friends
      WHERE ((user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?))
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

// GET /friends/possible-friends - Retrieve possible friends (users not already friends or pending)
router.get('/possible-friends', authenticateToken, (req, res) => {
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

export default router;
