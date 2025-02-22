import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Notifications.css';
import ProfilePic from './ProfilePic.jsx';

const Notifications = ({ token, onMarkAllRead, onProfileClick, onPostClick }) => {
  const [notifications, setNotifications] = useState([]);

  // Helper: truncate text to a maximum length
  const truncateText = (text, maxLen) => {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  };

  useEffect(() => {
    if (!token) return;
    axios
      .get('http://localhost:5000/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(async (res) => {
        const rawNotifications = res.data;
        console.log(rawNotifications)

        // 1. Fetch actor data for each notification (if available)
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

        // 2. Fetch snippet based on notification type
        const withSnippets = await Promise.all(
          withActors.map(async (notif) => {
            try {
              // Handle post-related notifications
              if (notif.reference_type === 'post' || notif.reference_type === 'group_post') {
                if (notif.reference_type === 'group_post') {
                  // For group posts, require a valid group_id and call the group endpoint.
                  if (!notif.group_id) {
                    console.error("Missing group_id for group_post notification", notif);
                    return notif;
                  }
                  const groupPostRes = await axios.get(
                    `http://localhost:5000/groups/${notif.group_id}/posts/${notif.reference_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const groupPostData = Array.isArray(groupPostRes.data)
                    ? groupPostRes.data[0]
                    : groupPostRes.data;
                  const snippet = truncateText(groupPostData?.content || '', 15);
                  return { ...notif, _snippet: snippet };
                } else {
                  // Regular feed post
                  const postRes = await axios.get(
                    `http://localhost:5000/feed/${notif.reference_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const postData = Array.isArray(postRes.data)
                    ? postRes.data[0]
                    : postRes.data;
                  const snippet = truncateText(postData?.content || '', 15);
                  return { ...notif, _snippet: snippet };
                }
              }
              // Handle comment notifications
              if (notif.reference_type === 'comment' || notif.reference_type === 'group_comment') {
                let isGroup = notif.reference_type === 'group_comment' || !!notif.group_id;
                if (isGroup) {
                  let groupId = notif.group_id;
                  // If group_id is missing, attempt to retrieve it from the comment's post via /feed/
                  if (!groupId) {
                    try {
                      const commentRes = await axios.get(
                        `http://localhost:5000/comments/${notif.reference_id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      const commentData = Array.isArray(commentRes.data)
                        ? commentRes.data[0]
                        : commentRes.data;
                      if (commentData?.post_id) {
                        const postRes = await axios.get(
                          `http://localhost:5000/feed/${commentData.post_id}`,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        const postData = Array.isArray(postRes.data)
                          ? postRes.data[0]
                          : postRes.data;
                        groupId = postData?.group_id;
                      }
                    } catch (err) {
                      console.error('Error fetching group_id for comment:', err);
                    }
                  }
                  if (groupId) {
                    const groupCommentRes = await axios.get(
                      `http://localhost:5000/groups/${groupId}/comments/${notif.reference_id}`,
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const groupCommentData = Array.isArray(groupCommentRes.data)
                      ? groupCommentRes.data[0]
                      : groupCommentRes.data;
                    const snippet = truncateText(groupCommentData?.content || '', 15);
                    const postId = groupCommentData?.post_id || null;
                    return { ...notif, _snippet: snippet, _postId: postId, group_id: groupId };
                  } else {
                    // Fallback: regular comment endpoint
                    const commentRes = await axios.get(
                      `http://localhost:5000/comments/${notif.reference_id}`,
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const commentData = Array.isArray(commentRes.data)
                      ? commentRes.data[0]
                      : commentRes.data;
                    const snippet = truncateText(commentData?.content || '', 15);
                    const postId = commentData?.post_id || null;
                    return { ...notif, _snippet: snippet, _postId: postId };
                  }
                } else {
                  // Regular comment
                  const commentRes = await axios.get(
                    `http://localhost:5000/comments/${notif.reference_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const commentData = Array.isArray(commentRes.data)
                    ? commentRes.data[0]
                    : commentRes.data;
                  const snippet = truncateText(commentData?.content || '', 15);
                  const postId = commentData?.post_id || null;
                  return { ...notif, _snippet: snippet, _postId: postId };
                }
              }
            } catch (err) {
              console.error('Error fetching snippet for notification:', err);
              return notif;
            }
            return notif;
          })
        );

        setNotifications(withSnippets);
      })
      .catch((err) => console.error('Error fetching notifications:', err));
  }, [token]);

  // Mark a single notification as read
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
      .catch(err => console.error('Error marking notification as read:', err));
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
      .catch(err => console.error('Error marking all as read:', err));
  };

  // When hovering over a notification, mark it as read if not already.
  const handleMouseEnter = (notif) => {
    if (notif.is_read === 0) {
      handleMarkAsRead(notif.notification_id);
    }
  };

  // Format the notification message based on its type.
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
      default:
        const actorName = notif.actor?.username || 'Someone';
        return notif.message || `${actorName} did something.`;
    }
  };

  // Handle clicking on the snippet to navigate to the related post/comment.
  const handleSnippetClick = (notif) => {
    if (!onPostClick) return;
    if (notif.group_id) {
      // For group-related notifications, navigate to the group view.
      if (notif.reference_type === 'post' || notif.reference_type === 'group_post') {
        onPostClick({
          view: 'group',
          groupId: notif.group_id,
          postId: notif.reference_id
        });
      } else if ((notif.reference_type === 'comment' || notif.reference_type === 'group_comment') && notif._postId) {
        onPostClick({
          view: 'group',
          groupId: notif.group_id,
          postId: notif._postId,
          expandedCommentId: notif.reference_id
        });
      }
    } else {
      // Otherwise, fallback to the feed view.
      if (notif.reference_type === 'post') {
        onPostClick({ view: 'feed', postId: notif.reference_id });
      } else if (notif.reference_type === 'comment' && notif._postId) {
        onPostClick({ view: 'feed', postId: notif._postId, expandedCommentId: notif.reference_id });
      }
    }
  };

  // Handle clicking on the actor's profile.
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
        const snippet = notif._snippet;
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
                  </span>
                  {` ${mainText}`}
                </p>
              </div>
              <div className="notification-date">
                {new Date(notif.created_at).toLocaleString()}
              </div>
            </div>
            {snippet && snippet.length > 0 && (
              <div className="notification-snippet">
                <span className="snippet-text" onClick={() => handleSnippetClick(notif)}>
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
