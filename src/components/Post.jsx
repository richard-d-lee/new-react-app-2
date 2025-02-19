import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Comment from './Comment.jsx';
import '../styles/Post.css';

const Post = ({ post, token, currentUserId, currentUserProfilePic }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);

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

  // Fetch the like count for the post
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

  // Fetch whether the current user has liked this post
  const fetchLikedStatus = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/posts/${post.post_id}/liked`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLiked(res.data.liked);
    } catch (err) {
      console.error('Error fetching liked status:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchComments();
      fetchLikes();
      fetchLikedStatus();
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
      // Append a temporary comment (ideally re-fetch comments)
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

  // Toggle like/unlike functionality
  const handleToggleLike = async () => {
    try {
      if (!liked) {
        await axios.post(`http://localhost:5000/posts/${post.post_id}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiked(true);
      } else {
        await axios.delete(`http://localhost:5000/posts/${post.post_id}/like`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiked(false);
      }
      fetchLikes();
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  // Decide which profile image URL to use:
  // If the post belongs to the current user, use currentUserProfilePic (if available)
  // Otherwise, use the profile_picture_url from the post data (or default)
  const profileImageUrl =
    post.user_id === currentUserId && currentUserProfilePic
      ? `http://localhost:5000${currentUserProfilePic}`
      : post.profile_picture_url
      ? `http://localhost:5000${post.profile_picture_url}`
      : "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg";

  return (
    <div className="post">
      {/* Post Header */}
      <div className="post-author">
        <img 
          src={profileImageUrl} 
          alt={post.username || 'User'} 
        />
        <span>{post.username || `User ${post.user_id}`}</span>
      </div>

      {/* Post Content */}
      <div className="post-content">
        <p>{post.content}</p>
      </div>

      {/* Post Stats (like & comment counts) */}
      <div className="post-stats">
        <span>{likes} {likes === 1 ? "Like" : "Likes"}</span>
        <span>{comments.length} {comments.length === 1 ? "Comment" : "Comments"}</span>
      </div>

      {/* Post Actions */}
      <div className="post-actions">
        <button onClick={handleToggleLike} className={liked ? 'liked' : ''}>
          {liked ? "Unlike" : "Like"}
        </button>
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
