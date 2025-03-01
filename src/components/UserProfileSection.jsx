import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/UserProfileSection.css';

const UserProfileSection = ({ setCurrentView, token, currentUserId, collapsed }) => {
  const [userData, setUserData] = useState({
    first_name: '',
    last_name: '',
    username: '',
    profile_picture_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !currentUserId) return;
    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await axios.get(`http://localhost:5000/users/${currentUserId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserData(res.data);
      } catch (err) {
        console.error('Error fetching user data in UserProfileSection:', err);
        setError('Failed to load user data.');
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [token, currentUserId]);

  const handleClick = () => {
    setCurrentView({ view: 'profile', userId: currentUserId });
  };

  if (loading) {
    return <div className="user-profile-section">Loading...</div>;
  }

  if (error) {
    return <div className="user-profile-section error">{error}</div>;
  }

  const { first_name, last_name, username, profile_picture_url } = userData;
  let displayName = '';
  if (first_name || last_name) {
    displayName = `${first_name || ''} ${last_name || ''}`.trim();
  }
  if (!displayName) {
    displayName = username;
  }

  // Ensure the profile picture URL is absolute.
  let profilePic = 'https://via.placeholder.com/80';
  if (profile_picture_url && profile_picture_url.trim() !== '') {
    if (profile_picture_url.startsWith('http')) {
      profilePic = profile_picture_url;
    } else {
      profilePic = `http://localhost:5000${profile_picture_url}`;
    }
  }

  return (
    <div className="user-profile-section clickable" onClick={handleClick}>
      <div className="user-profile-header">
        <img
          className="user-profile-pic"
          src={profilePic}
          alt="Profile"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://via.placeholder.com/80';
          }}
        />
        {!collapsed && (
          <div className="user-profile-info">
            <h4 className="user-profile-name">{displayName}</h4>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileSection;
