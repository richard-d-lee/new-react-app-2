// CreatePost.jsx
import React, { useState } from 'react';
import axios from 'axios';
import '../styles/CreatePost.css';

const CreatePost = ({
  token,
  currentUserId,
  currentUserProfilePic,
  onNewPost,
  groupId // optional prop: if provided, we're posting in a group
}) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
  
    try {
      let url = '';
      if (groupId) {
        // Post to group
        url = `http://localhost:5000/groups/${groupId}/posts`;
      } else {
        // Post to the main feed
        url = `http://localhost:5000/posts`;
      }
      const res = await axios.post(url, { content }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Now res.data has user_id, username, etc.
      onNewPost(res.data);
      setContent('');
    } catch (err) {
      console.error("Error creating post:", err);
      setError(err.response?.data?.error || "Error creating post");
    }
  };

  return (
    <div className="create-post">
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your post here..."
        />
        <button type="submit">Post</button>
      </form>
    </div>
  );
};

export default CreatePost;
