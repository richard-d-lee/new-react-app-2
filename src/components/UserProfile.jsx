import React, { useState, useRef, useEffect } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import '../styles/UserProfile.css';

const UserProfile = ({ updateLogged, setCurrentView, profilePic }) => {
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

  const handleSettingsClick = () => {
    setCurrentView('settings');
    setDropdownOpen(false);
  };

  // Default image URL if no profilePic is available
  const defaultPic = "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg";
  
  return (
    <div className="user-profile" ref={dropdownRef}>
      <div className="profile-trigger" onClick={toggleDropdown}>
        <img 
          src={ profilePic ? `http://localhost:5000${profilePic}` : defaultPic } 
          className="dropdown-profile-pic" 
          alt="User Profile" 
        />
        <FaChevronDown className={`dropdown-icon ${isDropdownOpen ? 'open' : ''}`} />
      </div>
      <div className={`dropdown-menu ${isDropdownOpen ? 'show' : ''}`}>
        <ul>
          <li onClick={handleProfileClick}>Profile</li>
          <li onClick={handleSettingsClick}>Settings</li>
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
