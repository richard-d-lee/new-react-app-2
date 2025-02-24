import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Post from './Post.jsx';
import CreatePost from './CreatePost.jsx';
import EventInviteModal from './EventInviteModal.jsx';
import '../styles/Event.css';

const Event = ({
  token,
  currentUserId,
  eventData: propEventData,  // May be null or undefined if we only have an eventId
  eventId: propEventId,     // If HomePage sets { view: 'event', eventId: 123 }
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const postRef = useRef(null);

  // If we do have an eventData from props, use its event_id; otherwise use propEventId.
  const eventId = eventData?.event_id || propEventId;

  const baseURL = 'http://localhost:5000';
  
  // Determine if currentUser is the owner
  const isOwner = (currentUserId && eventData && eventData.user_id === currentUserId);

  // For the event image
  const eventImageUrl = eventData?.event_image_url
    ? `${baseURL}${eventData.event_image_url}`
    : null;

  // If we have an event description, handle show-more/hide
  const fullDescription = eventData?.event_description || '';
  const shouldTruncate = fullDescription.length > 500;
  const displayedDescription = shouldTruncate && !showFullDescription
    ? fullDescription.slice(0, 500) + '...'
    : fullDescription;

  const toggleDescription = () => setShowFullDescription(prev => !prev);

  /**
   * 1) Fetch the event data if not provided.
   */
  const fetchEventData = async () => {
    if (!token || !eventId) return;
    setLoadingEvent(true);
    try {
      const res = await axios.get(
        `${baseURL}/events/${eventId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEventData(res.data);
    } catch (err) {
      console.error('Error fetching event data:', err);
    } finally {
      setLoadingEvent(false);
    }
  };

  /**
   * 2) Fetch posts for this event
   */
  const fetchEventPosts = async () => {
    if (!token || !eventId) return;
    setLoadingPosts(true);
    try {
      if (postId) {
        // Single targeted post
        const res = await axios.get(
          `${baseURL}/events/${eventId}/posts/${postId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const postData = Array.isArray(res.data) ? res.data[0] : res.data;
        setPosts(postData ? [postData] : []);
      } else {
        // All posts
        const res = await axios.get(
          `${baseURL}/events/${eventId}/posts`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPosts(res.data);
      }
    } catch (err) {
      console.error('Error fetching event posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  // On mount or changes to eventId, fetch event data if needed
  useEffect(() => {
    if (!eventData) {
      fetchEventData();
    }
  }, [eventId]);

  // Once we have eventData (or if we already did), fetch posts
  useEffect(() => {
    if (eventId) {
      fetchEventPosts();
    }
  }, [eventId, token, postId]);

  // Scroll to the targeted post if applicable
  useEffect(() => {
    if (postRef.current) {
      postRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [posts]);

  // Remove a post from state on deletion
  const handleDeletePost = (deletedPostId) => {
    setPosts(prev => prev.filter(post => post.post_id !== deletedPostId));
  };

  // Delete the entire event
  const handleDeleteEvent = async () => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await axios.delete(`${baseURL}/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // After deletion, navigate back to events list
      if (setCurrentView) setCurrentView('events');
    } catch (err) {
      console.error("Error deleting event:", err);
      alert(err.response?.data?.error || "Error deleting event");
    }
  };

  // Invite modal toggles
  const handleOpenInviteModal = () => setShowInviteModal(true);
  const handleCloseInviteModal = () => setShowInviteModal(false);

  // If still loading the event data
  if (!eventData && loadingEvent) {
    return <div className="event-container">Loading event data...</div>;
  }

  // If we tried to fetch but eventData is still null => error or not found
  if (!eventData) {
    return <div className="event-container">Event not found or access denied.</div>;
  }

  return (
    <div className="event-container">
      {eventImageUrl && (
        <div className="event-image" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img
            src={eventImageUrl}
            alt="Event"
            style={{ maxWidth: '300px', height: 'auto', borderRadius: '6px' }}
          />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
        <button className="back-button" onClick={onBack || (() => setCurrentView('events'))}>
          Back to Events
        </button>
        {isOwner && (
          <>
            <button 
              className="delete-post-button" 
              style={{ marginLeft: 'auto' }} 
              onClick={handleDeleteEvent}
            >
              Delete Event
            </button>
            <button 
              className="back-button" 
              style={{ marginLeft: '10px' }}
              onClick={handleOpenInviteModal}
            >
              Invite Friends
            </button>
          </>
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
        <p><strong>Privacy:</strong> {eventData.event_privacy}</p>
      </div>

      <h3 className="posts-header">
        {postId ? 'Viewing Post' : `Posts for ${eventData.event_name}`}
      </h3>

      {/* If not viewing a single post, show the create post form */}
      {!postId && isOwner && (
        <CreatePost
          token={token}
          currentUserId={currentUserId}
          onNewPost={(newPost) => setPosts((prev) => [newPost, ...prev])}
          eventId={eventId}
        />
      )}

      {/* Show loading or no-posts message */}
      {loadingPosts && <p className="loading-text">Loading event posts...</p>}
      {!loadingPosts && posts.length === 0 && <p className="empty">No posts yet for this event.</p>}

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

      {showInviteModal && (
        <EventInviteModal
          token={token}
          eventId={eventId}
          currentUserId={currentUserId}
          onClose={handleCloseInviteModal}
        />
      )}
    </div>
  );
};

export default Event;
