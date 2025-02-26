import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/Friends.css';

const Friends = ({ refreshFriendRequestsCount }) => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [acceptedFriends, setAcceptedFriends] = useState([]);
  const [outboundRequests, setOutboundRequests] = useState([]);
  const [suggestedFriends, setSuggestedFriends] = useState([]);
  const [error, setError] = useState('');
  const [currentFriendsSearch, setCurrentFriendsSearch] = useState('');
  const token = localStorage.getItem('authToken');
  const baseURL = 'http://localhost:5000';

  // Fetch inbound pending requests and accepted friends
  const fetchFriendsData = async () => {
    try {
      const pendingRes = await axios.get(`${baseURL}/friends/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingRequests(pendingRes.data);

      const acceptedRes = await axios.get(`${baseURL}/friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAcceptedFriends(acceptedRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error fetching friend data.');
    }
  };

  // Fetch outbound pending requests (sent requests)
  const fetchOutboundRequests = async () => {
    try {
      const res = await axios.get(`${baseURL}/friends/outbound`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOutboundRequests(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error fetching outbound requests.');
    }
  };

  // Fetch suggested friends
  const fetchSuggestedFriends = async () => {
    try {
      const res = await axios.get(`${baseURL}/friends/possible-friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Show all data from the API (adjust filter if needed)
      setSuggestedFriends(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error fetching suggested friends.');
    }
  };

  // Combined refresh function
  const refreshData = useCallback(() => {
    if (!token) return;
    fetchFriendsData();
    fetchOutboundRequests();
    fetchSuggestedFriends();
  }, [token]);

  useEffect(() => {
    if (token) {
      refreshData();
    }
  }, [token, refreshData]);

  // Confirm an incoming friend request
  const handleConfirm = async (friendId) => {
    try {
      await axios.post(
        `${baseURL}/friends/confirm`,
        { friendId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      refreshData();
      refreshFriendRequestsCount();
    } catch (err) {
      setError(err.response?.data?.error || 'Error confirming friend request.');
    }
  };

  // Decline an incoming friend request
  const handleDecline = async (friendId) => {
    try {
      await axios.post(
        `${baseURL}/friends/decline`,
        { friendId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      refreshData();
      refreshFriendRequestsCount();
    } catch (err) {
      setError(err.response?.data?.error || 'Error declining friend request.');
    }
  };

  // Unfriend a current friend
  const handleRemove = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    try {
      await axios.post(
        `${baseURL}/friends/remove`,
        { friendId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      refreshData();
      refreshFriendRequestsCount();
    } catch (err) {
      setError(err.response?.data?.error || 'Error removing friend.');
    }
  };

  // Send friend request from suggested friends
  const handleAddFriend = async (friendEmail) => {
    try {
      await axios.post(
        `${baseURL}/friends/add-friend`,
        { friendEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      refreshData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error sending friend request.');
    }
  };

  // Cancel an outbound friend request
  const handleCancel = async (friendId) => {
    try {
      await axios.post(
        `${baseURL}/friends/cancel`,
        { friendId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      refreshData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error cancelling friend request.');
    }
  };

  // Filter accepted friends based on search query (username only)
  const filteredAcceptedFriends = acceptedFriends.filter(user =>
    user.username.toLowerCase().includes(currentFriendsSearch.toLowerCase())
  );

  return (
    <div className="friends-page">
      <h2>Friends</h2>
      {error && <p className="error">{error}</p>}

      <div className="friends-grid">
        {/* Current Friends Section - Top Right */}
        <div className="friends-section current">
          <h3>Current Friends</h3>
          <input
            type="text"
            placeholder="Search current friends..."
            value={currentFriendsSearch}
            onChange={(e) => setCurrentFriendsSearch(e.target.value)}
            className="search-input"
          />
          {filteredAcceptedFriends.length === 0 ? (
            <p className="empty">No current friends</p>
          ) : (
            filteredAcceptedFriends.map(user => (
              <div className="friend-card" key={user.user_id}>
                <div className="friend-left">
                  <img
                    src={
                      user.profile_picture_url
                        ? `${baseURL}${user.profile_picture_url}`
                        : 'https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg'
                    }
                    alt={user.username}
                    className="friend-avatar"
                  />
                  <p className="friend-name">{user.username}</p>
                </div>
                <div className="friend-right">
                  <button className="btn btn-large btn-gray" onClick={() => handleRemove(user.user_id)}>
                    Unfriend
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Suggested Friends Section - Top Left */}
        <div className="friends-section suggested">
          <h3>Suggested Friends</h3>
          {suggestedFriends.length === 0 ? (
            <p className="empty">No suggestions available</p>
          ) : (
            suggestedFriends.map(friend => (
              <div className="friend-card" key={friend.user_id}>
                <div className="friend-left">
                  <img
                    src={
                      friend.profile_picture_url
                        ? `${baseURL}${friend.profile_picture_url}`
                        : 'https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg'
                    }
                    alt={friend.username}
                    className="friend-avatar"
                  />
                  <p className="friend-name">{friend.username}</p>
                </div>
                <div className="friend-right">
                  <button
                    className="btn btn-large btn-blue"
                    onClick={() => handleAddFriend(friend.email)}
                  >
                    Add
                  </button>
                </div>
              </div>
            ))
          )}
        </div>


        {/* Incoming Requests Section - Bottom Left */}
        <div className="friends-section incoming">
          <h3>Incoming Requests</h3>
          {pendingRequests.length === 0 ? (
            <p className="empty">No pending requests</p>
          ) : (
            pendingRequests.map(user => (
              <div className="friend-card" key={user.user_id}>
                <div className="friend-left">
                  <img
                    src={
                      user.profile_picture_url
                        ? `${baseURL}${user.profile_picture_url}`
                        : 'https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg'
                    }
                    alt={user.username}
                    className="friend-avatar"
                  />
                  <p className="friend-name">{user.username}</p>
                </div>
                <div className="friend-right stacked">
                  <button className="btn btn-blue" onClick={() => handleConfirm(user.user_id)}>
                    Confirm
                  </button>
                  <button className="btn btn-gray" onClick={() => handleDecline(user.user_id)}>
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Outgoing Requests Section - Bottom Right */}
        <div className="friends-section outgoing">
          <h3>Outgoing Requests</h3>
          {outboundRequests.length === 0 ? (
            <p className="empty">No pending requests</p>
          ) : (
            outboundRequests.map(friend => (
              <div className="friend-card" key={friend.user_id}>
                <div className="friend-left">
                  <img
                    src={
                      friend.profile_picture_url
                        ? `${baseURL}${friend.profile_picture_url}`
                        : 'https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg'
                    }
                    alt={friend.username}
                    className="friend-avatar"
                  />
                  <p className="friend-name">{friend.username}</p>
                </div>
                <div className="friend-right">
                  <button className="btn btn-large btn-gray" onClick={() => handleCancel(friend.user_id)}>
                    Cancel
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Friends;