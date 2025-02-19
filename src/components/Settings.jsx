// Settings.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Settings.css";

const Settings = ({ token, currentUserId, setCurrentView }) => {
  const [user, setUser] = useState({
    first_name: "",
    last_name: "",
    birthday: "",
    profile_picture_url: ""
  });
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Fetch current user settings
  const fetchUserSettings = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/users/${currentUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Error fetching user details");
    }
  };

  useEffect(() => {
    if (token && currentUserId) {
      fetchUserSettings();
    }
  }, [token, currentUserId]);

  // Handle form field changes
  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  // Handle profile picture file selection
  const handleFileChange = (e) => {
    setProfilePicFile(e.target.files[0]);
  };

  // Submit updated settings (birthday, first name, last name)
  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(
        `http://localhost:5000/users/settings/${currentUserId}`,
        {
          first_name: user.first_name,
          last_name: user.last_name,
          birthday: user.birthday
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(res.data.message);
      fetchUserSettings();
    } catch (err) {
      setError(err.response?.data?.error || "Error updating settings");
    }
  };

  // Upload new profile picture (optional)
  const handleUploadProfilePic = async (e) => {
    e.preventDefault();
    if (!profilePicFile) return;
    const formData = new FormData();
    formData.append("profilePic", profilePicFile);
    try {
      const res = await axios.post("http://localhost:5000/upload-profile-pic", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });
      setMessage("Profile picture updated successfully");
      setUser((prev) => ({ ...prev, profile_picture_url: res.data.fileUrl }));
    } catch (err) {
      setError(err.response?.data?.error || "Error uploading profile picture");
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete your account? This action cannot be undone.");
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

  return (
    <div className="settings-container">
      <h2>Account Settings</h2>
      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      <form onSubmit={handleUpdateSettings} className="settings-form">
        <label>
          First Name:
          <input
            type="text"
            name="first_name"
            value={user.first_name}
            onChange={handleChange}
          />
        </label>
        <label>
          Last Name:
          <input
            type="text"
            name="last_name"
            value={user.last_name}
            onChange={handleChange}
          />
        </label>
        <label>
          Birthday:
          <input
            type="date"
            name="birthday"
            value={user.birthday || ""}
            onChange={handleChange}
          />
        </label>
        <button type="submit" className="update-btn">Update Settings</button>
      </form>

      <hr />

      <form onSubmit={handleUploadProfilePic} className="settings-form">
        <label>
          Change Profile Picture:
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </label>
        <button type="submit" className="update-btn">Upload Picture</button>
      </form>

      <hr />

      <button onClick={handleDeleteAccount} className="delete-btn">
        Delete Account
      </button>
    </div>
  );
};

export default Settings;
