import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Event from './Event.jsx'; // Single event detail view
import '../styles/Events.css';

const Events = ({ token, currentUserId, setCurrentView }) => {
  const [allEvents, setAllEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // CREATE form fields
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [eventPrivacy, setEventPrivacy] = useState('public');
  const [imageFile, setImageFile] = useState(null);

  // Use a simple fallback baseURL
  const baseURL = 'http://localhost:5000';

  // 1) Fetch all events, then split into My, Upcoming, Recent
  const fetchEventsData = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${baseURL}/events`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const events = res.data;
      setAllEvents(events);

      const now = new Date();
      const myEv = events.filter(ev => ev.user_id === currentUserId);
      const upcomingEv = events.filter(ev => new Date(ev.start_time) > now);
      const recentEv = events.filter(ev => new Date(ev.end_time) < now);

      setMyEvents(myEv);
      setUpcomingEvents(upcomingEv);
      setRecentEvents(recentEv);
    } catch (err) {
      console.error('Error fetching events data:', err);
    }
  };

  useEffect(() => {
    if (token) fetchEventsData();
  }, [token]);

  // 2) Create a new event
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!eventName.trim()) {
      return alert('Event name is required.');
    }
    try {
      const payload = {
        event_name: eventName,
        event_description: eventDescription,
        event_location: eventLocation,
        start_time: startTime,
        end_time: endTime,
        event_privacy: eventPrivacy
      };
      const createRes = await axios.post(`${baseURL}/events`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newEventId = createRes.data.event_id;

      // If there's an imageFile, upload it
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        await axios.post(
          `${baseURL}/events/${newEventId}/upload-image`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      }

      setEventName('');
      setEventDescription('');
      setEventLocation('');
      setStartTime('');
      setEndTime('');
      setEventPrivacy('public');
      setImageFile(null);
      setShowCreateModal(false);

      // Re-fetch events
      fetchEventsData();
    } catch (err) {
      console.error('Error creating event:', err);
      alert(err.response?.data?.error || 'Error creating event');
    }
  };

  const handleViewEvent = (ev) => {
    setSelectedEvent(ev);
  };

  const handleCloseEvent = () => {
    setSelectedEvent(null);
  };

  // If a single event is selected, show that detail view
  if (selectedEvent) {
    return (
      <Event
        token={token}
        currentUserId={currentUserId}
        eventData={selectedEvent}
        onBack={handleCloseEvent}
        refreshEvents={fetchEventsData}
      />
    );
  }

  // Helper to format the event card
  const renderEventCard = (ev) => {
    const formattedStart = new Date(ev.start_time).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
    const eventImageUrl = ev.event_image_url
      ? `${baseURL}${ev.event_image_url}`
      : null;

    return (
      <div key={ev.event_id} className="event-card horizontal-layout">
        {/* Left side: event image */}
        {eventImageUrl && (
          <div className="event-image-wrapper">
            <img src={eventImageUrl} alt="Event" />
          </div>
        )}

        {/* Right side: name, date, truncated description, button */}
        <div className="event-info">
          <p><strong>{ev.event_name}</strong></p>
          <p>{formattedStart}</p>
          {/* Truncated description */}
          <p className="event-description">{ev.event_description}</p>
          <button onClick={() => handleViewEvent(ev)}>View Details</button>
        </div>
      </div>
    );
  };

  return (
    <div className="events-page">
      <h2>Events</h2>
      <button onClick={() => setShowCreateModal(true)}>+ Create New Event</button>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Create Event</h3>
            <form onSubmit={handleCreateEvent} className="create-event-form">
              <label>Event Name</label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />

              <label>Description</label>
              <textarea
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
              />

              <label>Location</label>
              <input
                type="text"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
              />

              <label>Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />

              <label>End Time</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />

              <label>Privacy</label>
              <select
                value={eventPrivacy}
                onChange={(e) => setEventPrivacy(e.target.value)}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="friends_only">Friends Only</option>
              </select>

              <label>Event Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
              />

              <div style={{ marginTop: '15px' }}>
                <button type="submit">Create</button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ marginLeft: '10px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* My Events Section */}
      <div className="my-events-section">
        <h3>My Events</h3>
        {myEvents.length === 0 ? (
          <p>No events found.</p>
        ) : (
          myEvents.map(renderEventCard)
        )}
      </div>

      {/* Upcoming Events Section */}
      <div className="upcoming-events-section">
        <h3>Upcoming Events</h3>
        {upcomingEvents.length === 0 ? (
          <p>No upcoming events available.</p>
        ) : (
          upcomingEvents.map(renderEventCard)
        )}
      </div>

      {/* Recent Events Section */}
      <div className="recent-events-section">
        <h3>Recent Events</h3>
        {recentEvents.length === 0 ? (
          <p>No recent events.</p>
        ) : (
          recentEvents.map(renderEventCard)
        )}
      </div>
    </div>
  );
};

export default Events;
