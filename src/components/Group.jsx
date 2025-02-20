import React from 'react';

const Group = ({ icon, text, onClick }) => {
  // If `icon` starts with "/uploads/", treat it as an image path
  const isImagePath = icon && icon.startsWith('/uploads/');
  const fullImageUrl = isImagePath ? `http://localhost:5000${icon}` : null;

  return (
    <div className="group" role="button" tabIndex={0} onClick={onClick}>
      {isImagePath ? (
        <img
          src={fullImageUrl}
          alt={text}
          style={{
            width: 30,
            height: 30,
            objectFit: 'cover',
            borderRadius: 4,
            marginRight: 8
          }}
        />
      ) : (
        // If icon is not a path, treat it as an emoji or fallback
        <span className="icon" style={{ marginRight: 8 }}>{icon}</span>
      )}
      <span className="text">{text}</span>
    </div>
  );
};

export default Group;
