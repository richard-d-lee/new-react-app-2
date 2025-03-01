import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {jwtDecode} from 'jwt-decode';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Feed from './Feed.jsx';
import Friends from './Friends.jsx';
import Groups from './Groups.jsx';
import GroupPage from './GroupPage.jsx';
import Profile from './Profile.jsx';
import Settings from './Settings.jsx';
import Event from './Event.jsx'; // Single event detail view
import Messenger from './Messenger.jsx';
import Events from './Events.jsx'; // Used to list events
import Marketplace from './Marketplace.jsx';
import Listing from './Listing.jsx';
import Notifications from './Notifications.jsx';
import BugReportModal from './BugReportModal.jsx'; // New bug report modal component
import '../styles/HomePage.css';

const HomePage = ({ updateLogged, email }) => {
  const [userId, setUserId] = useState(null);
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentUserProfilePic, setCurrentUserProfilePic] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState('feed');
  const [unreadCount, setUnreadCount] = useState(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const [showBugModal, setShowBugModal] = useState(false);

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

  // Fetch current user's profile
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

  // Refresh counts
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

  useEffect(() => {
    if (token && userId) {
      refreshUnreadCount();
      refreshFriendRequestsCount();
    }
  }, [token, userId]);

  // Smaller ASCII art bug (4 lines tall, roughly half the previous size)
  const asciiBug = `
 _ _
\''o o\ \
/ \ / \ / \
 \\_/
`;

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
          {/* Bug icon below Sidebar */}
          <button className="bug-report-icon" onClick={() => setShowBugModal(true)}>
            {sidebarCollapsed ? asciiBug : "Report a Bug"}
          </button>
        </div>

        {/* Main content area */}
        <div className="feed-container">
          {(() => {
            // Normalize view: if currentView is null, default to "events"
            const view = currentView === null ? 'events' : currentView;
            if (typeof view === 'string') {
              if (view === 'feed') {
                return (
                  <Feed
                    token={token}
                    currentUserId={userId}
                    currentUsername={currentUsername}
                    currentUserProfilePic={currentUserProfilePic}
                    setCurrentView={setCurrentView}
                  />
                );
              } else if (view === 'friends') {
                return <Friends refreshFriendRequestsCount={refreshFriendRequestsCount} />;
              } else if (view === 'events') {
                return <Events token={token} currentUserId={userId} setCurrentView={setCurrentView} />;
              } else if (view === 'marketplace') {
                return <Marketplace token={token} currentUserId={userId} setCurrentView={setCurrentView} />;
              } else if (view === 'notifications') {
                return (
                  <Notifications
                    token={token}
                    onMarkAllRead={() => setUnreadCount(0)}
                    onProfileClick={(actorId) =>
                      setCurrentView({ view: 'profile', userId: actorId })
                    }
                    onPostClick={(payload) => setCurrentView(payload)}
                    onUnreadCountChange={refreshUnreadCount}
                  />
                );
              } else if (view === 'settings') {
                return <Settings token={token} currentUserId={userId} setCurrentView={setCurrentView} />;
              } else if (view === 'groups') {
                return <Groups token={token} currentUserId={userId} setCurrentView={setCurrentView} />;
              }
            } else if (typeof view === 'object' && view !== null) {
              if (view.view === 'event') {
                return (
                  <Event
                    token={token}
                    currentUserId={userId}
                    eventId={view.eventId}
                    eventData={view.eventData}
                    onBack={() => setCurrentView('events')}
                    setCurrentView={setCurrentView}
                  />
                );
              } else if (view.view === 'listing') {
                return (
                  <Listing
                    token={token}
                    listingId={view.listingId}
                    setCurrentView={setCurrentView}
                    currentUserId={userId}
                    currentUserProfilePic={currentUserProfilePic}
                  />
                );
              } else if (view.view === 'profile') {
                return (
                  <Profile
                    token={token}
                    userId={view.userId}
                    currentUserId={userId}
                    setCurrentView={setCurrentView}
                  />
                );
              } else if (view.view === 'group') {
                return (
                  <GroupPage
                    token={token}
                    currentUserId={userId}
                    groupId={view.groupId}
                    setCurrentView={setCurrentView}
                  />
                );
              } else if (view.view === 'events') {
                return <Events token={token} currentUserId={userId} setCurrentView={setCurrentView} />;
              }
            }
            return (
              <Feed token={token} currentUserId={userId} setCurrentView={setCurrentView} />
            );
          })()}
        </div>
      </div>

      {/* Messenger */}
      {userId ? (
        <Messenger userId={userId} token={token} />
      ) : (
        <p className="chat-prompt">Please log in to use chat.</p>
      )}

      {/* Bug Report Modal */}
      {showBugModal && (
        <BugReportModal
          token={token}
          currentUserId={userId}
          onClose={() => setShowBugModal(false)}
        />
      )}
    </div>
  );
};

export default HomePage;
