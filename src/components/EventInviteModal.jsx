import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTimes } from 'react-icons/fa';
import ProfilePic from './ProfilePic.jsx';
import '../styles/AddGroupModal.css'; // Reuse the same CSS as AddGroupModal

const EventInviteModal = ({ token, eventId, currentUserId, onClose }) => {
  const [friends, setFriends] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [invitedMap, setInvitedMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [error, setError] = useState('');

  // Fetch friends
  const fetchFriends = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/friends/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(res.data);
      setFilteredFriends(res.data);
    } catch (err) {
      console.error("Error fetching friends:", err);
      setError(err.response?.data?.error || "Error fetching friends");
    }
  };

  // Fetch current event attendees
  const fetchAttendees = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/events/${eventId}/attendees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttendees(res.data);
    } catch (err) {
      console.error("Error fetching event attendees:", err);
      setError(err.response?.data?.error || "Error fetching event attendees");
    }
  };

  // Build invited map from attendees
  useEffect(() => {
    if (attendees.length > 0) {
      const map = {};
      attendees.forEach(a => {
        if (a.status === 'invited') {
          map[a.user_id] = true;
        }
      });
      setInvitedMap(map);
    }
  }, [attendees]);

  useEffect(() => {
    if (token && eventId) {
      fetchFriends();
      fetchAttendees();
    }
  }, [token, eventId]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFriends(friends);
    } else {
      const lower = searchQuery.toLowerCase();
      setFilteredFriends(
        friends.filter(friend =>
          friend.username.toLowerCase().includes(lower)
        )
      );
    }
  }, [searchQuery, friends]);

  const handleInviteFriend = async (friendId) => {
    try {
      await axios.post(
        `http://localhost:5000/events/${eventId}/invite`, 
        { invitee_id: friendId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInvitedMap(prev => ({ ...prev, [friendId]: true }));
    } catch (err) {
      console.error("Error inviting friend:", err);
      alert(err.response?.data?.error || "Error inviting friend");
    }
  };

  const handleUninviteFriend = async (friendId) => {
    try {
      await axios.delete(
        `http://localhost:5000/events/${eventId}/invite`,
        { headers: { Authorization: `Bearer ${token}` }, data: { invitee_id: friendId } }
      );
      setInvitedMap(prev => ({ ...prev, [friendId]: false }));
    } catch (err) {
      console.error("Error uninviting friend:", err);
      alert(err.response?.data?.error || "Error uninviting friend");
    }
  };

  const renderInviteButton = (friend) => {
    const isInvited = invitedMap[friend.user_id];
    return isInvited ? (
      <button
        style={{
          backgroundColor: '#e0e0e0',
          color: '#333',
          border: 'none',
          padding: '5px 10px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
        onClick={() => handleUninviteFriend(friend.user_id)}
      >
        Uninvite
      </button>
    ) : (
      <button
        style={{
          backgroundColor: '#1877f2',
          color: '#fff',
          border: 'none',
          padding: '5px 10px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
        onClick={() => handleInviteFriend(friend.user_id)}
      >
        Invite
      </button>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="close-modal" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>Invite Friends to Event</h2>
        <input
          type="text"
          placeholder="Search friends..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {error && <p className="error-message">{error}</p>}
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
          {filteredFriends.map(friend => (
            <li key={friend.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ProfilePic
                  imageUrl={
                    friend.profile_picture_url
                      ? `http://localhost:5000${friend.profile_picture_url}`
                      : null
                  }
                  alt={friend.username}
                  size={40}
                />
                <span style={{ marginLeft: '10px' }}>{friend.username}</span>
              </div>
              <div>
                {renderInviteButton(friend)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default EventInviteModal;
