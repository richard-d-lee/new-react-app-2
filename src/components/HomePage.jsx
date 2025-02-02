import React from 'react';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Feed from './Feed.jsx';

const HomePage = () => {
  return (
    <div className="home-page">
      <div className="navbar">
        <Navbar/>
      </div>
      <div className="main-content">
        <Sidebar/>
        <Feed/>

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