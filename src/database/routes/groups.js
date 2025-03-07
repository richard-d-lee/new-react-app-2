import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../helpers/notificationsSideEffect.js';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const absoluteUploadsPath = "C:\\Users\\rever\\react-app\\src\\database\\uploads";
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, absoluteUploadsPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = uuidv4() + ext;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

const router = express.Router();

/* ---------- Group Comment Like Endpoint ---------- */
// GET /groups/:groupId/comments/:commentId/liked - Get like status for a group comment
router.get('/:groupId/comments/:commentId/liked', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const userId = req.user.userId;
  const query = `
    SELECT 
      COUNT(*) AS likeCount,
      IFNULL(SUM(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END), 0) AS userLiked
    FROM comment_likes cl
    JOIN comments c ON cl.comment_id = c.comment_id
    JOIN posts p ON c.post_id = p.post_id
    WHERE c.comment_id = ? AND p.group_id = ?
  `;
  connection.query(query, [userId, commentId, groupId], (err, results) => {
    if (err) {
      console.error("Error fetching group comment like status:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!results || results.length === 0) {
      return res.json({ likeCount: 0, liked: false });
    }
    const likeCount = results[0].likeCount;
    const liked = results[0].userLiked > 0;
    res.json({ likeCount, liked });
  });
});

// DELETE /groups/:groupId/comments/:commentId/like - Unlike a group comment and remove its notification
router.delete('/:groupId/comments/:commentId/like', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const userId = req.user.userId;
  const deleteQuery = `
    DELETE FROM comment_likes
    WHERE comment_id = ? AND user_id = ?
  `;
  connection.query(deleteQuery, [commentId, userId], (err, results) => {
    if (err) {
      console.error("Error unliking group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Like not found or already removed' });
    }
    // Delete associated notification (assumes notification_type is 'GROUP_COMMENT_LIKE' and reference_id is the commentId)
    const deleteNotificationQuery = `
      DELETE FROM notifications
      WHERE reference_id = ? AND notification_type = 'GROUP_COMMENT_LIKE' AND actor_id = ?
    `;
    connection.query(deleteNotificationQuery, [commentId, userId], (err2) => {
      if (err2) {
        console.error("Error deleting notification for group comment like:", err2);
        // Proceed even if notification deletion fails
      }
      res.json({ message: 'Group comment like removed successfully' });
    });
  });
});

/**
 * CREATE a Group
 * POST /groups
 */
router.post('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { group_name, group_description, group_privacy, icon } = req.body;

  if (!group_name) {
    return res.status(400).json({ error: 'Group name is required.' });
  }

  const insertGroupQuery = `
    INSERT INTO groups_table
      (creator_id, group_name, group_description, group_privacy, icon)
    VALUES (?, ?, ?, ?, ?)
  `;
  connection.query(
    insertGroupQuery,
    [
      userId,
      group_name,
      group_description || '',
      group_privacy || 'public',
      icon || null
    ],
    (err, results) => {
      if (err) {
        console.error('Error creating group:', err);
        return res.status(500).json({ error: 'Database error.' });
      }
      const newGroupId = results.insertId;
      const insertMembershipQuery = `
        INSERT INTO user_groups (user_id, group_id, role)
        VALUES (?, ?, 'owner')
      `;
      connection.query(insertMembershipQuery, [userId, newGroupId], (err2) => {
        if (err2) {
          console.error('Error adding user as owner to new group:', err2);
          return res.status(500).json({ error: 'Database error adding membership.' });
        }
        return res.status(201).json({
          groupId: newGroupId,
          message: 'Group created successfully and user added as owner.'
        });
      });
    }
  );
});

/**
 * GET group members
 * GET /groups/:groupId/members
 * Filters out members that are in a block relationship with the current user.
 */
