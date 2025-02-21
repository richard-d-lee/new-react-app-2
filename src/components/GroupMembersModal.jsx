// GroupMembersModal.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTimes, FaCaretDown } from 'react-icons/fa';
import ProfilePic from './ProfilePic.jsx';
import '../styles/GroupMembersModal.css';

const GroupMembersModal = ({ token, groupId, groupName, currentUserId, onClose, isOwnerOrAdmin }) => {
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [error, setError] = useState('');
  const [friendStatusMap, setFriendStatusMap] = useState({});

  const fetchMembers = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/groups/${groupId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMembers(res.data);
      setFilteredMembers(res.data);
    } catch (err) {
      console.error("Error fetching group members:", err);
      setError(err.response?.data?.error || "Error fetching group members");
    }
  };

  const updateFriendStatuses = async (membersList) => {
    const statusMap = {};
    for (const member of membersList) {
      if (member.user_id === currentUserId) continue;
      try {
        const res = await axios.get("http://localhost:5000/friends/status", {
          params: { userId: currentUserId, otherId: member.user_id },
          headers: { Authorization: `Bearer ${token}` },
        });
        statusMap[member.user_id] = res.data;
      } catch (err) {
        console.error(`Error fetching friend status for user ${member.user_id}:`, err);
      }
    }
    setFriendStatusMap(statusMap);
  };

  useEffect(() => {
    if (token && groupId) {
      fetchMembers();
    }
  }, [token, groupId]);

  useEffect(() => {
    if (members.length > 0) {
      updateFriendStatuses(members);
    }
  }, [members]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMembers(members);
    } else {
      const lower = searchQuery.toLowerCase();
      const filtered = members.filter(member =>
        member.username.toLowerCase().includes(lower)
      );
      setFilteredMembers(filtered);
    }
  }, [searchQuery, members]);

  const handleAcceptFriend = async (memberId) => {
    try {
      await axios.post("http://localhost:5000/friends/confirm", { friendId: memberId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const now = new Date().toLocaleDateString();
      setFriendStatusMap(prev => ({
        ...prev,
        [memberId]: { status: 'accepted', friendAddedDate: now },
      }));
    } catch (err) {
      console.error("Error accepting friend request:", err);
      setError(err.response?.data?.error || "Error accepting friend request");
    }
  };

  const handleAddFriend = async (email, memberId) => {
    try {
      await axios.post("http://localhost:5000/friends/add-friend", { friendEmail: email }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFriendStatusMap(prev => ({
        ...prev,
        [memberId]: { status: 'pending', direction: 'outgoing' },
      }));
    } catch (err) {
      console.error("Error adding friend:", err);
      setError(err.response?.data?.error || "Error adding friend");
    }
  };

  const renderFriendStatus = (member) => {
    if (member.user_id === currentUserId) return null;
    const statusData = friendStatusMap[member.user_id] || { status: 'none' };
    if (statusData.status === 'accepted') {
      return <span style={{ marginLeft: 8, color: '#aaa' }}>Friend added on {statusData.friendAddedDate.slice(0, 10)}</span>;
    } else if (statusData.status === 'pending' && statusData.direction === 'outgoing') {
      return <span style={{ marginLeft: 8, color: '#aaa' }}>Pending</span>;
    } else if (statusData.status === 'pending' && statusData.direction === 'incoming') {
      return (
        <button 
          style={{ marginLeft: 8, backgroundColor: '#1877f2', color: '#fff' }}
          onClick={() => handleAcceptFriend(member.user_id)}
        >
          Accept Friend Request
        </button>
      );
    } else {
      return (
        <button 
          style={{ marginLeft: 8, backgroundColor: '#1877f2', color: '#fff' }}
          onClick={() => handleAddFriend(member.email, member.user_id)}
        >
          Add Friend
        </button>
      );
    }
  };

  const renderAdminDropdown = (member) => {
    if (member.user_id === currentUserId) return null;
    return (
      <div className="admin-dropdown">
        <button className="admin-dropdown-toggle">
          ⋮ <FaCaretDown />
        </button>
        <div className="admin-dropdown-menu">
          <button onClick={() => handleRemoveFromGroup(member.user_id)}>Remove from Group</button>
          {member.role !== 'admin' && (
            <button onClick={() => handleMakeAdmin(member.user_id)}>Make Admin</button>
          )}
          {member.role === 'admin' && (
            <button onClick={() => handleRemoveAdmin(member.user_id)}>Remove Admin</button>
          )}
          <button onClick={() => handleRemoveAllPosts(member.user_id)}>Remove All Posts</button>
        </div>
      </div>
    );
  };

  // (Assume handleRemoveFromGroup, handleMakeAdmin, handleRemoveAdmin, handleRemoveAllPosts are defined elsewhere)

  return (
    <div className="modal-overlay fade-in">
      <div className="group-members-modal fade-in">
        <button className="close-modal" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>Members of {groupName}</h2>
        <input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {error && <p className="error-message">{error}</p>}
        <ul className="members-list">
          {filteredMembers.map(member => (
            <li key={member.user_id} className="member-item">
              <div className="member-info">
                <ProfilePic
                  imageUrl={member.profile_picture_url ? `http://localhost:5000${member.profile_picture_url}` : null}
                  alt={member.username}
                  size={40}
                />
                <span>{member.username}</span>
                {renderFriendStatus(member)}
              </div>
              {isOwnerOrAdmin && (
                <div className="admin-actions">
                  {renderAdminDropdown(member)}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GroupMembersModal;
