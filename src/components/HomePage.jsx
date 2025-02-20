import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Feed from './Feed.jsx';
import Friends from './Friends.jsx';
import Groups from './Groups.jsx';
import GroupPage from './GroupPage.jsx';
import Profile from './Profile.jsx';
import Settings from './Settings.jsx';
import Widgets from './Widgets.jsx';
import Messenger from './Messenger.jsx';
import '../styles/HomePage.css';

const HomePage = ({ updateLogged, email }) => {
  const [userId, setUserId] = useState(null);
  const [currentUserProfilePic, setCurrentUserProfilePic] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [widgetsCollapsed, setWidgetsCollapsed] = useState(false);
  // currentView can be "feed", "friends", "profile", "settings", "groups", or { view: 'group', groupId: ... }
  const [currentView, setCurrentView] = useState('feed');

  const token = localStorage.getItem('authToken');

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserId(decoded.userId);
      } catch (error) {
        console.error('Invalid token', error);
        localStorage.removeItem('authToken');
        updateLogged(false);
      }
    }
  }, [token, updateLogged]);

  useEffect(() => {
    if (token && userId) {
      axios.get(`http://localhost:5000/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        setCurrentUserProfilePic(res.data.profile_picture_url || "");
      })
      .catch((err) => {
        console.error("Error fetching user details:", err);
        if (err.response && err.response.status === 401) {
          localStorage.removeItem('authToken');
          updateLogged(false);
        }
      });
    }
  }, [token, userId, updateLogged]);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  const toggleWidgets = () => {
    setWidgetsCollapsed(prev => !prev);
  };

  return (
    <div className="home-page">
      <div className="nav">
        <Navbar 
          updateLogged={updateLogged} 
          setCurrentView={setCurrentView}
          profilePic={currentUserProfilePic}
        />
      </div>
      
      <div className="main-content">
        <div className={`sidebar-container ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <Sidebar 
            collapsed={sidebarCollapsed} 
            toggleSidebar={toggleSidebar} 
            setCurrentView={setCurrentView}
            token={token}
            currentUserId={userId}
          />
        </div>
        
        <div className="feed-container">
          {currentView === 'feed' && (
            <Feed 
              token={token}
              currentUserId={userId}
              currentUserProfilePic={currentUserProfilePic}
            />
          )}
          {currentView === 'friends' && <Friends />}
          {currentView === 'profile' && (
            <Profile token={token} currentUserId={userId} />
          )}
          {currentView === 'settings' && (
            <Settings 
              token={token}
              currentUserId={userId}
              setCurrentView={setCurrentView}
            />
          )}
          {currentView === 'groups' && (
            <Groups 
              token={token}
              currentUserId={userId}
              setCurrentView={setCurrentView}
            />
          )}
          {typeof currentView === 'object' && currentView.view === 'group' && (
            <GroupPage 
              token={token} 
              currentUserId={userId} 
              groupId={currentView.groupId}
              setCurrentView={setCurrentView}
            />
          )}
        </div>
        
        <div className={`widgets-container ${widgetsCollapsed ? 'collapsed' : ''}`}>
          <Widgets email={email} collapsed={widgetsCollapsed} toggleWidgets={toggleWidgets} />
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
