import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../helpers/notificationsSideEffect.js';

const router = express.Router();

// Helper function to check block relationship between two users.
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

// Create a post mention
router.post('/post', authenticateToken, (req, res) => {
  const { post_id, mentioned_user_id, group_id } = req.body; // Accept group_id
  if (!post_id || !mentioned_user_id) {
    return res.status(400).json({ error: 'Post ID and mentioned user ID are required.' });
  }
  
  const currentUser = req.user.userId;
  // Check block relationship between current user and mentioned user
  checkBlockRelationship(currentUser, mentioned_user_id, (err, isBlocked) => {
    if (err) {
      console.error('Error checking block relationship:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (isBlocked) {
      return res.status(403).json({ error: 'Cannot mention a user that is blocked or has blocked you.' });
    }
    
    // Insert mention into the post_mentions table (or your unified table)
    const insertQuery = `INSERT INTO post_mentions (post_id, mentioned_user_id) VALUES (?, ?)`;
    connection.query(insertQuery, [post_id, mentioned_user_id], (err, result) => {
      if (err) {
        console.error('Error inserting post mention:', err);
        return res.status(500).json({ error: 'Database error' });
      }
  
      // Create a notification for the mentioned user
      createNotification({
        user_id: mentioned_user_id,
        notification_type: group_id ? 'GROUP_POST_MENTION' : 'POST_MENTION',
        reference_id: post_id,
        actor_id: currentUser,
        reference_type: group_id ? 'group_post' : 'post',
        group_id, // Pass group_id if provided
        message: group_id
          ? 'You were mentioned in a group post'
          : 'You were mentioned in a post'
      });
  
      res.json({ mention_id: result.insertId, post_id, mentioned_user_id, group_id });
    });
  });
});

// Create a comment mention
router.post('/comment', authenticateToken, (req, res) => {
  const { comment_id, mentioned_user_id, group_id } = req.body; // Accept group_id
  if (!comment_id || !mentioned_user_id) {
    return res.status(400).json({ error: 'Comment ID and mentioned user ID are required.' });
  }
  
  const currentUser = req.user.userId;
  // Check block relationship between current user and mentioned user
  checkBlockRelationship(currentUser, mentioned_user_id, (err, isBlocked) => {
    if (err) {
      console.error('Error checking block relationship:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (isBlocked) {
      return res.status(403).json({ error: 'Cannot mention a user that is blocked or has blocked you.' });
    }
    
    const insertQuery = `INSERT INTO comment_mentions (comment_id, mentioned_user_id) VALUES (?, ?)`;
    connection.query(insertQuery, [comment_id, mentioned_user_id], (err, result) => {
      if (err) {
        console.error('Error inserting comment mention:', err);
        return res.status(500).json({ error: 'Database error' });
      }
  
      createNotification({
        user_id: mentioned_user_id,
        notification_type: group_id ? 'GROUP_COMMENT_MENTION' : 'COMMENT_MENTION',
        reference_id: comment_id,
        actor_id: currentUser,
        reference_type: group_id ? 'group_comment' : 'comment',
        group_id, // Pass group_id if provided
        message: group_id
          ? 'You were mentioned in a group comment'
          : 'You were mentioned in a comment'
      });
  
      res.json({ mention_id: result.insertId, comment_id, mentioned_user_id, group_id });
    });
  });
});

export default router;
