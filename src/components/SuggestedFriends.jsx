import React, { useState, useEffect } from "react";
import axios from "axios";

const SuggestedFriends = ({email}) => {
  const [error, setError] = useState("");
  const [possibleFriends, setPossibleFriends] = useState([]);

  useEffect(() => {
    let getPossibleFriends = async () => {
      try {
        const response = await axios.post("http://localhost:5000/possible-friends", {email});
        setPossibleFriends(response.data);
      } catch (err) {
        setError(err.response ? err.response.data.error : "Something went wrong.");
      }
    };
    getPossibleFriends();
  }, []); 
  const handleAddFriend = async (friendEmail) => {
    try {
      const response = await axios.post("http://localhost:5000/add-friend", {
        friendEmail,
        email,
      });
    } catch (err) {
      setError(err.response ? err.response.data.error : "Something went wrong.");
    }
  };
  if (possibleFriends.length === 0) {
    return (
      <div>There are currently no suggested friends.</div>
    )
  }
  return (
    <div className="suggested-friends">
      {error && <p className="error">{error}</p>}
      {possibleFriends.map((friend) => {
        console.log(friend);
        return (
          <div className="friend">
          <span>{friend.EMAIL}</span>
          <img src={friend.avatar} alt={friend.name} />
          <button onClick={() => {handleAddFriend(friend.EMAIL)}}>Add Friend</button>
        </div>
      )}
      )}
    </div>
  );
};

export default SuggestedFriends;