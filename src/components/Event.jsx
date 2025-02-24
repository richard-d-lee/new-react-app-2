import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Post from './Post.jsx';
import CreatePost from './CreatePost.jsx';
import '../styles/Event.css';

const Event = ({ token, currentUserId, eventData, onBack, refreshEvents }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const eventId = eventData.event_id;
  const isOwner = (currentUserId === eventData.user_id);

  // Hardcoded fallback baseURL for images
  const baseURL = 'http://localhost:5000';

  // Build the event image URL if it exists
  const eventImageUrl = eventData.event_image_url
    ? `${baseURL}${eventData.event_image_url}`
    : null;

  // Fetch all posts for this event
  const fetchEventPosts = async () => {
    if (!token || !eventId) return;
    try {
      setLoading(true);
      const res = await axios.get(`${baseURL}/events/${eventId}/posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(res.data);
    } catch (err) {
      console.error('Error fetching event posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, token]);

  // Called when a new post is created via CreatePost
  const handleNewPost = (newPost) => {
    // Prepend the new post to the existing list
    setPosts((prev) => [newPost, ...prev]);
  };

  // Refresh if a post is deleted
  const handlePostDelete = () => {
    fetchEventPosts();
  };

  return (
    <div className="event-container">
      {/* Render the event image at the top */}
      {eventImageUrl && (
        <div className="event-image" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img
            src={eventImageUrl}
            alt="Event"
            style={{ maxWidth: '300px', height: 'auto', borderRadius: '6px' }}
          />
        </div>
      )}

      <button className="back-button" onClick={onBack}>Back to Events</button>
      <h2 className="event-title">{eventData.event_name}</h2>

      <div className="event-details">
        <p><strong>Owner:</strong> {isOwner ? 'You' : `User #${eventData.user_id}`}</p>
        <p><strong>Description:</strong> {eventData.event_description}</p>
        <p><strong>Location:</strong> {eventData.event_location}</p>
        <p><strong>Start:</strong> {new Date(eventData.start_time).toLocaleString()}</p>
        <p><strong>End:</strong> {new Date(eventData.end_time).toLocaleString()}</p>
        <p><strong>Privacy:</strong> {eventData.event_privacy}</p>
      </div>

      <h3 className="posts-header">Posts for {eventData.event_name}</h3>

      {/* CreatePost is now placed directly under the "Posts for..." header */}
      <CreatePost
        token={token}
        currentUserId={currentUserId}
        onNewPost={handleNewPost}
        eventId={eventId}
      />

      {loading && <p className="loading-text">Loading event posts...</p>}
      {!loading && posts.length === 0 && <p className="empty">No posts yet for this event.</p>}

      <div className="event-posts-list">
        {posts.map((post) => (
          <Post
            key={post.post_id}
            post={post}
            token={token}
            currentUserId={currentUserId}
            onDelete={handlePostDelete}
            setCurrentView={() => {}}
            onProfileClick={() => {}}
          />
        ))}
      </div>
    </div>
  );
};

export default Event;
