// routes/posts.js
import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../helpers/notificationsSideEffect.js';

const router = express.Router();

// GET all posts
router.get('/', authenticateToken, (req, res) => {
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
    ORDER BY p.created_at DESC
  `;
  connection.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error fetching posts' });
    res.json(results);
  });
});

// GET posts by a specific user
router.get('/user/:id', authenticateToken, (req, res) => {
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
    ORDER BY p.created_at DESC
  `;
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error fetching user's posts:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// POST a new post
router.post('/', authenticateToken, (req, res) => {
  const { content } = req.body;
  const userId = req.user.userId;
  const insertQuery = `
    INSERT INTO posts (user_id, content)
    VALUES (?, ?)
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
    `;
    connection.query(selectQuery, [newPostId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Post not found after insert' });
      res.json(rows[0]);
    });
  });
});

// GET /posts/:id/likes/count - Get like count for a post
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

// POST /posts/:id/like - Like a post and notify the post owner
router.post('/:id/like', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;
  const query = 'INSERT INTO likes (post_id, user_id) VALUES (?, ?)';
  connection.query(query, [postId, userId], (err, results) => {
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

// DELETE /posts/:id/like - Unlike a post
router.delete('/:id/like', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;
  const query = 'DELETE FROM likes WHERE post_id = ? AND user_id = ?';
  connection.query(query, [postId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error unliking post' });
    res.json({ message: 'Post unliked successfully' });
  });
});

// GET /posts/:id/liked - Get like status for a post
router.get('/:id/liked', authenticateToken, (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;
  const query = 'SELECT COUNT(*) AS liked FROM likes WHERE post_id = ? AND user_id = ?';
  connection.query(query, [postId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error checking like status' });
    res.json({ liked: results[0].liked > 0 });
  });
});

// DELETE /posts/:postId - Delete a post (with cascading deletion)
router.delete('/:postId', authenticateToken, (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.userId;
  connection.beginTransaction(err => {
    if (err) return res.status(500).json({ error: 'Database error' });
    connection.query('DELETE FROM likes WHERE post_id = ?', [postId], (err) => {
      if (err) {
        return connection.rollback(() => res.status(500).json({ error: 'Error deleting likes' }));
      }
      connection.query('DELETE FROM comments WHERE post_id = ?', [postId], (err) => {
        if (err) {
          return connection.rollback(() => res.status(500).json({ error: 'Error deleting comments' }));
        }
        connection.query('DELETE FROM posts WHERE post_id = ? AND user_id = ?', [postId, userId], (err, results) => {
          if (err) {
            return connection.rollback(() => res.status(500).json({ error: 'Error deleting post' }));
          }
          if (results.affectedRows === 0) {
            return connection.rollback(() => res.status(404).json({ error: 'Post not found or unauthorized' }));
          }
          connection.commit(err => {
            if (err) {
              return connection.rollback(() => res.status(500).json({ error: 'Error committing transaction' }));
            }
            res.json({ message: 'Post deleted successfully' });
          });
        });
      });
    });
  });
});

// POST /posts/:postId/comments - Create a comment on a post and notify the post owner
router.post('/:postId/comments', authenticateToken, (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.userId;
  const { content } = req.body;
  
  if (!content || content.trim() === "") {
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
    `;
    connection.query(selectQuery, [newCommentId], (err, rows) => {
      if (err) {
        console.error("Error selecting new comment:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Comment not found after insert' });
      }
      // Notify the post owner if not the same as the commenter.
      const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
      connection.query(getPostQuery, [postId], (err, postResults) => {
        if (err) {
          console.error("Error fetching post owner:", err);
        } else if (postResults.length > 0) {
          const postOwner = postResults[0].user_id;
          if (postOwner !== userId) {
            createNotification({
              user_id: postOwner,
              notification_type: 'POST_COMMENT',
              reference_id: newCommentId,
              actor_id: userId,
              reference_type: 'comment',
              message: 'Someone commented on your post'
            });
          }
        }
      });
      res.json(rows[0]);
    });
  });
});

// routes/posts.js

// GET /posts/:postId/comments - Fetch comments for a post
router.get('/:postId/comments', authenticateToken, (req, res) => {
  const postId = req.params.postId;
  const query = `
    SELECT c.*, u.username
    FROM comments c
    JOIN users u ON c.user_id = u.user_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `;
  connection.query(query, [postId], (err, results) => {
    if (err) {
      console.error("Error fetching comments for post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});


export default router;
