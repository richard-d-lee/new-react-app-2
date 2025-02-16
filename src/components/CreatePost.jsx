import React, { useState } from 'react';
import axios from 'axios';

const CreatePost = ({ onNewPost }) => {
  const [content, setContent] = useState('');
  const token = localStorage.getItem('authToken');

  const handlePost = async () => {
    if (!content.trim()) return;
    try {
      // Call the /posts endpoint
      const res = await axios.post(
        'http://localhost:5000/posts',
        { content },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Construct a temporary post object for the front-end
      const newPost = {
        id: res.data.postId,
        content,
        user_id: null, // or the logged-in user ID if you want
        username: 'You', // Optional placeholder
        profile_picture_url: '', // Optional placeholder
        created_at: new Date().toISOString(),
      };

      // Update the Feed immediately
      onNewPost(newPost);

      // Clear input
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
