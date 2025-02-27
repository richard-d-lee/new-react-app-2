import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ProfilePic from './ProfilePic.jsx';
import '../styles/Marketplace.css';

const MARKETPLACE_LISTING_TYPE_ID = 1; // ID for "Marketplace" in listing_types

const Marketplace = ({ token, currentUserId, setCurrentView }) => {
  const [listings, setListings] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  // For listing type dropdown
  const [marketplaceTypes, setMarketplaceTypes] = useState([]);

  // For user filter
  const [allUsers, setAllUsers] = useState([]); // array of { user_id, username, ... }
  const [selectedUsers, setSelectedUsers] = useState([]); // array of selected user IDs
  const [userSearch, setUserSearch] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Basic filters
  const [filters, setFilters] = useState({
    minPrice: '',
    maxPrice: '',
    type: '',
    search: ''
  });

  // Collapsible filter section
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Fields for creating a new listing
  const [newListing, setNewListing] = useState({
    title: '',
    description: '',
    price: '',
    marketplace_listing_type_id: ''
  });

  // Reference to the user filter section (to detect outside clicks)
  const userFilterRef = useRef(null);

  /**
   * 1) Fetch listing types, users, and listings.
   *    - We chain these calls so that we only fetch listings
   *      after we have the default selectedUsers set.
   */
  useEffect(() => {
    fetchMarketplaceTypes();

    // Fetch users, then set them as selected by default, then fetch listings
    axios
      .get('http://localhost:5000/marketplace/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        setAllUsers(res.data || []);
        // If we got some users, select them all by default
        if (res.data && res.data.length > 0) {
          const defaultSelected = res.data.map((u) => u.user_id);
          setSelectedUsers(defaultSelected);
          // Now fetch listings using these selected users
          fetchListings(defaultSelected);
        } else {
          // No users => no listings
          setListings([]);
        }
      })
      .catch((err) => {
        console.error('Error fetching marketplace users:', err);
        setListings([]); // fallback
      });
  }, [token]);

  // 2) Fetch listing types
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

  /**
   * 3) Actually fetch listings, optionally with an array of user IDs
   *    (to handle the default scenario).
   */
  const fetchListings = (usersArray) => {
    const { minPrice, maxPrice, type, search } = filters;
    const params = {};

    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (type) params.type = type;
    if (search) params.search = search;

    // If usersArray is given (initial load), use that. Otherwise use selectedUsers.
    const effectiveUsers = usersArray || selectedUsers;

    if (effectiveUsers.length === 0) {
      setListings([]);
      return;
    }
    params.users = effectiveUsers.join(',');

    axios
      .get('http://localhost:5000/marketplace', {
        headers: { Authorization: `Bearer ${token}` },
        params
      })
      .then((res) => {
        setListings(res.data);
      })
      .catch((err) => {
        console.error('Error fetching marketplace listings:', err);
      });
  };

  /**
   * 4) If selectedUsers changes (due to user toggles), refetch listings
   *    so that the page updates immediately.
   */
  useEffect(() => {
    // If we haven't fetched users yet, do nothing.
    if (allUsers.length === 0) return;
    fetchListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUsers]);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        userDropdownOpen &&
        userFilterRef.current &&
        !userFilterRef.current.contains(event.target)
      ) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userDropdownOpen]);

  // ---------------------------
  // Filter Handlers
  // ---------------------------
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    fetchListings();
  };

  // Toggle the entire filter section
  const toggleFiltersOpen = () => {
    setFiltersOpen((prev) => !prev);
  };

  // Toggle user dropdown
  const toggleUserDropdown = () => {
    setUserDropdownOpen((prev) => !prev);
  };

  // Search within user dropdown
  const handleUserSearchChange = (e) => {
    setUserSearch(e.target.value);
  };

  // Toggle a user's selection
  const handleToggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Filter displayed users based on search text
  const filteredUsers = allUsers.filter((u) =>
    u.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  // ---------------------------
  // Creating a New Listing
  // ---------------------------
  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  const handleNewListingChange = (e) => {
    const { name, value } = e.target;
    setNewListing((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...newListing,
      listing_type_id: MARKETPLACE_LISTING_TYPE_ID
    };

    axios
      .post('http://localhost:5000/marketplace', payload, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(() => {
        closeModal();
        fetchListings();
        setNewListing({
          title: '',
          description: '',
          price: '',
          marketplace_listing_type_id: ''
        });
      })
      .catch((err) => {
        console.error('Error creating listing:', err);
      });
  };

  // ---------------------------
  // Navigation
  // ---------------------------
  const handleListingClick = (listingId) => {
    setCurrentView({ view: 'listing', listingId });
  };

  const handlePosterClick = (e, userId) => {
    e.stopPropagation();
    setCurrentView({ view: 'profile', userId });
  };

  // ---------------------------
  // RENDER
  // ---------------------------
  return (
    <div className="marketplace-page">
      <div className="marketplace-header">
        <h2>Marketplace</h2>
        <button className="create-listing-btn" onClick={openModal}>
          Create Listing
        </button>
      </div>

      {/* Collapsible Filter Section */}
      <div className="filter-section">
        {/* Filter Section Header */}
        <div className="filter-section-header">
          <h4>Filters</h4>
          <button className="collapse-filters-btn" onClick={toggleFiltersOpen}>
            {filtersOpen ? '▲' : '▼'}
          </button>
        </div>

        {/* Animated Content */}
        <div className={`filter-section-content ${filtersOpen ? '' : 'collapsed'}`}>
          <div className="filters-row">
            {/* Price Range */}
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
            <div className="filter-group">
              <label>Max Price</label>
              <input
                type="number"
                name="maxPrice"
                value={filters.maxPrice}
                onChange={handleFilterChange}
                placeholder="9999"
              />
            </div>

            {/* Listing Type */}
            <div className="filter-group">
              <label>Listing Type</label>
              <select name="type" value={filters.type} onChange={handleFilterChange}>
                <option value="">All</option>
                {marketplaceTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Title/Desc */}
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

          {/* User Filter Dropdown */}
          <div className="user-filter-section" ref={userFilterRef}>
            <label>Filter by Users:</label>
            <div className="user-filter-toggle" onClick={toggleUserDropdown}>
              {selectedUsers.length === allUsers.length
                ? 'All Users'
                : `${selectedUsers.length} selected`}
              <span>{userDropdownOpen ? '▲' : '▼'}</span>
            </div>
            {userDropdownOpen && (
              <div className="user-dropdown">
                <div className="dropdown-search">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={handleUserSearchChange}
                  />
                </div>
                <div className="checkbox-list">
                  {filteredUsers.length === 0 ? (
                    <p style={{ fontStyle: 'italic', color: '#666' }}>
                      No users found
                    </p>
                  ) : (
                    filteredUsers.map((u) => (
                      <label key={u.user_id} className="user-item">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(u.user_id)}
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

          <button className="apply-filters-btn" onClick={applyFilters}>
            Apply Filters
          </button>
        </div>
      </div>

      {/* Listings Grid */}
      <div className="marketplace-listings">
        {listings.length ? (
          listings.map((listing) => {
            const finalProfilePic = listing.poster_profile_pic
              ? `http://localhost:5000${listing.poster_profile_pic}`
              : 'https://via.placeholder.com/40';

            return (
              <div
                key={listing.id}
                className="marketplace-listing-card"
                onClick={() => handleListingClick(listing.id)}
              >
                <h3>{listing.title}</h3>
                {listing.marketplace_listing_type_name && (
                  <p className="listing-category">
                    {listing.marketplace_listing_type_name}
                  </p>
                )}
                <p className="price">${listing.price}</p>
                <p className="description">{listing.description}</p>
                {listing.created_at && (
                  <p className="listing-date">
                    {new Date(listing.created_at).toLocaleString()}
                  </p>
                )}
                <div
                  className="listing-author-info"
                  onClick={(e) => handlePosterClick(e, listing.user_id)}
                >
                  <ProfilePic
                    imageUrl={finalProfilePic}
                    alt={listing.poster_username || 'User'}
                    size={35}
                  />
                  <span className="listing-author-name">
                    {listing.poster_username || 'User'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <p>No listings available.</p>
        )}
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
