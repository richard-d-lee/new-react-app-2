import React, { useEffect } from 'react';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import Feed from './Feed.jsx';
import Widgets from './Widgets.jsx';



const HomePage = ({updateLogged, email}) => {
  return (
    <div className="home-page">
      <div className="navbar">
        <Navbar updateLogged={updateLogged}/>
      </div>
      <div className="main-content">
        <Sidebar/>
        <Feed/>
        <Widgets email={email}/>
      </div>
    </div>
  );
};

export default HomePage;