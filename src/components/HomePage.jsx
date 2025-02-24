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
import Event from './Event.jsx';
import Widgets from './Widgets.jsx';
import Messenger from './Messenger.jsx';
import Events from './Events.jsx';
import Notifications from './Notifications.jsx';
import '../styles/HomePage.css';

const HomePage = ({ updateLogged, email }) => {
  const [userId, setUserId] = useState(null);
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentUserProfilePic, setCurrentUserProfilePic] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [widgetsCollapsed, setWidgetsCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState('feed');
  const [unreadCount, setUnreadCount] = useState(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);

  const token = localStorage.getItem('authToken');

  // Decode the token for user ID
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

  // Fetch current user's profile (avatar, username, etc.)
  useEffect(() => {
    if (token && userId) {
      axios
        .get(`http://localhost:5000/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then((res) => {
          setCurrentUserProfilePic(res.data.profile_picture_url || '');
          setCurrentUsername(res.data.username || '');
        })
        .catch((err) => {
          console.error('Error fetching user details:', err);
          if (err.response && err.response.status === 401) {
            localStorage.removeItem('authToken');
            updateLogged(false);
          }
        });
    }
  }, [token, userId, updateLogged]);

  // Fetch unread notifications count
  const refreshUnreadCount = () => {
    if (!token || !userId) return;
    axios
      .get('http://localhost:5000/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        setUnreadCount(res.data.unreadCount || 0);
      })
      .catch((err) => {
        console.error('Error fetching unread count:', err);
      });
  };

  // Fetch friend requests count
  const refreshFriendRequestsCount = () => {
    if (!token || !userId) return;
    axios
      .get('http://localhost:5000/friends/incoming-count', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        setFriendRequestsCount(res.data.incomingRequests || 0);
      })
      .catch((err) => {
        console.error('Error fetching friend requests count:', err);
      });
  };

  // On mount or when userId changes, fetch both unreadCount & friendRequestsCount
  useEffect(() => {
    if (token && userId) {
      refreshUnreadCount();
      refreshFriendRequestsCount();
    }
  }, [token, userId]);

  return (
    <div className="home-page">
      {/* Navbar */}
      <div className="nav">
        <Navbar
          updateLogged={updateLogged}
          setCurrentView={setCurrentView}
          profilePic={currentUserProfilePic}
          userId={userId}
          token={token}
          unreadCount={unreadCount}
          friendRequestsCount={friendRequestsCount}
        />
      </div>

      <div className="main-content">
        {/* Sidebar */}
        <div className={`sidebar-container ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <Sidebar
            collapsed={sidebarCollapsed}
            toggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
            setCurrentView={setCurrentView}
            token={token}
            currentUserId={userId}
          />
        </div>

        {/* Main content area */}
        <div className="feed-container">
          {/* Feed */}
          {((typeof currentView === 'string' && currentView === 'feed') ||
            (typeof currentView === 'object' && currentView.view === 'feed')) && (
            <Feed
              token={token}
              currentUserId={userId}
              currentUsername={currentUsername}
              currentUserProfilePic={currentUserProfilePic}
              setCurrentView={setCurrentView}
              postId={currentView.postId}
              expandedCommentId={currentView.expandedCommentId}
            />
          )}

          {/* Friends */}
          {currentView === 'friends' && (
            <Friends refreshFriendRequestsCount={refreshFriendRequestsCount} />
          )}

          {/* Events List */}
          {currentView === 'events' && (
            <Events token={token} currentUserId={userId} setCurrentView={setCurrentView} />
          )}

          {/* Single Event */}
          {typeof currentView === 'object' && currentView.view === 'event' && (
            <Event
              token={token}
              currentUserId={userId}
              // We can pass eventId or eventData, whichever is available
              eventId={currentView.eventId}
              eventData={currentView.eventData} // optional if we already have the data
              onBack={() => setCurrentView('events')}
              setCurrentView={setCurrentView}
              refreshEvents={() => {}}
              postId={currentView.postId}
              expandedCommentId={currentView.expandedCommentId}
            />
          )}

          {/* Notifications */}
          {currentView === 'notifications' && (
            <Notifications
              token={token}
              onMarkAllRead={() => setUnreadCount(0)}
              onProfileClick={(actorId) => setCurrentView({ view: 'profile', userId: actorId })}
              onPostClick={(payload) => setCurrentView(payload)}
              onUnreadCountChange={refreshUnreadCount}
            />
          )}

          {/* Profile */}
          {typeof currentView === 'object' && currentView.view === 'profile' && (
            <Profile
              token={token}
              userId={currentView.userId}
              currentUserId={userId}
              setCurrentView={setCurrentView}
            />
          )}

          {/* Settings */}
          {currentView === 'settings' && (
            <Settings
              token={token}
              currentUserId={userId}
              setCurrentView={setCurrentView}
            />
          )}

          {/* Groups List */}
          {currentView === 'groups' && (
            <Groups
              token={token}
              currentUserId={userId}
              setCurrentView={setCurrentView}
            />
          )}

          {/* Single Group Page */}
          {typeof currentView === 'object' && currentView.view === 'group' && (
            <GroupPage
              token={token}
              currentUserId={userId}
              currentUserProfilePic={currentUserProfilePic}
              groupId={currentView.groupId}
              setCurrentView={setCurrentView}
              postId={currentView.postId}
              expandedCommentId={currentView.expandedCommentId}
            />
          )}
        </div>

        {/* Widgets */}
        <div className={`widgets-container ${widgetsCollapsed ? 'collapsed' : ''}`}>
          <Widgets
            email={email}
            collapsed={widgetsCollapsed}
            toggleWidgets={() => setWidgetsCollapsed((prev) => !prev)}
          />
        </div>
      </div>

      {/* Messenger */}
      {userId ? (
        <Messenger userId={userId} token={token} />
      ) : (
        <p className="chat-prompt">Please log in to use chat.</p>
      )}
    </div>
  );
};

export default HomePage;
