import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "../styles/SuggestedFriends.css";

const SuggestedFriends = ({ email }) => {
  const [error, setError] = useState("");
  const [outbound, setOutbound] = useState([]); // Outbound pending requests
  const [suggested, setSuggested] = useState([]); // Users with no relationship
  const token = localStorage.getItem("authToken");

  // Fetch outbound pending requests (requests YOU have sent)
  const fetchOutbound = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:5000/friends/outbound", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOutbound(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Error fetching outbound requests");
    }
  }, [token]);

  // Fetch suggested friends
  const fetchSuggested = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:5000/friends/possible-friends", {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Filter out those with friend_status other than 'none' if needed
      // or remove the filter if you want them all
      const filtered = res.data.filter((f) => f.friend_status !== "none");
      setSuggested(filtered);
    } catch (err) {
      setError(err.response?.data?.error || "Error fetching suggested friends");
    }
  }, [token]);

  // Combined refresh function
  const refreshData = useCallback(() => {
    fetchOutbound();
    fetchSuggested();
  }, [fetchOutbound, fetchSuggested]);

  useEffect(() => {
    if (token) {
      refreshData();
    }
  }, [token, refreshData]);

  // Add friend: send friend request
  const handleAddFriend = async (friendEmail) => {
    try {
      await axios.post(
        "http://localhost:5000/friends/add-friend",
        { friendEmail, email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Refresh lists after adding a friend
      refreshData();
    } catch (err) {
      setError(err.response?.data?.error || "Error sending friend request");
    }
  };

  // Cancel outbound pending friend request
  const handleCancel = async (friendId) => {
    try {
      await axios.post(
        "http://localhost:5000/friends/cancel",
        { friendId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Refresh lists after cancelling the request
      refreshData();
    } catch (err) {
      setError(err.response?.data?.error || "Error cancelling friend request");
    }
  };

  return (
    <div className="suggested-friends-container">
      {error && <p className="error-message">{error}</p>}

      {/* Outbound Pending Requests Section */}
      <div className="outbound-section">
        <h3>Outgoing Requests</h3>
        {outbound.length === 0 ? (
          <p className="empty">No pending requests</p>
        ) : (
          outbound.map((friend) => (
            <div className="friend-card" key={friend.user_id}>
              <div className="friend-details">
                <img
                  src={
                    friend.profile_picture_url
                      ? `http://localhost:5000${friend.profile_picture_url}`
                      : "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg"
                  }
                  alt={friend.username}
                />
                <div className="friend-info">
                  <p className="friend-name">{friend.username}</p>
                  <p className="friend-email">{friend.email}</p>
                </div>
              </div>
              <button
                className="action-btn"
                onClick={() => handleCancel(friend.user_id)}
              >
                Cancel
              </button>
            </div>
          ))
        )}
      </div>

      {/* Suggested Friends Section */}
      <div className="possible-section">
        <h3>Suggested Friends</h3>
        {suggested.length === 0 ? (
          <p className="empty">No suggestions available</p>
        ) : (
          suggested.map((friend) => (
            <div className="friend-card" key={friend.user_id}>
              <div className="friend-details">
                <img
                  src={
                    friend.profile_picture_url
                      ? `http://localhost:5000${friend.profile_picture_url}`
                      : "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg"
                  }
                  alt={friend.username}
                />
                <div className="friend-info">
                  <p className="friend-name">{friend.username}</p>
                  <p className="friend-email">{friend.email}</p>
                </div>
              </div>
              <button
                className="action-btn"
                onClick={() => handleAddFriend(friend.email)}
              >
                Add
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SuggestedFriends;
