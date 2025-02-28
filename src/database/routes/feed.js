import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../helpers/notificationsSideEffect.js';

const router = express.Router();

// Helper clause for filtering out blocked users
const blockFilterClause = `
  AND p.user_id NOT IN (
    SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
    UNION
    SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
  )
`;

// GET all feed posts (only posts with post_type = 'feed')
router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT 
      p.post_id, 
      p.user_id, 
      p.content, 
      p.created_at,
      u.username, 
      u.profile_picture_url
    FROM posts p
    JOIN users u ON p.user_id = u.user_id
    WHERE p.post_type = 'feed'
      ${blockFilterClause}
    ORDER BY p.created_at DESC
  `;
  connection.query(query, [userId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching posts' });
    res.json(results);
  });
});

// GET feed posts by a specific user (only feed posts)
router.get('/user/:id', authenticateToken, (req, res) => {
  const currentUserId = req.user.userId;
  const userId = req.params.id;
  const query = `
    SELECT 
      p.post_id,
      p.user_id,
      p.content,
      p.created_at,
      u.username,
      u.profile_picture_url
    FROM posts p
    JOIN users u ON p.user_id = u.user_id
    WHERE p.user_id = ? 
      AND p.post_type = 'feed'
      ${blockFilterClause}
    ORDER BY p.created_at DESC
  `;
  connection.query(query, [userId, currentUserId, currentUserId], (err, results) => {
    if (err) {
      console.error("Error fetching user's feed posts:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// POST a new feed post
router.post('/', authenticateToken, (req, res) => {
  const { content } = req.body;
  const userId = req.user.userId;
  const insertQuery = `
    INSERT INTO posts (user_id, content, post_type)
    VALUES (?, ?, 'feed')
  `;
  connection.query(insertQuery, [userId, content], (err, insertResult) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const newPostId = insertResult.insertId;
    const selectQuery = `
      SELECT 
        p.post_id,
        p.user_id,
        p.content,
        p.created_at,
        u.username,
        u.profile_picture_url,
        0 AS likes
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.post_id = ?
        ${blockFilterClause}
    `;
    connection.query(selectQuery, [newPostId, userId, userId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Post not found after insert' });
      res.json(rows[0]);
    });
  });
});

// GET /feed/:postId/comments - Fetch comments for a feed post
router.get('/:postId/comments', authenticateToken, (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.userId;
  const query = `
    SELECT c.comment_id, c.post_id, c.user_id, c.content, c.created_at, c.parent_comment_id,
           u.username, u.profile_picture_url
    FROM comments c
    JOIN users u ON c.user_id = u.user_id
    WHERE c.post_id = ?
      AND c.user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    ORDER BY c.created_at ASC
  `;
  connection.query(query, [postId, userId, userId], (err, results) => {
    if (err) {
      console.error("Error fetching comments for post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// POST /feed/:postId/comments - Create a comment on a feed post
router.post('/:postId/comments', authenticateToken, (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.userId;
  const { content } = req.body;
  
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  const insertQuery = `
    INSERT INTO comments (post_id, user_id, content)
    VALUES (?, ?, ?)
  `;
  connection.query(insertQuery, [postId, userId, content], (err, insertResult) => {
    if (err) {
      console.error("Error inserting comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    const newCommentId = insertResult.insertId;
    const selectQuery = `
      SELECT c.comment_id, c.post_id, c.parent_comment_id, c.user_id, c.content, c.created_at,
             u.username, u.profile_picture_url, 0 AS likeCount
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.comment_id = ?
        AND c.user_id NOT IN (
          SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
          UNION
          SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
        )
    `;
    connection.query(selectQuery, [newCommentId, userId, userId], (err, rows) => {
      if (err) {
        console.error("Error selecting new comment:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Post not found after insert' });
      }
      // Optionally, you can add notification logic here.
      res.json(rows[0]);
    });
  });
});

// GET /feed/:id/likes/count - Get like count for a feed post
router.get('/:id/likes/count', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const query = 'SELECT COUNT(*) AS likeCount FROM likes WHERE post_id = ?';
  connection.query(query, [postId], (err, results) => {
    if (err) {
      console.error("Error fetching like count:", err);
      return res.status(500).json({ error: 'Error fetching like count' });
    }
    res.json({ likeCount: results[0].likeCount });
  });
});

// NEW: GET /feed/:id/liked - Check if the current user has liked the post
router.get('/:id/liked', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;
  const query = 'SELECT COUNT(*) AS count FROM likes WHERE post_id = ? AND user_id = ?';
  connection.query(query, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error checking if post is liked:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    const liked = results[0].count > 0;
    res.json({ liked });
  });
});

// POST /feed/:id/like - Like a feed post and notify the post owner
router.post('/:id/like', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;
  const query = 'INSERT INTO likes (post_id, user_id) VALUES (?, ?)';
  connection.query(query, [postId, userId], (err) => {
    if (err) return res.status(500).json({ error: 'Error liking post' });
    const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
    connection.query(getPostQuery, [postId], (err, postResults) => {
      if (err) {
        console.error('Error fetching post for notification:', err);
      } else if (postResults.length > 0) {
        const postOwner = postResults[0].user_id;
        if (postOwner !== userId) {
          createNotification({
            user_id: postOwner,
            notification_type: 'POST_LIKE',
            reference_id: postId,
            actor_id: userId,
            reference_type: 'post',
            message: 'Someone liked your post'
          });
        }
      }
    });
    res.json({ message: 'Post liked successfully' });
  });
});

// DELETE /feed/:id/like - Unlike a feed post and remove its notification
router.delete('/:id/like', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;
  const deleteQuery = 'DELETE FROM likes WHERE post_id = ? AND user_id = ?';
  connection.query(deleteQuery, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error unliking post:", err);
      return res.status(500).json({ error: 'Error unliking post' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'No like found to remove' });
    }
    const deleteNotificationQuery = `
      DELETE FROM notifications
      WHERE reference_id = ? 
        AND notification_type = 'POST_LIKE'
        AND reference_type = 'post'
        AND actor_id = ?
    `;
    connection.query(deleteNotificationQuery, [postId, userId], (err2) => {
      if (err2) {
        console.error("Error deleting notification for post like:", err2);
      }
      res.json({ message: 'Post unliked successfully' });
    });
  });
});

// DELETE /feed/:postId - Delete a feed post (with cascading deletion) and remove its notifications
router.delete('/:postId', authenticateToken, (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.userId;
  connection.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    connection.query('DELETE FROM likes WHERE post_id = ?', [postId], (err2) => {
      if (err2) {
        return connection.rollback(() => res.status(500).json({ error: 'Error deleting likes' }));
      }
      connection.query('DELETE FROM comments WHERE post_id = ?', [postId], (err3) => {
        if (err3) {
          return connection.rollback(() => res.status(500).json({ error: 'Error deleting comments' }));
        }
        connection.query(
          'DELETE FROM posts WHERE post_id = ? AND user_id = ? AND post_type = "feed"',
          [postId, userId],
          (err4, results4) => {
            if (err4) {
              return connection.rollback(() => res.status(500).json({ error: 'Error deleting post' }));
            }
            if (results4.affectedRows === 0) {
              return connection.rollback(() => res.status(404).json({ error: 'Post not found or unauthorized' }));
            }
            connection.commit((err5) => {
              if (err5) {
                return connection.rollback(() => res.status(500).json({ error: 'Error committing transaction' }));
              }
              const deleteNotificationQuery = `
                DELETE FROM notifications
                WHERE reference_id = ? AND reference_type = 'post'
              `;
              connection.query(deleteNotificationQuery, [postId], (err6) => {
                if (err6) {
                  console.error("Error deleting notifications for feed post:", err6);
                }
                res.json({ message: 'Post deleted successfully' });
              });
            });
          }
        );
      });
    });
  });
});

// GET /feed/:id - Get a single feed post by ID (no block filtering here since it's a self lookup)
router.get('/:id', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const query = `
    SELECT * 
    FROM posts
    WHERE post_id = ? AND post_type = 'feed'
  `;
  connection.query(query, [postId], (err, results) => {
    if (err) {
      console.error('Error fetching feed post:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Feed post not found' });
    }
    res.json(results[0]);
  });
});

export default router;
