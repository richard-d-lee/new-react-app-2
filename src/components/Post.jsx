import React, { useState } from 'react';

const Post = ({ post }) => {
  const [likes, setLikes] = useState(post.likes);
  const [comments, setComments] = useState(post.comments);
  const [newComment, setNewComment] = useState('');

  const handleLike = () => {
    setLikes(likes + 1);
  };

  const handleComment = () => {
    if (newComment.trim()) {
      const comment = {
        id: comments.length + 1,
        author: 'Current User', // Replace with actual user data
        text: newComment,
      };
      setComments([...comments, comment]);
      setNewComment('');
    }
  };

  return (
    <div className="post">
      {/* Post Author */}
      <div className="post-author">
        <img src={post.authorAvatar} alt={post.author} />
        <span>{post.author}</span>
      </div>

      {/* Post Content */}
      <div className="post-content">
        <p>{post.content}</p>
      </div>

      {/* Post Actions (Like, Comment) */}
      <div className="post-actions">
        <button onClick={handleLike}>👍 {likes} Likes</button>
        <button>💬 {comments.length} Comments</button>
      </div>

      {/* Comments Section */}
      <div className="comments">
        {comments.map((comment) => (
          <div key={comment.id} className="comment">
            <strong>{comment.author}:</strong> {comment.text}
          </div>
        ))}
      </div>

      {/* Add Comment Input */}
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