import React from 'react';
import '../styles/Navbar.css';
import SearchBar from './SearchBar.jsx';
import NavLink from './NavLink.jsx';
import UserProfile from './UserProfile.jsx';
import { FaHome, FaUserFriends, FaBell, FaUsers } from 'react-icons/fa';
import logo from '../files/logo.jpg'; // Adjust the path if necessary

const Navbar = ({
  updateLogged,
  setCurrentView,
  profilePic,
  userId,
  token,
  unreadCount,
  friendRequestsCount
}) => {
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
            style={{ textDecoration: 'none' }}
          >
            {/* Replace the text header with an image */}
            <img src={logo} alt="BuzApp Logo" className="logo-img" />
          </a>
        </div>
        <div className="search-bar-container">
          <SearchBar />
        </div>
      </div>
      
      <div className="right-container">
        <div className="nav-links">
          {/* Home */}
          <div onClick={() => setCurrentView('feed')}>
            <NavLink icon={<FaHome />} text="Home" />
          </div>
          {/* Groups */}
          <div onClick={() => setCurrentView('groups')}>
            <NavLink icon={<FaUsers />} text="Groups" />
          </div>
          {/* Friends with Friend Requests Count */}
          <div
            style={{ cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center' }}
            onClick={() => setCurrentView('friends')}
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <FaUserFriends
                style={{
                  fontSize: '1.2rem',
                  padding: '3px',
                  marginTop: '5px',
                  backgroundColor: friendRequestsCount > 0 ? 'red' : 'transparent',
                  color: '#fff',
                  borderRadius: '50%'
                }}
              />
              {friendRequestsCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    color: '#000'
                  }}
                >
                  {friendRequestsCount}
                </span>
              )}
            </div>
            <span style={{ marginLeft: '8px', color: '#fff' }}>
              Friends
            </span>
          </div>
          {/* Notifications */}
          <div
            style={{ cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center' }}
            onClick={() => setCurrentView('notifications')}
          >
            <FaBell
              style={{
                fontSize: '1.1rem',
                marginTop: '3px',
                padding: '3px',
                backgroundColor: unreadCount > 0 ? 'red' : 'transparent',
                color: '#fff',
                borderRadius: '50%'
              }}
            />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '52%',
                  left: '9.3%',
                  transform: 'translate(-50%, -50%)',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  color: '#000'
                }}
              >
                {unreadCount}
              </span>
            )}
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
