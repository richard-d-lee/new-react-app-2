import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Group from './Group.jsx';
import AddGroupModal from './AddGroupModal.jsx';
import '../styles/Groups.css';

const Groups = ({ token, currentUserId, setCurrentView }) => {
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Fetch all groups
  const fetchGroups = async () => {
    try {
      const res = await axios.get("http://localhost:5000/groups", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Error fetching groups");
    }
  };

  useEffect(() => {
    if (token) {
      fetchGroups();
    }
  }, [token]);

  // Handle clicking on a group; set view to group page with the selected group id.
  const handleGroupClick = (groupId) => {
    setCurrentView({ view: 'group', groupId });
  };

  return (
    <div className="groups-container">
      <div className="groups-header">
        <h3>All Groups</h3>
      </div>
      
      <div className="create-group-container">
        <button className="add-group-btn" onClick={() => setShowModal(true)}>
          Create New Group
        </button>
      </div>
      
      {error && <p className="error-message">{error}</p>}
      
      {groups.length === 0 ? (
        <p>No groups available</p>
      ) : (
        <ul className="groups-list">
          {groups.map((group) => (
            <li key={group.group_id} onClick={() => handleGroupClick(group.group_id)}>
              <Group icon={group.icon} text={group.group_name} />
            </li>
          ))}
        </ul>
      )}
      
      {showModal && (
        <AddGroupModal 
          token={token} 
          onClose={() => setShowModal(false)}
          onGroupCreated={(newGroupId) => {
            fetchGroups();
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Groups;
