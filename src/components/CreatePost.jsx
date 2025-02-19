// CreatePost.jsx
import React, { useState } from 'react';
import axios from 'axios';
import '../styles/CreatePost.css';

const CreatePost = ({ onNewPost, token, currentUserId, currentUserProfilePic, currentUsername }) => {
  const [content, setContent] = useState('');

  const handlePost = async () => {
    if (!content.trim()) return;
    try {
      const res = await axios.post(
        'http://localhost:5000/posts',
        { content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Construct a new post object for the front-end
      // The server may return minimal data, so we fill in local details:
      const newPost = {
        post_id: res.data.postId,   // from server
        content,
        user_id: currentUserId,
        username: currentUsername,  // e.g. 'b' or your real username
        profile_picture_url: currentUserProfilePic || null,
        created_at: new Date().toISOString(),
      };

      // Immediately add it to the feed
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
