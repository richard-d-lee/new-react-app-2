// Feed.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreatePost from './CreatePost.jsx';
import Post from './Post.jsx';
import '../styles/Feed.css';

const Feed = ({
  token,
  currentUserId,
  currentUserProfilePic,
  currentUsername,
  setCurrentView,
  postId, // optional: if present, we show only this single post
  expandedCommentId // optional: comment to auto-expand in the post
}) => {
  const [posts, setPosts] = useState([]);

  // Fetch all posts
  const fetchAllPosts = async () => {
    try {
      const res = await axios.get('http://localhost:5000/feed', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(res.data);
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  };

  // Fetch a single post
  const fetchSinglePost = async (id) => {
    try {
      const res = await axios.get(`http://localhost:5000/feed/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // The endpoint should return one post object
      // Put it into an array so we can map over it in the JSX
      setPosts([res.data]);
    } catch (err) {
      console.error('Error fetching single post:', err);
    }
  };

  // Decide which posts to fetch on mount or when postId changes
  useEffect(() => {
    if (!token) return;
    if (postId) {
      // If a single post ID is provided, fetch that post
      fetchSinglePost(postId);
    } else {
      // Otherwise, fetch all posts
      fetchAllPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, postId]);

  // Called by <CreatePost /> after a new post is created
  const handleNewPost = (newPostObj) => {
    // Insert the new post at the top
    setPosts((prev) => [newPostObj, ...prev]);
  };

  // If user deletes a post
  const handleDeletePost = (deleteId) => {
    setPosts((prev) => prev.filter((p) => p.post_id !== deleteId));
  };

  return (
    <div className="feed">
      {/* Only show CreatePost if we are viewing the full feed (not a single post) */}
      {!postId && (
        <CreatePost
          token={token}
          currentUserId={currentUserId}
          currentUsername={currentUsername}
          currentUserProfilePic={currentUserProfilePic}
          onNewPost={handleNewPost}
        />
      )}

      {posts.map((post) => (
        <Post
          key={post.post_id}
          post={post}
          token={token}
          onDelete={(postId) => handleDeletePost(postId)}
          currentUserId={currentUserId}
          currentUserProfilePic={currentUserProfilePic}
          setCurrentView={setCurrentView}
          onProfileClick={(userId) => setCurrentView({ view: 'profile', userId })}
          expandedCommentId={expandedCommentId}  // Pass it along here
        />
      ))}

    </div>
  );
};

export default Feed;
