import React from 'react';

const Shortcut = ({ icon, text }) => {
  return (
    <div className="shortcut" role="button" tabIndex={0}>
      <span className="icon">{icon}</span>
      <span className="text">{text}</span>
    </div>
  );
};

export default Shortcut;
