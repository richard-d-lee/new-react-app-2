import React, { useState } from 'react';
import '../styles/Feed.css'; // Import the CSS file
import CreatePost from './CreatePost.jsx';
import Post from './Post.jsx';

const Feed = () => {
  // Example posts data (replace with real data later)
  const [posts, setPosts] = useState([
    {
      id: 1,
      author: 'John Doe',
      authorAvatar: 'https://via.placeholder.com/40',
      content: 'This is a sample post. Hello, world!',
      likes: 10,
      comments: [
        { id: 1, author: 'Jane Doe', text: 'Nice post!' },
        { id: 2, author: 'Alice', text: 'Great job!' },
      ],
    },
    {
      id: 2,
      author: 'Jane Doe',
      authorAvatar: 'https://via.placeholder.com/40',
      content: 'Another sample post. How are you all doing?',
      likes: 5,
      comments: [],
    },
  ]);

  return (
    <div className="feed">
      {/* Create Post Input */}
      <CreatePost />

      {/* Display Posts */}
      {posts.map((post) => (
        <Post key={post.id} post={post} />
      ))}
    </div>
  );
};

export default Feed;