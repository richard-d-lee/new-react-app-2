import React from 'react';
import '../styles/Widgets.css';
import { FaAngleDoubleLeft, FaAngleDoubleRight } from 'react-icons/fa';
import BirthdayReminder from './BirthdayReminder.jsx';
import SponsoredContent from './SponsoredContent.jsx';
import SuggestedFriends from './SuggestedFriends.jsx';

const Widgets = ({ email, collapsed, toggleWidgets }) => {
  return (
    <div className="widgets">
      {/* Collapse Toggle Button */}
      <button className="collapse-widgets-button" onClick={toggleWidgets}>
        {collapsed ? <FaAngleDoubleLeft /> : <FaAngleDoubleRight />}
      </button>

      {/* Render widget content only if expanded */}
      {!collapsed && (
        <>
          <div className="widget">
            <h3>Birthdays</h3>
            <BirthdayReminder />
          </div>
          {/* <div className="widget">
            <h3>Sponsored</h3>
            <SponsoredContent />
          </div> */}
          <div className="widget">
            <h3>Suggested Friends</h3>
            <SuggestedFriends email={email} />
          </div>
        </>
      )}
    </div>
  );
};

export default Widgets;
