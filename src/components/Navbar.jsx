import React from 'react';
import '../styles/Navbar.css';
import SearchBar from './SearchBar.jsx';
import NavLink from './NavLink.jsx';
import UserProfile from './UserProfile.jsx';
import { FaHome, FaUserFriends, FaBell } from 'react-icons/fa';

const Navbar = ({ updateLogged }) => {
  return (
    <div className="navbar">
      <div className='left-container'>
        <div className="logo">
          <h1>SocialApp</h1>
        </div>
        <div className="search-bar-container">
          <SearchBar />
        </div>
      </div>

      <div className="right-container">
        <div className="nav-links">
          <NavLink icon={<FaHome />} text="Home" />
          <NavLink icon={<FaUserFriends />} text="Friends" />
          <NavLink icon={<FaBell />} text="Notifications" />
        </div>
        <div className="user-profile-container">
          <UserProfile updateLogged={updateLogged} />
        </div>
      </div>
    </div>
  );
};

export default Navbar;
