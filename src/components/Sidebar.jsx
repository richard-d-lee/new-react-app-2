import React, { useState, useEffect } from 'react';
import axios from 'axios';
import UserProfileSection from './UserProfileSection.jsx';
import Shortcut from './Shortcut.jsx';
import Group from './Group.jsx';
import '../styles/Sidebar.css';

const Sidebar = ({ collapsed, toggleSidebar, setCurrentView, token, currentUserId }) => {
  const [myGroups, setMyGroups] = useState([]);

  const fetchMyGroups = async () => {
    try {
      const res = await axios.get("http://localhost:5000/groups/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyGroups(res.data);
    } catch (err) {
      console.error("Error fetching user groups:", err);
    }
  };

  useEffect(() => {
    if (token && currentUserId) {
      fetchMyGroups();
    }
  }, [token, currentUserId]);

  const handleGroupClick = (groupId) => {
    setCurrentView({ view: 'group', groupId });
  };

  // (1) handleEventsClick: sets currentView to "events"
  const handleEventsClick = () => {
    setCurrentView('events');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} role="navigation">
      <button className="collapse-toggle" onClick={toggleSidebar}>
        {collapsed ? '→' : '←'}
      </button>

      <UserProfileSection setCurrentView={setCurrentView} />

      <div className="shortcuts">
        <h3>Shortcuts</h3>
        <Shortcut icon="📌" text="Saved Posts" />
        <div onClick={() => setCurrentView('marketplace')}>
          <Shortcut icon="🛒" text="Marketplace" />
        </div>
        {/* (2) Wrap the Shortcut in a clickable div to set currentView */}
        <div onClick={handleEventsClick}>
          <Shortcut icon="📅" text="Events" />
        </div>
        <Shortcut icon="📸" text="Memories" />
      </div>

      <div className="groups">
        <h3>Groups</h3>
        {myGroups.length > 0 ? (
          myGroups.map((group) => (
            <Group
              key={group.group_id}
              icon={group.icon}
              text={group.group_name}
              onClick={() => handleGroupClick(group.group_id)}
            />
          ))
        ) : (
          <p className="empty">You haven't joined any groups yet.</p>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
