import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import CreatePost from './CreatePost.jsx';
import Post from './Post.jsx';
import ProfilePic from './ProfilePic.jsx';
import { FaTimes } from 'react-icons/fa'; // for the close "X" icon
import '../styles/listing.css';

const Listing = ({ token, listingId, setCurrentView, currentUserId, currentUserProfilePic }) => {
  const [listing, setListing] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const postRef = useRef(null);
  const baseURL = 'http://localhost:5000';

  // Owner dropdown & edit modal
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // For detecting clicks outside the menu
  const menuRef = useRef(null);

  // Fields for editing listing text
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editMarketplaceType, setEditMarketplaceType] = useState('');

  // Existing images on the listing
  const [existingImages, setExistingImages] = useState([]);
  // A list of existing images that the user wants to remove
  const [removedImages, setRemovedImages] = useState([]);

  // For uploading additional images (up to 5)
  const [editListingImages, setEditListingImages] = useState([]);
  const [editImagePreviews, setEditImagePreviews] = useState([]);
  const fileInputRef = useRef(null);

  // For listing types
  const [marketplaceTypes, setMarketplaceTypes] = useState([]);

  // Full image preview modal
  const [previewSrc, setPreviewSrc] = useState(null);

  //------------------------------------------------------
  // 1) Fetch listing details
  //------------------------------------------------------
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

  //------------------------------------------------------
  // 2) Fetch posts for this listing
  //------------------------------------------------------
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, token]);

  // Scroll to newly created post
  useEffect(() => {
    if (postRef.current) {
      postRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [posts]);

  // Create new post callback
  const handleNewPost = (newPostObj) => {
    setPosts((prev) => [newPostObj, ...prev]);
  };

  // Delete post callback
  const handleDeletePost = (delPostId) => {
    setPosts((prev) => prev.filter((p) => p.post_id !== delPostId));
  };

  // Navigate back
  const handleBack = () => {
    setCurrentView('marketplace');
  };

  // Navigate to poster's profile
  const handlePosterClick = (userId) => {
    setCurrentView({ view: 'profile', userId });
  };

  // Toggle the owner dropdown menu
  const toggleMenu = () => {
    setShowMenu((prev) => !prev);
  };

  //------------------------------------------------------
  // 3) Open Edit Modal
  //------------------------------------------------------
  const openEditModal = () => {
    setShowMenu(false);
    if (listing) {
      setEditTitle(listing.title || '');
      setEditDescription(listing.description || '');
      setEditPrice(listing.price || '');
      setEditMarketplaceType(listing.marketplace_listing_type_id || '');

      // existingImages = what's on the server
      setExistingImages(listing.images || []);
      setRemovedImages([]);

      // Clear any newly selected images
      setEditListingImages([]);
      setEditImagePreviews([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    fetchMarketplaceTypes();
    setShowEditModal(true);
  };

  const closeEditModal = () => setShowEditModal(false);

  // Fetch listing types for the edit modal
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

  // Delete the entire listing
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

  //------------------------------------------------------
  // 4) Editing images
  //------------------------------------------------------
  const handleRemoveExistingImage = (imgPath) => {
    setExistingImages((prev) => prev.filter((p) => p !== imgPath));
    setRemovedImages((prev) => [...prev, imgPath]);
  };

  const handleRemoveEditImage = (index) => {
    const updatedFiles = editListingImages.filter((_, i) => i !== index);
    const updatedPreviews = editImagePreviews.filter((_, i) => i !== index);
    setEditListingImages(updatedFiles);
    setEditImagePreviews(updatedPreviews);

    // Rebuild file input
    const dataTransfer = new DataTransfer();
    updatedFiles.forEach((file) => dataTransfer.items.add(file));
    if (fileInputRef.current) {
      fileInputRef.current.files = dataTransfer.files;
    }
  };

  const handleEditImagesChange = (e) => {
    const remainingSlots = 5 - existingImages.length;
    if (remainingSlots <= 0) {
      return;
    }

    // Slice the user’s chosen files
    const rawFiles = Array.from(e.target.files);
    const files = rawFiles.slice(0, remainingSlots);

    // Rebuild the file input’s FileList so it only has the files we allow
    const dataTransfer = new DataTransfer();
    for (const f of files) {
      dataTransfer.items.add(f);
    }
    e.target.files = dataTransfer.files;

    setEditListingImages(files);

    const previews = files.map((file) => URL.createObjectURL(file));
    setEditImagePreviews(previews);
  };

  //------------------------------------------------------
  // 5) Submit Edit (Update Listing)
  //------------------------------------------------------
  const handleUpdateListing = async (e) => {
    e.preventDefault();
    try {
      // 1) Update text fields
      const payload = {
        title: editTitle,
        description: editDescription,
        price: editPrice,
        marketplace_listing_type_id: editMarketplaceType
      };
      await axios.patch(`${baseURL}/marketplace/${listingId}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // 2) Upload newly added images
      if (editListingImages.length > 0) {
        const formData = new FormData();
        editListingImages.forEach((file) => {
          formData.append('images', file);
        });
        await axios.post(
          `${baseURL}/marketplace/${listingId}/upload-images`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      }

      // 3) Remove any images the user deleted
      for (const imgPath of removedImages) {
        try {
          await axios.delete(`${baseURL}/marketplace/${listingId}/remove-image`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { imgPath }
          });
        } catch (err) {
          console.error('Error removing image:', imgPath, err);
        }
      }

      // 4) Refresh listing data
      const res = await axios.get(`${baseURL}/marketplace/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Force user_id to be present if missing
      const freshListing = res.data;
      if (!freshListing.user_id) {
        freshListing.user_id = currentUserId;
      }
      setListing(freshListing);

      // Close modal
      closeEditModal();
    } catch (err) {
      console.error('Error updating listing:', err);
      alert(err.response?.data?.error || 'Error updating listing');
    }
  };

  //------------------------------------------------------
  // 6) Full-image preview
  //------------------------------------------------------
  const openPreviewModal = (imgPath) => {
    setPreviewSrc(imgPath);
  };
  const closePreviewModal = () => {
    setPreviewSrc(null);
  };

  //------------------------------------------------------
  // 7) Close menu if user clicks outside
  //------------------------------------------------------
  useEffect(() => {
    function handleClickOutside(e) {
      if (showMenu && menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  //------------------------------------------------------
  // 8) Render
  //------------------------------------------------------
  if (!listing) return <p>Loading listing...</p>;

  const isOwner = parseInt(listing.user_id, 10) === parseInt(currentUserId, 10);

  const finalProfilePic = listing.poster_profile_pic
    ? `${baseURL}${listing.poster_profile_pic}`
    : 'https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg';

  const posterName = listing.poster_username || 'User';
  const images = listing.images || [];

  return (
    <div className="listing-page">
      <button className="back-btn" onClick={handleBack}>
        ← Back
      </button>

      <div className="listing-details">
        {isOwner && (
          <div className="owner-dropdown-container" ref={menuRef}>
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

        <div className="listing-details-top">
          <div className="listing-details-left">
            <h2>{listing.title}</h2>
            {listing.marketplace_listing_type_name && (
              <p className="listing-category">{listing.marketplace_listing_type_name}</p>
            )}
            <p className="price">${listing.price}</p>
            <p className="description">{listing.description}</p>
            <div className="listing-author" onClick={() => handlePosterClick(listing.user_id)}>
              <ProfilePic imageUrl={finalProfilePic} alt={posterName} size={35} />
              <span className="listing-author-name">{posterName}</span>
            </div>
          </div>

          <div className="listing-details-right">
            {images.length > 0 && (
              <div className="listing-images-wrapper">
                {images.map((imgPath, idx) => (
                  <div
                    className="image-thumbnail"
                    key={idx}
                    onClick={() => openPreviewModal(`${baseURL}${imgPath}`)}
                  >
                    <img src={`${baseURL}${imgPath}`} alt="Listing" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {previewSrc && (
        <div className="preview-overlay" onClick={closePreviewModal}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <img src={previewSrc} alt="Full View" />
            <button className="close-preview-btn" onClick={closePreviewModal}>
              &times;
            </button>
          </div>
        </div>
      )}

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
            {/* Close modal button with "X" icon in top-right */}
            <button className="close-modal" onClick={closeEditModal}>
              <FaTimes />
            </button>

            <h2>Edit Listing</h2>
            <form onSubmit={handleUpdateListing} className="listing-form">
              <div className="form-group">
                <label htmlFor="editTitle">Title</label>
                <input
                  id="editTitle"
                  type="text"
                  className="form-control"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="editDescription">Description</label>
                <textarea
                  id="editDescription"
                  className="form-control"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="editPrice">Price</label>
                <input
                  id="editPrice"
                  type="number"
                  className="form-control"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="editMarketplaceType">Category</label>
                <select
                  id="editMarketplaceType"
                  className="form-control"
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
              </div>

              {/* Existing images */}
              {existingImages.length > 0 && (
                <div className="existing-images">
                  <h4>Current Images</h4>
                  <div className="image-previews">
                    {existingImages.map((imgPath, idx) => (
                      <div key={idx} className="image-preview">
                        <img src={`${baseURL}${imgPath}`} alt={`Existing ${idx + 1}`} />
                        <button type="button" onClick={() => handleRemoveExistingImage(imgPath)}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New images */}
              {5 - existingImages.length > 0 && (
                <>
                  <div className="form-group">
                    <label htmlFor="newImages">
                      Upload Additional Images (up to {5 - existingImages.length})
                    </label>
                    <input
                      id="newImages"
                      type="file"
                      name="images"
                      multiple
                      accept="image/*"
                      onChange={handleEditImagesChange}
                      ref={fileInputRef}
                    />
                  </div>
                  {editImagePreviews.length > 0 && (
                    <div className="image-previews">
                      {editImagePreviews.map((src, idx) => (
                        <div key={idx} className="image-preview">
                          <img src={src} alt={`Preview ${idx + 1}`} />
                          <button type="button" onClick={() => handleRemoveEditImage(idx)}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="modal-buttons">
                <button type="submit" className="save-btn">
                  Save
                </button>
                <button type="button" className="cancel-btn" onClick={closeEditModal}>
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
