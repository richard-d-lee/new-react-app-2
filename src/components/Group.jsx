import React from 'react';

const Group = ({ icon, text }) => {
  return (
    <div className="group" role="button" tabIndex={0}>
      <span className="icon">{icon}</span>
      <span className="text">{text}</span>
    </div>
  );
};

export default Group;
