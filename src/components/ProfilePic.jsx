// ProfilePic.jsx
import React from 'react';
import '../styles/ProfilePic.css';

const ProfilePic = ({ imageUrl, alt, size = 40, style = {} }) => {
  const defaultUrl = "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg";
  const finalUrl = imageUrl || defaultUrl;

  return (
    <img
      className="profile-pic"
      src={finalUrl}
      alt={alt || 'Profile'}
      style={{
        width: size,
        height: size,
        ...style
      }}
    />
  );
};

export default ProfilePic;
