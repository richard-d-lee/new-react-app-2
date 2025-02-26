import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to check block relationship between two users
const checkBlockRelationship = (userA, userB, callback) => {
  const blockQuery = `
    SELECT * FROM blocked_users
    WHERE (blocker_id = ? AND blocked_id = ?)
       OR (blocker_id = ? AND blocked_id = ?)
  `;
  connection.query(blockQuery, [userA, userB, userB, userA], (err, results) => {
    if (err) return callback(err, null);
    callback(null, results.length > 0);
  });
};

/**
 * GET /messages/inbox - Retrieve all messages for the logged-in user,
 * excluding messages from senders in a blocking relationship.
 */
router.get('/inbox', authenticateToken, (req, res) => {
  const currentUser = req.user.userId;
  const query = `
    SELECT *
    FROM messages
    WHERE receiver_id = ?
      AND sender_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    ORDER BY created_at DESC
  `;
  connection.query(query, [currentUser, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error('Error fetching messages:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

/**
 * GET /messages/inbox-summary - Returns a summary of conversations for the logged-in user,
 * excluding those with users in a block relationship.
 */
router.get('/inbox-summary', authenticateToken, (req, res) => {
  const currentUser = req.user.userId;
  const query = `
    SELECT s.friend, u.username, m.content, m.created_at
    FROM (
      SELECT 
        CASE 
          WHEN sender_id = ? THEN receiver_id 
          ELSE sender_id 
        END AS friend,
        MAX(created_at) AS last_time
      FROM messages
      WHERE (sender_id = ? OR receiver_id = ?)
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
    WHERE s.friend NOT IN (
      SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
      UNION
      SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
    )
    ORDER BY m.created_at DESC
  `;
  connection.query(
    query,
    [currentUser, currentUser, currentUser, currentUser, currentUser, currentUser, currentUser],
    (err, results) => {
      if (err) {
        console.error("Error fetching inbox summary:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results);
    }
  );
});

/**
 * GET /messages/inbox-latest - Returns accepted friends with last message info,
 * excluding conversations with blocked users.
 */
router.get('/inbox-latest', authenticateToken, (req, res) => {
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
      SELECT 
        CASE WHEN user_id_1 = ? THEN user_id_2 ELSE user_id_1 END AS friend_id
      FROM friends
      WHERE status = 'accepted'
        AND (user_id_1 = ? OR user_id_2 = ?)
    ) f
    JOIN users u ON u.user_id = f.friend_id
    WHERE f.friend_id NOT IN (
      SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
      UNION
      SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
    )
    ORDER BY last_time IS NULL, last_time DESC
  `;
  connection.query(
    query,
    [
      currentUser, currentUser,
      currentUser, currentUser,
      currentUser, currentUser, currentUser,
      currentUser, currentUser
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

/**
 * POST /messages/send - Send a message.
 * First checks if there is a block relationship between sender and receiver.
 */
router.post('/send', authenticateToken, (req, res) => {
  const senderId = req.user.userId;
  const receiver = req.body.receiver_id || req.body.receiverId;
  const content = req.body.content;
  
  if (!receiver || !content || content.trim() === "") {
    console.error("Missing receiver or content:", { receiver, content });
    return res.status(400).json({ error: 'Receiver and content are required' });
  }
  
  // Check for block relationship before sending message.
  checkBlockRelationship(senderId, receiver, (err, isBlocked) => {
    if (err) {
      console.error("Error checking block relationship:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (isBlocked) {
      return res.status(403).json({ error: 'Messaging is not allowed between these users due to a block relationship.' });
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
});

/**
 * GET /messages/conversation/:otherUserId - Retrieve conversation between logged-in user and another user.
 * If a block relationship exists, return a 403 error.
 */
router.get('/conversation/:otherUserId', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const otherUserId = req.params.otherUserId;
  
  // Check block relationship between current user and other user.
  checkBlockRelationship(userId, otherUserId, (err, isBlocked) => {
    if (err) {
      console.error("Error checking block relationship:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (isBlocked) {
      return res.status(403).json({ error: 'Conversation not allowed due to block relationship.' });
    }
    
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
});

export default router;
