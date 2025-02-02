import React from 'react';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Feed from './Feed.jsx';
import Widgets from './Widgets.jsx';

const HomePage = () => {
  return (
    <div className="home-page">
      <div className="navbar">
        <Navbar/>
      </div>
      <div className="main-content">
        <Sidebar/>
        <Feed/>
        <Widgets />
      </div>
    </div>
  );
};

export default HomePage;