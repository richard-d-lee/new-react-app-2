import React, { useState } from 'react';

const CreatePost = () => {
  const [postContent, setPostContent] = useState('');

  const handlePost = () => {
    if (postContent.trim()) {
      // Add logic to submit the post (e.g., API call)
      console.log('Posting:', postContent);
      setPostContent('');
    }
  };

  return (
    <div className="create-post">
      <textarea
        placeholder="What's on your mind?"
        value={postContent}
        onChange={(e) => setPostContent(e.target.value)}
      />
      <button onClick={handlePost}>Post</button>
    </div>
  );
};

export default CreatePost;