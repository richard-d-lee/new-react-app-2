import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import CreatePost from './CreatePost.jsx';
import Post from './Post.jsx';
import ProfilePic from './ProfilePic.jsx';
import '../styles/Listing.css';

const Listing = ({ token, listingId, setCurrentView, currentUserId, currentUserProfilePic }) => {
  const [listing, setListing] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const postRef = useRef(null);
  const baseURL = 'http://localhost:5000';

  // 1) Fetch the listing details, including the poster's info (username, profile pic).
  useEffect(() => {
    axios
      .get(`${baseURL}/marketplace/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        // res.data should include something like:
        // {
        //   id: ...,
        //   title: "...",
        //   price: ...,
        //   poster_username: "...",
        //   poster_profile_pic: "...",
        //   user_id: ...,
        //   marketplace_listing_type_name: "...",
        //   image_url: "...",
        //   ...
        // }
        setListing(res.data);
      })
      .catch((err) => {
        console.error('Error fetching listing details:', err);
      });
  }, [listingId, token]);

  // 2) Fetch all posts for this listing.
  const fetchPosts = () => {
    setLoadingPosts(true);
    axios
      .get(`${baseURL}/marketplace/${listingId}/posts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        setPosts(res.data);
      })
      .catch((err) => {
        console.error('Error fetching marketplace posts:', err);
      })
      .finally(() => {
        setLoadingPosts(false);
      });
  };

  useEffect(() => {
    fetchPosts();
  }, [listingId, token]);

  // 3) Scroll to new posts if needed.
  useEffect(() => {
    if (postRef.current) {
      postRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [posts]);

  // 4) Handlers for new posts and post deletion.
  const handleNewPost = (newPostObj) => {
    setPosts((prev) => [newPostObj, ...prev]);
  };

  const handleDeletePost = (delPostId) => {
    setPosts((prev) => prev.filter((p) => p.post_id !== delPostId));
  };

  const handleBack = () => {
    setCurrentView('marketplace');
  };

  // 5) Navigate to the listing's poster profile
  const handlePosterClick = (userId) => {
    setCurrentView({ view: 'profile', userId });
  };

  if (!listing) return <p>Loading listing...</p>;

  // Use the fields returned by your backend:
  // e.g., listing.poster_username, listing.poster_profile_pic, listing.user_id
  const finalProfilePic = listing.poster_profile_pic
    ? `${baseURL}${listing.poster_profile_pic}`
    : 'https://via.placeholder.com/40';

  const posterName = listing.poster_username || 'User';

  return (
    <div className="listing-page">
      <button className="back-btn" onClick={handleBack}>
        ← Back
      </button>

      <div className="listing-details">
        <h2>{listing.title}</h2>

        {/* Display category if present */}
        {listing.marketplace_listing_type_name && (
          <p className="listing-category">
            {listing.marketplace_listing_type_name}
          </p>
        )}

        <p className="price">${listing.price}</p>
        <p className="description">{listing.description}</p>

        {/* "Posted by" area: use the user_id, poster_username, and poster_profile_pic */}
        <div className="listing-author">
          <div
            className="listing-author-info"
            onClick={() => handlePosterClick(listing.user_id)}
          >
            <ProfilePic
              imageUrl={finalProfilePic}
              alt={posterName}
              size={35}
            />
            <span className="listing-author-name">{posterName}</span>
          </div>
        </div>

        {/* Listing image, if available */}
        {listing.image_url && (
          <img
            src={listing.image_url}
            alt={listing.title}
            className="listing-image"
          />
        )}
      </div>

      <div className="listing-posts">
        <h3>Posts for this listing</h3>

        {/* The CreatePost component, passing marketplaceId for posting */}
        <CreatePost
          token={token}
          currentUserId={currentUserId}
          currentUserProfilePic={currentUserProfilePic}
          onNewPost={handleNewPost}
          marketplaceId={listingId}
        />

        {loadingPosts && <p className="loading-text">Loading posts...</p>}

        {!loadingPosts && posts.length === 0 && (
          <p className="empty">No posts yet for this listing.</p>
        )}

        {/* Render each post */}
        {posts.map((post) => (
          <div key={post.post_id} ref={postRef}>
            <Post
              post={post}
              token={token}
              currentUserId={currentUserId}
              currentUserProfilePic={currentUserProfilePic}
              setCurrentView={setCurrentView}
              onDelete={handleDeletePost}
              marketplaceId={listingId}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Listing;
