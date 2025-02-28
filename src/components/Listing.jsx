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

  // State for owner dropdown and edit modal
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Fields for editing listing
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editMarketplaceType, setEditMarketplaceType] = useState('');
  const [editImageFile, setEditImageFile] = useState(null);
  const [marketplaceTypes, setMarketplaceTypes] = useState([]);

  // Fetch listing details
  useEffect(() => {
    axios
      .get(`${baseURL}/marketplace/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        setListing(res.data);
      })
      .catch((err) => {
        console.error('Error fetching listing details:', err);
      });
  }, [listingId, token]);

  // Fetch posts for this listing
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

  useEffect(() => {
    if (postRef.current) {
      postRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [posts]);

  const handleNewPost = (newPostObj) => {
    setPosts((prev) => [newPostObj, ...prev]);
  };

  const handleDeletePost = (delPostId) => {
    setPosts((prev) => prev.filter((p) => p.post_id !== delPostId));
  };

  const handleBack = () => {
    setCurrentView('marketplace');
  };

  const handlePosterClick = (userId) => {
    setCurrentView({ view: 'profile', userId });
  };

  // Toggle the dropdown menu (with debug logging)
  const toggleMenu = () => {
    setShowMenu((prev) => {
      const newVal = !prev;
      console.log('Toggling owner menu, new value:', newVal);
      return newVal;
    });
  };

  const openEditModal = () => {
    setShowMenu(false);
    if (listing) {
      setEditTitle(listing.title || '');
      setEditDescription(listing.description || '');
      setEditPrice(listing.price || '');
      setEditMarketplaceType(listing.marketplace_listing_type_id || '');
      setEditImageFile(null);
    }
    fetchMarketplaceTypes();
    setShowEditModal(true);
  };

  const closeEditModal = () => setShowEditModal(false);

  const fetchMarketplaceTypes = () => {
    axios
      .get(`${baseURL}/marketplace/marketplace_listing_types`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => setMarketplaceTypes(res.data))
      .catch((err) => {
        console.error('Error fetching marketplace listing types:', err);
      });
  };

  const handleDeleteListing = async () => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    try {
      await axios.delete(`${baseURL}/marketplace/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentView('marketplace');
    } catch (err) {
      console.error('Error deleting listing:', err);
      alert(err.response?.data?.error || 'Error deleting listing');
    }
  };

  const handleEditImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setEditImageFile(e.target.files[0]);
    }
  };

  const handleUpdateListing = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: editTitle,
        description: editDescription,
        price: editPrice,
        marketplace_listing_type_id: editMarketplaceType
      };
      await axios.patch(`${baseURL}/marketplace/${listingId}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (editImageFile) {
        const formData = new FormData();
        formData.append('image', editImageFile);
        await axios.post(`${baseURL}/marketplace/${listingId}/upload-image`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }
      // Refresh listing data after update.
      const res = await axios.get(`${baseURL}/marketplace/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setListing(res.data);
      closeEditModal();
    } catch (err) {
      console.error('Error updating listing:', err);
      alert(err.response?.data?.error || 'Error updating listing');
    }
  };

  if (!listing) return <p>Loading listing...</p>;

  const finalProfilePic = listing.poster_profile_pic
    ? `${baseURL}${listing.poster_profile_pic}`
    : 'https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg';

  const posterName = listing.poster_username || 'User';
  const isOwner = listing.user_id === currentUserId;

  return (
    <div className="listing-page">
      <button className="back-btn" onClick={handleBack}>
        ← Back
      </button>

      <div className="listing-details">
        {/* Listing header: title on left; if owner, three-dot menu on right */}
        <div className="listing-header">
          <h2>{listing.title}</h2>
          {isOwner && (
            <div className="owner-dropdown-container">
              <button className="owner-dropdown" onClick={toggleMenu}>
                &#x22EE;
              </button>
              {showMenu && (
                <div className="listing-dropdown-menu">
                  <button onClick={openEditModal}>Edit Listing</button>
                  <button onClick={handleDeleteListing}>Delete Listing</button>
                </div>
              )}
            </div>
          )}
        </div>

        {listing.marketplace_listing_type_name && (
          <p className="listing-category">{listing.marketplace_listing_type_name}</p>
        )}
        <p className="price">${listing.price}</p>
        <p className="description">{listing.description}</p>
        {listing.image_url && (
          <img src={listing.image_url} alt={listing.title} className="listing-image" />
        )}

        {/* Poster row: profile pic left, username to right */}
        <div className="listing-author" onClick={() => handlePosterClick(listing.user_id)}>
          <ProfilePic imageUrl={finalProfilePic} alt={posterName} size={35} />
          <span className="listing-author-name">{posterName}</span>
        </div>
      </div>

      <div className="listing-posts">
        <h3>Posts for this listing</h3>
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

      {/* Edit Listing Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Edit Listing</h2>
            <form onSubmit={handleUpdateListing} className="listing-form">
              <label>Title:</label>
              <input
                type="text"
                name="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />

              <label>Description:</label>
              <textarea
                name="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />

              <label>Price:</label>
              <input
                type="number"
                name="price"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                required
              />

              <label>Marketplace Listing Type:</label>
              <select
                name="marketplace_listing_type_id"
                value={editMarketplaceType}
                onChange={(e) => setEditMarketplaceType(e.target.value)}
                required
              >
                <option value="">Select a category</option>
                {marketplaceTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>

              <label>Image (optional):</label>
              <input type="file" onChange={handleEditImageChange} />

              <div className="modal-buttons">
                <button type="submit">Save Changes</button>
                <button type="button" onClick={closeEditModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Listing;
