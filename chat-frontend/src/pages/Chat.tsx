import { useEffect, useState } from "react";
import { fetchChats, createChat } from "../api/chat";
import type { Chat as ChatType } from "../types";
import { getLocalChats, saveChatsLocally, getLocalMessages, getMyPrivateKey } from "../db/localDb";
import { decryptMessage } from "../utils/crypto";
import ChatList from "../components/ChatList.tsx";
import ChatWindow from "../components/ChatWindow.tsx";

import { useAuth } from "../auth/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { useNavigate } from "react-router-dom";
import { usePushNotifications } from "../hooks/usePushNotifications";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<User[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const { logout, user } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  
  usePushNotifications();

  // Debounced global search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        setIsSearchingGlobal(true);
        try {
          const { searchUsers } = await import("../api/auth");
          const res = await searchUsers(searchQuery);
          setGlobalSearchResults(res);
        } catch (err) {
          console.error(err);
        } finally {
          setIsSearchingGlobal(false);
        }
      } else {
        setGlobalSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

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
    const handleMessageUpdate = (data: any) => {
      console.log("📨 [Chat.tsx] message_update event - reloading sidebar");
      // Refresh chats to update last message and timestamps
      loadChats();
      
      if (data && data.senderId && user && data.senderId !== user.id) {
        import("../utils/sound").then(module => module.playNotificationSound());
        socket.emit("mark_delivered", { messageId: data.id, chatId: data.chatId });
      }
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

  const filteredChats = chats.filter(chat => {
    const query = searchQuery.toLowerCase();
    const name = chat.otherUser.name?.toLowerCase() || "";
    const email = chat.otherUser.email?.toLowerCase() || "";
    return name.includes(query) || email.includes(query);
  });

  const filteredGlobalUsers = globalSearchResults.filter(u => 
    !chats.some(c => c.otherUser.id === u.id)
  );

  return (
    <div className="app-layout">
      <div className={`app-sidebar ${activeChat ? "hidden-mobile" : ""}`}>
        <AppSidebar onSettingsClick={() => setShowSettingsModal(true)} />
      </div>

      <div className={`chat-list-panel ${activeChat ? "hidden-mobile" : ""}`}>
        <div className="chat-list-header">
          <h2>Chats <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg></h2>
          <button className="icon-btn" title="Search Users" onClick={() => setShowSearchModal(true)}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
        </div>

        <div className="search-box">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text-tertiary)" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Search chats or users..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <ChatList
          chats={filteredChats}
          activeChat={activeChat}
          onSelect={setActiveChat}
          searchQuery={searchQuery}
          globalUsers={filteredGlobalUsers}
          isSearchingGlobal={isSearchingGlobal}
          onGlobalUserSelect={(u) => {
            setSelectedUser(u);
            setShowProfileModal(true);
          }}
        />
        
        <div className="user-profile-bottom" onClick={handleLogout}>
          <div className="user-avatar" style={{ background: "linear-gradient(135deg, #FF6B6B, #8B3DFF)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", width: "40px", height: "40px", position: "relative" }}>
            {user?.name?.[0]?.toUpperCase()}
            <div className="online-indicator"></div>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--success-green)" }}>Online</span>
          </div>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text-tertiary)" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      <div className={`chat-window ${!activeChat ? "hidden-mobile" : ""}`}>
        <ChatWindow chat={activeChat} onMessageSent={loadChats} onBack={() => setActiveChat(null)} />
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
