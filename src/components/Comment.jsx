import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ProfilePic from './ProfilePic.jsx';
import '../styles/Comment.css';

const Comment = ({
  comment,
  token,
  currentUserId,
  setCurrentView,
  onAddComment,    // Callback for when a reply is added
  onDeleteComment, // Callback for deletion
  onProfileClick,  // Callback to view profile
  groupId,         // Optional: if provided, this comment is for a group post
  groupPostId,     // Optional: group post ID (for replies)

  // NEW props for highlighting and scrolling
  isHighlighted = false,  
  refCallback = null
}) => {
  const [likes, setLikes] = useState(comment.likeCount || 0);
  const [liked, setLiked] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [error, setError] = useState('');
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [profilePic, setProfilePic] = useState('');

  // This comment might be a reply if parent_comment_id is set
  const isReply = !!comment.parent_comment_id;

  // For referencing the DOM element
  const commentEl = useRef(null);

  // If we want to pass this DOM element back to the parent for scrolling
  useEffect(() => {
    if (refCallback && commentEl.current) {
      refCallback(commentEl.current);
    }
  }, [refCallback]);

  // Use group_comment_id if available when groupId is provided; otherwise, use comment_id.
  const commentId = groupId 
    ? (comment.group_comment_id || comment.comment_id)
    : comment.comment_id;

  // Build base URL for comment endpoints:
  // For group comments, endpoints will be under /groups/{groupId}/comments/{commentId}
  const baseCommentUrl = groupId
    ? `http://localhost:5000/groups/${groupId}/comments/${commentId}`
    : `http://localhost:5000/comments/${commentId}`;

  // Fetch commenter's profile picture
  useEffect(() => {
    if (!comment.user_id) return;
    axios.get(`http://localhost:5000/users/${comment.user_id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setProfilePic(
          res.data.profile_picture_url
            ? `http://localhost:5000${res.data.profile_picture_url}`
            : "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg"
        );
      })
      .catch(err => console.error("Error fetching commenter's profile picture:", err));
  }, [comment.user_id, token]);

  // Fetch like status for the comment
  useEffect(() => {
    if (!token) return;
    axios.get(`${baseCommentUrl}/liked`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setLiked(res.data.liked);
        // If your endpoint returns likeCount, you can set it here
        if (typeof res.data.likeCount === 'number') {
          setLikes(res.data.likeCount);
        }
      })
      .catch(err => console.error("Error fetching comment like status:", err));
  }, [baseCommentUrl, token]);

  // Toggle like/unlike for the comment
  const handleLike = async () => {
    try {
      if (!liked) {
        await axios.post(`${baseCommentUrl}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiked(true);
        setLikes(prev => prev + 1);
      } else {
        await axios.delete(`${baseCommentUrl}/like`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiked(false);
        setLikes(prev => prev - 1);
      }
    } catch (err) {
      console.error("Error toggling comment like:", err);
      setError(err.response?.data?.error || "Error toggling like");
    }
  };

  // Delete the comment
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      await axios.delete(`${baseCommentUrl}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onDeleteComment(commentId, comment.parent_comment_id || null);
    } catch (err) {
      console.error("Error deleting comment:", err);
      setError(err.response?.data?.error || "Error deleting comment");
    }
  };

  // Toggle reply form
  const toggleReplyForm = () => {
    setShowReplyForm(prev => !prev);
  };

  // Toggle showing all replies
  const toggleShowAllReplies = () => {
    setShowAllReplies(prev => !prev);
  };

  // Submit a reply to the comment
  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    try {
      // Use group-specific endpoint if groupId is provided.
      const replyUrl = groupId
        ? `http://localhost:5000/groups/${groupId}/comments/${commentId}/reply`
        : `http://localhost:5000/comments/${commentId}/reply`;

      // For group replies, you might include groupPostId in the payload if your backend requires it
      const payload = groupId 
        ? { content: replyContent, groupPostId: comment.post_id } 
        : { content: replyContent };

      const res = await axios.post(replyUrl, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newReplyObj = res.data;
      onAddComment(newReplyObj);
      setReplyContent('');
      setShowReplyForm(false);
    } catch (err) {
      console.error("Error creating reply:", err);
      setError("Could not post reply. Please try again.");
    }
  };

  return (
    <div
      className={`comment ${isReply ? 'reply' : ''} ${isHighlighted ? 'highlighted' : ''}`}
      ref={commentEl}
    >
      {error && <p className="comment-error">{error}</p>}

      {/* Comment Header */}
      <div className="comment-header">
        <span
          onClick={() => onProfileClick && onProfileClick(comment.user_id)}
          style={{ cursor: 'pointer' }}
        >
          <ProfilePic imageUrl={profilePic} alt={comment.username || 'User'} size={30} />
        </span>
        <span
          className="comment-author-link"
          onClick={() => onProfileClick && onProfileClick(comment.user_id)}
          style={{ cursor: 'pointer', marginLeft: '8px', fontWeight: 600, color: '#1877f2' }}
        >
          {comment.username || 'User'}
        </span>
        <span
          className="comment-timestamp"
          style={{ fontSize: '12px', color: '#555', marginLeft: 'auto' }}
        >
          {comment.created_at ? new Date(comment.created_at).toLocaleString() : ''}
        </span>
      </div>

      {/* Comment Content */}
      <div className="comment-content">{comment.content}</div>

      {/* Comment Stats */}
      <div className="comment-stats">
        {likes > 0 && <span>{likes} {likes === 1 ? 'Like' : 'Likes'}</span>}
        {!isReply && comment.replies && comment.replies.length > 0 && (
          <span>
            {comment.replies.length} {comment.replies.length === 1 ? 'Reply' : 'Replies'}
          </span>
        )}
      </div>

      {/* Comment Actions */}
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

      {/* Reply Form */}
      {!isReply && showReplyForm && (
        <div className="comment-reply-form">
          <form onSubmit={handleSubmitReply}>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={`Reply to ${comment.username || 'User'}`}
            />
            <button type="submit">Reply</button>
          </form>
        </div>
      )}

      {/* Replies Section */}
      {!isReply && comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {(showAllReplies ? comment.replies : comment.replies.slice(0, 1)).map((r) => (
            <Comment
              key={r.comment_id || r.group_comment_id}
              comment={r}
              token={token}
              currentUserId={currentUserId}
              onAddComment={onAddComment}
              onDeleteComment={onDeleteComment}
              onProfileClick={onProfileClick}
              setCurrentView={setCurrentView}
              groupId={groupId}
              groupPostId={groupPostId}

              /* For nested replies, we do not highlight by default
                 unless you pass down expandedCommentId and compare. */
            />
          ))}
          {comment.replies.length > 1 && (
            <div className="expand-replies-link">
              <span className="comment-link" onClick={toggleShowAllReplies}>
                {showAllReplies
                  ? `Hide ${comment.replies.length} replies`
                  : `Show ${comment.replies.length} replies`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Comment;
