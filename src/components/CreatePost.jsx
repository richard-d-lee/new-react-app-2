import React, { useState } from 'react';
import axios from 'axios';
import { extractMentionsFromMarkup } from '../helpers/parseMentions';
import { MentionsInput, Mention } from 'react-mentions';
import '../styles/CreatePost.css';

const mentionStyle = { backgroundColor: '#daf4fa' };
const defaultStyle = {
  control: { backgroundColor: '#fff', fontSize: 14 },
  '&multiLine': {
    control: { minHeight: 63 },
    highlighter: { padding: 9, border: '1px solid transparent' },
    input: { padding: 9, border: '1px solid silver' }
  },
  suggestions: {
    list: { backgroundColor: 'white', border: '1px solid #ccc', fontSize: 14, maxHeight: 150, overflowY: 'auto' },
    item: { padding: '5px 15px', borderBottom: '1px solid #ddd', '&focused': { backgroundColor: '#cee4e5' } }
  }
};

const CreatePost = ({ token, currentUserId, onNewPost, groupId, eventId }) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  // Fetch users for mentions
  const fetchUsers = async (query, callback) => {
    if (!query) return callback([]);
    try {
      const res = await axios.get(`http://localhost:5000/users/search?query=${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const suggestions = res.data.map((user) => ({
        id: user.user_id.toString(),
        display: user.username,
      }));
      callback(suggestions);
    } catch (err) {
      console.error('Error fetching mention suggestions:', err);
      callback([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      // Determine the URL based on props: eventId, groupId, or fallback to feed.
      const url = eventId 
        ? `http://localhost:5000/events/${eventId}/posts`
        : groupId 
          ? `http://localhost:5000/groups/${groupId}/posts`
          : `http://localhost:5000/feed`;

      const res = await axios.post(url, { content }, { headers: { Authorization: `Bearer ${token}` } });
      onNewPost(res.data);

      // Process mentions
      const mentions = extractMentionsFromMarkup(content);
      const extraId = groupId || eventId || null;
      mentions.forEach(async ({ id: userId }) => {
        try {
          await axios.post(`http://localhost:5000/mentions/post`,
            { post_id: res.data.post_id, mentioned_user_id: userId, group_id: groupId || null },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (err) {
          console.error('Error processing mention for post:', err);
        }
      });

      setContent('');
    } catch (err) {
      console.error('Error creating post:', err);
      setError(err.response?.data?.error || 'Error creating post');
    }
  };

  return (
    <div className="create-post">
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <MentionsInput
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={defaultStyle}
          placeholder="Write your post here..."
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
    </div>
  );
};

export default CreatePost;
