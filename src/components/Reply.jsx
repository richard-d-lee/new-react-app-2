// Reply.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Reply.css';

const Reply = ({ reply, token, currentUserId, onDeleteReply }) => {
  const [likes, setLikes] = useState(reply.likeCount || 0);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState('');

  // On mount, fetch whether user liked + total like count
  useEffect(() => {
    if (!token) return;
    axios
      .get(`http://localhost:5000/comments/${reply.comment_id}/liked`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setLiked(res.data.liked);
        setLikes(res.data.likeCount);
      })
      .catch((err) => {
        console.error('Error fetching reply liked status:', err);
      });
  }, [reply.comment_id, token]);

  // Like/unlike
  const handleLike = async () => {
    try {
      if (!liked) {
        await axios.post(
          `http://localhost:5000/comments/${reply.comment_id}/like`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setLiked(true);
        setLikes((prev) => prev + 1);
      } else {
        await axios.delete(
          `http://localhost:5000/comments/${reply.comment_id}/like`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setLiked(false);
        setLikes((prev) => prev - 1);
      }
    } catch (err) {
      console.error('Error toggling reply like:', err);
      setError(err.response?.data?.error || 'Error toggling like');
    }
  };

  // Delete
  const handleDelete = async () => {
    try {
      await axios.delete(`http://localhost:5000/comments/${reply.comment_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (onDeleteReply) {
        onDeleteReply(reply.comment_id);
      }
    } catch (err) {
      console.error('Error deleting reply:', err);
      setError(err.response?.data?.error || 'Error deleting reply');
    }
  };

  return (
    <div className="reply-container">
      {error && <p className="reply-error">{error}</p>}
      <div className="reply-content">
        <span className="reply-icon">↳</span>
        <span className="reply-author">{reply.username || 'User'}</span>
        <span className="reply-text">{reply.content}</span>
      </div>
      <div className="reply-actions">
        <span className="reply-link" onClick={handleLike}>
          {liked ? 'Unlike' : 'Like'} ({likes})
        </span>
        {reply.user_id === currentUserId && (
          <span className="reply-link" onClick={handleDelete}>
            Delete
          </span>
        )}
      </div>
    </div>
  );
};

export default Reply;
