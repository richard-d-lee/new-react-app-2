import React, { useState, useRef, useEffect } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import '../styles/UserProfile.css';

const UserProfile = ({ updateLogged, setCurrentView }) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleProfileClick = () => {
    setCurrentView('profile');
    setDropdownOpen(false);
  };

  return (
    <div className="user-profile" ref={dropdownRef}>
      <div className="profile-trigger" onClick={toggleDropdown}>
        <div className="profile-dropdown">Profile</div>
        <FaChevronDown className={`dropdown-icon ${isDropdownOpen ? 'open' : ''}`} />
      </div>
      <div className={`dropdown-menu ${isDropdownOpen ? 'show' : ''}`}>
        <ul>
          <li onClick={handleProfileClick}>Profile</li>
          <li>Settings</li>
          <li onClick={() => {
              localStorage.removeItem('authToken');
              updateLogged(false);
            }}>
            Logout
          </li>
        </ul>
      </div>
    </div>
  );
};

export default UserProfile;
