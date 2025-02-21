import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Comment from './Comment.jsx';
import ProfilePic from './ProfilePic.jsx';
import '../styles/Post.css';
import { buildCommentTree } from '../helpers/buildCommentTree.js';

function findCommentInTree(tree, targetId) {
  // Recursively search comment tree for targetId
  for (const comment of tree) {
    if (comment.comment_id === targetId) return comment;
    if (comment.replies && comment.replies.length > 0) {
      const found = findCommentInTree(comment.replies, targetId);
      if (found) return found;
    }
  }
  return null;
}

const Post = ({
  post,
  token,
  currentUserId,
  currentUserProfilePic,
  onDelete,
  setCurrentView,
  onProfileClick = () => {},
  groupId,                // if provided, this post is a group post
  expandedCommentId       // NEW: optional ID to highlight & scroll to
}) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [author, setAuthor] = useState({
    username: post.username || `User ${post.user_id || ''}`,
    profile_picture_url: post.profile_picture_url || null
  });

  const commentsRef = useRef(null);
  // For scrolling to a specific comment
  const commentRefs = useRef({}); 

  const effectivePostId = post?.post_id || post?.postId;

  // Build base URL for post API calls
  const basePostUrl = groupId
    ? `http://localhost:5000/groups/${groupId}/posts/${effectivePostId}`
    : `http://localhost:5000/posts/${effectivePostId}`;

  // Build comments URL
  const commentsUrl = groupId
    ? `http://localhost:5000/groups/${groupId}/posts/${effectivePostId}/comments`
    : `http://localhost:5000/posts/${effectivePostId}/comments`;

  // Fetch author info if not provided and if post.user_id exists
  useEffect(() => {
    if (!effectivePostId || post.username || !post.user_id) return;
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
  }, [effectivePostId, post.user_id, post.username, token]);

  // Fetch comments for this post
  useEffect(() => {
    if (!effectivePostId) return;
    axios.get(commentsUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setComments(buildCommentTree(res.data)))
      .catch(err => console.error("Error fetching comments:", err));
  }, [effectivePostId, token, commentsUrl]);

  // If expandedCommentId is provided, auto-expand (showAllComments) if the target comment is not visible
  useEffect(() => {
    if (!expandedCommentId || comments.length === 0) return;

    // If the target comment is in the tree, we show all so we can highlight it
    const foundComment = findCommentInTree(comments, expandedCommentId);
    if (foundComment) {
      setShowAllComments(true);
    }
  }, [expandedCommentId, comments]);

  // After we've shown all comments, scroll to the highlighted comment
  useEffect(() => {
    if (!expandedCommentId || comments.length === 0) return;

    // Delay slightly to ensure DOM is updated
    setTimeout(() => {
      const targetEl = commentRefs.current[expandedCommentId];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, [expandedCommentId, comments, showAllComments]);

  // Fetch like count and liked status for this post
  useEffect(() => {
    if (!token || !effectivePostId) return;
    axios.get(`${basePostUrl}/likes/count`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setLikeCount(res.data.likeCount))
      .catch(err => console.error("Error fetching like count:", err));
    axios.get(`${basePostUrl}/liked`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setLiked(res.data.liked))
      .catch(err => console.error("Error fetching liked status:", err));
  }, [token, effectivePostId, basePostUrl]);

  // Toggle like/unlike for the post
  const handleToggleLike = async () => {
    if (!effectivePostId) {
      console.error("Post ID is undefined. Cannot like/unlike.");
      return;
    }
    try {
      if (!liked) {
        await axios.post(`${basePostUrl}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiked(true);
        setLikeCount(prev => prev + 1);
      } else {
        await axios.delete(`${basePostUrl}/like`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLiked(false);
        setLikeCount(prev => prev - 1);
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  // Delete the post using the correct endpoint
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await axios.delete(basePostUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (typeof onDelete === 'function') onDelete(effectivePostId);
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  // Update comments state when a new comment or reply is added
  const handleAddComment = (newCommentObj) => {
    if (newCommentObj.parent_comment_id) {
      setComments(prev =>
        prev.map(c => c.comment_id === newCommentObj.parent_comment_id
          ? {
              ...c,
              replies: c.replies ? [...c.replies, newCommentObj] : [newCommentObj]
            }
          : c
        )
      );
    } else {
      setComments(prev => [newCommentObj, ...prev]);
    }
  };

  // Post a new comment
  const handlePostNewComment = async () => {
    if (!newComment.trim()) return;
    if (!effectivePostId) {
      console.error("Post ID is undefined. Cannot add comment.");
      return;
    }
    try {
      const res = await axios.post(commentsUrl, { content: newComment }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      handleAddComment(res.data);
      setNewComment('');
      setShowCommentForm(false);
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  // Delete a comment (local state update)
  const handleDeleteComment = (commentId, parentId) => {
    setComments(prev =>
      prev.map(comment => {
        if (parentId && comment.comment_id === parentId && comment.replies) {
          return {
            ...comment,
            replies: comment.replies.filter(r => r.comment_id !== commentId)
          };
        }
        return comment;
      }).filter(comment => comment.comment_id !== commentId)
    );
  };

  const finalUsername = author.username || "Unknown User";
  const finalProfilePic = author.profile_picture_url
    ? `http://localhost:5000${author.profile_picture_url}`
    : "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg";

  const handleProfileClick = () => {
    if (post.user_id) setCurrentView({ view: 'profile', userId: post.user_id });
  };

  const totalCommentCount = comments.length;
  const visibleComments = showAllComments ? comments : comments.slice(0, 1);

  return (
    <div className="post">
      {/* Post Header */}
      <div className="post-author">
        <span onClick={handleProfileClick} style={{ cursor: post.user_id ? 'pointer' : 'default' }}>
          <ProfilePic imageUrl={finalProfilePic} alt={finalUsername} size={40} />
        </span>
        <span
          className="post-author-link"
          onClick={handleProfileClick}
          style={{ cursor: post.user_id ? 'pointer' : 'default', marginLeft: '8px', color: '#1877f2' }}
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
        <p>{post.content || "No content available"}</p>
      </div>

      {/* Post Stats */}
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

      {/* Comments Section */}
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
            groupId={groupId}             // for group posts
            groupPostId={effectivePostId} // for group replies
            // Pass a ref callback so we can store each comment DOM node
            refCallback={(el) => {
              if (el) commentRefs.current[comment.comment_id] = el;
            }}
            // Indicate if this comment is highlighted
            isHighlighted={expandedCommentId === comment.comment_id}
            // Also pass expandedCommentId down if you want nested replies to highlight
            expandedCommentId={expandedCommentId}
          />
        ))}
        {comments.length > 1 && (
          <div className="expand-comments-link">
            <span className="post-link" onClick={() => setShowAllComments(!showAllComments)}>
              {showAllComments ? `Hide ${comments.length} comments` : `Show ${comments.length} comments`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Post;
