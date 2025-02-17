import React, { useEffect, useState } from 'react';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Feed from './Feed.jsx';
import Friends from './Friends.jsx'; // <-- Import the new Friends component
import Widgets from './Widgets.jsx';
import Messenger from './Messenger.jsx';
import { jwtDecode } from 'jwt-decode';
import '../styles/HomePage.css';

const HomePage = ({ updateLogged, email }) => {
  const [userId, setUserId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [widgetsCollapsed, setWidgetsCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState('feed'); // <--- new state

  const token = localStorage.getItem('authToken');

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
      <div className="nav">
        <Navbar 
          updateLogged={updateLogged} 
          setCurrentView={setCurrentView} // pass a setter to the Navbar
        />
      </div>
      
      <div className="main-content">
        <div className={`sidebar-container ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <Sidebar collapsed={sidebarCollapsed} toggleSidebar={toggleSidebar} />
        </div>

        <div className="feed-container">
          {currentView === 'feed' ? <Feed /> : <Friends />} 
          {/* Conditionally render feed or friends */}
        </div>

        <div className={`widgets-container ${widgetsCollapsed ? 'collapsed' : ''}`}>
          <Widgets 
            email={email} 
            collapsed={widgetsCollapsed} 
            toggleWidgets={toggleWidgets} 
          />
        </div>
      </div>

      {userId ? (
        <Messenger userId={userId} token={token} />
      ) : (
        <p className="chat-prompt">Please log in to use chat.</p>
      )}
    </div>
  );
};

export default HomePage;
