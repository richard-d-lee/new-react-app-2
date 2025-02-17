import React from 'react';

const UserProfileSection = ({ setCurrentView }) => {
  return (
    <div className="user-profile-section">
      <h3>John Doe</h3>
      <a href="#" onClick={(e) => { e.preventDefault(); setCurrentView('profile'); }}>
        View Profile
      </a>
    </div>
  );
};

export default UserProfileSection;
