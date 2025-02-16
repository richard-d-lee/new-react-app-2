import React, { useState, useEffect } from "react";
import axios from "axios";

const SuggestedFriends = ({ email }) => {
  const [error, setError] = useState("");
  const [possibleFriends, setPossibleFriends] = useState([]);

  useEffect(() => {
    const fetchPossibleFriends = async () => {
      try {
        const response = await axios.get("http://localhost:5000/possible-friends", {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
        });
        setPossibleFriends(response.data);
      } catch (err) {
        setError(err.response ? err.response.data.error : "Something went wrong.");
      }
    };

    fetchPossibleFriends();
  }, []);

  const handleAddFriend = async (friendEmail) => {
    try {
      await axios.post("http://localhost:5000/add-friend", {
        friendEmail,
        email,
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      // Optionally update the UI (e.g. remove friend from suggestions)
    } catch (err) {
      setError(err.response ? err.response.data.error : "Something went wrong.");
    }
  };

  if (possibleFriends.length === 0) {
    return <div>There are currently no suggested friends.</div>;
  }

  return (
    <div className="suggested-friends">
      {error && <p className="error">{error}</p>}
      {possibleFriends.map((friend) => (
        <div className="friend" key={friend.user_id}>
          <img 
            src={"https://pbs.twimg.com/profile_images/1237550450/mstom_400x400.jpg"} 
            alt={friend.username} 
          />
          <div className="friend-info">
            <p className="friend-name">{friend.username}</p>
            <p className="friend-email">{friend.email}</p>
          </div>
          <button onClick={() => handleAddFriend(friend.email)}>
            Add Friend
          </button>
        </div>
      ))}
    </div>
  );
};

export default SuggestedFriends;
