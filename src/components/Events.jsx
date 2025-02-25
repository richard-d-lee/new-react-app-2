import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Event from './Event.jsx'; // Single event detail view
import '../styles/Events.css';
import EventModal from './EventModal.jsx';

const Events = ({ token, currentUserId, setCurrentView }) => {
    const [allEvents, setAllEvents] = useState([]);
    const [myEvents, setMyEvents] = useState([]);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [recentEvents, setRecentEvents] = useState([]);

    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showModal, setShowModal] = useState(false);

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
                setCurrentView={setCurrentView}
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
                    <p className="event-description">{ev.event_description}</p>
                    <button onClick={() => handleViewEvent(ev)}>View Details</button>
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
                    onEventSaved={fetchEventsData} // or any callback
                />
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
