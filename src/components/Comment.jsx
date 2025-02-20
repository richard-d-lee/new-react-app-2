import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Comment.css';

const Comment = ({
  comment,
  token,
  currentUserId,
  onAddComment,
  onDeleteComment
}) => {
  const isReply = !!comment.parent_comment_id;
  const [likes, setLikes] = useState(comment.likeCount || 0);
  const [liked, setLiked] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [error, setError] = useState('');

  // For expanded replies
  const [showAllReplies, setShowAllReplies] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios.get(`http://localhost:5000/comments/${comment.comment_id}/liked`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then((res) => {
      setLiked(res.data.liked);
      setLikes(res.data.likeCount);
    })
    .catch((err) => {
      console.error("Error fetching comment like status:", err);
    });
  }, [comment.comment_id, token]);

  const handleLike = async () => {
    try {
      if (!liked) {
        await axios.post(
          `http://localhost:5000/comments/${comment.comment_id}/like`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setLiked(true);
        setLikes(prev => prev + 1);
      } else {
        await axios.delete(
          `http://localhost:5000/comments/${comment.comment_id}/like`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setLiked(false);
        setLikes(prev => prev - 1);
      }
    } catch (err) {
      console.error("Error toggling comment like:", err);
      setError(err.response?.data?.error || "Error toggling like");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      await axios.delete(`http://localhost:5000/comments/${comment.comment_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onDeleteComment(comment.comment_id, comment.parent_comment_id || null);
    } catch (err) {
      console.error("Error deleting comment:", err);
      setError(err.response?.data?.error || "Error deleting comment");
    }
  };

  const toggleReplyForm = () => {
    setShowReplyForm(!showReplyForm);
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    try {
      const res = await axios.post(
        `http://localhost:5000/comments/${comment.comment_id}/reply`,
        { content: replyContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newReply = {
        comment_id: res.data.commentId,
        content: replyContent,
        user_id: currentUserId,
        username: 'You',
        likeCount: 0,
        created_at: new Date().toISOString(),
        parent_comment_id: comment.comment_id,
        replies: []
      };
      onAddComment(newReply);
      setReplyContent('');
      setShowReplyForm(false);
    } catch (err) {
      console.error("Error creating reply:", err);
      setError(err.response?.data?.error || "Error creating reply");
    }
  };

  const replyCount = !isReply && comment.replies ? comment.replies.length : 0;

  // If we have more than 1 replies, we only show 1 by default
  const visibleReplies = !isReply && comment.replies
    ? showAllReplies
      ? comment.replies
      : comment.replies.slice(0, 1)
    : [];

  return (
    <div className={`comment ${isReply ? 'reply' : ''}`}>
      {error && <p className="comment-error">{error}</p>}

      <span className="comment-author">{comment.username || 'User'}</span>
      <span className="comment-content">{comment.content}</span>

      <div className="comment-stats">
        <span>{likes} {likes === 1 ? 'Like' : 'Likes'}</span>
        {!isReply && (
          <span>{replyCount} {replyCount === 1 ? 'Reply' : 'Replies'}</span>
        )}
      </div>

      <div className="comment-actions">
        <span className="comment-link" onClick={handleLike}>
          {liked ? 'Unlike' : 'Like'}
        </span>
        {!isReply && (
          <span className="comment-link" onClick={toggleReplyForm}>
            Reply
          </span>
        )}
        {comment.user_id === currentUserId && (
          <span className="comment-link" onClick={handleDelete}>
            Delete
          </span>
        )}
      </div>

      {!isReply && showReplyForm && (
        <div className="comment-reply-form">
          <form onSubmit={handleSubmitReply}>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
            />
            <button type="submit">Post Reply</button>
          </form>
        </div>
      )}

      {/* Render visible replies (either 1 or all) */}
      {!isReply && visibleReplies.length > 0 && (
        <div className="comment-replies">
          {visibleReplies.map(r => (
            <Comment
              key={r.comment_id}
              comment={r}
              token={token}
              currentUserId={currentUserId}
              onAddComment={() => {}}
              onDeleteComment={onDeleteComment}
            />
          ))}
        </div>
      )}

      {/* If we have more than 1 replies, show an expand/collapse link */}
      {!isReply && comment.replies && comment.replies.length > 1 && (
        <div className="expand-replies-link">
          <span
            className="comment-link"
            onClick={() => setShowAllReplies(!showAllReplies)}
          >
            {showAllReplies
              ? `Hide replies`
              : `View ${comment.replies.length} replies`}
          </span>
        </div>
      )}
    </div>
  );
};

export default Comment;
