import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /notifications
 * Retrieves all notifications for the authenticated user, sorted by newest first.
 */
router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT notification_id, user_id, notification_type, reference_id, actor_id, reference_type, message, is_read, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching notifications:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

/**
 * GET /notifications/unread-count
 * Retrieves the count of unread notifications for the authenticated user.
 */
router.get('/unread-count', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT COUNT(*) AS unreadCount
    FROM notifications
    WHERE user_id = ? AND is_read = 0
  `;
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching unread notifications:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ unreadCount: results[0].unreadCount });
  });
});

/**
 * PATCH /notifications/:id/mark-read
 * Marks a single notification as read.
 */
router.patch('/:id/mark-read', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const notificationId = req.params.id;
  const query = `
    UPDATE notifications
    SET is_read = 1
    WHERE notification_id = ? AND user_id = ?
  `;
  connection.query(query, [notificationId, userId], (err, results) => {
    if (err) {
      console.error('Error marking notification as read:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Notification not found or not authorized' });
    }
    res.json({ success: true });
  });
});

/**
 * PATCH /notifications/mark-all-read
 * Marks all notifications for the authenticated user as read.
 */
router.patch('/mark-all-read', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    UPDATE notifications
    SET is_read = 1
    WHERE user_id = ?
  `;
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error marking all notifications as read:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true });
  });
});

export default router;
