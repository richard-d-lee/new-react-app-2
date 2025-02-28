import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Events.css';
import EventModal from './EventModal.jsx';

const Events = ({ token, currentUserId, setCurrentView }) => {
  const [allEvents, setAllEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const baseURL = 'http://localhost:5000';

  // Helper function to format date/time as "11:10 AM 2/27/2025"
  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    });
    const formattedDate = date.toLocaleDateString('en-US');
    return `${formattedTime} ${formattedDate}`;
  };

  // Fetch events data and categorize them
  const fetchEventsData = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${baseURL}/events`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const events = res.data;
      setAllEvents(events);
      const now = new Date();
      setMyEvents(events.filter(ev => ev.user_id === currentUserId));
      setUpcomingEvents(events.filter(ev => new Date(ev.start_time) > now));
      setRecentEvents(events.filter(ev => new Date(ev.end_time) < now));
    } catch (err) {
      console.error('Error fetching events data:', err);
    }
  };

  useEffect(() => {
    if (token) fetchEventsData();
  }, [token]);

  // When an event card is clicked, change HomePage's currentView
  const handleViewEvent = (ev) => {
    setCurrentView({ view: 'event', eventData: ev, eventId: ev.event_id });
  };

  // Render an individual event card
  const renderEventCard = (ev) => {
    const formattedStart = formatDateTime(ev.start_time);
    const eventImageUrl = ev.event_image_url ? `${baseURL}${ev.event_image_url}` : null;

    return (
      <div
        key={ev.event_id}
        className="event-card horizontal-layout clickable-event"
        onClick={() => handleViewEvent(ev)}
      >
        {eventImageUrl && (
          <div className="event-image-wrapper">
            <img src={eventImageUrl} alt="Event" />
          </div>
        )}
        <div className="event-info">
          <p><strong>{ev.event_name}</strong></p>
          <p>{formattedStart}</p>
          <p className="event-description">{ev.event_description}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="events-page">
      <h2>Events</h2>
      <button onClick={() => setShowModal(true)}>Create New Event</button>

      {showModal && (
        <EventModal
          token={token}
          onClose={() => setShowModal(false)}
          onEventSaved={fetchEventsData}
        />
      )}

      <div className="my-events-section">
        <h3>My Events</h3>
        {myEvents.length === 0 ? <p>No events found.</p> : myEvents.map(renderEventCard)}
      </div>

      <div className="upcoming-events-section">
        <h3>Upcoming Events</h3>
        {upcomingEvents.length === 0 ? <p>No upcoming events available.</p> : upcomingEvents.map(renderEventCard)}
      </div>

      <div className="recent-events-section">
        <h3>Recent Events</h3>
        {recentEvents.length === 0 ? <p>No recent events.</p> : recentEvents.map(renderEventCard)}
      </div>
    </div>
  );
};

export default Events;
