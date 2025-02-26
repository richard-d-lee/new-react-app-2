import React, { useState, useEffect } from 'react';
import { FaSearch } from 'react-icons/fa';
import axios from 'axios';
import '../styles/SearchBar.css';

const fallbackImage = "https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg";

const SearchBar = ({ token, setCurrentView }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ users: [], groups: [], events: [] });
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (query.length > 0) {
      const delayDebounceFn = setTimeout(() => {
        axios
          .get(`http://localhost:5000/users/search-all?query=${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          .then((response) => {
            // Expecting response.data to be of the form:
            // { users: [...], groups: [...], events: [...] }
            setResults(response.data);
            setShowResults(true);
          })
          .catch((err) => {
            console.error(err);
            setResults({ users: [], groups: [], events: [] });
          });
      }, 300);

      return () => clearTimeout(delayDebounceFn);
    } else {
      setShowResults(false);
      setResults({ users: [], groups: [], events: [] });
    }
  }, [query, token]);

  const handleSelect = (item) => {
    // Determine what type of item was clicked
    if (item.user_id) {
      // Navigate to user's profile page
      setCurrentView({ view: 'profile', userId: item.user_id });
    } else if (item.group_id) {
      // Navigate to specific group page
      setCurrentView({ view: 'group', groupId: item.group_id });
    } else if (item.event_id) {
      // Navigate to event page (pass eventData if available)
      setCurrentView({ view: 'event', eventId: item.event_id, eventData: item });
    }
    setQuery('');
    setShowResults(false);
  };

  return (
    <div className="search-bar">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search for users, groups, events..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <FaSearch className="search-icon" />
      </div>
      {showResults &&
        (results.users.length > 0 ||
          results.groups.length > 0 ||
          results.events.length > 0) && (
          <div className="search-results">
            {results.users.length > 0 && (
              <div className="results-section">
                <h4>Users</h4>
                {results.users.map((user) => (
                  <div
                    className="result-item"
                    key={user.user_id}
                    onClick={() => handleSelect(user)}
                  >
                    <img
                      src={
                        user.profile_picture_url
                          ? `http://localhost:5000${user.profile_picture_url}`
                          : fallbackImage
                      }
                      alt={user.username}
                      className="result-avatar"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = fallbackImage;
                      }}
                    />
                    <span>{user.username}</span>
                  </div>
                ))}
              </div>
            )}
            {results.groups.length > 0 && (
              <div className="results-section">
                <h4>Groups</h4>
                {results.groups.map((group) => (
                  <div
                    className="result-item"
                    key={group.group_id}
                    onClick={() => handleSelect(group)}
                  >
                    <img
                      src={
                        group.group_pic
                          ? `http://localhost:5000${group.group_pic}`
                          : fallbackImage
                      }
                      alt={group.group_name}
                      className="result-avatar"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = fallbackImage;
                      }}
                    />
                    <span>{group.group_name}</span>
                  </div>
                ))}
              </div>
            )}
            {results.events.length > 0 && (
              <div className="results-section">
                <h4>Events</h4>
                {results.events.map((event) => (
                  <div
                    className="result-item"
                    key={event.event_id}
                    onClick={() => handleSelect(event)}
                  >
                    <img
                      src={
                        event.event_pic
                          ? `http://localhost:5000${event.event_pic}`
                          : fallbackImage
                      }
                      alt={event.event_name}
                      className="result-avatar"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = fallbackImage;
                      }}
                    />
                    <span>{event.event_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default SearchBar;
