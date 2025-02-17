import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaComments, FaPaperPlane, FaArrowLeft } from "react-icons/fa";
import "../styles/Messenger.css";

const Messenger = ({ userId, token }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inboxList, setInboxList] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  // Utility to truncate message text
  const truncateText = (text, maxLength = 30) => {
    return text && text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  // Fetch inbox-latest (friends + last message)
  const fetchInboxList = async () => {
    try {
      const res = await axios.get("http://localhost:5000/messages/inbox-latest", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInboxList(res.data);
    } catch (err) {
      console.error("Error fetching inbox-latest:", err);
    }
  };

  // Fetch conversation with a selected friend
  const fetchConversation = async (friendId) => {
    try {
      const res = await axios.get(
        `http://localhost:5000/messages/conversation/${friendId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConversation(res.data);
    } catch (err) {
      console.error("Error fetching conversation:", err);
    }
  };

  // Select a friend from the inbox
  const handleSelectFriend = (friend) => {
    setSelectedFriend(friend);
    // Use the property "friend" from inboxList as the receiver id
    fetchConversation(friend.friend_id);
  };

  // Return to inbox view
  const handleBackToInbox = () => {
    setSelectedFriend(null);
    setConversation([]);
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedFriend) return;
    try {
      await axios.post(
        "http://localhost:5000/messages/send",
        { receiver_id: selectedFriend.friend_id, content: newMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Append the message locally
      setConversation([...conversation, { content: newMessage, sender_id: userId }]);
      setNewMessage("");
      // Optionally refresh the inbox list so it updates the last_message
      fetchInboxList();
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // Load the inbox-latest when Messenger opens or user logs in
  useEffect(() => {
    if (isOpen && token && !selectedFriend) {
      fetchInboxList();
    }
  }, [isOpen, token, selectedFriend]);

  return (
    <>
      {/* Floating Chat Icon */}
      {!isOpen && (
        <button className="messenger-icon" onClick={() => setIsOpen(true)}>
          <FaComments size={24} />
        </button>
      )}

      {isOpen && (
        <div className="messenger-box">
          <div className="messenger-header">
            {selectedFriend ? (
              <>
                <button className="back-button" onClick={handleBackToInbox}>
                  <FaArrowLeft />
                </button>
                <span>Conversation with {selectedFriend.username}</span>
                <button onClick={() => setIsOpen(false)} className="close-button">
                  ✕
                </button>
              </>
            ) : (
              <>
                <span>Messenger</span>
                <button onClick={() => setIsOpen(false)} className="close-button">
                  ✕
                </button>
              </>
            )}
          </div>

          {/* Inbox View */}
          {!selectedFriend ? (
            <div className="inbox">
              {inboxList.length === 0 ? (
                <p className="empty">No conversations yet</p>
              ) : (
                inboxList.map((friend) => {
                  const preview = friend.last_message
                    ? truncateText(friend.last_message, 40)
                    : "Start a conversation";
                  return (
                    <div
                      key={friend.friend_id}
                      className="conversation"
                      onClick={() => handleSelectFriend(friend)}
                    >
                      <span className="friend-name">{friend.username}</span>
                      <span className="conversation-preview">{preview}</span>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            // Conversation View
            <div className="chat-area">
              <div className="messages">
                {conversation.length === 0 ? (
                  <p className="empty">Start a conversation</p>
                ) : (
                  conversation.map((msg, index) => (
                    <div
                      key={index}
                      className={
                        msg.sender_id === userId ? "message sent" : "message received"
                      }
                    >
                      {msg.content}
                    </div>
                  ))
                )}
              </div>
              <div className="message-input">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                />
                <button onClick={sendMessage} className="send-button">
                  <FaPaperPlane />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default Messenger;
