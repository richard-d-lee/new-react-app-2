import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../helpers/notificationsSideEffect.js';

const router = express.Router();

/* ---------- Group Creation and Membership ---------- */

// GET /groups - Retrieve all groups
router.get('/', authenticateToken, (req, res) => {
  const query = `
    SELECT group_id, group_name, group_description, group_privacy, icon, creator_id, created_at
    FROM groups_table
    ORDER BY created_at DESC
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching groups:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// GET /groups/my - Retrieve groups the user is a member of
router.get('/my', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT g.group_id, g.group_name, g.group_description, g.group_privacy, g.icon, g.creator_id, g.created_at, ug.role
    FROM groups_table g
    JOIN user_groups ug ON g.group_id = ug.group_id
    WHERE ug.user_id = ?
    ORDER BY g.created_at DESC
  `;
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching user groups:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// GET /groups/:groupId/posts/:postId/liked - Get like status for a group post
router.get('/:groupId/posts/:postId/liked', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    SELECT COUNT(*) AS liked
    FROM group_likes
    WHERE group_post_id = ? AND user_id = ?
  `;
  connection.query(query, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error checking group post like status:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ liked: results[0].liked > 0 });
  });
});

// DELETE /groups/:groupId/posts/:postId/like - Unlike a group post
router.delete('/:groupId/posts/:postId/like', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const userId = req.user.userId;
  const query = 'DELETE FROM group_likes WHERE group_post_id = ? AND user_id = ?';
  connection.query(query, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error unliking group post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Like not found or already removed' });
    }
    res.json({ message: 'Group post unliked successfully' });
  });
});

// DELETE /groups/:groupId/posts/:postId - Delete a post in a group
router.delete('/:groupId/posts/:postId', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    DELETE FROM group_posts 
    WHERE group_post_id = ? 
      AND group_id = ? 
      AND user_id = ?
  `;
  connection.query(query, [postId, groupId, userId], (err, results) => {
    if (err) {
      console.error("Error deleting group post:", err);
      return res.status(500).json({ error: 'Error deleting post' });
    }
    if (results.affectedRows === 0) {
      // This may indicate that the post doesn't exist or that the user isn't authorized.
      return res.status(404).json({ error: 'Post not found or not authorized' });
    }
    res.json({ message: 'Post deleted successfully' });
  });
});

// GET /groups/:groupId/comments/:commentId/liked - Get like status for a group comment
router.get('/:groupId/comments/:commentId/liked', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const userId = req.user.userId;
  const query = `
    SELECT 
      COUNT(*) AS likeCount,
      SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS userLiked
    FROM group_comment_likes
    WHERE group_comment_id = ?
  `;
  connection.query(query, [userId, commentId], (err, results) => {
    if (err) {
      console.error("Error fetching group comment like status:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    const likeCount = results[0].likeCount;
    const liked = results[0].userLiked > 0;
    res.json({ likeCount, liked });
  });
});

// GET /groups/:groupId/members - Retrieve all members of a group
router.get('/:groupId/members', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const query = `
    SELECT u.user_id, u.username, u.email, u.profile_picture_url, ug.role, ug.joined_at
    FROM user_groups ug
    JOIN users u ON ug.user_id = u.user_id
    WHERE ug.group_id = ?
    ORDER BY u.username ASC
  `;
  connection.query(query, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching group members:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// GET /groups/:groupId/members - Retrieve all members of a group
router.get('/:groupId/members', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const query = `
    SELECT u.user_id, u.username, u.email, u.profile_picture_url, ug.role, ug.joined_at
    FROM user_groups ug
    JOIN users u ON ug.user_id = u.user_id
    WHERE ug.group_id = ?
    ORDER BY u.username ASC
  `;
  connection.query(query, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching group members:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// POST /groups - Create a new group
router.post('/', authenticateToken, (req, res) => {
  const creatorId = req.user.userId;
  const { group_name, group_description, group_privacy, icon } = req.body;
  if (!group_name) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  const query = `
    INSERT INTO groups_table (group_name, group_description, group_privacy, icon, creator_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  connection.query(query, [group_name, group_description || '', group_privacy || 'public', icon || '👥', creatorId], (err, results) => {
    if (err) {
      console.error('Error creating group:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    const groupId = results.insertId;
    // Automatically add creator as owner
    const joinQuery = `
      INSERT INTO user_groups (user_id, group_id, role)
      VALUES (?, ?, 'owner')
    `;
    connection.query(joinQuery, [creatorId, groupId], (joinErr) => {
      if (joinErr) {
        console.error('Error joining group:', joinErr);
        return res.status(500).json({ error: 'Database error on join' });
      }
      res.json({ message: 'Group created successfully', groupId });
    });
  });
});

// GET /groups/:groupId/membership - Check if current user is a member of the group
router.get('/:groupId/membership', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const userId = req.user.userId;
  const query = 'SELECT role, joined_at FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(query, [groupId, userId], (err, results) => {
    if (err) {
      console.error('Error checking group membership:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length > 0) {
      return res.json({ isMember: true, role: results[0].role, joinedAt: results[0].joined_at });
    }
    res.json({ isMember: false });
  });
});

// POST /groups/:groupId/join - Join a group
router.post('/:groupId/join', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const groupId = req.params.groupId;
  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required' });
  }
  const checkQuery = 'SELECT * FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(checkQuery, [groupId, userId], (err, results) => {
    if (err) {
      console.error('Error checking membership:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length > 0) {
      return res.status(400).json({ error: 'Already a member' });
    }
    const query = 'INSERT INTO user_groups (user_id, group_id, role) VALUES (?, ?, "member")';
    connection.query(query, [userId, groupId], (err, results) => {
      if (err) {
        console.error('Error joining group:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Joined group successfully' });
    });
  });
});

// POST /groups/:groupId/leave - Leave a group
router.post('/:groupId/leave', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const groupId = req.params.groupId;
  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required' });
  }
  const query = `
    DELETE FROM user_groups
    WHERE user_id = ? AND group_id = ?
  `;
  connection.query(query, [userId, groupId], (err, results) => {
    if (err) {
      console.error('Error leaving group:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Not a member of this group' });
    }
    res.json({ message: 'Left group successfully' });
  });
});

/* ---------- Group Posts and Notifications ---------- */

// GET /groups/:groupId/posts - Retrieve all posts for a given group
router.get('/:groupId/posts', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const query = `
    SELECT 
      gp.group_post_id AS post_id, 
      gp.group_id, 
      gp.user_id, 
      gp.content, 
      gp.created_at,
      u.username, 
      u.profile_picture_url
    FROM group_posts gp
    JOIN users u ON gp.user_id = u.user_id
    WHERE gp.group_id = ?
    ORDER BY gp.created_at DESC
  `;
  connection.query(query, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching group posts:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// POST /groups/:groupId/posts - Create a new post in a group
router.post('/:groupId/posts', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const userId = req.user.userId;
  const { content } = req.body;
  
  if (!content || content.trim() === "") {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  const insertQuery = `
    INSERT INTO group_posts (group_id, user_id, content)
    VALUES (?, ?, ?)
  `;
  connection.query(insertQuery, [groupId, userId, content], (err, insertResult) => {
    if (err) {
      console.error("Error inserting group post:", err);
      return res.status(500).json({ error: 'Error posting in group' });
    }
    const newGroupPostId = insertResult.insertId;
    const selectQuery = `
      SELECT 
        gp.group_post_id AS post_id,
        gp.group_id,
        gp.user_id,
        gp.content,
        gp.created_at,
        u.username,
        u.profile_picture_url
      FROM group_posts gp
      JOIN users u ON gp.user_id = u.user_id
      WHERE gp.group_post_id = ?
    `;
    connection.query(selectQuery, [newGroupPostId], (err2, rows) => {
      if (err2) {
        console.error("Error selecting new group post:", err2);
        return res.status(500).json({ error: 'Database error selecting new group post' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Group post not found after insert' });
      }
      // Create a notification for group members (if desired, notify owner or all members)
      const post = rows[0];
      if (post.user_id !== userId) {
        createNotification({
          user_id: post.user_id,
          notification_type: 'GROUP_POST_CREATED',
          reference_id: newGroupPostId,
          actor_id: userId,
          reference_type: 'group_post',
          message: 'New group post'
        });
      }
      res.json(post);
    });
  });
});

// GET /groups/:groupId/posts/:postId/likes/count - Get like count for a group post
router.get('/:groupId/posts/:postId/likes/count', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const countQuery = `
    SELECT COUNT(*) AS likeCount
    FROM group_likes
    WHERE group_post_id = ?
  `;
  connection.query(countQuery, [postId], (err, results) => {
    if (err) {
      console.error('Error fetching group post like count:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ likeCount: results[0].likeCount });
  });
});

// POST /groups/:groupId/posts/:postId/like - Like a group post
router.post('/:groupId/posts/:postId/like', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const userId = req.user.userId;
  const insertLike = `
    INSERT INTO group_likes (group_post_id, user_id)
    VALUES (?, ?)
  `;
  connection.query(insertLike, [postId, userId], (err, results) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Post already liked by this user' });
      }
      console.error('Error liking group post:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    // Notify the post owner if not the actor
    const getPostQuery = 'SELECT user_id FROM group_posts WHERE group_post_id = ?';
    connection.query(getPostQuery, [postId], (err, postResults) => {
      if (!err && postResults.length > 0) {
        const postOwner = postResults[0].user_id;
        if (postOwner !== userId) {
          createNotification({
            user_id: postOwner,
            notification_type: 'GROUP_POST_LIKE',
            reference_id: postId,
            actor_id: userId,
            reference_type: 'group_post',
            message: 'Someone liked your group post'
          });
        }
      }
    });
    res.json({ message: 'Group post liked successfully' });
  });
});

/* ---------- Group Post Comments ---------- */

// GET /groups/:groupId/posts/:postId/comments - Retrieve all group comments for a post
router.get('/:groupId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const query = `
    SELECT gc.group_comment_id AS comment_id,
           gc.group_post_id AS post_id,
           gc.parent_comment_id,
           gc.user_id,
           gc.content,
           gc.created_at,
           u.username,
           u.profile_picture_url
    FROM group_comments gc
    JOIN users u ON gc.user_id = u.user_id
    WHERE gc.group_post_id = ?
    ORDER BY gc.created_at ASC
  `;
  connection.query(query, [postId], (err, results) => {
    if (err) {
      console.error("Error fetching group comments:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// POST /groups/:groupId/posts/:postId/comments - Create a new comment on a group post
router.post('/:groupId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const userId = req.user.userId;
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const insertQuery = `
    INSERT INTO group_comments (group_post_id, user_id, content)
    VALUES (?, ?, ?)
  `;
  connection.query(insertQuery, [postId, userId, content], (err, result) => {
    if (err) {
      console.error("Error inserting group comment:", err);
      return res.status(500).json({ error: 'Database error during insert' });
    }
    const newCommentId = result.insertId;
    const selectQuery = `
      SELECT 
        gc.group_comment_id AS comment_id,
        gc.group_post_id AS post_id,
        gc.user_id,
        gc.content,
        gc.created_at,
        u.username,
        u.profile_picture_url
      FROM group_comments gc
      JOIN users u ON gc.user_id = u.user_id
      WHERE gc.group_comment_id = ?
    `;
    connection.query(selectQuery, [newCommentId], (err, rows) => {
      if (err) {
        console.error("Error selecting new group comment:", err);
        return res.status(500).json({ error: 'Database error during select' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Group comment not found after insert' });
      }
      res.json(rows[0]);
    });
  });
});

// POST /groups/:groupId/comments/:commentId/like - Like a group comment
router.post('/:groupId/comments/:commentId/like', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const userId = req.user.userId;
  const insertQuery = `
    INSERT INTO group_comment_likes (group_comment_id, user_id)
    VALUES (?, ?)
  `;
  connection.query(insertQuery, [commentId, userId], (err, results) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Comment already liked by this user' });
      }
      console.error("Error liking group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    // Notify the comment owner if not the actor
    const getCommentQuery = 'SELECT user_id FROM group_comments WHERE group_comment_id = ?';
    connection.query(getCommentQuery, [commentId], (err, commentResults) => {
      if (!err && commentResults.length > 0) {
        const commentOwner = commentResults[0].user_id;
        if (commentOwner !== userId) {
          createNotification({
            user_id: commentOwner,
            notification_type: 'GROUP_COMMENT_LIKE',
            reference_id: commentId,
            actor_id: userId,
            reference_type: 'group_comment',
            message: 'Someone liked your group comment'
          });
        }
      }
    });
    res.json({ message: 'Group comment liked successfully' });
  });
});

// POST /groups/:groupId/comments/:commentId/reply - Reply to a group comment
router.post('/:groupId/comments/:commentId/reply', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const userId = req.user.userId;
  const { content, groupPostId } = req.body;  // groupPostId must be provided by the client
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const insertQuery = `
    INSERT INTO group_comments (group_post_id, parent_comment_id, user_id, content)
    VALUES (?, ?, ?, ?)
  `;
  connection.query(insertQuery, [groupPostId, commentId, userId, content], (err, result) => {
    if (err) {
      console.error("Error inserting group reply:", err);
      return res.status(500).json({ error: 'Database error during insert' });
    }
    const newCommentId = result.insertId;
    const selectQuery = `
      SELECT 
        gc.group_comment_id AS comment_id,
        gc.group_post_id AS post_id,
        gc.parent_comment_id,
        gc.user_id,
        gc.content,
        gc.created_at,
        u.username,
        u.profile_picture_url
      FROM group_comments gc
      JOIN users u ON gc.user_id = u.user_id
      WHERE gc.group_comment_id = ?
    `;
    connection.query(selectQuery, [newCommentId], (err, rows) => {
      if (err) {
        console.error("Error selecting new group reply:", err);
        return res.status(500).json({ error: 'Database error during select' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Reply not found after insert' });
      }
      // Notify the parent comment's owner if not the actor
      const getParentQuery = 'SELECT user_id FROM group_comments WHERE group_comment_id = ?';
      connection.query(getParentQuery, [commentId], (err, parentResults) => {
        if (!err && parentResults.length > 0) {
          const parentOwner = parentResults[0].user_id;
          if (parentOwner !== userId) {
            createNotification({
              user_id: parentOwner,
              notification_type: 'GROUP_COMMENT_REPLY',
              reference_id: newCommentId,
              actor_id: userId,
              reference_type: 'group_comment',
              message: 'Someone replied to your group comment'
            });
          }
        }
      });
      res.json(rows[0]);
    });
  });
});

// DELETE /groups/:groupId/comments/:commentId - Delete a group comment
router.delete('/:groupId/comments/:commentId', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const userId = req.user.userId;
  const deleteQuery = `
    DELETE FROM group_comments
    WHERE group_comment_id = ? AND user_id = ?
  `;
  connection.query(deleteQuery, [commentId, userId], (err, results) => {
    if (err) {
      console.error("Error deleting group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Group comment not found or unauthorized' });
    }
    res.json({ message: 'Group comment deleted successfully' });
  });
});

/* ---------- Group Management ---------- */

// GET /groups/:groupId - Retrieve basic details for a specific group
router.get('/:groupId', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const query = `
    SELECT group_id, group_name, group_description, group_privacy, icon, creator_id, created_at
    FROM groups_table
    WHERE group_id = ?
  `;
  connection.query(query, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching group details:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }
    res.json(results[0]);
  });
});

// DELETE /groups/:groupId/members/:userId - Remove a member from a group
router.delete('/:groupId/members/:userId', authenticateToken, (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const requesterId = req.user.userId;
  const checkRoleQuery = 'SELECT role FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(checkRoleQuery, [groupId, requesterId], (err, results) => {
    if (err) {
      console.error('Error checking role:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0 || (results[0].role !== 'owner' && results[0].role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const deleteQuery = 'DELETE FROM user_groups WHERE group_id = ? AND user_id = ?';
    connection.query(deleteQuery, [groupId, targetUserId], (err, results) => {
      if (err) {
        console.error('Error removing member:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Member removed from group' });
    });
  });
});

// PUT /groups/:groupId/members/:userId/admin - Promote a member to admin
router.put('/:groupId/members/:userId/admin', authenticateToken, (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const requesterId = req.user.userId;
  const checkRoleQuery = 'SELECT role FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(checkRoleQuery, [groupId, requesterId], (err, results) => {
    if (err) {
      console.error('Error checking role:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0 || results[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only group owner can promote members' });
    }
    const updateQuery = 'UPDATE user_groups SET role = "admin" WHERE group_id = ? AND user_id = ?';
    connection.query(updateQuery, [groupId, targetUserId], (err, results) => {
      if (err) {
        console.error('Error promoting member:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Member not found in group' });
      }
      res.json({ message: 'Member promoted to admin' });
    });
  });
});

// PUT /groups/:groupId/members/:userId/demote - Demote an admin to member
router.put('/:groupId/members/:userId/demote', authenticateToken, (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const requesterId = req.user.userId;
  const checkRoleQuery = 'SELECT role FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(checkRoleQuery, [groupId, requesterId], (err, results) => {
    if (err) {
      console.error('Error checking role:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0 || results[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only group owner can demote admins' });
    }
    const updateQuery = 'UPDATE user_groups SET role = "member" WHERE group_id = ? AND user_id = ?';
    connection.query(updateQuery, [groupId, targetUserId], (err, results) => {
      if (err) {
        console.error('Error demoting admin:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Member not found in group' });
      }
      res.json({ message: 'Admin demoted to member' });
    });
  });
});

// DELETE /groups/:groupId/members/:userId/posts - Remove all posts by a member in a group
router.delete('/:groupId/members/:userId/posts', authenticateToken, (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const requesterId = req.user.userId;
  const checkRoleQuery = 'SELECT role FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(checkRoleQuery, [groupId, requesterId], (err, results) => {
    if (err) {
      console.error('Error checking role:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0 || (results[0].role !== 'owner' && results[0].role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const deleteQuery = 'DELETE FROM group_posts WHERE group_id = ? AND user_id = ?';
    connection.query(deleteQuery, [groupId, targetUserId], (err, results) => {
      if (err) {
        console.error('Error deleting group posts:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'All posts by member removed from group' });
    });
  });
});

export default router;
