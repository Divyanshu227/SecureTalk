import { useEffect, useState } from "react";
import { fetchChats, createChat, fetchUsers } from "../api/chat";
import type { Chat as ChatType } from "../types";
import { getLocalChats, saveChatsLocally, getLocalMessages, getMyPrivateKey } from "../db/localDb";
import { decryptMessage } from "../utils/crypto";
import ChatList from "../components/ChatList.tsx";
import ChatWindow from "../components/ChatWindow.tsx";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../auth/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { useNavigate } from "react-router-dom";

const Chat = () => {
  const [chats, setChats] = useState<ChatType[]>([]);
  const [activeChat, setActiveChat] = useState<ChatType | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [users, setUsers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { logout } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();

  const loadChats = async () => {
    try {
      console.log("Loading chats from local DB...");
      const localChats = await getLocalChats();
      if (localChats && localChats.length > 0) {
        setChats(localChats);
      }

      console.log("Fetching chats from server...");
      const data = await fetchChats();
      console.log("Chats loaded from server:", data);
      
      // Decrypt last messages or pull from local DB
      const privateKey = await getMyPrivateKey();
      for (const c of data) {
        const localMsgs = await getLocalMessages(c.id);
        if (localMsgs && localMsgs.length > 0) {
          c.lastMessage = localMsgs[localMsgs.length - 1].content;
        } else if (c.lastMessage && privateKey) {
          try {
            const decrypted = await decryptMessage(c.lastMessage, privateKey);
            if (decrypted !== "[Encrypted Message - Decryption Failed]") {
              c.lastMessage = decrypted;
            } else {
              c.lastMessage = "Encrypted message";
            }
          } catch {
            c.lastMessage = "Encrypted message";
          }
        }
      }

      // Update local storage and state with fresh data
      await saveChatsLocally(data);
      setChats(data);
      setActiveChat(current => {
        if (!current) return current;
        return data.find(c => c.id === current.id) || current;
      });
    } catch (err) {
      console.error("Failed to load chats", err);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch {
      console.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (activeChat) {
      const timer = setTimeout(() => {
        console.log("Active chat changed - reloading chat list");
        loadChats();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeChat?.id]);

  // Listen for messages to refresh chat list in real-time
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log("Socket not ready:", { socket: !!socket, isConnected });
      return;
    }

    console.log("✅ [Chat.tsx] Listening for message_update");

    // Listen for sidebar updates - global message updates
    const handleMessageUpdate = () => {
      console.log("📨 [Chat.tsx] message_update event - reloading sidebar");
      // Refresh chats to update last message and timestamps
      loadChats();
    };

    socket.on("message_update", handleMessageUpdate);

    return () => {
      socket.off("message_update", handleMessageUpdate);
      console.log("Message update listener cleaned up");
    };
  }, [socket, isConnected]);

  const handleNewChat = async (userId: number) => {
    try {
      const { chatId } = await createChat(userId);
      const data = await fetchChats();
      
      const privateKey = await getMyPrivateKey();
      for (const c of data) {
        const localMsgs = await getLocalMessages(c.id);
        if (localMsgs && localMsgs.length > 0) {
          c.lastMessage = localMsgs[localMsgs.length - 1].content;
        } else if (c.lastMessage && privateKey) {
          try {
            const decrypted = await decryptMessage(c.lastMessage, privateKey);
            if (decrypted !== "[Encrypted Message - Decryption Failed]") c.lastMessage = decrypted;
            else c.lastMessage = "Encrypted message";
          } catch { c.lastMessage = "Encrypted message"; }
        }
      }

      await saveChatsLocally(data);
      setChats(data);
      setShowNewChatModal(false);
      const newChat = data.find(c => c.id === chatId);
      if (newChat) {
        setActiveChat(newChat);
      }
    } catch {
      console.error("Failed to create chat");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h3 style={{ margin: 0 }}>Chats</h3>
            <ThemeToggle />
          </div>
          <button
            onClick={() => {
              loadUsers();
              setShowNewChatModal(true);
            }}
          >
            + New Chat
          </button>
          <button onClick={handleLogout} className="secondary" style={{ marginTop: "8px" }}>
            Logout
          </button>
        </div>
        <ChatList
          chats={chats}
          activeChat={activeChat}
          onSelect={setActiveChat}
        />
      </div>
      <ChatWindow chat={activeChat} onMessageSent={loadChats} />

      {showNewChatModal && (
        <>
          <div className="edit-dialog-overlay" onClick={() => setShowNewChatModal(false)} />
          <div className="edit-dialog" style={{ minWidth: "350px" }}>
            <h3>Start a New Chat</h3>
            {loadingUsers ? (
              <p style={{ textAlign: "center", color: "#999" }}>Loading users...</p>
            ) : users.length === 0 ? (
              <p style={{ textAlign: "center", color: "#999" }}>No other users available</p>
            ) : (
              <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "16px" }}>
                {users.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleNewChat(user.id)}
                    style={{
                      padding: "12px",
                      borderBottom: "1px solid #e0e0e0",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ fontWeight: "600", marginBottom: "2px" }}>{user.name}</div>
                    <div style={{ fontSize: "0.85em", color: "#999" }}>{user.email}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="edit-dialog-actions">
              <button className="secondary" onClick={() => setShowNewChatModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Chat;
