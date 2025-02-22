import React from 'react';
import '../styles/Navbar.css';
import SearchBar from './SearchBar.jsx';
import NavLink from './NavLink.jsx';
import UserProfile from './UserProfile.jsx';
import { FaHome, FaUserFriends, FaBell, FaUsers } from 'react-icons/fa';

const Navbar = ({ updateLogged, setCurrentView, profilePic, userId, token, unreadCount }) => {
  return (
    <div className="navbar">
      <div className="left-container">
        <div className="logo">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setCurrentView('feed');
            }}
            style={{ textDecoration: 'none', color: '#fff' }}
          >
            <h1>BuzApp</h1>
          </a>
        </div>
        <div className="search-bar-container">
          <SearchBar />
        </div>
      </div>
      
      <div className="right-container">
        <div className="nav-links">
          <div onClick={() => setCurrentView('feed')}>
            <NavLink icon={<FaHome />} text="Home" />
          </div>
          <div onClick={() => setCurrentView('friends')}>
            <NavLink icon={<FaUserFriends />} text="Friends" />
          </div>
          <div onClick={() => setCurrentView('groups')}>
            <NavLink icon={<FaUsers />} text="Groups" />
          </div>

          {/* Notification Link with Bell */}
          <div
            style={{ cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center' }}
            onClick={() => setCurrentView('notifications')}
          >
            {/* Bell container for the red circle + count */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <FaBell
                style={{
                  fontSize: '1.2rem',
                  padding: '3px 3px 3px 3px',
                  // (1) Shift the bell down a bit
                  position: 'relative',
                  top: '3px',
                  backgroundColor: unreadCount > 0 ? 'red' : 'transparent',
                  color: '#fff',
                  borderRadius: '50%'
                }}
              />
              {/* Show the unread count if > 0, positioned inside the bell */}
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    // (2) Center the text
                    top: '50%',
                    left: '48%',
                    transform: 'translate(-50%, -50%)',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    color: '#000'
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </div>

            {/* The word 'Notifications' to the right of the bell */}
            <span style={{ marginLeft: '8px', color: '#fff' }}>
              Notifications
            </span>
          </div>
        </div>

        <div className="user-profile-container">
          <UserProfile
            userId={userId}
            updateLogged={updateLogged}
            setCurrentView={setCurrentView}
            profilePic={profilePic}
          />
        </div>
      </div>
    </div>
  );
};

export default Navbar;
