import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Comment from './Comment.jsx';
import '../styles/Post.css';
import { buildCommentTree } from '../helpers/buildCommentTree.js';

const Post = ({ post, token, currentUserId, currentUserProfilePic, groupId, onDelete }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [newReply, setNewReply] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);

  // Build the comment tree after fetching comments
  useEffect(() => {
    axios.get(`http://localhost:5000/posts/${post.post_id}/comments`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then((res) => {
      const structured = buildCommentTree(res.data);
      setComments(structured);
    })
    .catch((err) => {
      console.error("Error fetching comments:", err);
    });
  }, [post.post_id, token]);

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
      fetchLikes();
      fetchLikedStatus();
    }
  }, [post.post_id, token]);

  // Toggle like/unlike
  const handleToggleLike = async () => {
    try {
      if (!liked) {
        await axios.post(`http://localhost:5000/posts/${post.post_id}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiked(true);
        setLikes(prev => prev + 1);
      } else {
        await axios.delete(`http://localhost:5000/posts/${post.post_id}/like`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiked(false);
        setLikes(prev => prev - 1);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  // Delete the post (only if current user is the author)
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const url = groupId
        ? `http://localhost:5000/groups/${groupId}/posts/${post.post_id}`
        : `http://localhost:5000/posts/${post.post_id}`;
      await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (onDelete) onDelete(post.post_id);
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  // Add a new top-level comment
  const handleComment = async () => {
    if (!newComment.trim()) return;
    try {
      await axios.post(
        `http://localhost:5000/posts/${post.post_id}/comments`,
        { content: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const tempComment = {
        comment_id: Date.now(),
        content: newComment,
        user_id: currentUserId,
        username: 'You',
        created_at: new Date().toISOString(),
        parent_comment_id: null,
        replies: []
      };
      setComments(prev => [tempComment, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  // Add a new "reply" to the post itself (using the same endpoint as a top-level comment)
  const handlePostReply = async () => {
    if (!newReply.trim()) return;
    try {
      await axios.post(
        `http://localhost:5000/posts/${post.post_id}/comments`,
        { content: newReply },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const tempComment = {
        comment_id: Date.now(),
        content: newReply,
        user_id: currentUserId,
        username: 'You',
        created_at: new Date().toISOString(),
        parent_comment_id: null,
        replies: []
      };
      setComments(prev => [tempComment, ...prev]);
      setNewReply('');
      setShowReplyForm(false);
    } catch (err) {
      console.error('Error replying to post:', err);
    }
  };

  // Toggle the "Reply to post" form
  const toggleReplyForm = () => {
    setShowReplyForm(!showReplyForm);
  };

  // For adding replies to comments (passed down to Comment.jsx)
  const handleAddComment = (newReply) => {
    if (!newReply.parent_comment_id) {
      setComments(prev => [newReply, ...prev]);
    } else {
      setComments(prev =>
        prev.map(parent =>
          parent.comment_id === newReply.parent_comment_id
            ? { ...parent, replies: [newReply, ...parent.replies] }
            : parent
        )
      );
    }
  };

  // For deleting a comment or reply
  const handleDeleteComment = (commentId, parentId) => {
    if (!parentId) {
      setComments(prev => prev.filter(c => c.comment_id !== commentId));
    } else {
      setComments(prev =>
        prev.map(parent =>
          parent.comment_id === parentId
            ? { ...parent, replies: parent.replies.filter(r => r.comment_id !== commentId) }
            : parent
        )
      );
    }
  };

  // Determine the post author's profile image URL
  const profileImageUrl =
    post.user_id === currentUserId && currentUserProfilePic
      ? `http://localhost:5000${currentUserProfilePic}`
      : post.profile_picture_url
      ? `http://localhost:5000${post.profile_picture_url}`
      : "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg";

  // Count total comments (including replies)
  const commentCount = comments.reduce(
    (acc, c) => acc + 1 + (c.replies ? c.replies.length : 0),
    0
  );

  return (
    <div className="post">
      {/* Post header */}
      <div className="post-author">
        <img 
          src={profileImageUrl} 
          alt={post.username || 'User'} 
        />
        <span>{post.username || `User ${post.user_id}`}</span>
        {post.user_id === currentUserId && (
          <span className="post-link" onClick={handleDelete}>
            Delete
          </span>
        )}
      </div>

      {/* Post content */}
      <div className="post-content">
        <p>{post.content}</p>
      </div>

      {/* Post stats */}
      <div className="post-stats">
        <span>{likes} {likes === 1 ? "Like" : "Likes"}</span>
        <span>{commentCount} {commentCount === 1 ? "Comment" : "Comments"}</span>
      </div>

      {/* Post actions */}
      <div className="post-actions">
        <span className="post-link" onClick={handleToggleLike}>
          {liked ? 'Unlike' : 'Like'}
        </span>
        <span className="post-link" onClick={toggleReplyForm}>
          Reply
        </span>
      </div>

      {/* Reply form for the post */}
      {showReplyForm && (
        <div className="post-reply-form">
          <textarea
            value={newReply}
            onChange={(e) => setNewReply(e.target.value)}
            placeholder="Write a reply to this post..."
          />
          <button onClick={handlePostReply}>Post Reply</button>
        </div>
      )}

      {/* Comments list */}
      <div className="comments">
        {comments.map((comment) => (
          <Comment
            key={comment.comment_id}
            comment={comment}
            token={token}
            currentUserId={currentUserId}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
          />
        ))}
      </div>
    </div>
  );
};

export default Post;
