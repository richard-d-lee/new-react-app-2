// AddGroupModal.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { FaTimes } from 'react-icons/fa';
import '../styles/AddGroupModal.css';

const AddGroupModal = ({ token, onClose, onGroupCreated }) => {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [icon, setIcon] = useState('👥');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }
    try {
      const res = await axios.post(
        'http://localhost:5000/groups',
        { group_name: groupName, group_description: groupDescription, group_privacy: 'public', icon },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onGroupCreated(res.data.groupId);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Error creating group");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="close-modal" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>Create a New Group</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="Group Name" 
            value={groupName} 
            onChange={(e) => setGroupName(e.target.value)} 
          />
          <textarea 
            placeholder="Group Description" 
            value={groupDescription} 
            onChange={(e) => setGroupDescription(e.target.value)}
          />
          <button type="submit">Create Group</button>
        </form>
      </div>
    </div>
  );
};

export default AddGroupModal;
