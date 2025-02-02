import React from 'react';
import '../styles/Sidebar.css'; // Import the CSS file
import UserProfileSection from './UserProfileSection.jsx';
import Shortcut from './Shortcut.jsx';
import Group from './Group.jsx';

const Sidebar = () => {
  return (
    <div className="sidebar">
      {/* User Profile Section */}
      <div className="user-profile-section">
        <UserProfileSection />
      </div>

      {/* Shortcuts */}
      <div className="shortcuts">
        <h3>Shortcuts</h3>
        <Shortcut icon="📌" text="Saved Posts" />
        <Shortcut icon="📅" text="Events" />
        <Shortcut icon="📸" text="Memories" />
      </div>

      {/* Groups */}
      <div className="groups">
        <h3>Groups</h3>
        <Group icon="👥" text="React Developers" />
        <Group icon="👥" text="Travel Enthusiasts" />
        <Group icon="👥" text="Food Lovers" />
      </div>
    </div>
  );
};

export default Sidebar;