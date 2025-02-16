import React, { useState } from 'react';
import axios from 'axios';
import '../styles/CreatePost.css';

const CreatePost = ({ onNewPost }) => {
  const [content, setContent] = useState('');
  const token = localStorage.getItem('authToken');

  const handlePost = async () => {
    if (!content.trim()) return;
    try {
      const res = await axios.post(
        'http://localhost:5000/posts',
        { content },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Construct a new post object – in a real app, the API would return full post data.
      const newPost = {
        post_id: res.data.postId,
        content,
        user_id: null, // Optionally assign the logged-in user ID
        username: 'You',
        profile_picture_url: '', // Provide a default or actual URL if available
        created_at: new Date().toISOString(),
        likes: 0
      };

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
