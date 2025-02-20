import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Post from './Post.jsx';
import ProfilePicUploader from './ProfilePicUploader.jsx';
import '../styles/Profile.css';

const Profile = ({ token, userId, currentUserId, setCurrentView }) => {
  const [user, setUser] = useState({});
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const actualId = userId || currentUserId;

  // Fetch user details
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

  // Fetch user posts
  const fetchUserPosts = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/posts/user/${actualId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error fetching posts');
    }
  };

  // Handle profile picture updates
  const handleProfilePicUpdated = (newUrl) => {
    setUser(prev => ({ ...prev, profile_picture_url: newUrl }));
    setShowUploader(false);
  };

  // Fetch data when actualId changes
  useEffect(() => {
    if (token && actualId) {
      fetchUser();
      fetchUserPosts();
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
          <p>{user.email}</p>
          {user.first_name && user.last_name && <p>{user.first_name} {user.last_name}</p>}
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
