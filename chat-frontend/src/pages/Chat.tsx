import { useEffect, useState } from "react";
import { fetchChats, createChat } from "../api/chat";
import type { Chat as ChatType } from "../types";
import { getLocalChats, saveChatsLocally, getLocalMessages, getMyPrivateKey } from "../db/localDb";
import { decryptMessage } from "../utils/crypto";
import ChatList from "../components/ChatList.tsx";
import ChatWindow from "../components/ChatWindow.tsx";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../auth/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { useNavigate } from "react-router-dom";
import SearchModal from "../components/SearchModal";
import ProfileModal from "../components/ProfileModal";
import InboxModal from "../components/InboxModal";
import SettingsModal from "../components/SettingsModal";
import type { User } from "../types";

const Chat = () => {
  const [chats, setChats] = useState<ChatType[]>([]);
  const [activeChat, setActiveChat] = useState<ChatType | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { logout, user } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();

  const loadChats = async () => {
    try {
      if (user) {
        // No more self-healing key generation here.
        // Key generation and decryption is entirely handled in Login.tsx & Register.tsx
        // to ensure cross-device consistency and password-based encryption.
      }

      console.log("Loading chats from local DB...");
      const localChats = await getLocalChats();
      if (localChats && localChats.length > 0) {
        setChats(localChats);
      }

      console.log("Fetching chats from server...");
      const data = await fetchChats();
      console.log("Chats loaded from server:", data);
      
      // Decrypt last messages or pull from local DB
      const privateKey = user ? await getMyPrivateKey(user.id) : undefined;
      for (const c of data) {
        const localMsgs = await getLocalMessages(c.id);
        if (localMsgs && localMsgs.length > 0) {
          c.lastMessage = localMsgs[localMsgs.length - 1].content;
        } else if (c.lastMessage && privateKey) {
          try {
            const decrypted = await decryptMessage(c.lastMessage, privateKey);
            c.lastMessage = decrypted;
          } catch (err: any) {
            const originalText = c.lastMessage;
            c.lastMessage = "Encrypted message";
            socket?.emit("client_error", { context: "Chat.tsx loadChats", message: err.message, stack: err.stack, content: originalText });
          }
        }
      }

      // Update local storage and state with fresh data
      await saveChatsLocally(data);
      setChats(data);
      setActiveChat(current => {
        if (!current) return current;
        const updated = data.find(c => c.id === current.id);
        if (!updated) return current;
        // Only update if the public key changed (avoids triggering ChatWindow reload for sidebar updates)
        if (updated.otherUser.public_key === current.otherUser.public_key) {
          return current; // Keep the same reference — no re-render in ChatWindow
        }
        return updated;
      });
    } catch (err) {
      console.error("Failed to load chats", err);
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
      
      const privateKey = user ? await getMyPrivateKey(user.id) : undefined;
      for (const c of data) {
        const localMsgs = await getLocalMessages(c.id);
        if (localMsgs && localMsgs.length > 0) {
          c.lastMessage = localMsgs[localMsgs.length - 1].content;
        } else if (c.lastMessage && privateKey) {
          try {
            const decrypted = await decryptMessage(c.lastMessage, privateKey);
            c.lastMessage = decrypted;
          } catch (err: any) {
            const originalText = c.lastMessage;
            c.lastMessage = "Encrypted message";
            socket?.emit("client_error", { context: "Chat.tsx handleNewChat", message: err.message, stack: err.stack, content: originalText });
          }
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
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
            <button onClick={() => setShowSearchModal(true)} style={{ flex: 1 }}>
              Search
            </button>
            <button onClick={() => setShowInboxModal(true)} style={{ flex: 1 }}>
              Inbox
            </button>
            <button onClick={() => setShowSettingsModal(true)} style={{ flex: 1 }} className="secondary">
              Settings
            </button>
          </div>
          <button onClick={handleLogout} className="secondary" style={{ marginTop: "8px", width: "100%" }}>
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

      {showSearchModal && (
        <SearchModal
          onClose={() => setShowSearchModal(false)}
          onUserSelect={(u) => {
            setSelectedUser(u);
            setShowSearchModal(false);
            setShowProfileModal(true);
          }}
        />
      )}
      
      {showProfileModal && selectedUser && (
        <ProfileModal
          user={selectedUser}
          onClose={() => setShowProfileModal(false)}
          onMessage={(userId) => {
            setShowProfileModal(false);
            handleNewChat(userId);
          }}
        />
      )}

      {showInboxModal && (
        <InboxModal onClose={() => setShowInboxModal(false)} />
      )}

      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
    </div>
  );
};

export default Chat;
