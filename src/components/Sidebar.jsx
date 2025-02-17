import React from 'react';
import '../styles/Sidebar.css';
import { FaAngleDoubleLeft, FaAngleDoubleRight } from 'react-icons/fa';
import UserProfileSection from './UserProfileSection.jsx';
import Shortcut from './Shortcut.jsx';
import Group from './Group.jsx';

const Sidebar = ({ collapsed, toggleSidebar, setCurrentView}) => {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} role="navigation">
      <button className="collapse-toggle" onClick={toggleSidebar}>
        {collapsed ? <FaAngleDoubleRight /> : <FaAngleDoubleLeft />}
      </button>

      <UserProfileSection setCurrentView={setCurrentView}/>

      <div className="shortcuts">
        <h3>Shortcuts</h3>
        <Shortcut icon="📌" text="Saved Posts" />
        <Shortcut icon="📅" text="Events" />
        <Shortcut icon="📸" text="Memories" />
      </div>

      <div className="groups">
        <h3>Groups</h3>
        <Group icon="👥" text="React Developers" />
        <Group icon="👥" text="Travel Enthusiasts" />
        <Group icon="👥" text="Food Lovers" />
      </div>
    </aside>
  );
};

export default Sidebar;