router.get('/:groupId/members', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const currentUser = req.user.userId;
  const query = `
    SELECT 
      u.user_id, 
      u.username, 
      u.email, 
      u.profile_picture_url, 
      ug.role, 
      ug.joined_at
    FROM user_groups ug
    JOIN users u ON ug.user_id = u.user_id
    WHERE ug.group_id = ?
      AND u.user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    ORDER BY u.username ASC
  `;
  connection.query(query, [groupId, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching group members:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

/**
 * PUT /groups/:groupId/logo - Update a group's logo (owner only)
 */
router.put('/:groupId/logo', authenticateToken, upload.single('logo'), (req, res) => {
  const groupId = req.params.groupId;
  const userId = req.user.userId;
  if (!req.file) {
    return res.status(400).json({ error: 'No logo file uploaded' });
  }
  const ownershipQuery = 'SELECT creator_id FROM groups_table WHERE group_id = ? LIMIT 1';
  connection.query(ownershipQuery, [groupId], (err, rows) => {
    if (err) {
      console.error('Error checking group ownership:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!rows.length) {
      return res.status(404).json({ error: 'Group not found' });
    }
    if (rows[0].creator_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to update group logo' });
    }
    const filename = req.file.filename;
    const imagePath = `/uploads/${filename}`;
    const updateQuery = 'UPDATE groups_table SET icon = ? WHERE group_id = ?';
    connection.query(updateQuery, [imagePath, groupId], (err2) => {
      if (err2) {
        console.error('Error updating group logo:', err2);
        return res.status(500).json({ error: 'Database error updating logo' });
      }
      res.json({ message: 'Group logo updated successfully', icon: imagePath });
    });
  });
});

/* ---------- Group Creation and Membership ---------- */
// GET /groups - Retrieve all groups, excluding those created by users in a block relationship with the current user.
router.get('/', authenticateToken, (req, res) => {
  const currentUser = req.user.userId;
  const query = `
    SELECT group_id, group_name, group_description, group_privacy, icon, creator_id, created_at
    FROM groups_table
    WHERE creator_id NOT IN (
      SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
      UNION
      SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
    )
    ORDER BY created_at DESC
  `;
  connection.query(query, [currentUser, currentUser], (err, results) => {
    if (err) {
      console.error('Error fetching groups:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// GET /groups/my - Retrieve groups the user is a member of, excluding groups whose creator is blocked.
router.get('/my', authenticateToken, (req, res) => {
  const currentUser = req.user.userId;
  const query = `
    SELECT g.group_id, g.group_name, g.group_description, g.group_privacy, g.icon, g.creator_id, g.created_at, ug.role
    FROM groups_table g
    JOIN user_groups ug ON g.group_id = ug.group_id
    WHERE ug.user_id = ?
      AND g.creator_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    ORDER BY g.created_at DESC
  `;
  connection.query(query, [currentUser, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error('Error fetching user groups:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// GET /groups/:groupId/membership - Check if current user is a member of the group
router.get('/:groupId/membership', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const currentUser = req.user.userId;
  const query = 'SELECT role, joined_at FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(query, [groupId, currentUser], (err, results) => {
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
  const currentUser = req.user.userId;
  const groupId = req.params.groupId;
  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required' });
  }
  const checkQuery = 'SELECT * FROM user_groups WHERE group_id = ? AND user_id = ?';
  connection.query(checkQuery, [groupId, currentUser], (err, results) => {
    if (err) {
      console.error('Error checking membership:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length > 0) {
      return res.status(400).json({ error: 'Already a member' });
    }
    const query = 'INSERT INTO user_groups (user_id, group_id, role) VALUES (?, ?, "member")';
    connection.query(query, [currentUser, groupId], (err) => {
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
  const currentUser = req.user.userId;
  const groupId = req.params.groupId;
  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required' });
  }
  const query = `
    DELETE FROM user_groups
    WHERE user_id = ? AND group_id = ?
  `;
  connection.query(query, [currentUser, groupId], (err, results) => {
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

/* ---------- Unified Group Posts Endpoints ---------- */
// GET /groups/:groupId/posts - Retrieve all group posts, excluding those created by blocked users.
router.get('/:groupId/posts', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const currentUser = req.user.userId;
  const query = `
    SELECT p.post_id, p.user_id, p.content, p.created_at, p.post_type, p.group_id,
           u.username, u.profile_picture_url
    FROM posts p
    JOIN users u ON p.user_id = u.user_id
    WHERE p.group_id = ? 
      AND p.post_type = 'group'
      AND p.user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    ORDER BY p.created_at DESC
  `;
  connection.query(query, [groupId, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching group posts:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// POST /groups/:groupId/posts - Create a new group post
router.post('/:groupId/posts', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const currentUser = req.user.userId;
  const { content } = req.body;
  if (!content || content.trim() === "") {
    return res.status(400).json({ error: 'Content is required' });
  }
  const insertQuery = `
    INSERT INTO posts (group_id, user_id, content, post_type)
    VALUES (?, ?, ?, 'group')
  `;
  connection.query(insertQuery, [groupId, currentUser, content], (err, insertResult) => {
    if (err) {
      console.error("Error inserting group post:", err);
      return res.status(500).json({ error: 'Error posting in group' });
    }
    const newPostId = insertResult.insertId;
    const selectQuery = `
      SELECT p.post_id, p.user_id, p.content, p.created_at, p.post_type, p.group_id,
             u.username, u.profile_picture_url
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.post_id = ?
    `;
    connection.query(selectQuery, [newPostId], (err2, rows) => {
      if (err2) {
        console.error("Error selecting new group post:", err2);
        return res.status(500).json({ error: 'Database error selecting new group post' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Group post not found after insert' });
      }
      res.json(rows[0]);
    });
  });
});

// GET /groups/:groupId/posts/:postId - Retrieve a single group post by ID, excluding posts from blocked users.
router.get('/:groupId/posts/:postId', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  const query = `
    SELECT 
      p.post_id, 
      p.group_id, 
      p.user_id, 
      p.content, 
      p.created_at, 
      p.post_type,
      u.username, 
      u.profile_picture_url
    FROM posts p
    JOIN users u ON p.user_id = u.user_id
    WHERE p.post_id = ? 
      AND p.group_id = ?
      AND p.user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(query, [postId, groupId, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching group post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Group post not found' });
    }
    res.json(results[0]);
  });
});

/* ---------- Group Post Likes Endpoints ---------- */
// GET /groups/:groupId/posts/:postId/likes/count - Get like count for a group post
router.get('/:groupId/posts/:postId/likes/count', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  // First, verify the post exists and is not from a blocked user.
  const postCheckQuery = `
    SELECT post_id FROM posts
    WHERE post_id = ? AND group_id = ?
      AND user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(postCheckQuery, [postId, groupId, currentUser, currentUser], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Group post not found' });
    }
    const countQuery = `
      SELECT COUNT(*) AS likeCount
      FROM likes
      WHERE post_id = ?
    `;
    connection.query(countQuery, [postId], (err, results) => {
      if (err) {
        console.error('Error fetching group post like count:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ likeCount: results[0].likeCount });
    });
  });
});

// GET /groups/:groupId/posts/:postId/liked - Get like status for a group post
router.get('/:groupId/posts/:postId/liked', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  // Verify the post exists and is not from a blocked user.
  const postCheckQuery = `
    SELECT post_id FROM posts
    WHERE post_id = ? AND group_id = ?
      AND user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(postCheckQuery, [postId, groupId, currentUser, currentUser], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Group post not found' });
    }
    const query = `
      SELECT COUNT(*) AS liked
      FROM likes
      WHERE post_id = ? AND user_id = ?
    `;
    connection.query(query, [postId, currentUser], (err, results) => {
      if (err) {
        console.error("Error checking group post like status:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ liked: results[0].liked > 0 });
    });
  });
});

// POST /groups/:groupId/posts/:postId/like - Like a group post
router.post('/:groupId/posts/:postId/like', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  // Verify that the post exists and is not from a blocked user.
  const postCheckQuery = `
    SELECT post_id FROM posts
    WHERE post_id = ? AND group_id = ?
      AND user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(postCheckQuery, [postId, groupId, currentUser, currentUser], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Group post not found' });
    }
    const insertLike = `
      INSERT INTO likes (post_id, user_id)
      VALUES (?, ?)
    `;
    connection.query(insertLike, [postId, currentUser], (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Post already liked by this user' });
        }
        console.error('Error liking group post:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      // Notify the post owner if not the actor.
      const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
      connection.query(getPostQuery, [postId], (err, postResults) => {
        if (!err && postResults.length > 0) {
          const postOwner = postResults[0].user_id;
          if (postOwner !== currentUser) {
            createNotification({
              user_id: postOwner,
              notification_type: 'GROUP_POST_LIKE',
              reference_id: postId,
              actor_id: currentUser,
              reference_type: 'group_post',
              group_id: groupId,
              message: 'Someone liked your group post'
            });
          }
        }
      });
      res.json({ message: 'Group post liked successfully' });
    });
  });
});

/* ---------- Unified Post Comments Endpoints ---------- */
// GET /groups/:groupId/posts/:postId/comments - Retrieve all comments for a group post, excluding comments by blocked users.
router.get('/:groupId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const currentUser = req.user.userId;
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
  connection.query(query, [postId, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching group post comments:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// POST /groups/:groupId/posts/:postId/comments - Create a new comment on a group post
router.post('/:groupId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const insertQuery = `
    INSERT INTO comments (post_id, user_id, content)
    VALUES (?, ?, ?)
  `;
  connection.query(insertQuery, [postId, currentUser, content], (err, result) => {
    if (err) {
      console.error("Error inserting group comment:", err);
      return res.status(500).json({ error: 'Database error during insert' });
    }
    const newCommentId = result.insertId;
    const selectQuery = `
      SELECT c.comment_id, c.post_id, c.user_id, c.content, c.created_at, c.parent_comment_id,
             u.username, u.profile_picture_url
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.comment_id = ?
        AND c.user_id NOT IN (
          SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
          UNION
          SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
        )
    `;
    connection.query(selectQuery, [newCommentId, currentUser, currentUser], (err, rows) => {
      if (err) {
        console.error("Error selecting new group comment:", err);
        return res.status(500).json({ error: 'Database error during select' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Group comment not found after insert' });
      }
      const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
      connection.query(getPostQuery, [postId], (err, postResults) => {
        if (err) {
          console.error("Error fetching group post owner:", err);
        } else if (postResults.length > 0) {
          const postOwner = postResults[0].user_id;
          if (postOwner !== currentUser) {
            createNotification({
              user_id: postOwner,
              notification_type: 'GROUP_POST_COMMENT',
              reference_id: newCommentId,
              actor_id: currentUser,
              reference_type: 'group_comment',
              group_id: groupId,
              message: 'commented on your group post'
            });
          }
        }
      });
      res.json(rows[0]);
    });
  });
});

// POST /groups/:groupId/comments/:commentId/like - Like a comment on a group post
router.post('/:groupId/comments/:commentId/like', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const currentUser = req.user.userId;
  const insertQuery = `
    INSERT INTO comment_likes (comment_id, user_id)
    VALUES (?, ?)
  `;
  connection.query(insertQuery, [commentId, currentUser], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Comment already liked by this user' });
      }
      console.error("Error liking group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    const getCommentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
    connection.query(getCommentQuery, [commentId], (err, commentResults) => {
      if (!err && commentResults.length > 0) {
        const commentOwner = commentResults[0].user_id;
        if (commentOwner !== currentUser) {
          createNotification({
            user_id: commentOwner,
            notification_type: 'GROUP_COMMENT_LIKE',
            reference_id: commentId,
            actor_id: currentUser,
            reference_type: 'group_comment',
            group_id: groupId,
            message: 'Someone liked your group comment'
          });
        }
      }
    });
    res.json({ message: 'Group comment liked successfully' });
  });
});

// POST /groups/:groupId/comments/:commentId/reply - Reply to a comment on a group post
router.post('/:groupId/comments/:commentId/reply', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const currentUser = req.user.userId;
  const { content, groupPostId } = req.body;  // groupPostId is optional
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const insertReply = (postIdValue) => {
    const insertQuery = `
      INSERT INTO comments (post_id, parent_comment_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `;
    connection.query(insertQuery, [postIdValue, commentId, currentUser, content], (err, result) => {
      if (err) {
        console.error("Error inserting group reply:", err);
        return res.status(500).json({ error: 'Database error during insert' });
      }
      const newCommentId = result.insertId;
      const selectQuery = `
        SELECT 
          c.comment_id, c.post_id, c.parent_comment_id, c.user_id, c.content, c.created_at,
          u.username, u.profile_picture_url
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.comment_id = ?
          AND c.user_id NOT IN (
            SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
            UNION
            SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
          )
      `;
      connection.query(selectQuery, [newCommentId, currentUser, currentUser], (err, rows) => {
        if (err) {
          console.error("Error selecting new group reply:", err);
          return res.status(500).json({ error: 'Database error during select' });
        }
        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Reply not found after insert' });
        }
        const getParentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
        connection.query(getParentQuery, [commentId], (err, parentResults) => {
          if (!err && parentResults.length > 0) {
            const parentOwner = parentResults[0].user_id;
            if (parentOwner !== currentUser) {
              createNotification({
                user_id: parentOwner,
                notification_type: 'GROUP_COMMENT_REPLY',
                reference_id: newCommentId,
                actor_id: currentUser,
                reference_type: 'group_comment',
                group_id: groupId,
                message: 'Someone replied to your group comment'
              });
            }
          }
        });
        res.json(rows[0]);
      });
    });
  };

  if (groupPostId) {
    insertReply(groupPostId);
  } else {
    const parentQuery = 'SELECT post_id FROM comments WHERE comment_id = ?';
    connection.query(parentQuery, [commentId], (err, results) => {
      if (err) {
        console.error("Error fetching parent's post_id:", err);
        return res.status(500).json({ error: 'Database error retrieving parent comment' });
      }
      if (!results || results.length === 0) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      const parentPostId = results[0].post_id;
      insertReply(parentPostId);
    });
  }
});

// GET /groups/:groupId/comments/:commentId - Retrieve a single comment for a group post
// Excludes comments authored by users in a blocking relationship with the current user.
router.get('/:groupId/comments/:commentId', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const currentUser = req.user.userId;
  const query = `
    SELECT 
      c.comment_id, 
      c.post_id, 
      c.user_id, 
      c.content, 
      c.created_at, 
      c.parent_comment_id,
      u.username, 
      u.profile_picture_url
    FROM comments c
    JOIN users u ON c.user_id = u.user_id
    JOIN posts p ON c.post_id = p.post_id
    WHERE c.comment_id = ? 
      AND p.group_id = ?
      AND c.user_id NOT IN (
         SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
         UNION
         SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(query, [commentId, groupId, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Group comment not found' });
    }
    res.json(results[0]);
  });
});

/* ---------- Group Management Endpoints ---------- */
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
    connection.query(deleteQuery, [groupId, targetUserId], (err) => {
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
    connection.query(updateQuery, [groupId, targetUserId], (err, results2) => {
      if (err) {
        console.error('Error promoting member:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results2.affectedRows === 0) {
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
    connection.query(updateQuery, [groupId, targetUserId], (err, results2) => {
      if (err) {
        console.error('Error demoting admin:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results2.affectedRows === 0) {
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
    const deleteQuery = 'DELETE FROM posts WHERE group_id = ? AND user_id = ? AND post_type = "group"';
    connection.query(deleteQuery, [groupId, targetUserId], (err, results2) => {
      if (err) {
        console.error('Error deleting group posts:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'All posts by member removed from group' });
    });
  });
});

/* ---------- Group Post Likes Endpoints ---------- */
// GET /groups/:groupId/posts/:postId/likes/count - Get like count for a group post
router.get('/:groupId/posts/:postId/likes/count', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  // Verify the post exists and isn't from a blocked user.
  const postCheckQuery = `
    SELECT post_id FROM posts
    WHERE post_id = ? AND group_id = ?
      AND user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(postCheckQuery, [postId, groupId, currentUser, currentUser], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Group post not found' });
    }
    const countQuery = `
      SELECT COUNT(*) AS likeCount
      FROM likes
      WHERE post_id = ?
    `;
    connection.query(countQuery, [postId], (err, results) => {
      if (err) {
        console.error('Error fetching group post like count:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ likeCount: results[0].likeCount });
    });
  });
});

// GET /groups/:groupId/posts/:postId/liked - Get like status for a group post
router.get('/:groupId/posts/:postId/liked', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  const postCheckQuery = `
    SELECT post_id FROM posts
    WHERE post_id = ? AND group_id = ?
      AND user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(postCheckQuery, [postId, groupId, currentUser, currentUser], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Group post not found' });
    }
    const query = `
      SELECT COUNT(*) AS liked
      FROM likes
      WHERE post_id = ? AND user_id = ?
    `;
    connection.query(query, [postId, currentUser], (err, results) => {
      if (err) {
        console.error("Error checking group post like status:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ liked: results[0].liked > 0 });
    });
  });
});

// POST /groups/:groupId/posts/:postId/like - Like a group post
router.post('/:groupId/posts/:postId/like', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  const postCheckQuery = `
    SELECT post_id FROM posts
    WHERE post_id = ? AND group_id = ?
      AND user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(postCheckQuery, [postId, groupId, currentUser, currentUser], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Group post not found' });
    }
    const insertLike = `
      INSERT INTO likes (post_id, user_id)
      VALUES (?, ?)
    `;
    connection.query(insertLike, [postId, currentUser], (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Post already liked by this user' });
        }
        console.error("Error liking group post:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
      connection.query(getPostQuery, [postId], (err, postResults) => {
        if (!err && postResults.length > 0) {
          const postOwner = postResults[0].user_id;
          if (postOwner !== currentUser) {
            createNotification({
              user_id: postOwner,
              notification_type: 'GROUP_POST_LIKE',
              reference_id: postId,
              actor_id: currentUser,
              reference_type: 'group_post',
              group_id: groupId,
              message: 'Someone liked your group post'
            });
          }
        }
      });
      res.json({ message: 'Group post liked successfully' });
    });
  });
});

/* ---------- Unified Post Comments Endpoints ---------- */
// GET /groups/:groupId/posts/:postId/comments - Retrieve all comments for a group post, excluding comments by blocked users.
router.get('/:groupId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const currentUser = req.user.userId;
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
  connection.query(query, [postId, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching group post comments:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// POST /groups/:groupId/posts/:postId/comments - Create a new comment on a group post
router.post('/:groupId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const insertQuery = `
    INSERT INTO comments (post_id, user_id, content)
    VALUES (?, ?, ?)
  `;
  connection.query(insertQuery, [postId, currentUser, content], (err, result) => {
    if (err) {
      console.error("Error inserting group comment:", err);
      return res.status(500).json({ error: 'Database error during insert' });
    }
    const newCommentId = result.insertId;
    const selectQuery = `
      SELECT c.comment_id, c.post_id, c.user_id, c.content, c.created_at, c.parent_comment_id,
             u.username, u.profile_picture_url
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.comment_id = ?
        AND c.user_id NOT IN (
          SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
          UNION
          SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
        )
    `;
    connection.query(selectQuery, [newCommentId, currentUser, currentUser], (err, rows) => {
      if (err) {
        console.error("Error selecting new group comment:", err);
        return res.status(500).json({ error: 'Database error during select' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Group comment not found after insert' });
      }
      const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
      connection.query(getPostQuery, [postId], (err, postResults) => {
        if (err) {
          console.error("Error fetching group post owner:", err);
        } else if (postResults.length > 0) {
          const postOwner = postResults[0].user_id;
          if (postOwner !== currentUser) {
            createNotification({
              user_id: postOwner,
              notification_type: 'GROUP_POST_COMMENT',
              reference_id: newCommentId,
              actor_id: currentUser,
              reference_type: 'group_comment',
              group_id: groupId,
              message: 'Someone commented on your group post'
            });
          }
        }
      });
      res.json(rows[0]);
    });
  });
});

// POST /groups/:groupId/comments/:commentId/like - Like a comment on a group post
router.post('/:groupId/comments/:commentId/like', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const currentUser = req.user.userId;
  const insertQuery = `
    INSERT INTO comment_likes (comment_id, user_id)
    VALUES (?, ?)
  `;
  connection.query(insertQuery, [commentId, currentUser], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Comment already liked by this user' });
      }
      console.error("Error liking group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    const getCommentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
    connection.query(getCommentQuery, [commentId], (err, commentResults) => {
      if (!err && commentResults.length > 0) {
        const commentOwner = commentResults[0].user_id;
        if (commentOwner !== currentUser) {
          createNotification({
            user_id: commentOwner,
            notification_type: 'GROUP_COMMENT_LIKE',
            reference_id: commentId,
            actor_id: currentUser,
            reference_type: 'group_comment',
            group_id: groupId,
            message: 'Someone liked your group comment'
          });
        }
      }
    });
    res.json({ message: 'Group comment liked successfully' });
  });
});

// POST /groups/:groupId/comments/:commentId/reply - Reply to a comment on a group post
router.post('/:groupId/comments/:commentId/reply', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const currentUser = req.user.userId;
  const { content, groupPostId } = req.body;  // groupPostId is optional
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const insertReply = (postIdValue) => {
    const insertQuery = `
      INSERT INTO comments (post_id, parent_comment_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `;
    connection.query(insertQuery, [postIdValue, commentId, currentUser, content], (err, result) => {
      if (err) {
        console.error("Error inserting group reply:", err);
        return res.status(500).json({ error: 'Database error during insert' });
      }
      const newCommentId = result.insertId;
      const selectQuery = `
        SELECT 
          c.comment_id, c.post_id, c.parent_comment_id, c.user_id, c.content, c.created_at,
          u.username, u.profile_picture_url
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.comment_id = ?
          AND c.user_id NOT IN (
            SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
            UNION
            SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
          )
      `;
      connection.query(selectQuery, [newCommentId, currentUser, currentUser], (err, rows) => {
        if (err) {
          console.error("Error selecting new group reply:", err);
          return res.status(500).json({ error: 'Database error during select' });
        }
        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Reply not found after insert' });
        }
        const getParentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
        connection.query(getParentQuery, [commentId], (err, parentResults) => {
          if (!err && parentResults.length > 0) {
            const parentOwner = parentResults[0].user_id;
            if (parentOwner !== currentUser) {
              createNotification({
                user_id: parentOwner,
                notification_type: 'GROUP_COMMENT_REPLY',
                reference_id: newCommentId,
                actor_id: currentUser,
                reference_type: 'group_comment',
                group_id: groupId,
                message: 'Someone replied to your group comment'
              });
            }
          }
        });
        res.json(rows[0]);
      });
    });
  };

  if (groupPostId) {
    insertReply(groupPostId);
  } else {
    const parentQuery = 'SELECT post_id FROM comments WHERE comment_id = ?';
    connection.query(parentQuery, [commentId], (err, results) => {
      if (err) {
        console.error("Error fetching parent's post_id:", err);
        return res.status(500).json({ error: 'Database error retrieving parent comment' });
      }
      if (!results || results.length === 0) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      const parentPostId = results[0].post_id;
      insertReply(parentPostId);
    });
  }
});

// GET /groups/:groupId/comments/:commentId - Retrieve a single comment for a group post
// Excludes comments authored by users in a blocking relationship with the current user.
router.get('/:groupId/comments/:commentId', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const currentUser = req.user.userId;
  const query = `
    SELECT 
      c.comment_id, 
      c.post_id, 
      c.user_id, 
      c.content, 
      c.created_at, 
      c.parent_comment_id,
      u.username, 
      u.profile_picture_url
    FROM comments c
    JOIN users u ON c.user_id = u.user_id
    JOIN posts p ON c.post_id = p.post_id
    WHERE c.comment_id = ? 
      AND p.group_id = ?
      AND c.user_id NOT IN (
         SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
         UNION
         SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(query, [commentId, groupId, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Group comment not found' });
    }
    res.json(results[0]);
  });
});

/* ---------- Group Management Endpoints ---------- */
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
    connection.query(deleteQuery, [groupId, targetUserId], (err) => {
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
    connection.query(updateQuery, [groupId, targetUserId], (err, results2) => {
      if (err) {
        console.error('Error promoting member:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results2.affectedRows === 0) {
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
    connection.query(updateQuery, [groupId, targetUserId], (err, results2) => {
      if (err) {
        console.error('Error demoting admin:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results2.affectedRows === 0) {
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
    const deleteQuery = 'DELETE FROM posts WHERE group_id = ? AND user_id = ? AND post_type = "group"';
    connection.query(deleteQuery, [groupId, targetUserId], (err, results2) => {
      if (err) {
        console.error('Error deleting group posts:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'All posts by member removed from group' });
    });
  });
});

/* ---------- Group Post Likes Endpoints ---------- */
// GET /groups/:groupId/posts/:postId/likes/count - Get like count for a group post
router.get('/:groupId/posts/:postId/likes/count', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  const postCheckQuery = `
    SELECT post_id FROM posts
    WHERE post_id = ? AND group_id = ?
      AND user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(postCheckQuery, [postId, groupId, currentUser, currentUser], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Group post not found' });
    }
    const countQuery = `
      SELECT COUNT(*) AS likeCount
      FROM likes
      WHERE post_id = ?
    `;
    connection.query(countQuery, [postId], (err, results) => {
      if (err) {
        console.error('Error fetching group post like count:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ likeCount: results[0].likeCount });
    });
  });
});

// GET /groups/:groupId/posts/:postId/liked - Get like status for a group post
router.get('/:groupId/posts/:postId/liked', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  const postCheckQuery = `
    SELECT post_id FROM posts
    WHERE post_id = ? AND group_id = ?
      AND user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(postCheckQuery, [postId, groupId, currentUser, currentUser], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Group post not found' });
    }
    const query = `
      SELECT COUNT(*) AS liked
      FROM likes
      WHERE post_id = ? AND user_id = ?
    `;
    connection.query(query, [postId, currentUser], (err, results) => {
      if (err) {
        console.error("Error checking group post like status:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ liked: results[0].liked > 0 });
    });
  });
});

// POST /groups/:groupId/posts/:postId/like - Like a group post
router.post('/:groupId/posts/:postId/like', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  const postCheckQuery = `
    SELECT post_id FROM posts
    WHERE post_id = ? AND group_id = ?
      AND user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(postCheckQuery, [postId, groupId, currentUser, currentUser], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Group post not found' });
    }
    const insertLike = `
      INSERT INTO likes (post_id, user_id)
      VALUES (?, ?)
    `;
    connection.query(insertLike, [postId, currentUser], (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Post already liked by this user' });
        }
        console.error("Error liking group post:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
      connection.query(getPostQuery, [postId], (err, postResults) => {
        if (!err && postResults.length > 0) {
          const postOwner = postResults[0].user_id;
          if (postOwner !== currentUser) {
            createNotification({
              user_id: postOwner,
              notification_type: 'GROUP_POST_LIKE',
              reference_id: postId,
              actor_id: currentUser,
              reference_type: 'group_post',
              group_id: groupId,
              message: 'Someone liked your group post'
            });
          }
        }
      });
      res.json({ message: 'Group post liked successfully' });
    });
  });
});

/* ---------- Unified Post Comments Endpoints ---------- */
// GET /groups/:groupId/posts/:postId/comments - Retrieve all comments for a group post, excluding comments by blocked users.
router.get('/:groupId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const currentUser = req.user.userId;
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
  connection.query(query, [postId, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching group post comments:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// POST /groups/:groupId/posts/:postId/comments - Create a new comment on a group post
router.post('/:groupId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const insertQuery = `
    INSERT INTO comments (post_id, user_id, content)
    VALUES (?, ?, ?)
  `;
  connection.query(insertQuery, [postId, currentUser, content], (err, result) => {
    if (err) {
      console.error("Error inserting group comment:", err);
      return res.status(500).json({ error: 'Database error during insert' });
    }
    const newCommentId = result.insertId;
    const selectQuery = `
      SELECT c.comment_id, c.post_id, c.user_id, c.content, c.created_at, c.parent_comment_id,
             u.username, u.profile_picture_url
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.comment_id = ?
        AND c.user_id NOT IN (
          SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
          UNION
          SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
        )
    `;
    connection.query(selectQuery, [newCommentId, currentUser, currentUser], (err, rows) => {
      if (err) {
        console.error("Error selecting new group comment:", err);
        return res.status(500).json({ error: 'Database error during select' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Group comment not found after insert' });
      }
      const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
      connection.query(getPostQuery, [postId], (err, postResults) => {
        if (err) {
          console.error("Error fetching group post owner:", err);
        } else if (postResults.length > 0) {
          const postOwner = postResults[0].user_id;
          if (postOwner !== currentUser) {
            createNotification({
              user_id: postOwner,
              notification_type: 'GROUP_POST_COMMENT',
              reference_id: newCommentId,
              actor_id: currentUser,
              reference_type: 'group_comment',
              group_id: groupId,
              message: 'Someone commented on your group post'
            });
          }
        }
      });
      res.json(rows[0]);
    });
  });
});

// DELETE /groups/:groupId/posts/:postId/like - Unlike a group post and remove its notification
router.delete('/:groupId/posts/:postId/like', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  // Verify the post exists and isn't from a blocked user.
  const postCheckQuery = `
    SELECT post_id FROM posts
    WHERE post_id = ? AND group_id = ?
      AND user_id NOT IN (
        SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(postCheckQuery, [postId, groupId, currentUser, currentUser], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Group post not found' });
    }
    const deleteQuery = `
      DELETE FROM likes
      WHERE post_id = ? AND user_id = ?
    `;
    connection.query(deleteQuery, [postId, currentUser], (err, results) => {
      if (err) {
        console.error("Error unliking group post:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Like not found or already removed' });
      }
      // Delete associated notification (assumes notification_type is 'GROUP_POST_LIKE')
      const deleteNotificationQuery = `
        DELETE FROM notifications
        WHERE reference_id = ? AND notification_type = 'GROUP_POST_LIKE' AND actor_id = ?
      `;
      connection.query(deleteNotificationQuery, [postId, currentUser], (err2) => {
        if (err2) {
          console.error("Error deleting notification for group post like:", err2);
          // Proceed even if notification deletion fails
        }
        res.json({ message: 'Group post unliked successfully' });
      });
    });
  });
});


// DELETE /groups/:groupId/comments/:commentId - Delete a comment on a group post and remove its notifications
router.delete('/:groupId/comments/:commentId', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const currentUser = req.user.userId;
  
  // Delete only if the comment belongs to the current user
  const deleteQuery = `
    DELETE FROM comments
    WHERE comment_id = ? AND user_id = ?
  `;
  
  connection.query(deleteQuery, [commentId, currentUser], (err, results) => {
    if (err) {
      console.error("Error deleting group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Comment not found or not authorized' });
    }
    // Delete all notifications attached to this comment (covers likes, replies, or the original comment notification)
    const deleteNotificationQuery = `
      DELETE FROM notifications
      WHERE reference_id = ? AND reference_type = 'group_comment'
    `;
    connection.query(deleteNotificationQuery, [commentId], (err2) => {
      if (err2) {
        console.error("Error deleting notifications for group comment:", err2);
        // Proceed even if notification deletion fails
      }
      res.json({ message: 'Group comment deleted successfully' });
    });
  });
});


// DELETE /groups/:groupId/posts/:postId - Delete a group post and remove its notifications
router.delete('/:groupId/posts/:postId', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const currentUser = req.user.userId;
  
  // Check that the post exists, is a group post, and belongs to the current user
  const checkQuery = `
    SELECT post_id FROM posts
    WHERE post_id = ? AND group_id = ? AND user_id = ? AND post_type = 'group'
    LIMIT 1
  `;
  connection.query(checkQuery, [postId, groupId, currentUser], (err, posts) => {
    if (err) {
      console.error("Error checking group post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Group post not found or not authorized' });
    }
    
    // Delete the post
    const deleteQuery = `
      DELETE FROM posts
      WHERE post_id = ? AND group_id = ? AND user_id = ? AND post_type = 'group'
    `;
    connection.query(deleteQuery, [postId, groupId, currentUser], (err, results) => {
      if (err) {
        console.error("Error deleting group post:", err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Group post not found or not authorized' });
      }
      // Delete notifications attached to this group post (e.g. likes or comments notifications)
      const deleteNotificationQuery = `
        DELETE FROM notifications
        WHERE reference_id = ? AND reference_type = 'group_post'
      `;
      connection.query(deleteNotificationQuery, [postId], (err2) => {
        if (err2) {
          console.error("Error deleting notifications for group post:", err2);
          // Proceed even if notification deletion fails
        }
        res.json({ message: 'Group post deleted successfully' });
      });
    });
  });
});




// POST /groups/:groupId/comments/:commentId/like - Like a comment on a group post
router.post('/:groupId/comments/:commentId/like', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const currentUser = req.user.userId;
  const insertQuery = `
    INSERT INTO comment_likes (comment_id, user_id)
    VALUES (?, ?)
  `;
  connection.query(insertQuery, [commentId, currentUser], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Comment already liked by this user' });
      }
      console.error("Error liking group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    const getCommentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
    connection.query(getCommentQuery, [commentId], (err, commentResults) => {
      if (!err && commentResults.length > 0) {
        const commentOwner = commentResults[0].user_id;
        if (commentOwner !== currentUser) {
          createNotification({
            user_id: commentOwner,
            notification_type: 'GROUP_COMMENT_LIKE',
            reference_id: commentId,
            actor_id: currentUser,
            reference_type: 'group_comment',
            group_id: groupId,
            message: 'Someone liked your group comment'
          });
        }
      }
    });
    res.json({ message: 'Group comment liked successfully' });
  });
});

// POST /groups/:groupId/comments/:commentId/reply - Reply to a comment on a group post
router.post('/:groupId/comments/:commentId/reply', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const currentUser = req.user.userId;
  const { content, groupPostId } = req.body;  // groupPostId is optional
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const insertReply = (postIdValue) => {
    const insertQuery = `
      INSERT INTO comments (post_id, parent_comment_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `;
    connection.query(insertQuery, [postIdValue, commentId, currentUser, content], (err, result) => {
      if (err) {
        console.error("Error inserting group reply:", err);
        return res.status(500).json({ error: 'Database error during insert' });
      }
      const newCommentId = result.insertId;
      const selectQuery = `
        SELECT 
          c.comment_id, c.post_id, c.parent_comment_id, c.user_id, c.content, c.created_at,
          u.username, u.profile_picture_url
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.comment_id = ?
          AND c.user_id NOT IN (
            SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
            UNION
            SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
          )
      `;
      connection.query(selectQuery, [newCommentId, currentUser, currentUser], (err, rows) => {
        if (err) {
          console.error("Error selecting new group reply:", err);
          return res.status(500).json({ error: 'Database error during select' });
        }
        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Reply not found after insert' });
        }
        const getParentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
        connection.query(getParentQuery, [commentId], (err, parentResults) => {
          if (!err && parentResults.length > 0) {
            const parentOwner = parentResults[0].user_id;
            if (parentOwner !== currentUser) {
              createNotification({
                user_id: parentOwner,
                notification_type: 'GROUP_COMMENT_REPLY',
                reference_id: newCommentId,
                actor_id: currentUser,
                reference_type: 'group_comment',
                group_id: groupId,
                message: 'Someone replied to your group comment'
              });
            }
          }
        });
        res.json(rows[0]);
      });
    });
  };

  if (groupPostId) {
    insertReply(groupPostId);
  } else {
    const parentQuery = 'SELECT post_id FROM comments WHERE comment_id = ?';
    connection.query(parentQuery, [commentId], (err, results) => {
      if (err) {
        console.error("Error fetching parent's post_id:", err);
        return res.status(500).json({ error: 'Database error retrieving parent comment' });
      }
      if (!results || results.length === 0) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      const parentPostId = results[0].post_id;
      insertReply(parentPostId);
    });
  }
});

// GET /groups/:groupId/comments/:commentId - Retrieve a single comment for a group post
// Excludes comments authored by users in a blocking relationship with the current user.
router.get('/:groupId/comments/:commentId', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
  const currentUser = req.user.userId;
  const query = `
    SELECT 
      c.comment_id, 
      c.post_id, 
      c.user_id, 
      c.content, 
      c.created_at, 
      c.parent_comment_id,
      u.username, 
      u.profile_picture_url
    FROM comments c
    JOIN users u ON c.user_id = u.user_id
    JOIN posts p ON c.post_id = p.post_id
    WHERE c.comment_id = ? 
      AND p.group_id = ?
      AND c.user_id NOT IN (
         SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
         UNION
         SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    LIMIT 1
  `;
  connection.query(query, [commentId, groupId, currentUser, currentUser], (err, results) => {
    if (err) {
      console.error("Error fetching group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Group comment not found' });
    }
    res.json(results[0]);
  });
});

/* ---------- Group Management Endpoints ---------- */
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
    connection.query(deleteQuery, [groupId, targetUserId], (err) => {
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
    connection.query(updateQuery, [groupId, targetUserId], (err, results2) => {
      if (err) {
        console.error('Error promoting member:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results2.affectedRows === 0) {
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
    connection.query(updateQuery, [groupId, targetUserId], (err, results2) => {
      if (err) {
        console.error('Error demoting admin:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (results2.affectedRows === 0) {
        return res.status(404).json({ error: 'Member not found in group' });
      }
      res.json({ message: 'Admin demoted to member' });
    });
  });
});

// DELETE /groups/:groupId/members/:userId/posts - Remove all posts by a member in a group and delete their notifications
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
    // First, select all post IDs that will be deleted
    const selectPostsQuery = `
      SELECT post_id FROM posts
      WHERE group_id = ? AND user_id = ? AND post_type = "group"
    `;
    connection.query(selectPostsQuery, [groupId, targetUserId], (err, posts) => {
      if (err) {
        console.error('Error selecting group posts:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      const postIds = posts.map(p => p.post_id);
      // Delete the posts
      const deleteQuery = `
        DELETE FROM posts
        WHERE group_id = ? AND user_id = ? AND post_type = "group"
      `;
      connection.query(deleteQuery, [groupId, targetUserId], (err, results2) => {
        if (err) {
          console.error('Error deleting group posts:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        // If there were posts deleted, remove all notifications associated with those post IDs
        if (postIds.length > 0) {
          const deleteNotificationQuery = `
            DELETE FROM notifications
            WHERE reference_id IN (?) AND reference_type = 'group_post'
          `;
          connection.query(deleteNotificationQuery, [postIds], (err2) => {
            if (err2) {
              console.error("Error deleting notifications for group posts:", err2);
              // Proceed even if notification deletion fails
            }
            res.json({ message: 'All posts by member removed from group' });
          });
        } else {
          res.json({ message: 'All posts by member removed from group' });
        }
      });
    });
  });
});


export default router;
