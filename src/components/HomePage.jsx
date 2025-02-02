import React from 'react';
import Navbar from './Navbar.jsx';

const HomePage = () => {
  return (
    <div className="home-page">
      {/* Navbar Placeholder */}
      <div className="navbar">
        <Navbar/>
      </div>

      <div className="main-content">
        {/* Sidebar Placeholder */}
        <div className="sidebar">
          <h2>Sidebar</h2>
          {/* Replace this with the actual Sidebar component later */}
        </div>

        {/* Feed Placeholder */}
        <div className="feed">
          <h2>Feed</h2>
          {/* Replace this with the actual Feed component later */}
        </div>

        {/* Widgets Placeholder */}
        <div className="widgets">
          <h2>Widgets</h2>
          {/* Replace this with the actual Widgets component later */}
        </div>
      </div>
    </div>
  );
};

export default HomePage;