import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Post from './Post.jsx';
import CreatePost from './CreatePost.jsx';
import EventInviteModal from './EventInviteModal.jsx';
import EventModal from './EventModal.jsx';
import MembersModal from './MembersModal.jsx';
import '../styles/Event.css';

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
  const PRIVACY_LABELS = {
    public: 'Public',
    friends_only: 'Friends Only',
    private: 'Private'
  };

  const [eventData, setEventData] = useState(propEventData || null);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);

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
  const realEventId = eventData?.event_id || propEventId;
  const isOwner = currentUserId && eventData && eventData.user_id === currentUserId;

  const eventImageUrl = eventData?.event_image_url ? `${baseURL}${eventData.event_image_url}` : null;

  const fullDescription = eventData?.event_description || '';
  const shouldTruncate = fullDescription.length > 200;
  const displayedDescription = shouldTruncate && !showFullDescription
    ? `${fullDescription.slice(0, 200)}...`
    : fullDescription;

  const toggleDescription = () => setShowFullDescription(prev => !prev);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    });
    const formattedDate = date.toLocaleDateString('en-US');
    return `${formattedTime} ${formattedDate}`;
  };

  const fetchEventData = async () => {
    if (!token || !realEventId) return;
    setLoadingEvent(true);
    try {
      const res = await axios.get(`${baseURL}/events/${realEventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEventData(res.data);
    } catch (err) {
      console.error('Error fetching event data:', err);
    } finally {
      setLoadingEvent(false);
    }
  };

  const fetchEventPosts = async () => {
    if (!token || !realEventId) return;
    setLoadingPosts(true);
    try {
      if (postId) {
        const res = await axios.get(`${baseURL}/events/${realEventId}/posts/${postId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const postData = Array.isArray(res.data) ? res.data[0] : res.data;
        setPosts(postData ? [postData] : []);
      } else {
        const res = await axios.get(`${baseURL}/events/${realEventId}/posts`, {
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

  const fetchAttendanceStatus = async () => {
    if (!token || !realEventId) return;
    try {
      const res = await axios.get(`${baseURL}/events/${realEventId}/attendees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const myAttendance = res.data.find(att => att.user_id === currentUserId);
      setAttendanceStatus(myAttendance ? myAttendance.status : null);
    } catch (err) {
      console.error('Error fetching attendance status:', err);
    }
  };

  useEffect(() => {
    if (realEventId) {
      fetchEventData();
      fetchAttendanceStatus();
    }
  }, [realEventId, token]);

  useEffect(() => {
    if (realEventId) {
      fetchEventPosts();
    }
  }, [realEventId, token, postId]);

  useEffect(() => {
    if (postRef.current) {
      postRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [posts]);

  const handleDeletePost = (deletedPostId) => {
    setPosts(prev => prev.filter(post => post.post_id !== deletedPostId));
  };

  const handleDeleteEvent = async () => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await axios.delete(`${baseURL}/events/${realEventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (onBack) {
        onBack();
      } else if (setCurrentView) {
        setCurrentView('events');
      }
      if (refreshEvents) refreshEvents();
    } catch (err) {
      console.error('Error deleting event:', err);
      alert(err.response?.data?.error || 'Error deleting event');
    }
  };

  const toggleAttendance = async () => {
    if (isOwner) return;
    const newStatus = attendanceStatus === 'going' ? 'declined' : 'going';
    try {
      await axios.post(
        `${baseURL}/events/${realEventId}/attend`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAttendanceStatus(newStatus);
    } catch (err) {
      console.error('Error updating attendance status:', err);
      alert(err.response?.data?.error || 'Error updating attendance status');
    }
  };

  const handleOpenInviteModal = () => {
    setShowMenu(false);
    setShowInviteModal(true);
  };
  const handleCloseInviteModal = () => setShowInviteModal(false);

  const handleOpenEditModal = () => {
    setShowMenu(false);
    if (eventData) {
      setEditEventName(eventData.event_name || '');
      setEditEventDescription(eventData.event_description || '');
      setEditEventLocation(eventData.event_location || '');
      setEditEventPrivacy(eventData.event_privacy || 'public');
      setEditImageFile(null);
      setEditStartTime(formatDateTimeLocal(eventData.start_time));
      setEditEndTime(formatDateTimeLocal(eventData.end_time));
    }
    setShowEditModal(true);
  };
  const handleCloseEditModal = () => setShowEditModal(false);

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
      await axios.patch(`${baseURL}/events/${realEventId}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (editImageFile) {
        const formData = new FormData();
        formData.append('image', editImageFile);
        await axios.post(`${baseURL}/events/${realEventId}/upload-image`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }
      await fetchEventData();
      if (refreshEvents) refreshEvents();
      setShowEditModal(false);
    } catch (err) {
      console.error('Error updating event:', err);
      alert(err.response?.data?.error || 'Error updating event');
    }
  };

  if (!eventData && loadingEvent) {
    return <div className="event-container">Loading event data...</div>;
  }
  if (!eventData) {
    return <div className="event-container">Event not found or access denied.</div>;
  }

  return (
    <div className="event-container">
      <div className="back-button-container">
        <button
          className="back-btn"
          onClick={onBack || (() => setCurrentView('events'))}
        >
          ← Back
        </button>
      </div>

      {eventImageUrl && (
        <div className="event-image">
          <img src={eventImageUrl} alt="Event" />
        </div>
      )}

      <div className="action-row">
        <div className="left-actions">
          {!isOwner && (
            <button
              onClick={toggleAttendance}
              className={`common-button ${attendanceStatus === 'going' ? 'attending' : ''}`}
            >
              {attendanceStatus === 'going' ? 'Cancel Attendance' : 'Attend Event'}
            </button>
          )}
          {(isOwner || attendanceStatus === 'going') && (
            <button
              className="common-button"
              onClick={() => setShowAttendeesModal(true)}
            >
              View Attendees
            </button>
          )}
        </div>

        <div className="right-actions">
          {isOwner && (
            <div className="owner-dropdown-container">
              <button
                className="owner-dropdown"
                onClick={() => setShowMenu(prev => !prev)}
              >
                &#x22EE;
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
        <p>
          <strong>Location:</strong>{' '}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              eventData.event_location
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {eventData.event_location}
          </a>
        </p>
        <p><strong>Start:</strong> {formatDateTime(eventData.start_time)}</p>
        <p><strong>End:</strong> {formatDateTime(eventData.end_time)}</p>
        {eventData.type_name && <p><strong>Type:</strong> {eventData.type_name}</p>}
        <p>
          <strong>Privacy:</strong>{' '}
          {PRIVACY_LABELS[eventData.event_privacy] || eventData.event_privacy}
        </p>
      </div>

      <h3 className="posts-header">
        {postId ? 'Viewing Post' : `Posts for ${eventData.event_name}`}
      </h3>

      {(!postId && (isOwner || attendanceStatus === 'going')) && (
        <CreatePost
          token={token}
          currentUserId={currentUserId}
          onNewPost={(newPost) => setPosts(prev => [newPost, ...prev])}
          eventId={realEventId}
        />
      )}

      {loadingPosts && <p className="loading-text">Loading event posts...</p>}
      {!loadingPosts && posts.length === 0 && (
        <p className="empty">No posts yet for this event.</p>
      )}

      <div className="event-posts-list">
        {posts.map(post => (
          <div key={post.post_id} ref={postId ? postRef : null}>
            <Post
              post={post}
              token={token}
              currentUserId={currentUserId}
              onDelete={handleDeletePost}
              setCurrentView={setCurrentView}
              eventId={realEventId}
              eventPostId={post.post_id}
              expandedCommentId={expandedCommentId}
            />
          </div>
        ))}
      </div>

      {showInviteModal && (
        <EventInviteModal
          token={token}
          eventId={realEventId}
          currentUserId={currentUserId}
          onClose={handleCloseInviteModal}
        />
      )}

      {showEditModal && (
        <EventModal
          token={token}
          eventData={eventData}
          onClose={() => setShowEditModal(false)}
          onEventSaved={fetchEventData}
        />
      )}

      {showAttendeesModal && (
        <MembersModal
          token={token}
          type="event"
          itemId={realEventId}
          title={eventData.event_name}
          currentUserId={currentUserId}
          onClose={() => setShowAttendeesModal(false)}
          isOwnerOrAdmin={isOwner}
        />
      )}
    </div>
  );
};

export default Event;
