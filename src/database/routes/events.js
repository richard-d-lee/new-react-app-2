import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../helpers/notificationsSideEffect.js';

// 1) The same absolute path as in server.js
const absoluteUploadsPath = "C:\\Users\\rever\\react-app\\src\\database\\uploads";

// 2) Configure multer diskStorage so files are saved with correct extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, absoluteUploadsPath);
  },
  filename: (req, file, cb) => {
    // For example, preserve the extension from the original name
    const ext = path.extname(file.originalname); // e.g. ".jpeg" or ".png"
    const uniqueName = uuidv4() + ext;           // e.g. "e2f08277-bb5b-4a78-8a9a-14f172bb508b.jpeg"
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

const router = express.Router();

/**
 * CREATE an Event
 * POST /events
 */
router.post('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const {
    event_name,
    event_description,
    event_location,
    start_time,
    end_time,
    event_privacy,
    event_image_url // optional if uploading via a separate route
  } = req.body;

  if (!event_name) {
    return res.status(400).json({ error: 'Event name is required.' });
  }

  const insertQuery = `
    INSERT INTO events
      (user_id, event_name, event_description, event_location, event_image_url, start_time, end_time, event_privacy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  connection.query(
    insertQuery,
    [
      userId,
      event_name,
      event_description || '',
      event_location || '',
      event_image_url || null,
      start_time || null,
      end_time || null,
      event_privacy || 'public'
    ],
    (err, results) => {
      if (err) {
        console.error('Error creating event:', err);
        return res.status(500).json({ error: 'Database error.' });
      }
      return res.status(201).json({
        event_id: results.insertId,
        message: 'Event created successfully.'
      });
    }
  );
});

/**
 * (Optional) UPLOAD an Event Image (owner only)
 * POST /events/:id/upload-image
 */
router.post('/:id/upload-image', authenticateToken, upload.single('image'), (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.userId;
  
    // 1) Check ownership
    const ownershipQuery = 'SELECT user_id FROM events WHERE event_id = ? LIMIT 1';
    connection.query(ownershipQuery, [eventId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!rows.length) {
        return res.status(404).json({ error: 'Event not found' });
      }
      if (rows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Not event owner.' });
      }
  
      // 2) We have the new filename from multer (e.g. "e2f08277...jpeg")
      const filename = req.file.filename;
      // We'll store "/uploads/e2f08277...jpeg" in the DB
      const imagePath = `/uploads/${filename}`;
  
      // 3) Update the event record
      const updateQuery = 'UPDATE events SET event_image_url = ? WHERE event_id = ?';
      connection.query(updateQuery, [imagePath, eventId], (err2) => {
        if (err2) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Event image uploaded.', event_image_url: imagePath });
      });
    });
  });

/**
 * GET a Single Event by ID
 * GET /events/:id
 */
router.get('/:id', authenticateToken, (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.userId;

  // Basic privacy logic: user can see public events or own events. Expand for 'friends_only' if needed
  const selectQuery = `
    SELECT *
      FROM events
     WHERE event_id = ?
       AND (
         event_privacy = 'public'
         OR user_id = ?
         OR event_privacy = 'friends_only'
         -- TODO: check if user is friend with event owner if 'friends_only'
       )
     LIMIT 1
  `;
  connection.query(selectQuery, [eventId, userId], (err, rows) => {
    if (err) {
      console.error('Error fetching event:', err);
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!rows.length) {
      return res.status(404).json({ error: 'Event not found or you do not have access.' });
    }
    res.json(rows[0]);
  });
});

/**
 * LIST / GET All Events
 * GET /events
 */
router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  // Show all public events or user-owned events
  const query = `
    SELECT *
      FROM events
     WHERE
       event_privacy = 'public'
       OR user_id = ?
     ORDER BY created_at DESC
  `;
  connection.query(query, [userId], (err, rows) => {
    if (err) {
      console.error('Error listing events:', err);
      return res.status(500).json({ error: 'Database error.' });
    }
    res.json(rows);
  });
});

/**
 * UPDATE an Event (owner only)
 * PATCH /events/:id
 */
router.patch('/:id', authenticateToken, (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.userId;
  const {
    event_name,
    event_description,
    event_location,
    start_time,
    end_time,
    event_privacy
  } = req.body;

  const ownershipQuery = 'SELECT user_id FROM events WHERE event_id = ? LIMIT 1';
  connection.query(ownershipQuery, [eventId], (err, rows) => {
    if (err) {
      console.error('Error checking ownership:', err);
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!rows.length) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'You are not the owner of this event.' });
    }

    // Update
    const updateQuery = `
      UPDATE events
         SET event_name = ?,
             event_description = ?,
             event_location = ?,
             start_time = ?,
             end_time = ?,
             event_privacy = ?
       WHERE event_id = ?
         AND user_id = ?
    `;
    connection.query(
      updateQuery,
      [
        event_name || null,
        event_description || null,
        event_location || null,
        start_time || null,
        end_time || null,
        event_privacy || 'public',
        eventId,
        userId
      ],
      (err2, results) => {
        if (err2) {
          console.error('Error updating event:', err2);
          return res.status(500).json({ error: 'Database error.' });
        }
        if (!results.affectedRows) {
          return res.status(404).json({ error: 'Event not found or not updated.' });
        }
        res.json({ message: 'Event updated successfully.' });
      }
    );
  });
});

/**
 * DELETE an Event (owner only)
 * DELETE /events/:id
 */
router.delete('/:id', authenticateToken, (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.userId;

  const ownershipQuery = 'SELECT user_id FROM events WHERE event_id = ? LIMIT 1';
  connection.query(ownershipQuery, [eventId], (err, rows) => {
    if (err) {
      console.error('Error checking ownership for delete:', err);
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!rows.length) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'You are not the owner of this event.' });
    }

  const deleteQuery = 'DELETE FROM events WHERE event_id = ? AND user_id = ?';
    connection.query(deleteQuery, [eventId, userId], (err2, results) => {
      if (err2) {
        console.error('Error deleting event:', err2);
        return res.status(500).json({ error: 'Database error.' });
      }
      if (!results.affectedRows) {
        return res.status(404).json({ error: 'Event not found.' });
      }
      res.json({ message: 'Event deleted successfully.' });
    });
  });
});

/**
 * INVITE an Attendee to an Event (owner only)
 * POST /events/:id/invite
 */
router.post('/:id/invite', authenticateToken, (req, res) => {
  const eventId = req.params.id;
  const { invitee_id } = req.body;
  const userId = req.user.userId;

  if (!invitee_id) {
    return res.status(400).json({ error: 'Invitee user_id is required.' });
  }

  const ownershipQuery = 'SELECT user_id FROM events WHERE event_id = ? LIMIT 1';
  connection.query(ownershipQuery, [eventId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!rows.length) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'You are not the owner of this event.' });
    }

    const upsertQuery = `
      INSERT INTO event_attendees (event_id, user_id, status)
      VALUES (?, ?, 'invited')
      ON DUPLICATE KEY UPDATE status='invited'
    `;
    connection.query(upsertQuery, [eventId, invitee_id], (err2) => {
      if (err2) {
        return res.status(500).json({ error: 'Database error.' });
      }
      res.json({ message: 'User invited to event.' });
    });
  });
});

/**
 * GET LIST of Attendees for an Event
 * GET /events/:id/attendees
 */
router.get('/:id/attendees', authenticateToken, (req, res) => {
  const eventId = req.params.id;
  const query = `
    SELECT ea.user_id, ea.status, u.username, u.profile_picture_url
      FROM event_attendees ea
      JOIN users u ON ea.user_id = u.user_id
     WHERE ea.event_id = ?
  `;
  connection.query(query, [eventId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error.' });
    }
    res.json(rows);
  });
});

/**
 * UPDATE ATTENDEE STATUS (going, interested, declined, etc.)
 * PATCH /events/:eventId/attendees/:userId
 */
router.patch('/:eventId/attendees/:userId', authenticateToken, (req, res) => {
  const { eventId, userId: attendeeId } = req.params;
  const { status } = req.body; // 'going', 'interested', 'invited', 'declined'
  const currentUser = req.user.userId;

  if (!['going', 'interested', 'invited', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const ownershipCheckQuery = 'SELECT user_id FROM events WHERE event_id = ? LIMIT 1';
  connection.query(ownershipCheckQuery, [eventId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!rows.length) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const eventOwner = rows[0].user_id;
    // If currentUser isn't the attendee or eventOwner, not allowed
    if (currentUser !== attendeeId && currentUser !== eventOwner) {
      return res.status(403).json({ error: 'Not authorized to update this attendee status.' });
    }

    const updateAttendeeQuery = `
      UPDATE event_attendees
         SET status = ?
       WHERE event_id = ?
         AND user_id = ?
    `;
    connection.query(updateAttendeeQuery, [status, eventId, attendeeId], (err2, results) => {
      if (err2) {
        return res.status(500).json({ error: 'Database error.' });
      }
      if (!results.affectedRows) {
        return res.status(404).json({ error: 'No matching attendee found.' });
      }
      res.json({ message: 'Attendee status updated successfully.' });
    });
  });
});

/**
 * GET /events/:eventId/posts - Retrieve all posts for an event
 */
router.get('/:eventId/posts', authenticateToken, (req, res) => {
  const { eventId } = req.params;
  const query = `
    SELECT p.post_id, p.user_id, p.content, p.created_at, p.post_type, p.event_id,
           u.username, u.profile_picture_url
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
     WHERE p.event_id = ?
       AND p.post_type = 'event'
     ORDER BY p.created_at DESC
  `;
  connection.query(query, [eventId], (err, results) => {
    if (err) {
      console.error("Error fetching event posts:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

/**
 * CREATE A POST for an EVENT
 * POST /events/:eventId/posts
 */
router.post('/:eventId/posts', authenticateToken, (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.userId;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const insertQuery = `
    INSERT INTO posts (event_id, user_id, content, post_type)
    VALUES (?, ?, ?, 'event')
  `;
  connection.query(insertQuery, [eventId, userId, content], (err, result) => {
    if (err) {
      console.error("Error inserting event post:", err);
      return res.status(500).json({ error: 'Database error inserting post' });
    }
    const newPostId = result.insertId;

    const selectQuery = `
      SELECT p.post_id, p.user_id, p.content, p.created_at, p.post_type, p.event_id,
             u.username, u.profile_picture_url
        FROM posts p
        JOIN users u ON p.user_id = u.user_id
       WHERE p.post_id = ?
    `;
    connection.query(selectQuery, [newPostId], (err2, rows) => {
      if (err2) {
        console.error("Error selecting new event post:", err2);
        return res.status(500).json({ error: 'Database error selecting new event post' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Event post not found after insert' });
      }

      // If someone other than the event owner posted, create a notification
      const eventQuery = 'SELECT user_id, event_name FROM events WHERE event_id = ?';
      connection.query(eventQuery, [eventId], (err3, eventResults) => {
        if (!err3 && eventResults.length > 0) {
          const eventCreatorId = eventResults[0].user_id;
          if (eventCreatorId !== userId) {
            createNotification({
              user_id: eventCreatorId,
              notification_type: 'EVENT_POST',
              reference_id: newPostId,
              actor_id: userId,
              reference_type: 'event_post',
              event_id: eventId,
              message: `posted on your event "${eventResults[0].event_name}". Click to view.`,
              url: `/events/${eventId}?post=${newPostId}`
            });
          }
        }
      });
      res.json(rows[0]);
    });
  });
});

/**
 * POST /events/:eventId/posts/:postId/comments - Create a new comment on an event post
 */
router.post('/:eventId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { eventId, postId } = req.params;
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
      console.error("Error inserting event comment:", err);
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
    connection.query(selectQuery, [newCommentId], (err2, rows) => {
      if (err2) {
        console.error("Error selecting new event comment:", err2);
        return res.status(500).json({ error: 'Database error during select' });
      }
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Event comment not found after insert' });
      }

      // Optionally, notify the event post owner if the commenter is not the owner.
      const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
      connection.query(getPostQuery, [postId], (err3, postResults) => {
        if (!err3 && postResults.length > 0) {
          const postOwner = postResults[0].user_id;
          if (postOwner !== userId) {
            createNotification({
              user_id: postOwner,
              notification_type: 'EVENT_POST_COMMENT',
              reference_id: newCommentId,
              actor_id: userId,
              reference_type: 'event_comment',
              event_id: eventId,
              message: 'commented on your event post'
            });
          }
        }
      });
      res.json(rows[0]);
    });
  });
});

/**
 * GET /events/:eventId/posts/:postId/comments - Retrieve comments for an event post
 */
router.get('/:eventId/posts/:postId/comments', authenticateToken, (req, res) => {
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
      console.error("Error fetching event post comments:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

/**
 * DELETE /events/:eventId/posts/:postId - Delete an event post
 */
router.delete('/:eventId/posts/:postId', authenticateToken, (req, res) => {
  const { eventId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    DELETE FROM posts
    WHERE post_id = ?
      AND event_id = ?
      AND user_id = ?
      AND post_type = 'event'
  `;
  connection.query(query, [postId, eventId, userId], (err, results) => {
    if (err) {
      console.error("Error deleting event post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Event post not found or not authorized' });
    }
    res.json({ message: 'Event post deleted successfully' });
  });
});

