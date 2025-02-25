import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Post from './Post.jsx';
import ProfilePicUploader from './ProfilePicUploader.jsx';
import '../styles/Profile.css';

const Profile = ({ token, userId, currentUserId, setCurrentView }) => {
  const [user, setUser] = useState({});
  const [posts, setPosts] = useState([]);
  // Initialize profile settings with defaults
  const [profileSettings, setProfileSettings] = useState({
    show_first_name: true,
    show_last_name: true,
    show_email: true,
    show_birthday: true
  });
  const [error, setError] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const actualId = userId || currentUserId;

  // Helper to format birthday as "February 27"
  const formatBirthday = (birthdayStr) => {
    if (!birthdayStr) return '';
    const date = new Date(birthdayStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  };

  // Fetch user details (without birthday)
  const fetchUser = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/users/${actualId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error fetching user details');
    }
  };

  // Fetch birthday from the birthdays table
  const fetchBirthday = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/users/birthday/${actualId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(prev => ({ ...prev, birthday: res.data.date_of_birth }));
    } catch (err) {
      console.error(err.response?.data?.error || 'Error fetching birthday');
    }
  };

  // Fetch user posts
  const fetchUserPosts = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/feed/user/${actualId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error fetching posts');
    }
  };

  // Fetch profile display settings
  const fetchProfileSettings = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/users/profile-settings/${actualId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfileSettings({
        show_first_name:
          res.data.show_first_name === true || res.data.show_first_name === "true",
        show_last_name:
          res.data.show_last_name === true || res.data.show_last_name === "true",
        show_email: res.data.show_email === true || res.data.show_email === "true",
        show_birthday:
          res.data.show_birthday === true || res.data.show_birthday === "true"
      });
    } catch (err) {
      setProfileSettings({
        show_first_name: true,
        show_last_name: true,
        show_email: true,
        show_birthday: true
      });
    }
  };

  // Handle profile picture updates
  const handleProfilePicUpdated = (newUrl) => {
    setUser(prev => ({ ...prev, profile_picture_url: newUrl }));
    setShowUploader(false);
  };

  useEffect(() => {
    if (token && actualId) {
      fetchUser();
      fetchBirthday();
      fetchUserPosts();
      fetchProfileSettings();
    }
  }, [token, actualId]);

  return (
    <div className="profile-view">
      {error && <p className="error">{error}</p>}
      <div className="profile-header">
        <div className="profile-pic-container" onClick={() => setShowUploader(true)}>
          <img
            src={
              user.profile_picture_url
                ? `http://localhost:5000${user.profile_picture_url}`
                : "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg"
            }
            alt={user.username || 'User'}
            className="profile-pic"
          />
          <div className="edit-overlay">
            <span className="edit-icon">✎</span>
          </div>
        </div>
        <div className="profile-details">
          <h2>{user.username || 'User'}</h2>
          {profileSettings.show_email === true && user.email && <p>{user.email}</p>}
          {profileSettings.show_first_name === true &&
            profileSettings.show_last_name === true &&
            user.first_name &&
            user.last_name && (
              <p>{user.first_name} {user.last_name}</p>
            )}
          {profileSettings.show_first_name === true &&
            !profileSettings.show_last_name &&
            user.first_name && <p>{user.first_name}</p>}
          {profileSettings.show_last_name === true &&
            !profileSettings.show_first_name &&
            user.last_name && <p>{user.last_name}</p>}
          {profileSettings.show_birthday === true && user.birthday && (
            <p>
              <span className="birthday-icon">🎂</span>
              {formatBirthday(user.birthday)}
            </p>
          )}
        </div>
      </div>
      <div className="profile-posts">
        <h3>{user.username ? `${user.username}'s Posts` : "User's Posts"}</h3>
        {posts.length === 0 ? (
          <p className="empty">No posts to display.</p>
        ) : (
          posts.map(post => (
            <Post setCurrentView={setCurrentView} key={post.post_id} post={post} token={token} />
          ))
        )}
      </div>
      {showUploader && (
        <ProfilePicUploader
          token={token}
          onClose={() => setShowUploader(false)}
          onUploadSuccess={handleProfilePicUpdated}
        />
      )}
    </div>
  );
};

export default Profile;
