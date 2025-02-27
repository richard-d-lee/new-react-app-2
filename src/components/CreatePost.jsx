import React, { useState } from 'react';
import axios from 'axios';
import { MentionsInput, Mention } from 'react-mentions';
import '../styles/CreatePost.css';

const mentionStyle = { backgroundColor: '#daf4fa' };
const defaultStyle = {
  control: {
    backgroundColor: '#fff',
    fontSize: 14,
    fontWeight: 'normal',
    minHeight: 50,
    border: '1px solid silver',
    padding: 9
  },
  highlighter: {
    padding: 9,
    border: '1px solid transparent'
  },
  input: {
    padding: 9,
    border: '1px solid silver'
  },
  suggestions: {
    list: {
      backgroundColor: 'white',
      border: '1px solid #ccc',
      fontSize: 14,
      maxHeight: 150,
      overflowY: 'auto'
    },
    item: {
      padding: '5px 15px',
      borderBottom: '1px solid #ddd',
      '&focused': { backgroundColor: '#cee4e5' }
    }
  }
};

const CreatePost = ({
  token,
  currentUserId,
  currentUserProfilePic,
  onNewPost,
  marketplaceId,
  groupId,
  eventId
}) => {
  const [content, setContent] = useState('');
  const baseURL = 'http://localhost:5000';

  // Determine the endpoint based on context
  let postUrl = '';
  if (marketplaceId) {
    postUrl = `${baseURL}/marketplace/${marketplaceId}/posts`;
  } else if (eventId) {
    postUrl = `${baseURL}/events/${eventId}/posts`;
  } else if (groupId) {
    postUrl = `${baseURL}/groups/${groupId}/posts`;
  } else {
    postUrl = `${baseURL}/feed`;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      const res = await axios.post(
        postUrl,
        { content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onNewPost(res.data);
      setContent('');
    } catch (err) {
      console.error('Error creating post:', err);
    }
  };

  // Fetch users for mention suggestions
  const fetchUsers = async (query, callback) => {
    if (!query) return callback([]);
    try {
      const res = await axios.get(`${baseURL}/users/search?query=${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const suggestions = res.data.map((user) => ({
        id: user.user_id.toString(),
        display: user.username
      }));
      callback(suggestions);
    } catch (err) {
      console.error('Error fetching mention suggestions:', err);
      callback([]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-post-form">
      <MentionsInput
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={defaultStyle}
        placeholder="What's on your mind?"
        allowSuggestionsAboveCursor
        markup="@[__display__](__id__)"
        displayTransform={(id, display) => `@${display}`}
      >
        <Mention
          trigger="@"
          data={fetchUsers}
          style={mentionStyle}
          markup="@[__display__](__id__)"
          displayTransform={(id, display) => `@${display}`}
        />
      </MentionsInput>
      <button type="submit">Post</button>
    </form>
  );
};

export default CreatePost;
