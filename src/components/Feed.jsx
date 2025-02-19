import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreatePost from './CreatePost.jsx';
import Post from './Post.jsx';
import '../styles/Feed.css';

const Feed = ({ token, currentUserId, currentUserProfilePic }) => {
  const [posts, setPosts] = useState([]);

  // Fetch posts from /posts
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

  // Callback to add new post to the state immediately
  const handleNewPost = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  return (
    <div className="feed">
      <CreatePost
        onNewPost={handleNewPost}
        token={token}
        currentUserId={currentUserId}
        currentUserProfilePic={currentUserProfilePic}
      />

      {posts.map((post) => (
        <Post
          key={post.post_id}
          post={post}
          token={token}
          currentUserId={currentUserId}
          currentUserProfilePic={currentUserProfilePic}
        />
      ))}
    </div>
  );
};

export default Feed;
