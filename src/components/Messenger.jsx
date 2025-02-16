import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaComments, FaPaperPlane } from "react-icons/fa";
import "../styles/Messenger.css"; // We'll define .messenger-icon, .messenger-box, etc. here

const Messenger = ({ userId, token }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newMessage, setNewMessage] = useState("");

  // Fetch conversations
  useEffect(() => {
    if (token) {
      axios
        .get("http://localhost:5000/messages/inbox", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setConversations(res.data))
        .catch((err) => console.error(err));
    }
  }, [token]);

  // Fetch messages with a selected user
  const fetchMessages = (user) => {
    setSelectedUser(user);
    axios
      .get(`http://localhost:5000/messages/conversation/${user.user_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setMessages(res.data))
      .catch((err) => console.error(err));
  };

  // Send message
  const sendMessage = () => {
    if (newMessage.trim() === "" || !selectedUser) return;

    axios
      .post(
        "http://localhost:5000/messages/send",
        {
          receiver_id: selectedUser.user_id,
          content: newMessage,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then(() => {
        setMessages([...messages, { content: newMessage, sender_id: userId }]);
        setNewMessage("");
      })
      .catch((err) => console.error(err));
  };

  return (
    <>
      {/* Floating Chat Icon (if closed) */}
      {!isOpen && (
        <button
          className="messenger-icon"
          onClick={() => setIsOpen(true)}
        >
          <FaComments size={24} />
        </button>
      )}

      {/* Messenger Box (if open) */}
      {isOpen && (
        <div className="messenger-box">
          {/* Header */}
          <div className="messenger-header">
            <span>Messenger</span>
            <button onClick={() => setIsOpen(false)} className="close-button">
              ✕
            </button>
          </div>

          {/* Conversation List / Chat Box */}
          {!selectedUser ? (
            <div className="conversation-list">
              {conversations.length === 0 ? (
                <p className="empty">No messages yet</p>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.sender_id}
                    onClick={() => fetchMessages(conv)}
                    className="conversation"
                  >
                    {conv.sender_name || `User ${conv.sender_id}`}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="chat-area">
              {/* Messages */}
              <div className="messages">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={
                      msg.sender_id === userId
                        ? "message sent"
                        : "message received"
                    }
                  >
                    {msg.content}
                  </div>
                ))}
              </div>

              {/* Message Input */}
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
