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
  const token = localStorage.getItem("authToken"); // Get JWT token from localStorage

  useEffect(() => {
    if (token) {
      try {
        const decodedToken = jwtDecode(token); // Decode the JWT token
        setUserId(decodedToken.userId); // Set userId from decoded token
      } catch (error) {
        console.error("Invalid token", error);
        setUserId(null); // If token is invalid, reset userId
      }
    }
  }, [token]);

  return (
    <div className="home-page">
      <div className="nav">
        <Navbar updateLogged={updateLogged} />
      </div>
      <div className="main-content">
        <div className="sidebar">
          <Sidebar />
        </div>
        <div className="feed">
          <Feed />
        </div>
        <div className="widgets">
          <Widgets email={email} />
        </div>
        {userId ? (
          <Messenger userId={userId} token={token} />
        ) : (
          <p>Please log in to use chat.</p>
        )}
      </div>

    </div>
  );
};

export default HomePage;
