import React from 'react';
import '../styles/Navbar.css';
import SearchBar from './SearchBar.jsx';
import NavLink from './NavLink.jsx';
import UserProfile from './UserProfile.jsx';

const Navbar = () => {
  return (
    <div className="navbar">
      {/* Logo */}
      <div className="logo">
        <h1>SocialApp</h1>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <SearchBar />
      </div>

      {/* Navigation Links */}
      <div className="nav-links">
        <NavLink icon="🏠" text="Home" />
        <NavLink icon="👥" text="Friends" />
        <NavLink icon="🔔" text="Notifications" />
      </div>

      {/* User Profile Dropdown */}
      <div className="user-profile">
        <UserProfile />
      </div>
    </div>
  );
};

export default Navbar;