import React, { useState, useEffect } from 'react';
import {jwtDecode} from 'jwt-decode';
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
import Notifications from './Notifications.jsx';
import '../styles/HomePage.css';

const HomePage = ({ updateLogged, email }) => {
  const [userId, setUserId] = useState(null);
  const [currentUserProfilePic, setCurrentUserProfilePic] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [widgetsCollapsed, setWidgetsCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState('feed');
  const [unreadCount, setUnreadCount] = useState(0);

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

  // Fetch unread notifications count on mount and whenever the token changes.
  useEffect(() => {
    if (token) {
      axios.get('http://localhost:5000/notifications/unread-count', {
          headers: { Authorization: `Bearer ${token}` }
      })
      .then(response => {
         setUnreadCount(response.data.unreadCount);
      })
      .catch(err => console.error("Error fetching unread notifications count:", err));
    }
  }, [token]);

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
          userId={userId}
          unreadCount={unreadCount}
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
              setCurrentView={setCurrentView}
            />
          )}
          {currentView === 'friends' && <Friends />}
          {currentView === 'notifications' && (
            <Notifications
              token={token}
              userId={userId}
              onMarkAllRead={() => setUnreadCount(0)}
            />
          )}
          {typeof currentView === 'object' && currentView.view === 'profile' && (
            <Profile 
              token={token} 
              userId={currentView.userId}  
              currentUserId={userId} 
              setCurrentView={setCurrentView}
            />
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
