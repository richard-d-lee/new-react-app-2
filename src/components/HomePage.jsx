import React, { useEffect } from 'react';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Feed from './Feed.jsx';
import Widgets from './Widgets.jsx';



const HomePage = () => {
  useEffect(() => {
    fetch("http://localhost:5000/data")
      .then(res => res.json())
      .then(data => console.log(data))
      .catch(err => console.error(err));
  }, []);
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