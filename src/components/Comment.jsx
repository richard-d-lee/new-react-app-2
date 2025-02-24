import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ProfilePic from './ProfilePic.jsx';
import '../styles/Comment.css';
import { parseMentions, extractMentionsFromMarkup } from '../helpers/parseMentions.js';
import { MentionsInput, Mention } from 'react-mentions';

const mentionStyle = { backgroundColor: '#daf4fa' };
const defaultStyle = {
  control: {
    backgroundColor: '#fff',
    fontSize: 14,
    fontWeight: 'normal'
  },
  '&multiLine': {
    control: { minHeight: 50 },
    highlighter: { padding: 9, border: '1px solid transparent' },
    input: { padding: 9, border: '1px solid silver' }
  },
  suggestions: {
    list: { backgroundColor: 'white', border: '1px solid #ccc', fontSize: 14, maxHeight: 150, overflowY: 'auto' },
    item: { padding: '5px 15px', borderBottom: '1px solid #ddd', '&focused': { backgroundColor: '#cee4e5' } }
  }
};

const Comment = ({
  comment = {},
  token,
  currentUserId,
  setCurrentView,
  onAddComment,
  onDeleteComment,
  onProfileClick,
  // Group context:
  groupId,
  groupPostId,
  // Event context:
  eventId,
  // If provided, event post id; if not, falls back to comment.post_id
  eventPostId,
  isHighlighted = false,
  refCallback = null
}) => {
  const [likes, setLikes] = useState(comment.likeCount || 0);
  const [liked, setLiked] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [error, setError] = useState('');
  const [profilePic, setProfilePic] = useState('');

  const isReply = !!comment.parent_comment_id;
  const commentEl = useRef(null);
  useEffect(() => {
    if (refCallback && commentEl.current) {
      refCallback(commentEl.current);
    }
  }, [refCallback]);

  // Use group_comment_id if in group context; otherwise fallback to comment_id.
  const commentId = groupId
    ? (comment.group_comment_id || comment.comment_id)
    : comment.comment_id;

  // Compute effective event post id if in event context.
  const effectiveEventPostId = eventId ? (eventPostId || comment.post_id) : null;

  // Build base URL for actions (like, delete)
  const baseCommentUrl = eventId && effectiveEventPostId
    ? `http://localhost:5000/events/${eventId}/posts/${effectiveEventPostId}/comments/${commentId}`
    : groupId
      ? `http://localhost:5000/groups/${groupId}/comments/${commentId}`
      : `http://localhost:5000/comments/${commentId}`;

  // Mention suggestions function.
  const fetchUsers = async (query, callback) => {
    if (!query) return callback([]);
    try {
      const res = await axios.get(`http://localhost:5000/users/search?query=${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const suggestions = res.data.map(user => ({
        id: user.user_id.toString(),
        display: user.username
      }));
      callback(suggestions);
    } catch (err) {
      console.error('Error fetching mention suggestions:', err);
      callback([]);
    }
  };

  // Fetch commenter's profile picture.
  useEffect(() => {
    if (!comment.user_id) return;
    axios.get(`http://localhost:5000/users/${comment.user_id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        const picUrl = res.data.profile_picture_url
          ? `http://localhost:5000${res.data.profile_picture_url}`
          : "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg";
        setProfilePic(picUrl);
      })
      .catch(err => console.error("Error fetching commenter's profile picture:", err));
  }, [comment.user_id, token]);

  // Fetch like status.
  useEffect(() => {
    if (!token) return;
    axios.get(`${baseCommentUrl}/liked`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setLiked(res.data.liked);
        if (typeof res.data.likeCount === 'number') {
          setLikes(res.data.likeCount);
        }
      })
      .catch(err => console.error("Error fetching comment like status:", err));
  }, [baseCommentUrl, token]);

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

  const toggleReplyForm = () => {
    setShowReplyForm(prev => !prev);
  };

  /**
   * Submit a reply.
   * For event comments, always use the dedicated reply endpoint:
   * POST /events/:eventId/comments/:commentId/reply
   */
  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    try {
      let replyUrl;
      if (eventId) {
        replyUrl = `http://localhost:5000/events/${eventId}/comments/${commentId}/reply`;
      } else if (groupId) {
        replyUrl = `http://localhost:5000/groups/${groupId}/comments/${commentId}/reply`;
      } else {
        replyUrl = `http://localhost:5000/comments/${commentId}/reply`;
      }
      const res = await axios.post(
        replyUrl,
        { content: replyContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newReplyObj = res.data;
      onAddComment(newReplyObj);

      // Process any @mentions.
      const group_id = groupId || null;
      const mentions = extractMentionsFromMarkup(replyContent);
      for (const { id: userId } of mentions) {
        try {
          await axios.post(
            'http://localhost:5000/mentions/comment',
            {
              comment_id: newReplyObj.comment_id,
              mentioned_user_id: Number(userId),
              group_id
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (err2) {
          console.error('Error creating comment mention:', err2);
        }
      }
      setReplyContent('');
      setShowReplyForm(false);
    } catch (err) {
      console.error('Error creating reply:', err);
      setError('Could not post reply. Please try again.');
    }
  };

  // Parse comment content for @mentions.
  const parsedContent = parseMentions(comment.content || '', onProfileClick);

  return (
    <div className={`comment ${isReply ? 'reply' : ''} ${isHighlighted ? 'highlighted' : ''}`}
         ref={commentEl}>
      {error && <p className="comment-error">{error}</p>}
      
      {/* Comment header with clickable profile picture and username */}
      <div className="comment-header">
        <span 
          onClick={() => onProfileClick && onProfileClick(comment.user_id)}
          style={{ cursor: 'pointer' }}>
          <ProfilePic imageUrl={profilePic} alt={comment.username || 'User'} size={30} />
        </span>
        <span 
          className="comment-author-link"
          onClick={() => onProfileClick && onProfileClick(comment.user_id)}
          style={{ cursor: 'pointer', marginLeft: '8px', fontWeight: 600, color: '#1877f2' }}>
          {comment.username || 'User'}
        </span>
        <span 
          className="comment-timestamp"
          style={{ fontSize: '12px', color: '#555', marginLeft: 'auto' }}>
          {comment.created_at ? new Date(comment.created_at).toLocaleString() : ''}
        </span>
      </div>

      {/* Comment content */}
      <div className="comment-content">
        {parsedContent}
      </div>

      {/* Comment stats (like count) */}
      <div className="comment-stats">
        {likes > 0 && <span>{likes} {likes === 1 ? 'Like' : 'Likes'}</span>}
      </div>

      {/* Comment actions */}
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

      {/* Reply form */}
      {!isReply && showReplyForm && (
        <div className="comment-reply-form">
          <form onSubmit={handleSubmitReply}>
            <MentionsInput
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              style={defaultStyle}
              placeholder={`Reply to ${comment.username || 'User'}`}
              allowSuggestionsAboveCursor
              markup="@[__display__](__id__)"
              displayTransform={(id, display) => `${display}`}
            >
              <Mention
                trigger="@"
                data={fetchUsers}
                style={mentionStyle}
                markup="@[__display__](__id__)"
                displayTransform={(id, display) => `${display}`}
              />
            </MentionsInput>
            <button type="submit">Reply</button>
          </form>
        </div>
      )}

      {/* Nested replies */}
      {!isReply && comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map((r) => (
            <Comment
              key={r.comment_id || r.group_comment_id}
              comment={r}
              token={token}
              currentUserId={currentUserId}
              setCurrentView={setCurrentView}
              onAddComment={onAddComment}
              onDeleteComment={onDeleteComment}
              onProfileClick={onProfileClick}
              groupId={groupId}
              eventId={eventId}
              eventPostId={eventPostId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Comment;
