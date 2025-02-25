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
    // If no rows are returned, return likeCount 0 and liked false
    if (!results || results.length === 0) {
      return res.json({ likeCount: 0, liked: false });
    }
    const likeCount = results[0].likeCount;
    const liked = results[0].userLiked > 0;
    res.json({ likeCount, liked });
  });
});

/**
 * DELETE /groups/:groupId/comments/:commentId/like - Unlike a group comment
 */
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
    res.json({ message: 'Group comment like removed successfully' });
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

  // Insert into groups_table
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

      // Insert creator into user_groups with role "owner"
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


router.get('/:groupId/members', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
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

/**
 * PUT /groups/:groupId/logo - Update a group's logo (owner only)
 */
router.put('/:groupId/logo', authenticateToken, upload.single('logo'), (req, res) => {
  const groupId = req.params.groupId;
  const userId = req.user.userId;

  // Check that a file was uploaded.
  if (!req.file) {
    return res.status(400).json({ error: 'No logo file uploaded' });
  }

  // Verify ownership of the group (assuming group owner is stored in 'creator_id').
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

    // Build the image path from the uploaded file.
    const filename = req.file.filename;
    const imagePath = `/uploads/${filename}`;

    // Update the group's logo (icon) in the database.
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
    connection.query(query, [userId, groupId], (err) => {
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

/* ---------- Unified Group Posts Endpoints ----------
  In this unified structure, group posts are stored in the posts table with:
    - post_type = 'group'
    - group_id set to the appropriate group ID
*/

// GET /groups/:groupId/posts - Retrieve all group posts
router.get('/:groupId/posts', authenticateToken, (req, res) => {
  const groupId = req.params.groupId;
  const query = `
    SELECT p.post_id, p.user_id, p.content, p.created_at, p.post_type, p.group_id,
           u.username, u.profile_picture_url
    FROM posts p
    JOIN users u ON p.user_id = u.user_id
    WHERE p.group_id = ? AND p.post_type = 'group'
    ORDER BY p.created_at DESC
  `;
  connection.query(query, [groupId], (err, results) => {
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
  const userId = req.user.userId;
  const { content } = req.body;
  if (!content || content.trim() === "") {
    return res.status(400).json({ error: 'Content is required' });
  }
  const insertQuery = `
    INSERT INTO posts (group_id, user_id, content, post_type)
    VALUES (?, ?, ?, 'group')
  `;
  connection.query(insertQuery, [groupId, userId, content], (err, insertResult) => {
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

// GET /groups/:groupId/posts/:postId - Retrieve a single group post by ID
router.get('/:groupId/posts/:postId', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
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
    WHERE p.post_id = ? AND p.group_id = ?
  `;
  connection.query(query, [postId, groupId], (err, results) => {
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


// DELETE /groups/:groupId/posts/:postId - Delete a group post
router.delete('/:groupId/posts/:postId', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    DELETE FROM posts 
    WHERE post_id = ? 
      AND group_id = ? 
      AND user_id = ?
      AND post_type = 'group'
  `;
  connection.query(query, [postId, groupId, userId], (err, results) => {
    if (err) {
      console.error("Error deleting group post:", err);
      return res.status(500).json({ error: 'Error deleting post' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Post not found or not authorized' });
    }
    res.json({ message: 'Post deleted successfully' });
  });
});

/* ---------- Unified Post Likes Endpoints ---------- */

// GET /groups/:groupId/posts/:postId/likes/count - Get like count for a group post
router.get('/:groupId/posts/:postId/likes/count', authenticateToken, (req, res) => {
  const { postId } = req.params;
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

// GET /groups/:groupId/posts/:postId/liked - Get like status for a group post
router.get('/:groupId/posts/:postId/liked', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;
  const query = `
    SELECT COUNT(*) AS liked
    FROM likes
    WHERE post_id = ? AND user_id = ?
  `;
  connection.query(query, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error checking group post like status:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ liked: results[0].liked > 0 });
  });
});

// POST /groups/:groupId/posts/:postId/like - Like a group post
router.post('/:groupId/posts/:postId/like', authenticateToken, (req, res) => {
  const { groupId, postId } = req.params;
  const userId = req.user.userId;
  const insertLike = `
    INSERT INTO likes (post_id, user_id)
    VALUES (?, ?)
  `;
  connection.query(insertLike, [postId, userId], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Post already liked by this user' });
      }
      console.error('Error liking group post:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    // Notify the post owner if not the actor. Force reference_type to 'group_post' if groupId exists.
    const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
    connection.query(getPostQuery, [postId], (err, postResults) => {
      if (!err && postResults.length > 0) {
        const postOwner = postResults[0].user_id;
        if (postOwner !== userId) {
          createNotification({
            user_id: postOwner,
            notification_type: 'GROUP_POST_LIKE',
            reference_id: postId,
            event_id: event_id,
            actor_id: userId,
            reference_type: groupId ? 'group_post' : 'post',
            group_id: groupId,
            message: 'Someone liked your group post'
          });
        }
      }
    });
    res.json({ message: 'Group post liked successfully' });
  });
});

// DELETE /groups/:groupId/posts/:postId/like - Unlike a group post
router.delete('/:groupId/posts/:postId/like', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;
  const query = 'DELETE FROM likes WHERE post_id = ? AND user_id = ?';
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

/* ---------- Unified Post Comments Endpoints ---------- */

// GET /groups/:groupId/posts/:postId/comments - Retrieve all comments for a group post
router.get('/:groupId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const query = `
    SELECT c.comment_id, c.post_id, c.user_id, c.content, c.created_at, c.parent_comment_id,
           u.username, u.profile_picture_url
    FROM comments c
    JOIN users u ON c.user_id = u.user_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `;
  connection.query(query, [postId], (err, results) => {
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
  const userId = req.user.userId;
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const insertQuery = `
    INSERT INTO comments (post_id, user_id, content)
    VALUES (?, ?, ?)
  `;
  connection.query(insertQuery, [postId, userId, content], (err, result) => {
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
    `;
    connection.query(selectQuery, [newCommentId], (err, rows) => {
      if (err) {
        console.error("Error selecting new group comment:", err);
        return res.status(500).json({ error: 'Database error during select' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Group comment not found after insert' });
      }
      // Notify the group post owner if not the same as the commenter.
      const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
      connection.query(getPostQuery, [postId], (err, postResults) => {
        if (err) {
          console.error("Error fetching group post owner:", err);
        } else if (postResults.length > 0) {
          const postOwner = postResults[0].user_id;
          if (postOwner !== userId) {
            createNotification({
              user_id: postOwner,
              notification_type: 'GROUP_POST_COMMENT',
              reference_id: newCommentId,
              actor_id: userId,
              reference_type: groupId ? 'group_comment' : 'comment',
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
  const userId = req.user.userId;
  const insertQuery = `
    INSERT INTO comment_likes (comment_id, user_id)
    VALUES (?, ?)
  `;
  connection.query(insertQuery, [commentId, userId], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Comment already liked by this user' });
      }
      console.error("Error liking group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    // Optionally notify the comment owner if not the actor
    const getCommentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
    connection.query(getCommentQuery, [commentId], (err, commentResults) => {
      if (!err && commentResults.length > 0) {
        const commentOwner = commentResults[0].user_id;
        if (commentOwner !== userId) {
          createNotification({
            user_id: commentOwner,
            notification_type: 'GROUP_COMMENT_LIKE',
            reference_id: commentId,
            actor_id: userId,
            reference_type: groupId ? 'group_comment' : 'comment',
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
  const userId = req.user.userId;
  const { content, groupPostId } = req.body;  // groupPostId is optional now
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  // Function to insert reply with a valid post_id
  const insertReply = (postIdValue) => {
    const insertQuery = `
      INSERT INTO comments (post_id, parent_comment_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `;
    connection.query(insertQuery, [postIdValue, commentId, userId, content], (err, result) => {
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
      `;
      connection.query(selectQuery, [newCommentId], (err, rows) => {
        if (err) {
          console.error("Error selecting new group reply:", err);
          return res.status(500).json({ error: 'Database error during select' });
        }
        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Reply not found after insert' });
        }
        // Optionally create a notification for the parent comment's owner
        const getParentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
        connection.query(getParentQuery, [commentId], (err, parentResults) => {
          if (!err && parentResults.length > 0) {
            const parentOwner = parentResults[0].user_id;
            if (parentOwner !== userId) {
              createNotification({
                user_id: parentOwner,
                notification_type: 'GROUP_COMMENT_REPLY',
                reference_id: newCommentId,
                actor_id: userId,
                reference_type: groupId ? 'group_comment' : 'comment',
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
router.get('/:groupId/comments/:commentId', authenticateToken, (req, res) => {
  const { groupId, commentId } = req.params;
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
    WHERE c.comment_id = ? AND p.group_id = ?
  `;
  connection.query(query, [commentId, groupId], (err, results) => {
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


// DELETE /groups/:groupId/comments/:commentId - Delete a comment on a group post
router.delete('/:groupId/comments/:commentId', authenticateToken, (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.userId;
  const deleteQuery = `
    DELETE FROM comments
    WHERE comment_id = ? AND user_id = ?
  `;
  connection.query(deleteQuery, [commentId, userId], (err, results) => {
    if (err) {
      console.error("Error deleting group comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Comment not found or unauthorized' });
    }
    res.json({ message: 'Group comment deleted successfully' });
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

export default router;
