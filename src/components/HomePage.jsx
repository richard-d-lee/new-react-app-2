import React, { useEffect, useState } from 'react';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Feed from './Feed.jsx';
import Widgets from './Widgets.jsx';
import Messenger from './Messenger.jsx';
import { jwtDecode } from 'jwt-decode';
import '../styles/HomePage.css';

const HomePage = ({ updateLogged, email }) => {
  const [userId, setUserId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [widgetsCollapsed, setWidgetsCollapsed] = useState(false);

  const token = localStorage.getItem("authToken");

  useEffect(() => {
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setUserId(decodedToken.userId);
      } catch (error) {
        console.error("Invalid token", error);
        setUserId(null);
      }
    }
  }, [token]);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const toggleWidgets = () => {
    setWidgetsCollapsed((prev) => !prev);
  };

  return (
    <div className="home-page">
      {/* Navbar */}
      <div className="nav">
        <Navbar updateLogged={updateLogged} />
      </div>
      
      <div className="main-content">
        {/* Left Sidebar */}
        <div className={`sidebar-container ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <Sidebar collapsed={sidebarCollapsed} toggleSidebar={toggleSidebar} />
        </div>

        {/* Feed */}
        <div className="feed-container">
          <Feed />
        </div>

        {/* Right Widgets Sidebar */}
        <div className={`widgets-container ${widgetsCollapsed ? 'collapsed' : ''}`}>
          <Widgets 
            email={email} 
            collapsed={widgetsCollapsed} 
            toggleWidgets={toggleWidgets} 
          />
        </div>
      </div>

      {/* Messenger at the root level, not inside main-content */}
      {userId ? (
        <Messenger userId={userId} token={token} />
      ) : (
        <p className="chat-prompt">Please log in to use chat.</p>
      )}
    </div>
  );
};

export default HomePage;
