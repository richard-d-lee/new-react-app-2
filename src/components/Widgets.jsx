import React from 'react';
import '../styles/Widgets.css';
import BirthdayReminder from './BirthdayReminder.jsx';
import SponsoredContent from './SponsoredContent.jsx';
import SuggestedFriends from './SuggestedFriends.jsx';

const Widgets = () => {
  return (
    <div className="widgets">
      {/* Birthday Reminders */}
      <div className="widget">
        <h3>Birthdays</h3>
        <BirthdayReminder />
      </div>

      {/* Sponsored Content */}
      <div className="widget">
        <h3>Sponsored</h3>
        <SponsoredContent />
      </div>

      {/* Suggested Friends */}
      <div className="widget">
        <h3>Suggested Friends</h3>
        <SuggestedFriends />
      </div>
    </div>
  );
};

export default Widgets;