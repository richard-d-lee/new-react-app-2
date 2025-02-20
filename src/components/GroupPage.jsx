import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreatePost from './CreatePost.jsx';
import Post from './Post.jsx';
import GroupLogoUploader from './GroupLogoUploader.jsx';
import GroupMembersModal from './GroupMembersModal.jsx';
import '../styles/GroupPage.css';

const GroupPage = ({ token, currentUserId, currentUserProfilePic, groupId, setCurrentView }) => {
  const [group, setGroup] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [showLogoUploader, setShowLogoUploader] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  // ✅ Fetch group details
  const fetchGroupDetails = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroup(res.data);
    } catch (err) {
      console.error("Error fetching group details:", err);
      setError(err.response?.data?.error || "Error fetching group details");
    }
  };

  // ✅ Check membership status
  const fetchMembershipStatus = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/groups/${groupId}/membership`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsMember(res.data.isMember);
    } catch (err) {
      console.error("Error checking membership:", err);
    }
  };

  // ✅ Fetch group posts
  const fetchGroupPosts = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/groups/${groupId}/posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(res.data);
    } catch (err) {
      console.error("Error fetching group posts:", err);
      setError(err.response?.data?.error || "Error fetching group posts");
    }
  };

  useEffect(() => {
    if (token && groupId) {
      fetchGroupDetails();
      fetchMembershipStatus();
      if (isMember) {
        fetchGroupPosts();
      }
    }
  }, [token, groupId, isMember]);

  // ✅ Handle joining the group
  const handleJoinGroup = async () => {
    try {
      await axios.post(`http://localhost:5000/groups/${groupId}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsMember(true);
      fetchGroupPosts(); // ✅ Fetch posts after joining
    } catch (err) {
      console.error("Error joining group:", err);
      setError(err.response?.data?.error || "Error joining group");
    }
  };

  // ✅ Handle new post creation (same as `Feed.jsx`)
  const handleNewPost = (newPostObj) => {
    setPosts(prev => [newPostObj, ...prev]); // ✅ Insert at the top
  };

  // ✅ Handle post deletion (same as `Feed.jsx`)
  const handleDeletePost = (postId) => {
    setPosts(prev => prev.filter(p => p.post_id !== postId));
  };

  // ✅ Handle group logo update
  const handleLogoUpdate = (newLogoUrl) => {
    setGroup(prev => ({ ...prev, icon: newLogoUrl }));
    setShowLogoUploader(false);
  };

  // ✅ Check if the user can update the logo (only owner)
  const canUpdateLogo = group && group.creator_id === currentUserId;

  return (
    <div className="group-page">
      <button className="back-button" onClick={() => setCurrentView('groups')}>
        &larr; Back to Groups
      </button>

      {group ? (
        <>
          <div className="group-header">
            <div
              className="group-logo-container"
              onClick={() => canUpdateLogo && setShowLogoUploader(true)}
              style={{ cursor: canUpdateLogo ? 'pointer' : 'default' }}
            >
              <img
                src={group.icon ? `http://localhost:5000${group.icon}` : "https://via.placeholder.com/80"}
                alt={group.group_name}
                className="group-logo"
              />
            </div>
            <div className="group-details">
              <h2>{group.group_name}</h2>
              <p>{group.group_description}</p>
            </div>
            <div className="view-members-link">
              {isMember && (
                <button onClick={() => setShowMembersModal(true)} className="members-link">
                  View Group Members
                </button>
              )}
            </div>
          </div>

          {isMember ? (
            <div className="group-posts">
              <h3>Posts in {group.group_name}</h3>

              {/* ✅ Use CreatePost like `Feed.jsx` */}
              <CreatePost
                token={token}
                currentUserId={currentUserId}
                currentUserProfilePic={currentUserProfilePic}
                onNewPost={handleNewPost}
                groupId={groupId} // ✅ Ensure it posts in the correct group
              />

              {posts.length === 0 ? (
                <p>No posts in this group yet.</p>
              ) : (
                posts.map(post => (
                  <Post
                    key={post.post_id}
                    post={post}
                    token={token}
                    onDelete={handleDeletePost}
                    currentUserId={currentUserId}
                    currentUserProfilePic={currentUserProfilePic}
                    setCurrentView={setCurrentView}
                    onProfileClick={(userId) => setCurrentView({ view: 'profile', userId })} // ✅ Fix profile navigation
                  />
                ))
              )}
            </div>
          ) : (
            <div className="join-group">
              <p>You are not a member of this group.</p>
              <button onClick={handleJoinGroup}>Join Group</button>
            </div>
          )}
        </>
      ) : (
        <p>Loading group details...</p>
      )}

      {error && <p className="error">{error}</p>}

      {/* ✅ Group Logo Uploader */}
      {showLogoUploader && (
        <GroupLogoUploader 
          token={token} 
          groupId={groupId} 
          onClose={() => setShowLogoUploader(false)}
          onUploadSuccess={handleLogoUpdate}
        />
      )}

      {/* ✅ Group Members Modal */}
      {showMembersModal && (
        <GroupMembersModal 
          token={token} 
          groupId={groupId}
          groupName={group.group_name}
          currentUserId={currentUserId}
          onClose={() => setShowMembersModal(false)}
          isOwnerOrAdmin={canUpdateLogo} // ✅ Only owner in this example
        />
      )}
    </div>
  );
};

export default GroupPage;
