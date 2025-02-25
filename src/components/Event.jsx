import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Post from './Post.jsx';
import CreatePost from './CreatePost.jsx';
import EventInviteModal from './EventInviteModal.jsx';
import '../styles/Event.css';
import EventModal from './EventModal.jsx';

const Event = ({
    token,
    currentUserId,
    eventData: propEventData,
    eventId: propEventId,
    onBack,
    setCurrentView,
    refreshEvents,
    postId,
    expandedCommentId
}) => {
    const [eventData, setEventData] = useState(propEventData || null);
    const [loadingEvent, setLoadingEvent] = useState(false);
    const [posts, setPosts] = useState([]);
    const [loadingPosts, setLoadingPosts] = useState(false);

    // For the Invite Attendees modal
    const [showInviteModal, setShowInviteModal] = useState(false);

    // For the "three-dot" menu
    const [showMenu, setShowMenu] = useState(false);

    // For editing the event
    const [showEditModal, setShowEditModal] = useState(false);

    // Fields for editing the event
    const [editEventName, setEditEventName] = useState('');
    const [editEventDescription, setEditEventDescription] = useState('');
    const [editEventLocation, setEditEventLocation] = useState('');
    const [editStartTime, setEditStartTime] = useState('');
    const [editEndTime, setEditEndTime] = useState('');
    const [editEventPrivacy, setEditEventPrivacy] = useState('public');
    const [editImageFile, setEditImageFile] = useState(null);

    const [showFullDescription, setShowFullDescription] = useState(false);
    const postRef = useRef(null);

    const baseURL = 'http://localhost:5000';

    // Decide which event ID we're dealing with
    const eventId = eventData?.event_id || propEventId;

    // Owner check
    const isOwner = (currentUserId && eventData && eventData.user_id === currentUserId);

    // Possibly show event image
    const eventImageUrl = eventData?.event_image_url
        ? `${baseURL}${eventData.event_image_url}`
        : null;

    // Description toggling (long vs short)
    const fullDescription = eventData?.event_description || '';
    const shouldTruncate = fullDescription.length > 500;
    const displayedDescription = shouldTruncate && !showFullDescription
        ? fullDescription.slice(0, 500) + '...'
        : fullDescription;

    const toggleDescription = () => setShowFullDescription((prev) => !prev);

    /** Fetch the event data if not provided from props */
    const fetchEventData = async () => {
        if (!token || !eventId) return;
        setLoadingEvent(true);
        try {
            const res = await axios.get(`${baseURL}/events/${eventId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEventData(res.data);
        } catch (err) {
            console.error('Error fetching event data:', err);
        } finally {
            setLoadingEvent(false);
        }
    };

    /** Fetch posts for this event */
    const fetchEventPosts = async () => {
        if (!token || !eventId) return;
        setLoadingPosts(true);
        try {
            if (postId) {
                // Fetch a single post if postId is specified
                const res = await axios.get(`${baseURL}/events/${eventId}/posts/${postId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const postData = Array.isArray(res.data) ? res.data[0] : res.data;
                setPosts(postData ? [postData] : []);
            } else {
                // Otherwise fetch all posts
                const res = await axios.get(`${baseURL}/events/${eventId}/posts`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPosts(res.data);
            }
        } catch (err) {
            console.error('Error fetching event posts:', err);
        } finally {
            setLoadingPosts(false);
        }
    };

    // Load event data if we didn't get it via props
    useEffect(() => {
        if (!eventData) {
            fetchEventData();
        }
    }, [eventId]);

    // Once we have event data (or if we already did), fetch posts
    useEffect(() => {
        if (eventId) {
            fetchEventPosts();
        }
    }, [eventId, token, postId]);

    // Scroll to the targeted post if postId was provided
    useEffect(() => {
        if (postRef.current) {
            postRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [posts]);

    // Handle post deletion (remove from local state)
    const handleDeletePost = (deletedPostId) => {
        setPosts((prev) => prev.filter((post) => post.post_id !== deletedPostId));
    };

    // Delete the entire event
    const handleDeleteEvent = async () => {
        if (!window.confirm('Are you sure you want to delete this event?')) return;
        try {
            await axios.delete(`${baseURL}/events/${eventId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // After deletion, go back to events list
            if (setCurrentView) setCurrentView('events');
        } catch (err) {
            console.error('Error deleting event:', err);
            alert(err.response?.data?.error || 'Error deleting event');
        }
    };

    // Invite modal toggles
    const handleOpenInviteModal = () => {
        setShowMenu(false);
        setShowInviteModal(true);
    };
    const handleCloseInviteModal = () => setShowInviteModal(false);

    // Edit modal toggles
    const handleOpenEditModal = () => {
        setShowMenu(false);
        // Populate form fields with current event data
        if (eventData) {
            setEditEventName(eventData.event_name || '');
            setEditEventDescription(eventData.event_description || '');
            setEditEventLocation(eventData.event_location || '');
            setEditEventPrivacy(eventData.event_privacy || 'public');
            setEditImageFile(null);

            // Convert event times to datetime-local format
            setEditStartTime(formatDateTimeLocal(eventData.start_time));
            setEditEndTime(formatDateTimeLocal(eventData.end_time));
        }
        setShowEditModal(true);
    };
    const handleCloseEditModal = () => setShowEditModal(false);

    // Utility to convert e.g. "2025-02-25T14:00" from a date string
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

    // Update event on form submission
    const handleUpdateEvent = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                event_name: editEventName,
                event_description: editEventDescription,
                event_location: editEventLocation,
                start_time: editStartTime,
                end_time: editEndTime,
                event_privacy: editEventPrivacy
            };
            // Update event details
            await axios.patch(`${baseURL}/events/${eventId}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // If a new image was selected, upload it
            if (editImageFile) {
                const formData = new FormData();
                formData.append('image', editImageFile);
                await axios.post(`${baseURL}/events/${eventId}/upload-image`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
            }

            // Refresh data
            await fetchEventData();
            if (refreshEvents) refreshEvents();

            // Close modal
            setShowEditModal(false);
        } catch (err) {
            console.error('Error updating event:', err);
            alert(err.response?.data?.error || 'Error updating event');
        }
    };

    // Loading / not found states
    if (!eventData && loadingEvent) {
        return <div className="event-container">Loading event data...</div>;
    }
    if (!eventData) {
        return <div className="event-container">Event not found or access denied.</div>;
    }

    return (
        <div className="event-container">
            {/* Event image */}
            {eventImageUrl && (
                <div className="event-image" style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <img
                        src={eventImageUrl}
                        alt="Event"
                        style={{ maxWidth: '300px', height: 'auto', borderRadius: '6px' }}
                    />
                </div>
            )}

            {/* Top bar: Back button + (optionally) 3-dot menu */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <button
                    className="back-button"
                    onClick={onBack || (() => setCurrentView('events'))}
                >
                    Back to Events
                </button>

                {/* Show the 3-dot menu only if the user is the event owner */}
                {isOwner && (
                    <div className="event-actions-menu-container">
                        <button
                            className="three-dot-button"
                            onClick={() => setShowMenu((prev) => !prev)}
                        >
                            &#x22EE; {/* or just "..." */}
                        </button>
                        {showMenu && (
                            <div className="event-actions-dropdown">
                                <button onClick={handleOpenInviteModal}>Invite Attendees</button>
                                <button onClick={handleOpenEditModal}>Edit Event Details</button>
                                <button onClick={handleDeleteEvent}>Delete Event</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <h2 className="event-title">{eventData.event_name}</h2>

            <div className="event-details">
                <p><strong>Owner:</strong> {isOwner ? 'You' : `User #${eventData.user_id}`}</p>
                <p>
                    <strong>Description:</strong>{' '}
                    {displayedDescription}{' '}
                    {shouldTruncate && (
                        <span
                            style={{ color: '#1877f2', cursor: 'pointer' }}
                            onClick={toggleDescription}
                        >
                            {showFullDescription ? 'hide description' : 'show more'}
                        </span>
                    )}
                </p>
                <p><strong>Location:</strong> {eventData.event_location}</p>
                <p><strong>Start:</strong> {new Date(eventData.start_time).toLocaleString()}</p>
                <p><strong>End:</strong> {new Date(eventData.end_time).toLocaleString()}</p>
                {eventData.type_name && <p><strong>Type:</strong> {eventData.type_name}</p>}
                <p><strong>Privacy:</strong> {eventData.event_privacy}</p>
            </div>

            <h3 className="posts-header">
                {postId ? 'Viewing Post' : `Posts for ${eventData.event_name}`}
            </h3>

            {/* Create a post (only if not viewing single post and if owner) */}
            {!postId && isOwner && (
                <CreatePost
                    token={token}
                    currentUserId={currentUserId}
                    onNewPost={(newPost) => setPosts((prev) => [newPost, ...prev])}
                    eventId={eventId}
                />
            )}

            {/* Loading / no posts */}
            {loadingPosts && <p className="loading-text">Loading event posts...</p>}
            {!loadingPosts && posts.length === 0 && (
                <p className="empty">No posts yet for this event.</p>
            )}

            {/* Render posts */}
            <div className="event-posts-list">
                {posts.map((post) => (
                    <div key={post.post_id} ref={postId ? postRef : null}>
                        <Post
                            post={post}
                            token={token}
                            currentUserId={currentUserId}
                            onDelete={handleDeletePost}
                            setCurrentView={setCurrentView}
                            onProfileClick={(actorId) => setCurrentView({ view: 'profile', userId: actorId })}
                            eventId={eventId}
                            eventPostId={post.post_id}
                            expandedCommentId={expandedCommentId}
                        />
                    </div>
                ))}
            </div>

            {/* Invite Attendees Modal */}
            {showInviteModal && (
                <EventInviteModal
                    token={token}
                    eventId={eventId}
                    currentUserId={currentUserId}
                    onClose={handleCloseInviteModal}
                />
            )}

            {/* Edit Event Modal */}
            {showEditModal && (
                <EventModal
                    token={token}
                    eventData={eventData} // pass the existing event
                    onClose={() => setShowEditModal(false)}
                    onEventSaved={fetchEventData}
                />
            )}
        </div>
    );
};

export default Event;
