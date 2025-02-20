// CreatePost.jsx snippet
import React, { useState } from 'react';
import axios from 'axios';
import '../styles/CreatePost.css';

const CreatePost = ({ 
  token, 
  currentUserId, 
  currentUsername, 
  currentUserProfilePic, 
  onNewPost 
}) => {
  const [content, setContent] = useState('');

  const handlePost = async () => {
    if (!content.trim()) return;
    try {
      // 1) Create the post in the database
      const res = await axios.post(
        'http://localhost:5000/posts',
        { content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
  
      const { post_id } = res.data; // Ensure the backend returns the new post_id
  
      // 2) Manually add current user info to avoid "User {userId}" and missing post_id
      const newPost = {
        post_id, // Ensure this is defined
        user_id: currentUserId,
        username: currentUsername,                 // Add username
        profile_picture_url: currentUserProfilePic, // Add profile picture
        content,
        created_at: new Date().toISOString()
      };
  
      // 3) Add to feed immediately
      onNewPost(newPost);
      setContent('');
    } catch (err) {
      console.error('Error creating post:', err);
    }
  };
  
  

  return (
    <div className="create-post">
      <textarea
        placeholder="What's on your mind?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button onClick={handlePost}>Post</button>
    </div>
  );
};

export default CreatePost;
