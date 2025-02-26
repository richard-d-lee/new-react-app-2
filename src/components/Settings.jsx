import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Settings.css";
import UnblockUsersModal from "./UnblockUsersModal.jsx";

const Settings = ({ token, currentUserId, setCurrentView }) => {
  const [user, setUser] = useState({
    first_name: "",
    last_name: "",
    email: "",
    birthday: "",
    profile_picture_url: ""
  });
  const [profileSettings, setProfileSettings] = useState({
    show_first_name: true,
    show_last_name: true,
    show_email: true,
    show_birthday: true
  });
  const [editMode, setEditMode] = useState({
    first_name: false,
    last_name: false,
    email: false,
    birthday: false
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Block / Unblock state
  const [blockUsername, setBlockUsername] = useState("");
  const [blockMessage, setBlockMessage] = useState("");
  const [blockError, setBlockError] = useState("");
  const [showUnblockModal, setShowUnblockModal] = useState(false);

  // Fetch user details
  const fetchUserDetails = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/users/${currentUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Error fetching user details");
    }
  };

  // Fetch profile settings
  const fetchProfileSettings = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/users/profile-settings/${currentUserId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfileSettings({
        show_first_name:
          res.data.show_first_name === "true" || res.data.show_first_name === true,
        show_last_name:
          res.data.show_last_name === "true" || res.data.show_last_name === true,
        show_email: res.data.show_email === "true" || res.data.show_email === true,
        show_birthday:
          res.data.show_birthday === "true" || res.data.show_birthday === true
      });
    } catch (err) {
      setError(err.response?.data?.error || "Error fetching profile settings");
    }
  };

  useEffect(() => {
    if (token && currentUserId) {
      fetchUserDetails();
      fetchProfileSettings();
    }
  }, [token, currentUserId]);

  // Handlers for updating user details
  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const toggleEditMode = (field) => {
    setEditMode((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleToggleSetting = (key, value) => {
    setProfileSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        birthday: user.birthday,
        show_first_name: profileSettings.show_first_name,
        show_last_name: profileSettings.show_last_name,
        show_email: profileSettings.show_email,
        show_birthday: profileSettings.show_birthday
      };
      const res = await axios.put(
        `http://localhost:5000/users/settings/${currentUserId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(res.data.message || "Settings updated successfully");
      fetchUserDetails();
      fetchProfileSettings();
      setEditMode({
        first_name: false,
        last_name: false,
        email: false,
        birthday: false
      });
    } catch (err) {
      setError(err.response?.data?.error || "Error updating settings");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone."
    );
    if (!confirmDelete) return;
    try {
      await axios.delete(`http://localhost:5000/users/settings/${currentUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      localStorage.removeItem("authToken");
      setCurrentView("login");
    } catch (err) {
      setError(err.response?.data?.error || "Error deleting account");
    }
  };

  // Block user by exact username and show unblock modal to manage list
  const handleBlockUser = async (e) => {
    e.preventDefault();
    setBlockMessage("");
    setBlockError("");

    if (!blockUsername.trim()) {
      setBlockError("Please enter a complete username.");
      return;
    }

    try {
      const lookupRes = await axios.get(`http://localhost:5000/users/lookup`, {
        params: { username: blockUsername.trim() },
        headers: { Authorization: `Bearer ${token}` }
      });

      const foundUser = lookupRes.data;
      if (!foundUser || !foundUser.user_id) {
        setBlockError("User not found.");
        return;
      }

      const confirmBlock = window.confirm(
        `Block "${blockUsername}"?`
      );

      if (!confirmBlock) return;

      await axios.post(
        `http://localhost:5000/users/block`,
        { blockedId: foundUser.user_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setBlockMessage(`"${blockUsername}" has been blocked.`);
      setBlockUsername("");
    } catch (err) {
      console.error("Error blocking user:", err);
      setBlockError(err.response?.data?.error || "Error blocking user.");
    }
  };

  return (
    <div className="settings-container">
      <h2>Account Settings</h2>
      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      <form onSubmit={handleUpdateSettings} className="settings-form">
        {/* First Name */}
        <div className="setting-row">
          <div className="setting-field">
            <label>First Name:</label>
            <div className="editable-field">
              <input
                type="text"
                name="first_name"
                value={user.first_name}
                onChange={handleChange}
                disabled={!editMode.first_name}
              />
              <button type="button" className="edit-btn" onClick={() => toggleEditMode("first_name")}>
                &#9998;
              </button>
            </div>
          </div>
          <div className="setting-switch">
            <small>Show on profile</small>
            <label className="switch">
              <input
                type="checkbox"
                checked={profileSettings.show_first_name}
                onChange={(e) => handleToggleSetting("show_first_name", e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        {/* Last Name */}
        <div className="setting-row">
          <div className="setting-field">
            <label>Last Name:</label>
            <div className="editable-field">
              <input
                type="text"
                name="last_name"
                value={user.last_name}
                onChange={handleChange}
                disabled={!editMode.last_name}
              />
              <button type="button" className="edit-btn" onClick={() => toggleEditMode("last_name")}>
                &#9998;
              </button>
            </div>
          </div>
          <div className="setting-switch">
            <small>Show on profile</small>
            <label className="switch">
              <input
                type="checkbox"
                checked={profileSettings.show_last_name}
                onChange={(e) => handleToggleSetting("show_last_name", e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        {/* Email */}
        <div className="setting-row">
          <div className="setting-field">
            <label>Email:</label>
            <div className="editable-field">
              <input
                type="text"
                name="email"
                value={user.email}
                onChange={handleChange}
                disabled={!editMode.email}
              />
              <button type="button" className="edit-btn" onClick={() => toggleEditMode("email")}>
                &#9998;
              </button>
            </div>
          </div>
          <div className="setting-switch">
            <small>Show on profile</small>
            <label className="switch">
              <input
                type="checkbox"
                checked={profileSettings.show_email}
                onChange={(e) => handleToggleSetting("show_email", e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        {/* Birthday */}
        <div className="setting-row">
          <div className="setting-field">
            <label>Birthday:</label>
            <div className="editable-field">
              <input
                type="date"
                name="birthday"
                value={user.birthday || ""}
                onChange={handleChange}
                disabled={!editMode.birthday}
              />
              <button type="button" className="edit-btn" onClick={() => toggleEditMode("birthday")}>
                &#9998;
              </button>
            </div>
          </div>
          <div className="setting-switch">
            <small>Show on profile</small>
            <label className="switch">
              <input
                type="checkbox"
                checked={profileSettings.show_birthday}
                onChange={(e) => handleToggleSetting("show_birthday", e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        <button type="submit" className="update-btn">Update Settings</button>
      </form>

      <hr />

      {/* Consolidated Block/Unblock Section */}
      <div className="block-unblock-section">
        <h3>Manage Blocked Users</h3>
        <form onSubmit={handleBlockUser} className="block-form">
          <input
            type="text"
            value={blockUsername}
            onChange={(e) => setBlockUsername(e.target.value)}
            placeholder="Enter full username"
          />
          <button type="submit" className="block-btn">Block User</button>
        </form>
        {blockError && <p className="error-message">{blockError}</p>}
        {blockMessage && <p className="success-message">{blockMessage}</p>}
        <button className="block-btn" onClick={() => setShowUnblockModal(true)}>
          Manage Blocked Users
        </button>
      </div>

      <hr />

      <button onClick={handleDeleteAccount} className="delete-btn">Delete Account</button>

      {showUnblockModal && (
        <UnblockUsersModal
          token={token}
          currentUserId={currentUserId}
          onClose={() => setShowUnblockModal(false)}
        />
      )}
    </div>
  );
};

export default Settings;
