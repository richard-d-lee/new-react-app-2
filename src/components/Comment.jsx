import React, { useState, useEffect } from 'react'; 
import axios from 'axios';
import ProfilePic from './ProfilePic.jsx';
import '../styles/Comment.css';

const Comment = ({
  comment,
  token,
  currentUserId,
  setCurrentView,
  onAddComment,    // Callback for when a reply is added (updates parent's state)
  onDeleteComment, // Callback for when a comment/reply is deleted (updates parent's state)
  onProfileClick   // Callback to switch HomePage view to show commenter's profile
}) => {
  const isReply = !!comment.parent_comment_id;
  const [likes, setLikes] = useState(comment.likeCount || 0);
  const [liked, setLiked] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [error, setError] = useState('');
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [profilePic, setProfilePic] = useState('');

  // Fetch commenter's profile picture on mount
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
    axios.get(`http://localhost:5000/comments/${comment.comment_id}/liked`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setLiked(res.data.liked);
        setLikes(res.data.likeCount);
      })
      .catch(err => console.error("Error fetching comment like status:", err));
  }, [comment.comment_id, token]);

  // Toggle like/unlike for the comment
  const handleLike = async () => {
    try {
      if (!liked) {
        await axios.post(`http://localhost:5000/comments/${comment.comment_id}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiked(true);
        setLikes(prev => prev + 1);
      } else {
        await axios.delete(`http://localhost:5000/comments/${comment.comment_id}/like`, {
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

  // Delete comment or reply and update UI immediately via parent's state update
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

  // Toggle reply form
  const toggleReplyForm = () => {
    setShowReplyForm(!showReplyForm);
  };

  // Submit a reply to the comment
  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    try {
      const res = await axios.post(
        `http://localhost:5000/comments/${comment.comment_id}/reply`,
        { content: replyContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newReplyObj = res.data; // Server returns full reply object
      onAddComment(newReplyObj);
      setReplyContent('');
      setShowReplyForm(false);
    } catch (err) {
      console.error("Error creating reply:", err);
      setError("Could not post reply. Please try again.");
    }
  };

  // Toggle showing all replies or just one
  const toggleShowAllReplies = () => {
    setShowAllReplies(prev => !prev);
  };

  return (
    <div className={`comment ${isReply ? 'reply' : ''}`}>
      {error && <p className="comment-error">{error}</p>}
      
      {/* Comment Header: ProfilePic + Username + Timestamp */}
      <div className="comment-header">
        <span onClick={() => onProfileClick && onProfileClick(comment.user_id)} style={{ cursor: 'pointer' }}>
          <ProfilePic imageUrl={profilePic} alt={comment.username || 'User'} size={30} />
        </span>
        <span
          className="comment-author-link"
          onClick={() => onProfileClick && onProfileClick(comment.user_id)}
          style={{ cursor: 'pointer', marginLeft: '8px', fontWeight: 600, color: '#1877f2' }}
        >
          {comment.username || 'User'}
        </span>
        <span className="comment-timestamp" style={{ fontSize: '12px', color: '#555', marginLeft: 'auto' }}>
          {comment.created_at ? new Date(comment.created_at).toLocaleString() : ''}
        </span>
      </div>
      
      {/* Comment Content */}
      <div className="comment-content">{comment.content}</div>
      
      {/* Comment Stats: Show counts if > 0 */}
      <div className="comment-stats">
        {likes > 0 && <span>{likes} {likes === 1 ? 'Like' : 'Likes'}</span>}
        {!isReply && comment.replies && comment.replies.length > 0 && (
          <span>
            {`${comment.replies.length} ${comment.replies.length === 1 ? 'Reply' : 'Replies'}`}
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
      
      {/* Reply Form (collapsed by default) */}
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
          {(showAllReplies ? comment.replies : comment.replies.slice(0, 1)).map(r => (
            <Comment
              key={r.comment_id}
              comment={r}
              token={token}
              currentUserId={currentUserId}
              onAddComment={onAddComment}
              onDeleteComment={onDeleteComment}
              onProfileClick={onProfileClick}
              setCurrentView={setCurrentView}
            />
          ))}
          {comment.replies.length > 1 && (
            <div className="expand-replies-link">
              <span className="comment-link" onClick={toggleShowAllReplies}>
                {showAllReplies ? `Hide ${comment.replies.length} replies` : `${comment.replies.length} replies`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Comment;
