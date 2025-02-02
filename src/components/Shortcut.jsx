import React from 'react';
const Shortcut = ({ icon, text }) => {
    return (
      <div className="shortcut">
        <span className="icon">{icon}</span>
        <span className="text">{text}</span>
      </div>
    );
  };
  
  export default Shortcut;