import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Notifications.css';
import ProfilePic from './ProfilePic.jsx';

const Notifications = ({ token, onMarkAllRead, onProfileClick, onPostClick }) => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!token) return;

    axios
      .get('http://localhost:5000/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(async (res) => {
        const rawNotifications = res.data;

        // 1) Fetch actor data if actor_id is present
        const withActors = await Promise.all(
          rawNotifications.map(async (notif) => {
            let actorObj = null;
            if (notif.actor_id) {
              try {
                const actorRes = await axios.get(`http://localhost:5000/users/${notif.actor_id}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                actorObj = actorRes.data;
              } catch (err) {
                console.error('Error fetching actor details:', err);
              }
            }
            return { ...notif, actor: actorObj };
          })
        );

        // 2) If reference_type is post or comment, fetch snippet
        const withSnippets = await Promise.all(
          withActors.map(async (notif) => {
            if (notif.reference_type === 'post') {
              try {
                const postRes = await axios.get(`http://localhost:5000/posts/${notif.reference_id}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                // In some setups, postRes.data might be an array, so handle that:
                const postData = Array.isArray(postRes.data) ? postRes.data[0] : postRes.data;

                // Debug log: see what is actually returned
                console.log('Fetched post data:', postData);

                // Attempt to get the content from multiple possible fields
                const rawContent = postData?.content || postData?.text || postData?.body || '';
                const snippet = truncateText(rawContent, 15);

                return { ...notif, _snippet: snippet, _postOwnerId: postData.user_id };
              } catch (err) {
                console.error('Error fetching post snippet:', err);
                return notif;
              }
            } else if (notif.reference_type === 'comment') {
              try {
                const commentRes = await axios.get(`http://localhost:5000/comments/${notif.reference_id}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                // Possibly an array
                const commentData = Array.isArray(commentRes.data)
                  ? commentRes.data[0]
                  : commentRes.data;

                // Debug log
                console.log('Fetched comment data:', commentData);

                const rawContent = commentData?.content || commentData?.text || commentData?.body || '';
                const snippet = truncateText(rawContent, 15);

                // Optionally fetch the post for context
                let postOwnerId = null;
                let postId = commentData.post_id;

                if (postId) {
                  try {
                    const postRes = await axios.get(`http://localhost:5000/posts/${postId}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    const fetchedPost = Array.isArray(postRes.data)
                      ? postRes.data[0]
                      : postRes.data;
                    postOwnerId = fetchedPost?.user_id;
                  } catch (err) {
                    console.error('Error fetching post for comment context:', err);
                  }
                }

                return {
                  ...notif,
                  _snippet: snippet,
                  _postId: postId,
                  _postOwnerId: postOwnerId
                };
              } catch (err) {
                console.error('Error fetching comment snippet:', err);
                return notif;
              }
            }
            return notif; // If no reference_type, just return as-is
          })
        );

        setNotifications(withSnippets);
      })
      .catch((err) => console.error('Error fetching notifications:', err));
  }, [token]);

  // Helper to truncate text
  const truncateText = (text, maxLen) => {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  };

  // Mark single notification as read
  const handleMarkAsRead = (id) => {
    axios
      .patch(`http://localhost:5000/notifications/${id}/mark-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.notification_id === id ? { ...n, is_read: 1 } : n))
        );
      })
      .catch((err) => console.error('Error marking notification as read:', err));
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = () => {
    axios
      .patch('http://localhost:5000/notifications/mark-all-read', {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
        if (onMarkAllRead) onMarkAllRead();
      })
      .catch((err) => console.error('Error marking all as read:', err));
  };

  // Hover => mark as read
  const handleMouseEnter = (notif) => {
    if (notif.is_read === 0) {
      handleMarkAsRead(notif.notification_id);
    }
  };

  // Build main line
  const formatNotificationMessage = (notif) => {
    switch (notif.notification_type) {
      case 'FRIEND_REQUEST_ACCEPTED':
        return 'accepted your friend request.';
      case 'POST_LIKE':
        return 'liked your post.';
      case 'POST_COMMENT':
        return 'commented on your post.';
      case 'COMMENT_LIKE':
        return 'liked your comment.';
      case 'COMMENT_REPLY':
        return 'replied to your comment.';
      default:
        const actorName = notif.actor?.username || 'Someone';
        return notif.message || `${actorName} did something.`;
    }
  };

  // Handle snippet click => pass post ID to parent
  const handleSnippetClick = (notif) => {
    if (!onPostClick) return;
    // For regular posts or comments
    if (notif.reference_type === 'post') {
      onPostClick({ view: 'feed', postId: notif.reference_id });
    } else if (notif.reference_type === 'comment' && notif._postId) {
      onPostClick({ view: 'feed', postId: notif._postId, expandedCommentId: notif.reference_id });
    }
    // For group posts and comments
    else if (notif.reference_type === 'group_post') {
      // Pass along group_id from your notification payload
      onPostClick({ view: 'group', groupId: notif.group_id, postId: notif.reference_id });
    } else if (notif.reference_type === 'group_comment' && notif._postId) {
      onPostClick({ view: 'group', groupId: notif.group_id, postId: notif._postId, expandedCommentId: notif.reference_id });
    }
  };
  



  // Handle actor click => pass actor ID to parent
  const handleActorClick = (actorId) => {
    if (onProfileClick) {
      onProfileClick(actorId);
    }
  };

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h2>Notifications</h2>
        {notifications.length > 0 && (
          <button onClick={handleMarkAllAsRead} className="mark-all-read-btn">
            Mark All as Read
          </button>
        )}
      </div>

      {notifications.length === 0 && <p>No notifications yet.</p>}

      {notifications.map((notif) => {
        const isRead = notif.is_read === 1;
        const actor = notif.actor;
        const actorPic = actor?.profile_picture_url
          ? `http://localhost:5000${actor.profile_picture_url}`
          : 'https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg';

        const mainText = formatNotificationMessage(notif);
        const snippet = notif._snippet; // short preview from the post/comment

        return (
          <div
            key={notif.notification_id}
            className={`notification-item ${isRead ? 'notification-read' : 'notification-unread'}`}
            onMouseEnter={() => handleMouseEnter(notif)}
          >
            {/* Actor section */}
            <div className="actor-section">
              <div className="actor-pic" onClick={() => handleActorClick(notif.actor_id)}>
                <ProfilePic imageUrl={actorPic} alt={actor?.username || 'User'} size={40} />
              </div>
              <p className="notification-main-text">
                <span className="actor-name" onClick={() => handleActorClick(notif.actor_id)}>
                  {actor?.username || 'Someone'}
                </span>
                {` ${mainText}`}
              </p>
            </div>

            {/* Date */}
            <div className="notification-date">
              {new Date(notif.created_at).toLocaleString()}
            </div>

            {/* Snippet preview */}
            {snippet && snippet.length > 0 && (
              <div className="notification-snippet">
                <span
                  className="snippet-text"
                  onClick={() => handleSnippetClick(notif)}
                >
                  "{snippet}"
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Notifications;
