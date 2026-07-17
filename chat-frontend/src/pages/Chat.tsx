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
import AppSidebar from "../components/AppSidebar";
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
          } catch (err: unknown) {
            const e = err as { message?: string; stack?: string };
            const originalText = c.lastMessage;
            c.lastMessage = "Encrypted message";
            socket?.emit("client_error", { context: "Chat.tsx loadChats", message: e.message, stack: e.stack, content: originalText });
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
          } catch (err: unknown) {
            const e = err as { message?: string; stack?: string };
            const originalText = c.lastMessage;
            c.lastMessage = "Encrypted message";
            socket?.emit("client_error", { context: "Chat.tsx handleNewChat", message: e.message, stack: e.stack, content: originalText });
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
    <div className="app-layout">
      <AppSidebar onSettingsClick={() => setShowSettingsModal(true)} />

      <div className="chat-list-panel glass-panel">
        <div className="chat-list-header">
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <h2>Chats</h2>
            <ThemeToggle />
          </div>
          <button className="icon-btn" onClick={() => setShowSearchModal(true)}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
        </div>

        <div className="search-box" onClick={() => setShowSearchModal(true)}>
          <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Search by username..." readOnly />
        </div>

        <div className="filter-pills">
          <div className="filter-pill active">All</div>
          <div className="filter-pill" onClick={() => setShowInboxModal(true)}>Inbox</div>
          <div className="filter-pill">Groups</div>
          <div className="filter-pill">DMs</div>
        </div>

        <div className="section-title">Messages</div>
        <ChatList
          chats={chats}
          activeChat={activeChat}
          onSelect={setActiveChat}
        />
        
        <div style={{ padding: "16px" }}>
          <button onClick={handleLogout} className="secondary" style={{ width: "100%", fontSize: "0.85rem" }}>
            Logout
          </button>
        </div>
      </div>

      <div className="chat-window glass-panel">
        <ChatWindow chat={activeChat} onMessageSent={loadChats} />
      </div>

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