/**
 * LIKE / UNLIKE Endpoints
 */

// POST /events/:eventId/posts/:postId/like - Like an event post
router.post('/:eventId/posts/:postId/like', authenticateToken, (req, res) => {
  const { eventId, postId } = req.params;
  const userId = req.user.userId;
  const insertLikeQuery = `
    INSERT INTO likes (post_id, user_id)
    VALUES (?, ?)
  `;
  connection.query(insertLikeQuery, [postId, userId], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Post already liked by this user' });
      }
      console.error("Error liking event post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    // Notify post owner if needed
    const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
    connection.query(getPostQuery, [postId], (err2, postResults) => {
      if (!err2 && postResults.length > 0) {
        const postOwner = postResults[0].user_id;
        if (postOwner !== userId) {
          createNotification({
            user_id: postOwner,
            notification_type: 'EVENT_POST_LIKE',
            reference_id: postId,
            actor_id: userId,
            reference_type: 'event_post',
            event_id: eventId,
            message: 'liked your event post'
          });
        }
      }
    });
    res.json({ message: 'Event post liked successfully' });
  });
});

// DELETE /events/:eventId/posts/:postId/like - Unlike an event post
router.delete('/:eventId/posts/:postId/like', authenticateToken, (req, res) => {
  const { eventId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    DELETE FROM likes
    WHERE post_id = ? AND user_id = ?
  `;
  connection.query(query, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error unliking event post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Like not found or already removed' });
    }
    res.json({ message: 'Event post unliked successfully' });
  });
});

// GET /events/:eventId/posts/:postId/likes/count - Get like count for an event post
router.get('/:eventId/posts/:postId/likes/count', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const query = `
    SELECT COUNT(*) AS likeCount
    FROM likes
    WHERE post_id = ?
  `;
  connection.query(query, [postId], (err, results) => {
    if (err) {
      console.error('Error fetching event post like count:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ likeCount: results[0].likeCount });
  });
});

// GET /events/:eventId/posts/:postId/liked - Get like status for an event post
router.get('/:eventId/posts/:postId/liked', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;
  const query = `
    SELECT COUNT(*) AS liked
    FROM likes
    WHERE post_id = ? AND user_id = ?
  `;
  connection.query(query, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error checking event post like status:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ liked: results[0].liked > 0 });
  });
});

// DELETE /events/:eventId/posts/:postId - Delete an event post
router.delete('/:eventId/posts/:postId', authenticateToken, (req, res) => {
  const { eventId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    DELETE FROM posts
    WHERE post_id = ?
      AND event_id = ?
      AND user_id = ?
      AND post_type = 'event'
  `;
  connection.query(query, [postId, eventId, userId], (err, results) => {
    if (err) {
      console.error("Error deleting event post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Event post not found or not authorized' });
    }
    res.json({ message: 'Event post deleted successfully' });
  });
});

export default router;
