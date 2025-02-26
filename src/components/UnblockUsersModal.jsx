import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaTimes } from "react-icons/fa";
import ProfilePic from "./ProfilePic.jsx";
import "../styles/MembersModal.css";

const UnblockUsersModal = ({ token, currentUserId, onClose }) => {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Fetch the list of blocked users for the current user.
  const fetchBlockedUsers = async () => {
    try {
      const res = await axios.get("http://localhost:5000/users/blocked", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBlockedUsers(res.data);
    } catch (err) {
      console.error("Error fetching blocked users:", err);
      setError(err.response?.data?.error || "Error fetching blocked users");
    }
  };

  useEffect(() => {
    if (token && currentUserId) {
      fetchBlockedUsers();
    }
  }, [token, currentUserId]);

  // Handler to unblock a specific user
  const handleUnblock = async (blockedId, username) => {
    const confirmUnblock = window.confirm(`Are you sure you want to unblock "${username}"?`);
    if (!confirmUnblock) return;
    try {
      await axios.delete("http://localhost:5000/users/block", {
        headers: { Authorization: `Bearer ${token}` },
        data: { blockedId },
      });
      setMessage(`User "${username}" has been unblocked.`);
      // Refresh the list after unblocking.
      fetchBlockedUsers();
    } catch (err) {
      console.error("Error unblocking user:", err);
      setError(err.response?.data?.error || "Error unblocking user.");
    }
  };

  return (
    <div className="modal-overlay fade-in">
      <div className="members-modal fade-in">
        <button className="close-modal" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>Blocked Users</h2>
        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}
        {blockedUsers.length === 0 ? (
          <p>No blocked users found.</p>
        ) : (
          <ul className="members-list">
            {blockedUsers.map((user) => (
              <li key={user.user_id} className="member-item">
                <div className="member-info">
                  <ProfilePic
                    imageUrl={
                      user.profile_picture_url
                        ? `http://localhost:5000${user.profile_picture_url}`
                        : null
                    }
                    alt={user.username}
                    size={40}
                  />
                  <span>{user.username}</span>
                </div>
                <button
                  className="block-btn"
                  onClick={() => handleUnblock(user.user_id, user.username)}
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default UnblockUsersModal;
