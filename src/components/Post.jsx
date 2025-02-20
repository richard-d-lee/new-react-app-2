import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Comment from './Comment.jsx';
import ProfilePic from './ProfilePic.jsx';
import '../styles/Post.css';
import { buildCommentTree } from '../helpers/buildCommentTree.js';

const Post = ({
  post,
  token,
  currentUserId,
  currentUserProfilePic,
  onDelete,
  setCurrentView,
  onProfileClick = () => {}
}) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [author, setAuthor] = useState({
    username: post.username || `User ${post.user_id}`,
    profile_picture_url: post.profile_picture_url || null
  });

  const commentsRef = useRef(null);
  const effectivePostId = post?.post_id || post?.postId;

  // Fetch author info if not already provided
  useEffect(() => {
    if (!effectivePostId || post.username) return;
    axios.get(`http://localhost:5000/users/${post.user_id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setAuthor({
          username: res.data.username,
          profile_picture_url: res.data.profile_picture_url
        });
      })
      .catch(err => console.error("Error fetching post author:", err));
  }, [effectivePostId, post.user_id, token]);

  // Fetch and structure comments
  useEffect(() => {
    if (!effectivePostId) return;
    axios.get(`http://localhost:5000/posts/${effectivePostId}/comments`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setComments(buildCommentTree(res.data)))
      .catch(err => console.error("Error fetching comments:", err));
  }, [effectivePostId, token]);

  // Fetch like count and liked status
  useEffect(() => {
    if (!token || !effectivePostId) return;
    axios.get(`http://localhost:5000/posts/${effectivePostId}/likes/count`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setLikeCount(res.data.likeCount))
      .catch(err => console.error("Error fetching like count:", err));
    axios.get(`http://localhost:5000/posts/${effectivePostId}/liked`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setLiked(res.data.liked))
      .catch(err => console.error("Error fetching liked status:", err));
  }, [effectivePostId, token]);

  // Toggle like/unlike
  const handleToggleLike = async () => {
    if (!effectivePostId) {
      console.error("Post ID is undefined. Cannot like post.");
      return;
    }
    try {
      if (!liked) {
        await axios.post(`http://localhost:5000/posts/${effectivePostId}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiked(true);
        setLikeCount(prev => prev + 1);
      } else {
        await axios.delete(`http://localhost:5000/posts/${effectivePostId}/like`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiked(false);
        setLikeCount(prev => prev - 1);
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  // Delete the post
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await axios.delete(`http://localhost:5000/posts/${effectivePostId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (typeof onDelete === 'function') {
        onDelete(effectivePostId);
      }
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  // Single source of truth: update parent's comment tree when adding either a top-level comment or a reply.
  const handleAddComment = (newCommentObj) => {
    if (newCommentObj.parent_comment_id) {
      // It's a reply – update the parent comment's replies.
      setComments(prev =>
        prev.map(c => {
          if (c.comment_id === newCommentObj.parent_comment_id) {
            return { 
              ...c, 
              replies: c.replies ? [...c.replies, newCommentObj] : [newCommentObj]
            };
          }
          return c;
        })
      );
    } else {
      // It's a top-level comment.
      setComments(prev => [newCommentObj, ...prev]);
    }
  };

  // Post a new top-level comment
  const handlePostNewComment = async () => {
    if (!newComment.trim()) return;
    if (!effectivePostId) {
      console.error("Post ID is undefined. Cannot add comment.");
      return;
    }
    try {
      const res = await axios.post(
        `http://localhost:5000/posts/${effectivePostId}/comments`,
        { content: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      handleAddComment(res.data);
      setNewComment('');
      setShowCommentForm(false);
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  // Delete a comment or reply (updates local state)
  const handleDeleteComment = (commentId, parentId) => {
    setComments(prev =>
      prev.map(comment => {
        if (parentId && comment.comment_id === parentId && comment.replies) {
          return { ...comment, replies: comment.replies.filter(r => r.comment_id !== commentId) };
        }
        return comment;
      }).filter(comment => comment.comment_id !== commentId)
    );
  };

  // Determine final username and profile pic for the post author
  const finalUsername = author.username;
  const finalProfilePic = author.profile_picture_url
    ? `http://localhost:5000${author.profile_picture_url}`
    : "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg";

  // Update HomePage view to show selected user's profile
  const handleProfileClick = () => {
    setCurrentView({ view: 'profile', userId: post.user_id });
  };

  // Total top-level comment count (for display)
  const totalCommentCount = comments.length;

  // Show collapsed or expanded comments
  const visibleComments = showAllComments ? comments : comments.slice(0, 1);

  return (
    <div className="post">
      {/* Post Header */}
      <div className="post-author">
        <span onClick={handleProfileClick} style={{ cursor: 'pointer' }}>
          <ProfilePic imageUrl={finalProfilePic} alt={finalUsername} size={40} />
        </span>
        <span
          className="post-author-link"
          style={{ cursor: 'pointer', marginLeft: '8px', color: '#1877f2' }}
          onClick={handleProfileClick}
        >
          {finalUsername}
        </span>
        {post.user_id === currentUserId && (
          <span className="post-link" onClick={handleDelete} style={{ marginLeft: 'auto' }}>
            Delete
          </span>
        )}
      </div>

      {/* Post Timestamp */}
      {post.created_at && (
        <div className="post-timestamp" style={{ fontSize: '12px', color: '#555', marginBottom: '5px' }}>
          {new Date(post.created_at).toLocaleString()}
        </div>
      )}

      {/* Post Content */}
      <div className="post-content">
        <p>{post.content}</p>
      </div>

      {/* Post Stats (only shown if likeCount or commentCount > 0) */}
      {(likeCount > 0 || totalCommentCount > 0) && (
        <div className="post-stats">
          {likeCount > 0 && <span>{likeCount} {likeCount === 1 ? "Like" : "Likes"}</span>}
          {totalCommentCount > 0 && <span>{totalCommentCount} {totalCommentCount === 1 ? "Comment" : "Comments"}</span>}
        </div>
      )}

      {/* Post Actions */}
      <div className="post-actions">
        <span className="post-link" onClick={handleToggleLike}>
          {liked ? 'Unlike' : 'Like'}
        </span>
        <span className="post-link" onClick={() => setShowCommentForm(!showCommentForm)}>
          Comment
        </span>
      </div>

      {/* Comment Input Field */}
      {showCommentForm && (
        <div className="post-reply-form">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
          />
          <button onClick={handlePostNewComment}>Post Comment</button>
        </div>
      )}

      {/* Comments Section with Expand/Collapse */}
      <div className="comments" ref={commentsRef}>
        {visibleComments.map(comment => (
          <Comment
            key={comment.comment_id}
            comment={comment}
            token={token}
            currentUserId={currentUserId}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onProfileClick={handleProfileClick}
            setCurrentView={setCurrentView}
          />
        ))}
        {comments.length > 1 && (
          <div className="expand-comments-link">
            <span className="post-link" onClick={() => setShowAllComments(!showAllComments)}>
              {showAllComments ? `Hide ${comments.length} comments` : `View ${comments.length} comments`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Post;
