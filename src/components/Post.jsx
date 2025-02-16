import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Post = ({ post, token }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  // Fetch comments for this post
  const fetchComments = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/posts/${post.id}/comments`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      setComments(res.data); // Each comment includes { id, post_id, user_id, content, created_at, username? }
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, token]);

  // Add a new comment
  const handleComment = async () => {
    if (!newComment.trim()) return;
    try {
      await axios.post(
        `http://localhost:5000/posts/${post.id}/comments`,
        { content: newComment },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
        }
      );

      // Optionally fetch comments again or push a new comment in state
      setComments([
        ...comments,
        {
          id: Date.now(), // Temporary ID
          content: newComment,
          user_id: null, // The logged-in user
          created_at: new Date().toISOString(),
        },
      ]);
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  return (
    <div className="post">
      {/* Post Author */}
      <div className="post-author">
        {post.profile_picture_url && (
          <img src={post.profile_picture_url} alt={post.username || 'User'} />
        )}
        <span>{post.username || `User ${post.user_id}`}</span>
      </div>

      {/* Post Content */}
      <div className="post-content">
        <p>{post.content}</p>
      </div>

      {/* Comments */}
      <div className="comments">
        {comments.map((comment) => (
          <div key={comment.id} className="comment">
            <p>{comment.content}</p>
          </div>
        ))}
      </div>

      {/* Add Comment */}
      <div className="add-comment">
        <input
          type="text"
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button onClick={handleComment}>Comment</button>
      </div>
    </div>
  );
};

export default Post;
