import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../helpers/notificationsSideEffect.js';

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
        event_image_url,
        event_type_id  // New: Event Type ID
    } = req.body;

    if (!event_name) {
        return res.status(400).json({ error: 'Event name is required.' });
    }

    const insertQuery = `
    INSERT INTO events
      (user_id, event_name, event_description, event_location, event_image_url, start_time, end_time, event_privacy, event_type_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            event_privacy || 'public',
            event_type_id || null
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
 * GET event types
 * GET /events/event_types
 */
router.get('/event_types', authenticateToken, (req, res) => {
    const query = `SELECT * FROM event_types ORDER BY type_name ASC`;
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching event types:', err);
            return res.status(500).json({ error: 'Database error.' });
        }
        res.json(results);
    });
});

/**
 * (Optional) UPLOAD an Event Image (owner only)
 * POST /events/:id/upload-image
 */
router.post('/:id/upload-image', authenticateToken, upload.single('image'), (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.userId;

    const ownershipQuery = 'SELECT user_id FROM events WHERE event_id = ? LIMIT 1';
    connection.query(ownershipQuery, [eventId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!rows.length) return res.status(404).json({ error: 'Event not found' });
        if (rows[0].user_id !== userId) return res.status(403).json({ error: 'Not event owner.' });

        const filename = req.file.filename;
        const imagePath = `/uploads/${filename}`;

        const updateQuery = 'UPDATE events SET event_image_url = ? WHERE event_id = ?';
        connection.query(updateQuery, [imagePath, eventId], (err2) => {
            if (err2) return res.status(500).json({ error: 'Database error' });
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

    const selectQuery = `
    SELECT e.*, et.type_name 
      FROM events e
      LEFT JOIN event_types et ON e.event_type_id = et.event_type_id
     WHERE e.event_id = ?
       AND (
         e.event_privacy = 'public'
         OR e.user_id = ?
         OR e.event_privacy = 'friends_only'
       )
     LIMIT 1
  `;
    connection.query(selectQuery, [eventId, userId], (err, rows) => {
        if (err) {
            console.error('Error fetching event:', err);
            return res.status(500).json({ error: 'Database error.' });
        }
        if (!rows.length) return res.status(404).json({ error: 'Event not found or access denied.' });
        res.json(rows[0]);
    });
});


/**
 * LIST / GET All Events
 * GET /events
 */
router.get('/', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const query = `
    SELECT e.*, et.type_name 
      FROM events e
      LEFT JOIN event_types et ON e.event_type_id = et.event_type_id
     WHERE e.event_privacy = 'public' OR e.user_id = ?
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
        event_privacy,
        event_type_id  // New: Event Type ID
    } = req.body;

    const ownershipQuery = 'SELECT user_id FROM events WHERE event_id = ? LIMIT 1';
    connection.query(ownershipQuery, [eventId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!rows.length) return res.status(404).json({ error: 'Event not found.' });
        if (rows[0].user_id !== userId) return res.status(403).json({ error: 'Not authorized.' });

        const updateQuery = `
      UPDATE events
         SET event_name = ?,
             event_description = ?,
             event_location = ?,
             start_time = ?,
             end_time = ?,
             event_privacy = ?,
             event_type_id = ?
       WHERE event_id = ? AND user_id = ?
    `;
        connection.query(updateQuery, [
            event_name || null,
            event_description || null,
            event_location || null,
            start_time || null,
            end_time || null,
            event_privacy || 'public',
            event_type_id || null,
            eventId,
            userId
        ], (err2, results) => {
            if (err2) return res.status(500).json({ error: 'Database error.' });
            if (!results.affectedRows) return res.status(404).json({ error: 'Event not updated.' });
            res.json({ message: 'Event updated successfully.' });
        });
    });
});


/**
 * DELETE an Event (owner only) with cascading deletion of notifications.
 * DELETE /events/:id
 */
