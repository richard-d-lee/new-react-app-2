import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ProfilePic from './ProfilePic.jsx';
import '../styles/Marketplace.css';

const MARKETPLACE_LISTING_TYPE_ID = 1;

const Marketplace = ({ token, currentUserId, setCurrentView }) => {
  // Separate listings
  const [myListings, setMyListings] = useState([]);
  const [otherListings, setOtherListings] = useState([]);

  // Listing type dropdown state and ref
  const [marketplaceTypes, setMarketplaceTypes] = useState([]);
  const [listingTypeOpen, setListingTypeOpen] = useState(false);
  const [listingTypeRect, setListingTypeRect] = useState(null);
  const listingTypeToggleRef = useRef(null);

  // Create Listing Modal
  const [modalOpen, setModalOpen] = useState(false);

  // User filter state and refs (excluding current user)
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userFilterRef = useRef(null);
  const userDropdownToggleRef = useRef(null);

  // Basic filters
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    type: '',
    search: ''
  });

  // Collapsible filters
  const [filtersOpen, setFiltersOpen] = useState(true);
  const filterSectionRef = useRef(null);

  // New Listing state
  const [newListing, setNewListing] = useState({
    title: '',
    description: '',
    price: '',
    marketplace_listing_type_id: ''
  });
  const [newListingImages, setNewListingImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  // Refs for file input
  const fileInputRef = useRef(null);

  //------------------------------------------------------
  // 1) Fetch listing types, users (excluding current user),
  //    then fetch "my" and "other" listings.
  //------------------------------------------------------
  useEffect(() => {
    fetchMarketplaceTypes();

    axios
      .get('http://localhost:5000/marketplace/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        const fetchedUsers = res.data || [];
        // Exclude current user from dropdown
        const filteredUsers = fetchedUsers.filter((u) => u.user_id !== currentUserId);
        setAllUsers(filteredUsers);

        // Default selection = all other user IDs as strings
        const defaultSelected = filteredUsers.map((u) => String(u.user_id));
        setSelectedUsers(defaultSelected);

        fetchOtherListings(defaultSelected);
        fetchMyListings();
      })
      .catch((err) => {
        console.error('Error fetching marketplace users:', err);
        setOtherListings([]);
      });
  }, [token, currentUserId]);

  const fetchMarketplaceTypes = () => {
    axios
      .get('http://localhost:5000/marketplace/marketplace_listing_types', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => setMarketplaceTypes(res.data))
      .catch((err) => {
        console.error('Error fetching marketplace listing types:', err);
      });
  };

  const fetchMyListings = () => {
    axios
      .get('http://localhost:5000/marketplace', {
        headers: { Authorization: `Bearer ${token}` },
        params: { users: String(currentUserId) }
      })
      .then((res) => setMyListings(res.data))
      .catch((err) => console.error('Error fetching my listings:', err));
  };

  const fetchOtherListings = (usersArray) => {
    const { minPrice, maxPrice, type, search } = filters;
    const params = {};
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (type) params.type = type;
    if (search) params.search = search;

    if (!usersArray || usersArray.length === 0) {
      setOtherListings([]);
      return;
    }
    params.users = usersArray.join(',');

    axios
      .get('http://localhost:5000/marketplace', {
        headers: { Authorization: `Bearer ${token}` },
        params
      })
      .then((res) => setOtherListings(res.data))
      .catch((err) => console.error('Error fetching marketplace listings:', err));
  };

  useEffect(() => {
    if (allUsers.length === 0) return;
    fetchOtherListings(selectedUsers);
  }, [selectedUsers]);

  //------------------------------------------------------
  // 2) Filter Handlers
  //------------------------------------------------------
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Listing Type dropdown toggle
  const toggleListingType = (e) => {
    if (listingTypeOpen) {
      setListingTypeOpen(false);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setListingTypeRect(rect);
      setListingTypeOpen(true);
    }
  };

  const handleListingTypeSelect = (val) => {
    setFilters((prev) => ({ ...prev, type: val }));
    setListingTypeOpen(false);
  };

  // User Filter dropdown toggle
  const toggleUserDropdown = (e) => {
    if (userDropdownOpen) {
      setUserDropdownOpen(false);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setUserDropdownOpen(true);
      // Store toggle rect if needed
    }
  };

  const handleUserSearchChange = (e) => setUserSearch(e.target.value);

  const handleToggleUser = (userId) => {
    const strId = String(userId);
    setSelectedUsers((prev) =>
      prev.includes(strId) ? prev.filter((id) => id !== strId) : [...prev, strId]
    );
  };

  const filteredUsers = allUsers.filter((u) =>
    u.username.toLowerCase().includes(userSearch.toLowerCase())
  );
  const selectedCount = allUsers.filter((u) =>
    selectedUsers.includes(String(u.user_id))
  ).length;

  const applyFilters = () => {
    fetchMyListings();
    fetchOtherListings(selectedUsers);
  };

  const toggleFiltersOpen = () => {
    setFiltersOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!filtersOpen) {
      setUserDropdownOpen(false);
      setListingTypeOpen(false);
    }
  }, [filtersOpen]);

  // Close dropdowns if clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        userDropdownOpen &&
        userDropdownToggleRef.current &&
        !userDropdownToggleRef.current.contains(event.target)
      ) {
        setUserDropdownOpen(false);
      }
      if (
        listingTypeOpen &&
        listingTypeToggleRef.current &&
        !listingTypeToggleRef.current.contains(event.target)
      ) {
        setListingTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () =>
      document.removeEventListener('mousedown', handleClickOutside);
  }, [userDropdownOpen, listingTypeOpen]);

  //------------------------------------------------------
  // 3) Creating a New Listing
  //------------------------------------------------------
  const openModal = () => setModalOpen(true);
  const closeModal = () => {
    setModalOpen(false);
    setNewListing({
      title: '',
      description: '',
      price: '',
      marketplace_listing_type_id: ''
    });
    setNewListingImages([]);
    setImagePreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleNewListingChange = (e) => {
    const { name, value } = e.target;
    setNewListing((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 5);
    setNewListingImages(files);
    const previews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const handleRemoveImage = (index) => {
    const updatedFiles = newListingImages.filter((_, i) => i !== index);
    const updatedPreviews = imagePreviews.filter((_, i) => i !== index);
    setNewListingImages(updatedFiles);
    setImagePreviews(updatedPreviews);
    const dataTransfer = new DataTransfer();
    updatedFiles.forEach((file) => dataTransfer.items.add(file));
    if (fileInputRef.current) {
      fileInputRef.current.files = dataTransfer.files;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...newListing,
      listing_type_id: MARKETPLACE_LISTING_TYPE_ID
    };
    try {
      const res = await axios.post('http://localhost:5000/marketplace', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newListingId = res.data.listing_id;
      if (newListingImages.length > 0) {
        const formData = new FormData();
        newListingImages.forEach((file) => formData.append('images', file));
        await axios.post(
          `http://localhost:5000/marketplace/${newListingId}/upload-images`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      }
      closeModal();
      fetchMyListings();
      fetchOtherListings(selectedUsers);
    } catch (err) {
      console.error('Error creating listing:', err);
    }
  };

  //------------------------------------------------------
  // 4) Navigation
  //------------------------------------------------------
  const handleListingClick = (listingId) => {
    setCurrentView({ view: 'listing', listingId });
  };

  const handlePosterClick = (e, userId) => {
    e.stopPropagation();
    setCurrentView({ view: 'profile', userId });
  };

  //------------------------------------------------------
  // Render
  //------------------------------------------------------
  return (
    <div className="marketplace-page">
      <div className="marketplace-header">
        <h2>Marketplace</h2>
        <button className="create-listing-btn" onClick={openModal}>
          Create Listing
        </button>
      </div>

      {/* Collapsible Filter Section */}
      <div className="filter-section" ref={filterSectionRef}>
        <div className="filter-section-header">
          <h4>Filters</h4>
          <button className="collapse-filters-btn" onClick={toggleFiltersOpen}>
            {filtersOpen ? '▲' : '▼'}
          </button>
        </div>
        <div className={`filter-section-content ${filtersOpen ? '' : 'collapsed'}`}>
          <div className="filters-row">
            {/* Min Price */}
            <div className="filter-group">
              <label>Min Price</label>
              <input
                type="number"
                name="minPrice"
                value={filters.minPrice}
                onChange={handleFilterChange}
                placeholder="0"
              />
            </div>
            {/* Max Price */}
            <div className="filter-group">
              <label>Max Price</label>
              <input
                type="number"
                name="maxPrice"
                value={filters.maxPrice}
                onChange={handleFilterChange}
                placeholder="999999.99"
              />
            </div>
            {/* Listing Type Toggle */}
            <div className="filter-group listing-type-section">
              <label>Listing Type</label>
              <div
                className="listing-type-toggle"
                onClick={toggleListingType}
                ref={listingTypeToggleRef}
              >
                {filters.type
                  ? marketplaceTypes.find((t) => String(t.id) === String(filters.type))?.name || 'All'
                  : 'All'}
                <span>{listingTypeOpen ? '▲' : '▼'}</span>
              </div>
            </div>
            {/* Search */}
            <div className="filter-group search-group">
              <label>Search Title/Desc</label>
              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Title or description..."
              />
            </div>
          </div>
          {/* User Filter Toggle */}
          <div className="user-filter-section" ref={userFilterRef}>
            <label>Filter by Users:</label>
            <div
              className="user-filter-toggle"
              onClick={toggleUserDropdown}
              ref={userDropdownToggleRef}
            >
              {selectedCount === allUsers.length ? 'All Users' : `${selectedCount} selected`}
              <span>{userDropdownOpen ? '▲' : '▼'}</span>
            </div>
          </div>
          <button className="apply-filters-btn" onClick={applyFilters}>
            Apply Filters
          </button>
        </div>

        {/* Listing Type Dropdown Portal */}
        {listingTypeOpen && listingTypeRect && (
          <div
            className="listing-type-dropdown-portal"
            style={{
              position: 'absolute',
              top:
                listingTypeRect.bottom -
                filterSectionRef.current.getBoundingClientRect().top +
                5,
              left:
                listingTypeRect.left -
                filterSectionRef.current.getBoundingClientRect().left,
              width: 200,
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              padding: 10,
              zIndex: 9999
            }}
          >
            <div className="type-item" onClick={() => handleListingTypeSelect('')}>
              All
            </div>
            {marketplaceTypes.map((t) => (
              <div
                key={t.id}
                className="type-item"
                onClick={() => handleListingTypeSelect(t.id)}
              >
                {t.name}
              </div>
            ))}
          </div>
        )}

        {/* User Dropdown Portal */}
        {userDropdownOpen && userDropdownToggleRef.current && (
          <div
            className="user-dropdown-portal"
            style={{
              position: 'absolute',
              top:
                userDropdownToggleRef.current.getBoundingClientRect().bottom -
                filterSectionRef.current.getBoundingClientRect().top +
                5,
              left:
                userDropdownToggleRef.current.getBoundingClientRect().left -
                filterSectionRef.current.getBoundingClientRect().left,
              width: 200,
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              padding: 10,
              zIndex: 9999
            }}
          >
            <div className="dropdown-search">
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={handleUserSearchChange}
                style={{
                  width: '90%',
                  padding: 6,
                  border: '1px solid #ccc',
                  borderRadius: 10
                }}
              />
            </div>
            <div className="checkbox-list">
              {filteredUsers.length === 0 ? (
                <p style={{ fontStyle: 'italic', color: '#666' }}>No users found</p>
              ) : (
                filteredUsers.map((u) => (
                  <label key={u.user_id} className="user-item">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(String(u.user_id))}
                      onChange={() => handleToggleUser(u.user_id)}
                    />
                    {u.username}
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Community Listings */}
      <div className="other-listings-section">
        <h3>Community Listings</h3>
        <div className="marketplace-listings">
          {otherListings.length ? (
            otherListings.map((listing) => {
              const finalProfilePic = listing.poster_profile_pic
                ? `http://localhost:5000${listing.poster_profile_pic}`
                : 'https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg';
              const images = listing.images || [];
              const additionalCount = images.length > 1 ? images.length - 1 : 0;
              return (
                <div
                  key={listing.id}
                  className="marketplace-listing-card"
                  onClick={() => handleListingClick(listing.id)}
                >
                  <div className="listing-card-title">
                    <h3>{listing.title}</h3>
                  </div>
                  <div className="listing-card-main">
                    <div className="listing-card-left">
                      {listing.marketplace_listing_type_name && (
                        <p className="listing-category">
                          {listing.marketplace_listing_type_name}
                        </p>
                      )}
                      <p className="price">${listing.price}</p>
                      <p className="description">{listing.description}</p>
                    </div>
                    {images.length > 0 && (
                      <div className="listing-card-right">
                        <div className="listing-image-wrapper">
                          <img src={`http://localhost:5000${images[0]}`} alt="Listing" />
                          {additionalCount > 0 && (
                            <div className="additional-count">+{additionalCount}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="listing-card-footer">
                    {listing.created_at && (
                      <p className="listing-date">
                        {new Date(listing.created_at).toLocaleString()}
                      </p>
                    )}
                    <div
                      className="listing-author-info"
                      onClick={(e) => handlePosterClick(e, listing.user_id)}
                    >
                      <ProfilePic imageUrl={finalProfilePic} alt={listing.poster_username || 'User'} size={35} />
                      <span className="listing-author-name">
                        {listing.poster_username || 'User'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p>No listings available.</p>
          )}
        </div>
      </div>

      {/* My Listings */}
      <div className="my-listings-section">
        <h3>My Listings</h3>
        <div className="marketplace-listings">
          {myListings.length ? (
            myListings.map((listing) => {
              const finalProfilePic = listing.poster_profile_pic
                ? `http://localhost:5000${listing.poster_profile_pic}`
                : 'https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg';
              const images = listing.images || [];
              const additionalCount = images.length > 1 ? images.length - 1 : 0;
              return (
                <div
                  key={listing.id}
                  className="marketplace-listing-card"
                  onClick={() => handleListingClick(listing.id)}
                >
                  <div className="listing-card-title">
                    <h3>{listing.title}</h3>
                  </div>
                  <div className="listing-card-main">
                    <div className="listing-card-left">
                      {listing.marketplace_listing_type_name && (
                        <p className="listing-category">
                          {listing.marketplace_listing_type_name}
                        </p>
                      )}
                      <p className="price">${listing.price}</p>
                      <p className="description">{listing.description}</p>
                    </div>
                    {images.length > 0 && (
                      <div className="listing-card-right">
                        <div className="listing-image-wrapper">
                          <img src={`http://localhost:5000${images[0]}`} alt="Listing" />
                          {additionalCount > 0 && (
                            <div className="additional-count">+{additionalCount}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="listing-card-footer">
                    {listing.created_at && (
                      <p className="listing-date">
                        {new Date(listing.created_at).toLocaleString()}
                      </p>
                    )}
                    <div
                      className="listing-author-info"
                      onClick={(e) => handlePosterClick(e, listing.user_id)}
                    >
                      <ProfilePic imageUrl={finalProfilePic} alt={listing.poster_username || 'User'} size={35} />
                      <span className="listing-author-name">
                        {listing.poster_username || 'User'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p>No listings found.</p>
          )}
        </div>
      </div>

      {/* Create Listing Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Create a New Listing</h2>
            <form onSubmit={handleSubmit} className="listing-form">
              <label>Title:</label>
              <input
                type="text"
                name="title"
                value={newListing.title}
                onChange={handleNewListingChange}
                required
              />
              <label>Description:</label>
              <textarea
                name="description"
                value={newListing.description}
                onChange={handleNewListingChange}
              />
              <label>Price:</label>
              <input
                type="number"
                name="price"
                value={newListing.price}
                onChange={handleNewListingChange}
                min="0"
                max="999999.99"
                step="0.1"
                required
              />
              <label>Marketplace Listing Type:</label>
              <select
                name="marketplace_listing_type_id"
                value={newListing.marketplace_listing_type_id}
                onChange={handleNewListingChange}
                required
              >
                <option value="">Select a category</option>
                {marketplaceTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <label>Upload Images (up to 5):</label>
              <input
                type="file"
                name="images"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                ref={fileInputRef}
              />
              {imagePreviews.length > 0 && (
                <div className="image-previews">
                  {imagePreviews.map((src, idx) => (
                    <div key={idx} className="image-preview">
                      <img src={src} alt={`Preview ${idx + 1}`} />
                      <button type="button" onClick={() => handleRemoveImage(idx)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="modal-buttons">
                <button type="submit">Create Listing</button>
                <button type="button" onClick={closeModal}>
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

export default Marketplace;
