import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../helpers/notificationsSideEffect.js';

const router = express.Router();

// Create a post mention
router.post('/post', authenticateToken, (req, res) => {
  const { post_id, mentioned_user_id } = req.body;

  if (!post_id || !mentioned_user_id) {
    return res.status(400).json({ error: 'Post ID and mentioned user ID are required.' });
  }

  const insertQuery = `
    INSERT INTO post_mentions (post_id, mentioned_user_id)
    VALUES (?, ?)
  `;

  connection.query(insertQuery, [post_id, mentioned_user_id], (err, result) => {
    if (err) {
      console.error("Error inserting post mention:", err);
      return res.status(500).json({ error: 'Database error' });
    }

    createNotification({
      user_id: mentioned_user_id,
      notification_type: 'POST_MENTION',
      reference_id: post_id,
      actor_id: req.user.userId,
      reference_type: 'post',
      message: 'You were mentioned in a post'
    });

    res.json({ mention_id: result.insertId, post_id, mentioned_user_id });
  });
});

// Create a comment mention
router.post('/comment', authenticateToken, (req, res) => {
    const { comment_id, mentioned_user_id } = req.body;
  
    console.log("Incoming Mention Request:", req.body); // Debugging log
  
    if (!comment_id || !mentioned_user_id) {
      console.error("Missing parameters:", { comment_id, mentioned_user_id });
      return res.status(400).json({ error: 'Comment ID and mentioned user ID are required.' });
    }
  
    const insertQuery = `
      INSERT INTO comment_mentions (comment_id, mentioned_user_id)
      VALUES (?, ?)
    `;
  
    connection.query(insertQuery, [comment_id, mentioned_user_id], (err, result) => {
      if (err) {
        console.error("Error inserting comment mention:", err);
        return res.status(500).json({ error: 'Database error' });
      }
  
      createNotification({
        user_id: mentioned_user_id,
        notification_type: 'COMMENT_MENTION',
        reference_id: comment_id,
        actor_id: req.user.userId,
        reference_type: 'comment',
        message: 'You were mentioned in a comment'
      });
  
      res.json({ mention_id: result.insertId, comment_id, mentioned_user_id });
    });
  });
  

export default router;