router.delete('/:id', authenticateToken, (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.userId;

    const ownershipQuery = 'SELECT user_id FROM events WHERE event_id = ? LIMIT 1';
    connection.query(ownershipQuery, [eventId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!rows.length) return res.status(404).json({ error: 'Event not found.' });
        if (rows[0].user_id !== userId) return res.status(403).json({ error: 'Not authorized.' });

        const deleteQuery = 'DELETE FROM events WHERE event_id = ? AND user_id = ?';
        connection.query(deleteQuery, [eventId, userId], (err2, results) => {
            if (err2) return res.status(500).json({ error: 'Database error.' });
            if (!results.affectedRows) return res.status(404).json({ error: 'Event not found.' });
            // Cascade delete notifications for this event.
            const notifDeleteQuery = "DELETE FROM notifications WHERE event_id = ?";
            connection.query(notifDeleteQuery, [eventId], (err3) => {
                if (err3) console.error("Error deleting event notifications:", err3);
                res.json({ message: 'Event deleted successfully.' });
            });
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
    if (!invitee_id) return res.status(400).json({ error: 'Invitee user_id required.' });

    // Check ownership and fetch event name for the notification.
    const ownershipQuery = 'SELECT user_id, event_name FROM events WHERE event_id = ? LIMIT 1';
    connection.query(ownershipQuery, [eventId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!rows.length) return res.status(404).json({ error: 'Event not found.' });
        if (rows[0].user_id !== userId) return res.status(403).json({ error: 'Not authorized.' });

        const eventName = rows[0].event_name;
        const upsertQuery = `
        INSERT INTO event_attendees (event_id, user_id, status)
        VALUES (?, ?, 'invited')
        ON DUPLICATE KEY UPDATE status='invited'
      `;
        connection.query(upsertQuery, [eventId, invitee_id], (err2) => {
            if (err2) return res.status(500).json({ error: 'Database error.' });
            // Create a notification for the invited user.
            // Include a URL that points to the event page so the event name can be rendered as a clickable link.
            createNotification({
                user_id: invitee_id,
                notification_type: 'EVENT_INVITE',
                reference_id: eventId,
                actor_id: userId,
                reference_type: 'event',
                event_id: eventId,
                message: `invited you to the event "${eventName}"`,
                url: `/events/${eventId}`
            });
            res.json({ message: 'User invited to event.' });
        });
    });
});

/**
 * RESCIND an Event Invitation (owner only)
 * DELETE /events/:id/invite
 * 
 * Expects a JSON body: { invitee_id: <friend's user id> }
 */
router.delete('/:id/invite', authenticateToken, (req, res) => {
    const eventId = req.params.id;
    const { invitee_id } = req.body;
    const userId = req.user.userId;
    if (!invitee_id) return res.status(400).json({ error: 'Invitee user_id required.' });

    const ownershipQuery = 'SELECT user_id FROM events WHERE event_id = ? LIMIT 1';
    connection.query(ownershipQuery, [eventId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!rows.length) return res.status(404).json({ error: 'Event not found.' });
        if (rows[0].user_id !== userId) return res.status(403).json({ error: 'Not authorized.' });

        const deleteQuery = 'DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?';
        connection.query(deleteQuery, [eventId, invitee_id], (err2, results) => {
            if (err2) return res.status(500).json({ error: 'Database error.' });
            if (results.affectedRows === 0) {
                return res.status(404).json({ error: 'Invitation not found.' });
            }
            res.json({ message: 'Invitation rescinded successfully.' });
        });
    });
});


/**
 * ACCEPT an Event Invitation
 * PATCH /events/:eventId/invite/accept
 *
 * The currently authenticated user accepts the invitation to the event.
 */
router.patch('/:eventId/invite/accept', authenticateToken, (req, res) => {
    const eventId = req.params.eventId;
    const userId = req.user.userId; // The invitee is the current user

    // Update the event_attendees table: set status to "accepted" for this user.
    const updateQuery = `
      UPDATE event_attendees
         SET status = 'accepted'
      WHERE event_id = ? AND user_id = ?
    `;
    connection.query(updateQuery, [eventId, userId], (err, results) => {
        if (err) {
            console.error("Error accepting event invitation:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Invitation not found or already processed' });
        }

        // Optionally, create a notification for the event owner.
        const getEventQuery = 'SELECT user_id, event_name FROM events WHERE event_id = ? LIMIT 1';
        connection.query(getEventQuery, [eventId], (err2, rows) => {
            if (err2) {
                console.error("Error fetching event details:", err2);
            } else if (rows.length > 0) {
                const eventOwner = rows[0].user_id;
                if (eventOwner !== userId) {
                    createNotification({
                        user_id: eventOwner,
                        notification_type: 'EVENT_INVITE_ACCEPTED',
                        reference_id: eventId,
                        actor_id: userId,
                        reference_type: 'event',
                        message: `Your invitation for "${rows[0].event_name}" was accepted`
                    });
                }
            }
            res.json({ message: 'Event invitation accepted successfully.' });
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
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

/**
 * UPDATE ATTENDEE STATUS
 * PATCH /events/:eventId/attendees/:userId
 */
router.patch('/:eventId/attendees/:userId', authenticateToken, (req, res) => {
    const { eventId, userId: attendeeId } = req.params;
    const { status } = req.body;
    const currentUser = req.user.userId;
    if (!['going', 'interested', 'invited', 'declined'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
    }
    const ownershipCheckQuery = 'SELECT user_id FROM events WHERE event_id = ? LIMIT 1';
    connection.query(ownershipCheckQuery, [eventId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!rows.length) return res.status(404).json({ error: 'Event not found.' });
        const eventOwner = rows[0].user_id;
        if (currentUser !== attendeeId && currentUser !== eventOwner) {
            return res.status(403).json({ error: 'Not authorized to update this attendee status.' });
        }
        const updateAttendeeQuery = `
      UPDATE event_attendees
         SET status = ?
       WHERE event_id = ? AND user_id = ?
    `;
        connection.query(updateAttendeeQuery, [status, eventId, attendeeId], (err2, results) => {
            if (err2) return res.status(500).json({ error: 'Database error.' });
            if (!results.affectedRows) return res.status(404).json({ error: 'No matching attendee found.' });
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
     WHERE p.event_id = ? AND p.post_type = 'event'
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
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });
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
            if (!rows || rows.length === 0) return res.status(404).json({ error: 'Event post not found after insert' });
            // Cascade delete notifications for this new post if needed later.
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
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });
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
        connection.query(selectQuery, [newCommentId], (err, rows) => {
            if (err) {
                console.error("Error selecting new event comment:", err);
                return res.status(500).json({ error: 'Database error during select' });
            }
            if (!rows || rows.length === 0) return res.status(404).json({ error: 'Event comment not found after insert' });
            // Notify the post owner if not the same as the commenter.
            const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
            connection.query(getPostQuery, [postId], (err, postResults) => {
                if (!err && postResults.length > 0) {
                    const postOwner = postResults[0].user_id;
                    if (postOwner !== userId) {
                        createNotification({
                            user_id: postOwner,
                            notification_type: 'EVENT_POST_COMMENT',
                            reference_id: newCommentId,
                            actor_id: userId,
                            reference_type: 'event_comment',
                            event_id: eventId,
                            message: 'commented on your event post',
                            url: `/events/${eventId}?post=${postId}&comment=${newCommentId}`
                        });
                    }
                }
            });
            res.json(rows[0]);
        });
    });
});

/**
 * DELETE /events/:eventId/posts/:postId/comments/:commentId - Delete an event comment
 * Also cascade–delete any notifications referencing this comment.
 */
router.delete('/:eventId/posts/:postId/comments/:commentId', authenticateToken, (req, res) => {
    const { eventId, postId, commentId } = req.params;
    const userId = req.user.userId;
    const deleteQuery = `
    DELETE FROM comments
    WHERE comment_id = ? AND post_id = ? AND user_id = ?
  `;
    connection.query(deleteQuery, [commentId, postId, userId], (err, results) => {
        if (err) {
            console.error("Error deleting event comment:", err);
            return res.status(500).json({ error: "Database error" });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: "Event comment not found or not authorized" });
        }
        // Cascade delete notifications referencing this event comment.
        const notifDeleteQuery = `
      DELETE FROM notifications
      WHERE reference_id = ? AND reference_type = 'event_comment'
    `;
        connection.query(notifDeleteQuery, [commentId], (err, notifResults) => {
            if (err) {
                console.error("Error deleting event comment notifications:", err);
            }
            res.json({ message: "Event comment deleted successfully" });
        });
    });
});

/**
 * POST /events/:eventId/posts/:postId/comments/:commentId/like - Like an event comment
 */
router.post('/:eventId/posts/:postId/comments/:commentId/like', authenticateToken, (req, res) => {
    const { eventId, postId, commentId } = req.params;
    const userId = req.user.userId;
    const insertLikeQuery = `
    INSERT INTO comment_likes (comment_id, user_id)
    VALUES (?, ?)
  `;
    connection.query(insertLikeQuery, [commentId, userId], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Comment already liked by this user' });
            }
            console.error("Error liking event comment:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        const getCommentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
        connection.query(getCommentQuery, [commentId], (err2, results) => {
            if (err2) {
                console.error("Error fetching comment owner:", err2);
            }
            if (results && results.length > 0) {
                const commentOwner = results[0].user_id;
                if (commentOwner !== userId) {
                    createNotification({
                        user_id: commentOwner,
                        notification_type: 'EVENT_COMMENT_LIKE',
                        reference_id: commentId,
                        actor_id: userId,
                        reference_type: 'event_comment',
                        event_id: eventId,
                        message: 'liked your event comment'
                    });
                }
            }
            res.json({ message: 'Event comment liked successfully' });
        });
    });
});

/**
 * GET /events/:eventId/posts/:postId/comments/:commentId/liked - Check if an event comment is liked
 */
router.get('/:eventId/posts/:postId/comments/:commentId/liked', authenticateToken, (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.userId;
    const query = `
    SELECT COUNT(*) AS liked
    FROM comment_likes
    WHERE comment_id = ? AND user_id = ?
  `;
    connection.query(query, [commentId, userId], (err, results) => {
        if (err) {
            console.error("Error checking event comment like status:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ liked: results[0].liked > 0 });
    });
});

/**
 * DELETE /events/:eventId/posts/:postId/comments/:commentId/like - Unlike an event comment
 */
router.delete('/:eventId/posts/:postId/comments/:commentId/like', authenticateToken, (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.userId;
    const deleteQuery = `
    DELETE FROM comment_likes
    WHERE comment_id = ? AND user_id = ?
  `;
    connection.query(deleteQuery, [commentId, userId], (err, results) => {
        if (err) {
            console.error("Error unliking event comment:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Like not found or already removed' });
        }
        res.json({ message: 'Event comment unliked successfully' });
    });
});

/**
 * GET /events/:eventId/posts/:postId - Retrieve a single event post by ID
 */
router.get('/:eventId/posts/:postId', authenticateToken, (req, res) => {
    const { eventId, postId } = req.params;
    const query = `
    SELECT p.post_id, p.user_id, p.content, p.created_at, p.post_type, p.event_id,
           u.username, u.profile_picture_url
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
     WHERE p.post_id = ? AND p.event_id = ? AND p.post_type = 'event'
     LIMIT 1
  `;
    connection.query(query, [postId, eventId], (err, results) => {
        if (err) {
            console.error("Error fetching single event post:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!results || results.length === 0) {
            return res.status(404).json({ error: 'Event post not found' });
        }
        res.json(results[0]);
    });
});

/**
 * NEW ROUTE: GET a Single Comment for an Event
 * GET /events/:eventId/comments/:commentId
 */
router.get('/:eventId/comments/:commentId', authenticateToken, (req, res) => {
    const { eventId, commentId } = req.params;
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
    WHERE c.comment_id = ? AND p.event_id = ?
    LIMIT 1
  `;
    connection.query(query, [commentId, eventId], (err, results) => {
        if (err) {
            console.error("Error fetching single event comment:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!results || results.length === 0) {
            return res.status(404).json({ error: 'Event comment not found' });
        }
        res.json(results[0]);
    });
});

/**
 * DELETE /events/:eventId/posts/:postId - Delete an event post
 * This endpoint now also cascades deletion of notifications for:
 *  - the event post itself (reference_type 'event_post')
 *  - any notifications for child comments (reference_type 'event_comment')
 */
router.delete('/:eventId/posts/:postId', authenticateToken, (req, res) => {
    const { eventId, postId } = req.params;
    const userId = req.user.userId;

    connection.beginTransaction(err => {
        if (err) return res.status(500).json({ error: 'Database error' });

        // Delete notifications for the event post itself.
        const deletePostNotifQuery = `
      DELETE FROM notifications
      WHERE reference_id = ? AND reference_type = 'event_post'
    `;
        connection.query(deletePostNotifQuery, [postId], (err, results) => {
            if (err) {
                return connection.rollback(() => res.status(500).json({ error: 'Error deleting event post notifications' }));
            }

            // Get all comment IDs for the event post.
            const getCommentsQuery = 'SELECT comment_id FROM comments WHERE post_id = ?';
            connection.query(getCommentsQuery, [postId], (err, commentRows) => {
                if (err) {
                    return connection.rollback(() => res.status(500).json({ error: 'Error fetching comments for post' }));
                }

                const commentIds = commentRows.map(row => row.comment_id);
                if (commentIds.length > 0) {
                    // Delete notifications for each child comment.
                    const deleteCommentNotifQuery = `
            DELETE FROM notifications
            WHERE reference_id IN (?) AND reference_type = 'event_comment'
          `;
                    connection.query(deleteCommentNotifQuery, [commentIds], (err, notifResults) => {
                        if (err) {
                            return connection.rollback(() => res.status(500).json({ error: 'Error deleting comment notifications' }));
                        }
                        // Now delete the event post.
                        const deletePostQuery = `
              DELETE FROM posts
              WHERE post_id = ? AND event_id = ? AND user_id = ? AND post_type = 'event'
            `;
                        connection.query(deletePostQuery, [postId, eventId, userId], (err, results) => {
                            if (err) {
                                return connection.rollback(() => res.status(500).json({ error: 'Error deleting event post' }));
                            }
                            if (results.affectedRows === 0) {
                                return connection.rollback(() => res.status(404).json({ error: 'Event post not found or not authorized' }));
                            }
                            connection.commit(err => {
                                if (err) return connection.rollback(() => res.status(500).json({ error: 'Error committing transaction' }));
                                res.json({ message: 'Event post and associated notifications deleted successfully' });
                            });
                        });
                    });
                } else {
                    // If no child comments, just delete the event post.
                    const deletePostQuery = `
            DELETE FROM posts
            WHERE post_id = ? AND event_id = ? AND user_id = ? AND post_type = 'event'
          `;
                    connection.query(deletePostQuery, [postId, eventId, userId], (err, results) => {
                        if (err) {
                            return connection.rollback(() => res.status(500).json({ error: 'Error deleting event post' }));
                        }
                        if (results.affectedRows === 0) {
                            return connection.rollback(() => res.status(404).json({ error: 'Event post not found or not authorized' }));
                        }
                        connection.commit(err => {
                            if (err) return connection.rollback(() => res.status(500).json({ error: 'Error committing transaction' }));
                            res.json({ message: 'Event post deleted successfully' });
                        });
                    });
                }
            });
        });
    });
});

/**
 * LIKE / UNLIKE Endpoints for Event Posts
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
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Post already liked by this user' });
            console.error("Error liking event post:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
        connection.query(getPostQuery, [postId], (err, postResults) => {
            if (!err && postResults.length > 0) {
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
    const query = 'DELETE FROM likes WHERE post_id = ? AND user_id = ?';
    connection.query(query, [postId, userId], (err, results) => {
        if (err) {
            console.error("Error unliking event post:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.affectedRows === 0) return res.status(404).json({ error: 'Like not found or already removed' });
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

// GET /events/:eventId/posts/:postId/comments - Retrieve comments for an event post
router.get('/:eventId/posts/:postId/comments', authenticateToken, (req, res) => {
    const { eventId, postId } = req.params;
    const query = `
      SELECT c.comment_id, c.post_id, c.user_id, c.content, c.created_at, c.parent_comment_id,
             u.username, u.profile_picture_url
        FROM comments c
        JOIN posts p ON c.post_id = p.post_id
        JOIN users u ON c.user_id = u.user_id
       WHERE c.post_id = ? AND p.event_id = ?
       ORDER BY c.created_at ASC
    `;
    connection.query(query, [postId, eventId], (err, results) => {
        if (err) {
            console.error("Error fetching event post comments:", err);
            return res.status(500).json({ error: "Database error" });
        }
        // Return the comments (an empty array if none are found)
        res.json(results);
    });
});

// POST /events/:eventId/comments/:commentId/reply - Reply to an existing event comment
router.post('/:eventId/comments/:commentId/reply', authenticateToken, (req, res) => {
    const { eventId, commentId } = req.params;
    const userId = req.user.userId;
    const { content } = req.body;
    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Content is required' });
    }

    // First fetch the parent comment so we know which post it belongs to
    const getParentQuery = 'SELECT post_id FROM comments WHERE comment_id = ?';
    connection.query(getParentQuery, [commentId], (err, parentResults) => {
        if (err) {
            console.error("Error fetching parent comment's post_id:", err);
            return res.status(500).json({ error: 'Database error retrieving parent comment' });
        }
        if (!parentResults || parentResults.length === 0) {
            return res.status(404).json({ error: 'Parent comment not found' });
        }
        const parentPostId = parentResults[0].post_id;

        // Insert the reply with parent_comment_id
        const insertQuery = `
        INSERT INTO comments (post_id, parent_comment_id, user_id, content)
        VALUES (?, ?, ?, ?)
      `;
        connection.query(insertQuery, [parentPostId, commentId, userId, content], (err2, result) => {
            if (err2) {
                console.error("Error inserting event reply:", err2);
                return res.status(500).json({ error: 'Database error during insert' });
            }
            const newCommentId = result.insertId;

            // Return the newly inserted reply
            const selectQuery = `
          SELECT c.comment_id, c.post_id, c.parent_comment_id, c.user_id, c.content, c.created_at,
                 u.username, u.profile_picture_url
          FROM comments c
          JOIN users u ON c.user_id = u.user_id
          WHERE c.comment_id = ?
        `;
            connection.query(selectQuery, [newCommentId], (err3, rows) => {
                if (err3) {
                    console.error("Error selecting new event reply:", err3);
                    return res.status(500).json({ error: 'Database error during select' });
                }
                if (!rows || rows.length === 0) {
                    return res.status(404).json({ error: 'Reply not found after insert' });
                }

                // Optionally create a notification for the parent comment's owner
                const getParentAuthorQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
                connection.query(getParentAuthorQuery, [commentId], (err4, parentAuthorResults) => {
                    if (!err4 && parentAuthorResults.length > 0) {
                        const parentOwner = parentAuthorResults[0].user_id;
                        if (parentOwner !== userId) {
                            createNotification({
                                user_id: parentOwner,
                                notification_type: 'EVENT_COMMENT_REPLY',
                                reference_id: newCommentId,
                                actor_id: userId,
                                reference_type: 'event_comment',
                                event_id, // so we know which event
                                message: 'Someone replied to your event comment'
                            });
                        }
                    }
                });

                res.json(rows[0]);
            });
        });
    });
});


export default router;
