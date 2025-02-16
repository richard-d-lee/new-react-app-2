import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Comment from './Comment.jsx';
import '../styles/Post.css';

const Post = ({ post, token }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [likes, setLikes] = useState(0);

  // Fetch comments for this post
  const fetchComments = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/posts/${post.post_id}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(res.data);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  // Fetch the like count from the API endpoint
  const fetchLikes = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/posts/${post.post_id}/likes/count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLikes(res.data.likeCount);
    } catch (err) {
      console.error('Error fetching like count:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchComments();
      fetchLikes();
    }
  }, [post.post_id, token]);

  // Add a new comment
  const handleComment = async () => {
    if (!newComment.trim()) return;
    try {
      await axios.post(
        `http://localhost:5000/posts/${post.post_id}/comments`,
        { content: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Append a temporary comment (ideally, you would re-fetch the comments)
      const tempComment = {
        id: Date.now(), // temporary ID
        content: newComment,
        username: 'You', // Replace with actual logged-in username if available
        created_at: new Date().toISOString()
      };
      setComments([...comments, tempComment]);
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  // Like post and then re-fetch like count
  const handleLike = async () => {
    try {
      await axios.post(`http://localhost:5000/posts/${post.post_id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLikes(); // Update like count from server
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  return (
    <div className="post">
      {/* Post Header */}
      <div className="post-author">
        {post.profile_picture_url ? (
          <img src={post.profile_picture_url} alt={post.username || 'User'} />
        ) : (
          <img src="https://via.placeholder.com/40" alt="Default Avatar" />
        )}
        <span>{post.username || `User ${post.user_id}`}</span>
      </div>

      {/* Post Content */}
      <div className="post-content">
        <p>{post.content}</p>
      </div>

      {/* Post Actions */}
      <div className="post-actions">
        <button onClick={handleLike}>👍 {likes} Likes</button>
        <button onClick={fetchComments}>💬 {comments.length} Comments</button>
      </div>

      {/* Comments List */}
      <div className="comments">
        {comments.map((comment) => (
          <Comment key={comment.id} comment={comment} />
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
