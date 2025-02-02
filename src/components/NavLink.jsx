import React from 'react';
const NavLink = ({ icon, text }) => {
    return (
      <div className="nav-link">
        <span className="icon">{icon}</span>
        <span className="text">{text}</span>
      </div>
    );
  };
  
  export default NavLink;