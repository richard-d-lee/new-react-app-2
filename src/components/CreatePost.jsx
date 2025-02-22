import React, { useState } from 'react';
import axios from 'axios';
import '../styles/CreatePost.css';

const CreatePost = ({
  token,
  currentUserId,
  currentUserProfilePic,
  onNewPost,
  groupId // If provided, we're posting in a group
}) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      let url = '';
      if (groupId) {
        // For group posts, the endpoint now inserts the post into the unified posts table
        // with post_type set to 'group' and group_id set accordingly.
        url = `http://localhost:5000/groups/${groupId}/posts`;
      } else {
        // For regular feed posts, the endpoint sets post_type to 'feed'
        url = `http://localhost:5000/feed`;
      }

      const res = await axios.post(url, { content }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // onNewPost is called with the new post data returned from the server.
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
