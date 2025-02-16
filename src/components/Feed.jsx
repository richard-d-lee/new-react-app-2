import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreatePost from './CreatePost.jsx';
import Post from './Post.jsx';

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const token = localStorage.getItem('authToken'); // Or get from context/props

  // Fetch posts from /posts
  const fetchPosts = async () => {
    try {
      const res = await axios.get('http://localhost:5000/posts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(res.data); // Each post includes { id, user_id, content, created_at, username, profile_picture_url, ... }
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPosts();
    }
  }, [token]);

  // Callback to add new post to the state immediately
  const handleNewPost = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  return (
    <div className="feed">
      {/* Create New Post */}
      <CreatePost onNewPost={handleNewPost} />

      {/* Render Posts */}
      {posts.map((post) => (
        <Post key={post.id} post={post} token={token} />
      ))}
    </div>
  );
};

export default Feed;
