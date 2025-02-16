import React from 'react';
import '../styles/NavLink.css';

const NavLink = ({ icon, text }) => {
  return (
    <div className="nav-link">
      <span className="icon">{icon}</span>
      <span className="text">{text}</span>
    </div>
  );
};

export default NavLink;