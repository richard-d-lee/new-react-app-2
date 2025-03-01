import React, { useState } from 'react';
import axios from 'axios';
import '../styles/BugReportModal.css';

const BUG_TARGET_TYPE_ID = 1;   // Assumed ID for "Bug" in target_types table
const BUG_REPORT_TYPE_ID = 1;   // Assumed default report type for bug reports

const BugReportModal = ({ token, currentUserId, onClose }) => {
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // In this bug report, we assume there is no specific target id so we set it to 0.
    const payload = {
      target_id: 0,
      target_type_id: BUG_TARGET_TYPE_ID,
      report_type_id: BUG_REPORT_TYPE_ID,
      details
    };

    try {
      await axios.post('http://localhost:5000/reports', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onClose();
    } catch (err) {
      console.error('Error submitting bug report:', err);
      setError(err.response?.data?.error || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bug-modal-overlay">
      <div className="bug-modal">
        <button className="bug-modal-close" onClick={onClose}>
          &times;
        </button>
        <h2>Report a Bug</h2>
        <form onSubmit={handleSubmit} className="bug-report-form">
          <label htmlFor="bug-details">Bug Details:</label>
          <textarea
            id="bug-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Describe the bug, steps to reproduce, etc."
            required
          />
          {error && <p className="bug-error">{error}</p>}
          <div className="bug-modal-buttons">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BugReportModal;
