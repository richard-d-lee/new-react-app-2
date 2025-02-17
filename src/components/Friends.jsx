import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/Friends.css';

const Friends = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [acceptedFriends, setAcceptedFriends] = useState([]);
  const [error, setError] = useState('');

  const token = localStorage.getItem('authToken');

  // Fetch inbound pending requests and accepted friends
  const fetchFriendsData = async () => {
    try {
      // Inbound pending requests
      const pendingRes = await axios.get('http://localhost:5000/friends/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingRequests(pendingRes.data);

      // Accepted friends
      const acceptedRes = await axios.get('http://localhost:5000/friends', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAcceptedFriends(acceptedRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    }
  };

  useEffect(() => {
    if (token) {
      fetchFriendsData();
    }
  }, [token]);

  // Confirm inbound friend request
  const handleConfirm = async (friendId) => {
    try {
      await axios.post('http://localhost:5000/friends/confirm', { friendId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFriendsData();
      // Refresh possible friends as well (if needed)
      window.dispatchEvent(new Event('refreshPossibleFriends'));
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong confirming request.');
    }
  };

  // Decline inbound friend request
  const handleDecline = async (friendId) => {
    try {
      await axios.post('http://localhost:5000/friends/decline', { friendId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFriendsData();
      window.dispatchEvent(new Event('refreshPossibleFriends'));
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong declining request.');
    }
  };

  // Remove (unfriend) an accepted friend
  const handleRemove = async (friendId) => {
    const confirmRemove = window.confirm('Are you sure you want to remove this friend?');
    if (!confirmRemove) return;
    try {
      await axios.post('http://localhost:5000/friends/remove', { friendId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFriendsData();
      window.dispatchEvent(new Event('refreshPossibleFriends'));
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong removing friend.');
    }
  };

  // Base URL for images
  const baseURL = "http://localhost:5000";

  return (
    <div className="friends-container">
      <h2>Friends</h2>
      {error && <p className="error">{error}</p>}

      {/* Inbound Pending Requests */}
      <div className="pending-section">
        <h3>Incoming Requests</h3>
        {pendingRequests.length === 0 ? (
          <p className="empty">No pending requests</p>
        ) : (
          pendingRequests.map(user => (
            <div className="friend-card" key={user.user_id}>
              <div className="friend-details">
                <img
                  src={
                    user.profile_picture_url 
                      ? `${baseURL}${user.profile_picture_url}` 
                      : "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg"
                  }
                  alt={user.username}
                />
                <div className="friend-info">
                  <p className="friend-name">{user.username}</p>
                  <p className="friend-email">{user.email}</p>
                </div>
              </div>
              <div className="friend-actions">
                <button className="confirm-btn" onClick={() => handleConfirm(user.user_id)}>
                  Confirm
                </button>
                <button className="decline-btn" onClick={() => handleDecline(user.user_id)}>
                  Decline
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Accepted Friends */}
      <div className="accepted-section">
        <h3>Current Friends</h3>
        {acceptedFriends.length === 0 ? (
          <p className="empty">No current friends</p>
        ) : (
          acceptedFriends.map(user => (
            <div className="friend-card" key={user.user_id}>
              <div className="friend-details">
                <img
                  src={
                    user.profile_picture_url 
                      ? `${baseURL}${user.profile_picture_url}` 
                      : "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg"
                  }
                  alt={user.username}
                />
                <div className="friend-info">
                  <p className="friend-name">{user.username}</p>
                  <p className="friend-email">{user.email}</p>
                </div>
              </div>
              <button className="remove-btn" onClick={() => handleRemove(user.user_id)}>
                Unfriend
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Friends;
