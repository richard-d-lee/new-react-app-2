import React from "react";
const SuggestedFriends = () => {
    // Example data (replace with real data later)
    const friends = [
      { id: 1, name: 'John Smith', avatar: 'https://via.placeholder.com/40' },
      { id: 2, name: 'Emily Johnson', avatar: 'https://via.placeholder.com/40' },
      { id: 3, name: 'Michael Brown', avatar: 'https://via.placeholder.com/40' },
    ];
  
    return (
      <div className="suggested-friends">
        {friends.map((friend) => (
          <div key={friend.id} className="friend">
            <img src={friend.avatar} alt={friend.name} />
            <span>{friend.name}</span>
            <button>Add Friend</button>
          </div>
        ))}
      </div>
    );
  };
  
  export default SuggestedFriends;