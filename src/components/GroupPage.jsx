// GroupPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Post from './Post.jsx';
import GroupLogoUploader from './GroupLogoUploader.jsx';
import GroupMembersModal from './GroupMembersModal.jsx';
import '../styles/GroupPage.css';

const GroupPage = ({ token, currentUserId, groupId, setCurrentView }) => {
  const [group, setGroup] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [error, setError] = useState('');
  const [showLogoUploader, setShowLogoUploader] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  // Fetch group details
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

  // Check membership status
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

  // Fetch group posts
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
      // Only fetch posts if the user is a member
      if (isMember) {
        fetchGroupPosts();
      }
    }
  }, [token, groupId, isMember]);

  // Handle joining the group
  const handleJoinGroup = async () => {
    try {
      await axios.post(`http://localhost:5000/groups/${groupId}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsMember(true);
      // Once joined, fetch posts
      fetchGroupPosts();
    } catch (err) {
      console.error("Error joining group:", err);
      setError(err.response?.data?.error || "Error joining group");
    }
  };

  // Post a new group message
  const handleNewPost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;
    try {
      const res = await axios.post(
        `http://localhost:5000/groups/${groupId}/posts`,
        { content: newPostContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newPost = {
        post_id: res.data.postId,
        content: newPostContent,
        user_id: currentUserId,
        username: "You",
        created_at: new Date().toISOString()
      };
      setPosts([newPost, ...posts]);
      setNewPostContent('');
    } catch (err) {
      console.error("Error posting in group:", err);
      setError(err.response?.data?.error || "Error posting in group");
    }
  };

  // Delete a post from group posts
  const handleDeletePost = (postId) => {
    setPosts(posts.filter(p => p.post_id !== postId));
  };

  // Callback when group logo is updated
  const handleLogoUpdate = (newLogoUrl) => {
    setGroup(prev => ({ ...prev, icon: newLogoUrl }));
    setShowLogoUploader(false);
  };

  // Determine if current user can update the logo (only owner in this example)
  const canUpdateLogo = group && group.creator_id === currentUserId;

  return (
    <div className="group-page">
      <button className="back-button" onClick={() => setCurrentView('groups')}>
        &larr; Back to Groups
      </button>
      {group ? (
        <>
          <div className="group-header">
            <div className="group-logo-container" onClick={() => canUpdateLogo && setShowLogoUploader(true)} style={{ cursor: canUpdateLogo ? 'pointer' : 'default' }}>
              <img 
                src={ group.icon ? `http://localhost:5000${group.icon}` : "https://via.placeholder.com/80" } 
                alt={group.group_name}
                className="group-logo"
              />
            </div>
            <div className="group-details">
              <h2>{group.group_name}</h2>
              <p>{group.group_description}</p>
            </div>
            <div className="view-members-link">
              {isMember ? (
                <button onClick={() => setShowMembersModal(true)} className="members-link">
                  View Group Members
                </button>
              ) : null}
            </div>
          </div>
          {isMember ? (
            <div className="group-posts">
              <h3>Posts in {group.group_name}</h3>
              <form onSubmit={handleNewPost} className="new-group-post-form">
                <textarea
                  placeholder="Write something for the group..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                />
                <button type="submit">Post</button>
              </form>
              {posts.length === 0 ? (
                <p>No posts in this group yet.</p>
              ) : (
                posts.map(post => (
                  <Post 
                    key={post.post_id} 
                    post={post} 
                    token={token} 
                    currentUserId={currentUserId}
                    currentUserProfilePic={""} // pass current user's profile picture if available
                    groupId={groupId}
                    onDelete={handleDeletePost}
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
      {showLogoUploader && (
        <GroupLogoUploader 
          token={token} 
          groupId={groupId} 
          onClose={() => setShowLogoUploader(false)}
          onUploadSuccess={handleLogoUpdate}
        />
      )}
      {showMembersModal && (
        <GroupMembersModal 
          token={token} 
          groupId={groupId}
          groupName={group.group_name}
          currentUserId={currentUserId}
          onClose={() => setShowMembersModal(false)}
          isOwnerOrAdmin={canUpdateLogo} // only owner in this example
        />
      )}
    </div>
  );
};

export default GroupPage;
