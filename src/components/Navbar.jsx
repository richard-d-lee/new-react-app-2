import React from 'react';
import '../styles/Navbar.css';
import SearchBar from './SearchBar.jsx';
import NavLink from './NavLink.jsx';
import UserProfile from './UserProfile.jsx';
import { FaHome, FaUserFriends, FaBell, FaUsers } from 'react-icons/fa';

const Navbar = ({ updateLogged, setCurrentView, profilePic, userId }) => {
  // You may want to pass in "unreadCount" as a prop from HomePage
  // so that we can display the badge on the notifications icon.
  // For example: Navbar({ unreadCount, updateLogged, ... })
  const unreadCount = 0; // placeholder if you pass it as a prop

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

          {/* Wrap the notifications link in a clickable div */}
          <div
            onClick={() => setCurrentView('notifications')}
            style={{ position: 'relative', cursor: 'pointer' }}
          >
            <NavLink icon={<FaBell />} text="Notifications" />
            
            {/* Show the badge if unreadCount > 0 */}
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount}
              </span>
            )}
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
