// routes/comments.js
import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../helpers/notificationsSideEffect.js';

const router = express.Router();


/**
 * GET /comments/:commentId/liked
 * Returns the like count and whether the current user liked the comment.
*/
router.get('/:commentId/liked', authenticateToken, (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.userId;
  const query = `
  SELECT 
  COUNT(*) AS likeCount,
  SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS userLiked
  FROM comment_likes
  WHERE comment_id = ?
  `;
  connection.query(query, [userId, commentId], (err, results) => {
    if (err) {
      console.error("Error fetching comment like status:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    const likeCount = results[0].likeCount;
    const liked = results[0].userLiked > 0;
    res.json({ likeCount, liked });
  });
});


/**
 * POST /comments/:commentId/like
 * Likes a comment. Inserts a record into comment_likes.
 * If the comment's author is different from the liker, a notification is generated.
*/
router.post('/:commentId/like', authenticateToken, (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.userId;
  const query = 'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)';
  
  connection.query(query, [commentId, userId], (err, results) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Comment already liked by this user' });
      }
      console.error('Error liking comment:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Fetch the comment owner to create a notification if necessary.
    const getCommentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
    connection.query(getCommentQuery, [commentId], (err, commentResults) => {
      if (err) {
        console.error('Error fetching comment owner:', err);
      } else if (commentResults.length > 0) {
        const commentOwner = commentResults[0].user_id;
        if (commentOwner !== userId) {
          createNotification({
            user_id: commentOwner,
            notification_type: 'COMMENT_LIKE',
            reference_id: commentId,
            actor_id: userId,
            reference_type: 'comment',
            message: 'Someone liked your comment'
          });
        }
      }
    });
    
    res.json({ message: 'Comment liked successfully' });
  });
});

/**
 * POST /comments/:commentId/reply
 * Inserts a reply to an existing comment and notifies the parent comment’s author.
*/
router.post('/:commentId/reply', authenticateToken, (req, res) => {
  const parentCommentId = req.params.commentId;
  const userId = req.user.userId;
  const { content } = req.body;
  const insertQuery = `
  INSERT INTO comments (post_id, parent_comment_id, user_id, content)
  SELECT post_id, ?, ?, ?
  FROM comments
  WHERE comment_id = ?
  `;
  connection.query(insertQuery, [parentCommentId, userId, content, parentCommentId], (err, insertResult) => {
    if (err) {
      console.error("Error inserting reply:", err);
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
        console.error("Error selecting new reply:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Reply not found after insert' });
      }
      // Notify the parent comment's author if necessary.
      const getParentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
      connection.query(getParentQuery, [parentCommentId], (err, parentResults) => {
        if (err) {
          console.error("Error fetching parent comment:", err);
        } else if (parentResults.length > 0) {
          const parentAuthor = parentResults[0].user_id;
          if (parentAuthor !== userId) {
            createNotification({
              user_id: parentAuthor,
              notification_type: 'COMMENT_REPLY',
              reference_id: newCommentId,
              actor_id: userId,
              reference_type: 'comment',
              message: 'Someone replied to your comment'
            });
          }
        }
      });
      res.json(rows[0]);
    });
  });
});

router.get('/:commentId', authenticateToken, (req, res) => {
  const commentId = req.params.commentId;
  
  const query = 'SELECT * FROM comments WHERE comment_id = ? LIMIT 1';
  connection.query(query, [commentId], (err, results) => {
    if (err) {
      console.error('Error fetching comment:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    // Return the single comment object
    res.json(results[0]);
  });
});


// DELETE /comments/:commentId/like - Unlike a comment
router.delete('/:commentId/like', authenticateToken, (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.userId;
  const query = 'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?';
  
  connection.query(query, [commentId, userId], (err, results) => {
    if (err) {
        console.error('Error unliking comment:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'No like found to remove' });
      }
      res.json({ message: 'Comment unliked successfully' });
    });
  });
  
/**
 * DELETE /comments/:commentId
 * Deletes a comment if the logged-in user is the author.
 */
router.delete('/:commentId', authenticateToken, (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.userId;
  const checkQuery = 'SELECT user_id FROM comments WHERE comment_id = ? LIMIT 1';
  connection.query(checkQuery, [commentId], (err, results) => {
    if (err) {
      console.error("Error finding comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) return res.status(404).json({ error: 'Comment not found' });
    const authorId = results[0].user_id;
    if (authorId !== userId) return res.status(403).json({ error: 'Not authorized to delete this comment' });
    const deleteQuery = 'DELETE FROM comments WHERE comment_id = ?';
    connection.query(deleteQuery, [commentId], (err, delResults) => {
      if (err) {
        console.error("Error deleting comment:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (delResults.affectedRows === 0) {
        return res.status(404).json({ error: 'Comment not found or already deleted' });
      }
      res.json({ message: 'Comment deleted successfully' });
    });
  });
});

/**
 * GET /comments/:postId/comments
 * Retrieves all comments for a given post.
 */
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
      console.error("Error fetching comments:", err);
      return res.status(500).json({ error: 'Error fetching comments' });
    }
    res.json(results);
  });
});

/**
 * POST /comments/:postId/comments
 * Inserts a new comment for a given post and notifies the post owner.
 */
router.post('/:postId/comments', authenticateToken, (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.userId;
  const { content } = req.body;
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

export default router;
