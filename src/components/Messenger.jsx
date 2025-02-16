import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaComments, FaPaperPlane } from "react-icons/fa";

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
    <div className="fixed bottom-5 right-5 z-50">
      {/* Floating Chat Icon */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition"
        >
          <FaComments size={24} />
        </button>
      )}

      {/* Messenger Box */}
      {isOpen && (
        <div className="w-80 h-96 bg-white shadow-lg rounded-lg flex flex-col">
          {/* Header */}
          <div className="p-3 bg-blue-600 text-white flex justify-between">
            <span>Messenger</span>
            <button onClick={() => setIsOpen(false)} className="text-sm">
              ✕
            </button>
          </div>

          {/* Conversation List / Chat Box */}
          {!selectedUser ? (
            <div className="flex-1 overflow-auto p-2">
              {conversations.length === 0 ? (
                <p className="text-center text-gray-500">No messages yet</p>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.sender_id}
                    onClick={() => fetchMessages(conv)}
                    className="p-2 border-b cursor-pointer hover:bg-gray-100"
                  >
                    {conv.sender_name || `User ${conv.sender_id}`}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-auto p-2">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-2 my-1 rounded ${
                      msg.sender_id === userId ? "bg-blue-500 text-white ml-auto" : "bg-gray-200"
                    } max-w-xs`}
                  >
                    {msg.content}
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <div className="p-2 border-t flex">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 p-2 border rounded"
                  placeholder="Type a message..."
                />
                <button
                  onClick={sendMessage}
                  className="ml-2 bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
                >
                  <FaPaperPlane />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Messenger;