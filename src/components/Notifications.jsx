import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Notifications.css';
import ProfilePic from './ProfilePic.jsx';

const Notifications = ({
  token,
  onMarkAllRead,
  onProfileClick,
  onPostClick,
  onUnreadCountChange
}) => {
  const [notifications, setNotifications] = useState([]);

  // Helper to truncate text
  const truncateText = (text, maxLen) => {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  };

  // Remove mention markup like "@[zubzug](10) hey" => "zubzug hey"
  function removeMentionMarkup(text = '') {
    return text.replace(/@\[(.*?)\]\(\d+\)/g, '$1');
  }

  useEffect(() => {
    if (!token) return;

    axios
      .get('http://localhost:5000/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(async (res) => {
        const rawNotifications = res.data;

        // 1) Fetch actor data
        const withActors = await Promise.all(
          rawNotifications.map(async (notif) => {
            let actorObj = null;
            if (notif.actor_id) {
              try {
                const actorRes = await axios.get(
                  `http://localhost:5000/users/${notif.actor_id}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                actorObj = actorRes.data;
              } catch (err) {
                console.error('Error fetching actor details:', err);
              }
            }
            return { ...notif, actor: actorObj };
          })
        );

        // 2) Fetch snippet for each notification if needed (post/comment preview).
        //    We'll skip snippet logic for certain notifications (like EVENT_INVITE).
        const withSnippets = await Promise.all(
          withActors.map(async (notif) => {
            try {
              // Skip snippet for certain types
              if (notif.notification_type === 'EVENT_INVITE') {
                return notif;
              }

              // GROUP LOGIC
              if (notif.group_id) {
                // If reference_type is group_post or post => fetch the group post content
                if (
                  notif.reference_type === 'post' ||
                  notif.reference_type === 'group_post'
                ) {
                  const groupPostRes = await axios.get(
                    `http://localhost:5000/groups/${notif.group_id}/posts/${notif.reference_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const groupPostData = Array.isArray(groupPostRes.data)
                    ? groupPostRes.data[0]
                    : groupPostRes.data;
                  const rawContent = groupPostData?.content || '';
                  const snippet = truncateText(removeMentionMarkup(rawContent), 15);
                  return { ...notif, _snippet: snippet };
                } else {
                  // group_comment => fetch the group comment
                  const groupCommentRes = await axios.get(
                    `http://localhost:5000/groups/${notif.group_id}/comments/${notif.reference_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const groupCommentData = Array.isArray(groupCommentRes.data)
                    ? groupCommentRes.data[0]
                    : groupCommentRes.data;
                  const rawContent = groupCommentData?.content || '';
                  const snippet = truncateText(removeMentionMarkup(rawContent), 15);
                  const postId = groupCommentData?.post_id || null;
                  return {
                    ...notif,
                    _snippet: snippet,
                    _postId: postId,
                    group_id: notif.group_id
                  };
                }
              }
              // EVENT LOGIC
              else if (notif.event_id) {
                // If reference_type includes 'post', it's an event post
                if (notif.reference_type.toLowerCase().includes('post')) {
                  const eventPostRes = await axios.get(
                    `http://localhost:5000/events/${notif.event_id}/posts/${notif.reference_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const eventPostData = Array.isArray(eventPostRes.data)
                    ? eventPostRes.data[0]
                    : eventPostRes.data;
                  const rawContent = eventPostData?.content || '';
                  const snippet = truncateText(removeMentionMarkup(rawContent), 15);
                  return { ...notif, _snippet: snippet };
                } else {
                  // 'comment' => fetch the event comment
                  const eventCommentRes = await axios.get(
                    `http://localhost:5000/events/${notif.event_id}/comments/${notif.reference_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const eventCommentData = Array.isArray(eventCommentRes.data)
                    ? eventCommentRes.data[0]
                    : eventCommentRes.data;
                  const rawContent = eventCommentData?.content || '';
                  const snippet = truncateText(removeMentionMarkup(rawContent), 15);
                  const postId = eventCommentData?.post_id || null;
                  return {
                    ...notif,
                    _snippet: snippet,
                    _postId: postId,
                    event_id: notif.event_id
                  };
                }
              }
              // FEED LOGIC
              else {
                if (notif.reference_type === 'post') {
                  const postRes = await axios.get(
                    `http://localhost:5000/feed/${notif.reference_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const postData = Array.isArray(postRes.data)
                    ? postRes.data[0]
                    : postRes.data;
                  const rawContent = postData?.content || '';
                  const snippet = truncateText(removeMentionMarkup(rawContent), 15);
                  return { ...notif, _snippet: snippet };
                } else if (notif.reference_type === 'comment') {
                  const commentRes = await axios.get(
                    `http://localhost:5000/comments/${notif.reference_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const commentData = Array.isArray(commentRes.data)
                    ? commentRes.data[0]
                    : commentRes.data;
                  const rawContent = commentData?.content || '';
                  const snippet = truncateText(removeMentionMarkup(rawContent), 15);
                  const postId = commentData?.post_id || null;
                  return { ...notif, _snippet: snippet, _postId: postId };
                }
              }
            } catch (err) {
              console.error('Error fetching snippet for notification:', err);
              return notif; // fallback if snippet fetch fails
            }
            return notif; // fallback
          })
        );

        // 3) Sort: unread first, then by created_at desc
        const sortedNotifications = withSnippets.sort((a, b) => {
          if (a.is_read === 0 && b.is_read === 1) return -1;
          if (a.is_read === 1 && b.is_read === 0) return 1;
          return new Date(b.created_at) - new Date(a.created_at);
        });

        setNotifications(sortedNotifications);
      })
      .catch((err) => console.error('Error fetching notifications:', err));
  }, [token]);

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
        if (onUnreadCountChange) {
          onUnreadCountChange();
        }
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
        if (onMarkAllRead) {
          onMarkAllRead();
        }
        if (onUnreadCountChange) {
          onUnreadCountChange();
        }
      })
      .catch((err) => console.error('Error marking all as read:', err));
  };

  // On hover, mark as read
  const handleMouseEnter = (notif) => {
    if (notif.is_read === 0) {
      handleMarkAsRead(notif.notification_id);
    }
  };

  // Format message
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
      case 'GROUP_POST_CREATED':
        return 'created a new group post.';
      case 'GROUP_POST_LIKE':
        return 'liked your group post.';
      case 'GROUP_COMMENT_LIKE':
        return 'liked your group comment.';
      case 'GROUP_COMMENT_REPLY':
        return 'replied to your group comment.';
      case 'EVENT_INVITE':
        return 'invited you to the event';
      case 'EVENT_POST':
        return 'posted on your event.';
      case 'EVENT_POST_COMMENT':
        return 'commented on your event post.';
      case 'EVENT_POST_LIKE':
        return 'liked your event post.';
      default:
        const actorName = notif.actor?.username || 'Someone';
        return notif.message || `${actorName} did something.`;
    }
  };

  // For snippet text (post/comment preview) clicks
  const handleSnippetClick = (notif) => {
    if (!onPostClick) return;

    // For group or feed logic, you'd pass the appropriate payload
    if (notif.group_id) {
      // If it's a group post or comment
      if (notif.reference_type === 'post' || notif.reference_type === 'group_post') {
        onPostClick({ view: 'group', groupId: notif.group_id, postId: notif.reference_id });
      } else {
        onPostClick({
          view: 'group',
          groupId: notif.group_id,
          postId: notif._postId,
          expandedCommentId: notif.reference_id
        });
      }
    } 
    else if (notif.event_id) {
      // For event posts/comments
      onPostClick({
        view: 'event',
        eventId: notif.event_id,
        postId: notif.reference_type.toLowerCase().includes('post')
          ? notif.reference_id
          : notif._postId,
        expandedCommentId: notif.reference_type.toLowerCase().includes('comment')
          ? notif.reference_id
          : null
      });
    } 
    else {
      // feed logic
      if (notif.reference_type === 'post') {
        onPostClick({ view: 'feed', postId: notif.reference_id });
      } else {
        onPostClick({
          view: 'feed',
          postId: notif._postId,
          expandedCommentId: notif.reference_id
        });
      }
    }
  };

  // Actor profile
  const handleActorClick = (actorId) => {
    if (onProfileClick) onProfileClick(actorId);
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

        return (
          <div
            key={notif.notification_id}
            className={`notification-item ${isRead ? 'notification-read' : 'notification-unread'}`}
            onMouseEnter={() => handleMouseEnter(notif)}
          >
            <div className="notif-top-row">
              <div className="notif-left">
                <div className="actor-pic" onClick={() => handleActorClick(notif.actor_id)}>
                  <ProfilePic imageUrl={actorPic} alt={actor?.username || 'User'} size={40} />
                </div>
                <p className="notification-main-text">
                  <span className="actor-name" onClick={() => handleActorClick(notif.actor_id)}>
                    {actor?.username || 'Someone'}
                  </span>{' '}
                  {notif.notification_type === 'EVENT_INVITE' ? (
                    <>
                      {' invited you to the event '}
                      <span
                        className="event-invite-link"
                        style={{ color: '#1877f2', cursor: 'pointer', textDecoration: 'none' }}
                        onClick={() => {
                          if (onPostClick) {
                            onPostClick({
                              view: 'event',
                              eventId: notif.event_id
                            });
                          }
                        }}
                      >
                        {notif.message.match(/"([^"]+)"/)?.[1] || 'this event'}
                      </span>
                      .
                    </>
                  ) : (
                    mainText
                  )}
                </p>
              </div>
              <div className="notification-date">
                {new Date(notif.created_at).toLocaleString()}
              </div>
            </div>
            {/* If there's a snippet, show it. */}
            {notif._snippet && notif._snippet.length > 0 && (
              <div className="notification-snippet">
                <span className="snippet-text" onClick={() => handleSnippetClick(notif)}>
                  "{removeMentionMarkup(notif._snippet)}"
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
