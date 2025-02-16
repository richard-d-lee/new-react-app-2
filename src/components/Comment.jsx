import React from 'react';
import '../styles/Comment.css';

const Comment = ({ comment }) => {
  return (
    <div className="comment">
      <span className="comment-author">{comment.username || 'User'}</span> 
      <span className="comment-content">{comment.content}</span>
    </div>
  );
};

export default Comment;
