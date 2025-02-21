// Notifications.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Notifications = ({ token, onMarkAllRead }) => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!token) return;
    axios.get('http://localhost:5000/notifications', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setNotifications(res.data))
      .catch(err => console.error('Error fetching notifications:', err));
  }, [token]);

  // Mark a single notification as read
  const handleMarkAsRead = (id) => {
    axios.patch(`http://localhost:5000/notifications/${id}/mark-read`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(() => {
        setNotifications(prev =>
          prev.map(n =>
            n.notification_id === id ? { ...n, is_read: 1 } : n
          )
        );
      })
      .catch(err => console.error('Error marking notification as read:', err));
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = () => {
    axios.patch('http://localhost:5000/notifications/mark-all-read', {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(() => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        if (onMarkAllRead) onMarkAllRead();
      })
      .catch(err => console.error('Error marking all as read:', err));
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Notifications</h2>
      {notifications.length > 0 && (
        <button onClick={handleMarkAllAsRead} style={{ marginBottom: '1rem' }}>
          Mark All as Read
        </button>
      )}
      {notifications.length === 0 && <p>No notifications yet.</p>}
      
      {notifications.map(notification => (
        <div
          key={notification.notification_id}
          style={{
            border: '1px solid #ccc',
            background: notification.is_read ? '#fff' : '#eef',
            padding: '8px',
            marginBottom: '8px'
          }}
        >
          <p>{notification.message}</p>
          <small>Type: {notification.notification_type}</small><br />
          <small>{new Date(notification.created_at).toLocaleString()}</small>
          {!notification.is_read && (
            <button
              onClick={() => handleMarkAsRead(notification.notification_id)}
              style={{ marginLeft: '1rem' }}
            >
              Mark as Read
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default Notifications;
