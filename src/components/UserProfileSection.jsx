import React from 'react';
const UserProfileSection = () => {
    return (
      <div className="user-profile-section">
        <img src="https://via.placeholder.com/80" alt="Profile" className="profile-pic" />
        <h3>John Doe</h3>
        <a href="/profile">View Profile</a>
      </div>
    );
  };
  
  export default UserProfileSection;