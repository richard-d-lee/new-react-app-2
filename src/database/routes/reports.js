import express from 'express';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /reports/target-types
 * Retrieve all target types (e.g., Bug, User, Post, Comment)
 */
router.get('/target-types', authenticateToken, (req, res) => {
  const sql = 'SELECT id, name, description FROM target_types';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching target types:", err);
      return res.status(500).json({ error: 'Database error fetching target types' });
    }
    res.json(results);
  });
});

/**
 * GET /reports/report-types
 * Retrieve all report types (e.g., Inappropriate Content, Threatening, Harassment, Spam)
 */
router.get('/report-types', authenticateToken, (req, res) => {
  const sql = 'SELECT id, type_name, description FROM report_types';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching report types:", err);
      return res.status(500).json({ error: 'Database error fetching report types' });
    }
    res.json(results);
  });
});

/**
 * POST /reports
 * Create a new report.
 * Required body parameters: target_id, target_type_id, report_type_id.
 * Optional: details.
 */
router.post('/', authenticateToken, (req, res) => {
  const reporter_id = req.user.userId;
  const { target_id, target_type_id, report_type_id, details } = req.body;
  
  if (!target_id || !target_type_id || !report_type_id) {
    return res.status(400).json({ error: 'target_id, target_type_id, and report_type_id are required.' });
  }
  
  const sql = `
    INSERT INTO reports (reporter_id, target_id, target_type_id, report_type_id, details)
    VALUES (?, ?, ?, ?, ?)
  `;
  connection.query(sql, [reporter_id, target_id, target_type_id, report_type_id, details || ''], (err, results) => {
    if (err) {
      console.error("Error creating report:", err);
      return res.status(500).json({ error: 'Database error creating report' });
    }
    res.status(201).json({ message: 'Report submitted successfully', reportId: results.insertId });
  });
});

/**
 * GET /reports
 * Retrieve all reports.
 * (Optional: Restrict to admin users in your application logic.)
 */
router.get('/', authenticateToken, (req, res) => {
  const sql = `
    SELECT 
      r.id,
      r.reporter_id,
      r.target_id,
      t.name AS target_type,
      rt.type_name AS report_type,
      r.details,
      r.created_at,
      r.updated_at
    FROM reports r
    JOIN target_types t ON r.target_type_id = t.id
    JOIN report_types rt ON r.report_type_id = rt.id
    ORDER BY r.created_at DESC
  `;
  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching reports:", err);
      return res.status(500).json({ error: 'Database error fetching reports' });
    }
    res.json(results);
  });
});

/**
 * GET /reports/:id
 * Retrieve a specific report by its ID.
 */
router.get('/:id', authenticateToken, (req, res) => {
  const reportId = req.params.id;
  const sql = `
    SELECT 
      r.id,
      r.reporter_id,
      r.target_id,
      t.name AS target_type,
      rt.type_name AS report_type,
      r.details,
      r.created_at,
      r.updated_at
    FROM reports r
    JOIN target_types t ON r.target_type_id = t.id
    JOIN report_types rt ON r.report_type_id = rt.id
    WHERE r.id = ?
  `;
  connection.query(sql, [reportId], (err, results) => {
    if (err) {
      console.error("Error fetching report:", err);
      return res.status(500).json({ error: 'Database error fetching report' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(results[0]);
  });
});

/**
 * PUT /reports/:id
 * Update a report's details (for example, adding additional details).
 * Only the reporter is allowed to update their report.
 */
router.put('/:id', authenticateToken, (req, res) => {
  const reportId = req.params.id;
  const reporter_id = req.user.userId;
  const { details } = req.body;
  if (details === undefined) {
    return res.status(400).json({ error: 'Details field is required for update.' });
  }
  const sql = `
    UPDATE reports
    SET details = ?
    WHERE id = ? AND reporter_id = ?
  `;
  connection.query(sql, [details, reportId, reporter_id], (err, results) => {
    if (err) {
      console.error("Error updating report:", err);
      return res.status(500).json({ error: 'Database error updating report' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Report not found or not authorized to update' });
    }
    res.json({ message: 'Report updated successfully' });
  });
});

/**
 * DELETE /reports/:id
 * Delete a report.
 * Only allow deletion if the current user is the reporter.
 */
router.delete('/:id', authenticateToken, (req, res) => {
  const reportId = req.params.id;
  const reporter_id = req.user.userId;
  const sql = `
    DELETE FROM reports
    WHERE id = ? AND reporter_id = ?
  `;
  connection.query(sql, [reportId, reporter_id], (err, results) => {
    if (err) {
      console.error("Error deleting report:", err);
      return res.status(500).json({ error: 'Database error deleting report' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Report not found or not authorized to delete' });
    }
    res.json({ message: 'Report deleted successfully' });
  });
});

export default router;
