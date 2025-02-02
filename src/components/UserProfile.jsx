import React, { useState } from 'react';

const UserProfile = ({updateLogged}) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className="user-profile">
      <div className="profile-pic" onClick={toggleDropdown}>
        <img src="https://via.placeholder.com/40" alt="Profile" />
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="dropdown-menu">
          <ul>
            <li>Profile</li>
            <li>Settings</li>
            <li onClick={() => {
              localStorage.removeItem('authToken');
              updateLogged(false);
              }}>Logout</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserProfile;