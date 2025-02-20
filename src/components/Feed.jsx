// Feed.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreatePost from './CreatePost.jsx';
import Post from './Post.jsx';
import '../styles/Feed.css';

const Feed = ({
  token,
  currentUserId,
  currentUsername,
  currentUserProfilePic,
  setCurrentView,
  onProfileClick
}) => {
  const [posts, setPosts] = useState([]);

  // Fetch all posts
  const fetchPosts = async () => {
    try {
      const res = await axios.get('http://localhost:5000/posts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(res.data);
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPosts();
    }
  }, [token]);

  // This is called by <CreatePost /> after a new post is created
  const handleNewPost = (newPostObj) => {
    // Insert at top
    setPosts(prev => [newPostObj, ...prev]);
  };

  // If user deletes a post
  const handleDeletePost = (postId) => {
    setPosts(prev => prev.filter(p => p.post_id !== postId));
  };

  return (
    <div className="feed">
      <CreatePost
        token={token}
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        currentUserProfilePic={currentUserProfilePic}
        onNewPost={handleNewPost}
      />

      {posts.map((post) => (
        <Post
          key={post.post_id}
          post={post}
          token={token}
          onDelete={(postId) => setPosts(prev => prev.filter(p => p.post_id !== postId))}
          currentUserId={currentUserId}
          currentUserProfilePic={currentUserProfilePic}
          setCurrentView={setCurrentView}
          onProfileClick={(userId) => setCurrentView({ view: 'profile', userId })} // ✅ Fix profile navigation
        />
      ))}
    </div>
  );
};

export default Feed;
