import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTimes } from 'react-icons/fa';
import '../styles/EventModal.css'; // Use the distinct stylesheet for this modal

/**
 * A single modal for creating or editing an event.
 * - If `eventData` is provided, it PATCHes /events/:id (edit mode).
 * - Otherwise, it POSTs /events (create mode).
 */
const EventModal = ({ token, eventData = null, onClose, onEventSaved }) => {
  const baseURL = 'http://localhost:5000';
  const isEditMode = !!eventData;

  // Form fields
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [eventPrivacy, setEventPrivacy] = useState('public');
  const [imageFile, setImageFile] = useState(null);
  const [eventTypeId, setEventTypeId] = useState(''); // New: selected event type
  const [eventTypes, setEventTypes] = useState([]);   // New: list of event types
  const [error, setError] = useState('');

  // On mount (or when eventData changes), populate fields if editing
  useEffect(() => {
    if (isEditMode && eventData) {
      setEventName(eventData.event_name || '');
      setEventDescription(eventData.event_description || '');
      setEventLocation(eventData.event_location || '');
      setEventPrivacy(eventData.event_privacy || 'public');
      setStartTime(formatDateTimeLocal(eventData.start_time));
      setEndTime(formatDateTimeLocal(eventData.end_time));
      setEventTypeId(eventData.event_type_id || '');
    }
  }, [eventData, isEditMode]);

  // Fetch event types for the LOV
  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const res = await axios.get(`${baseURL}/events/event_types`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEventTypes(res.data);
      } catch (err) {
        console.error("Error fetching event types:", err);
      }
    };
    fetchEventTypes();
  }, [token, baseURL]);

  // Utility: Convert a date string into a "datetime-local" string
  const formatDateTimeLocal = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const pad = (num) => (num < 10 ? '0' + num : num);
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Handle form submission for both create and edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!eventName.trim()) {
      setError('Event name is required.');
      return;
    }

    try {
      const payload = {
        event_name: eventName,
        event_description: eventDescription,
        event_location: eventLocation,
        start_time: startTime,
        end_time: endTime,
        event_privacy: eventPrivacy,
        event_type_id: eventTypeId || null  // Include event type if selected
      };

      let updatedEventId;
      if (isEditMode) {
        const id = eventData.event_id;
        await axios.patch(`${baseURL}/events/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        updatedEventId = id;
      } else {
        const createRes = await axios.post(`${baseURL}/events`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        updatedEventId = createRes.data.event_id;
      }

      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        await axios.post(`${baseURL}/events/${updatedEventId}/upload-image`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      if (onEventSaved) {
        onEventSaved();
      }
      onClose();
    } catch (err) {
      console.error(isEditMode ? 'Error updating event:' : 'Error creating event:', err);
      setError(err.response?.data?.error || 'An error occurred.');
    }
  };

  // Determine labels based on mode
  const modalTitle = isEditMode ? 'Edit Event' : 'Create Event';
  const submitLabel = isEditMode ? 'Save' : 'Create';

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="close-modal" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>{modalTitle}</h2>
        {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleSubmit} className="edit-event-form">
          <input
            type="text"
            placeholder="Event Name"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
          />
          <textarea
            placeholder="Description"
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
          />
          <input
            type="text"
            placeholder="Location"
            value={eventLocation}
            onChange={(e) => setEventLocation(e.target.value)}
          />
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <select
            value={eventPrivacy}
            onChange={(e) => setEventPrivacy(e.target.value)}
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="friends_only">Friends Only</option>
          </select>
          {/* New Event Type dropdown */}
          <select
            value={eventTypeId}
            onChange={(e) => setEventTypeId(e.target.value)}
          >
            <option value="">Select Event Type (optional)</option>
            {eventTypes.map((type) => (
              <option key={type.event_type_id} value={type.event_type_id}>
                {type.type_name}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0])}
          />

          <div style={{ marginTop: '15px' }}>
            <button type="submit">{submitLabel}</button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;
