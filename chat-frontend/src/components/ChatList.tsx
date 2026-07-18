import type { Chat } from "../types/chat";
import type { User } from "../types";

interface Props {
  chats: Chat[];
  activeChat: Chat | null;
  onSelect: (chat: Chat) => void;
  onChatCreated?: () => void;
  globalUsers?: User[];
  isSearchingGlobal?: boolean;
  onGlobalUserSelect?: (user: User) => void;
  searchQuery?: string;
}

const ChatList = ({ chats, activeChat, onSelect, globalUsers = [], isSearchingGlobal = false, onGlobalUserSelect, searchQuery = "" }: Props) => {
  return (
    <div className="chat-list-scroll">
      {chats.length === 0 && searchQuery.length === 0 ? (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "#999",
            fontSize: "0.95em",
          }}
        >
          No chats yet. Start a conversation!
        </div>
      ) : chats.length === 0 && searchQuery.length > 0 ? (
        <div style={{ padding: "10px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
          No local chats match
        </div>
      ) : (
        chats.map((chat) => (
          <div
            key={chat.id}
            className={`chat-list-item ${activeChat?.id === chat.id ? "active" : ""}`}
            onClick={() => onSelect(chat)}
          >
            <div className="user-avatar" style={{ background: "linear-gradient(135deg, #FF6B6B, #8B3DFF)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", width: "44px", height: "44px", flexShrink: 0, fontSize: "1.2rem" }}>
              {chat.otherUser.name?.[0]?.toUpperCase()}
            </div>
            <div className="chat-item-content">
              <div className="chat-item-header">
                <span className="chat-item-name">{chat.otherUser.name}</span>
                <span className="chat-item-time">
                  {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}
                </span>
              </div>
              <div className="chat-item-header" style={{ marginBottom: 0 }}>
                <span className="chat-item-preview">
                  {chat.lastMessage ? (chat.lastMessage.startsWith("[MEDIA]:") ? "📷 Media" : chat.lastMessage) : "Start a conversation"}
                </span>
              </div>
            </div>
          </div>
        ))
      )}

      {searchQuery.length > 0 && (
        <div style={{ marginTop: "16px", paddingTop: "8px", borderTop: "1px solid var(--border-color)" }}>
          <div style={{ padding: "8px 16px", fontSize: "0.8rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
            Global Search
          </div>
          
          {isSearchingGlobal ? (
            <div style={{ padding: "12px", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.9rem" }}>Searching...</div>
          ) : globalUsers.length === 0 ? (
            <div style={{ padding: "12px", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.9rem" }}>No global users found</div>
          ) : (
            globalUsers.map(u => (
              <div 
                key={`global-${u.id}`}
                className="chat-list-item"
                onClick={() => onGlobalUserSelect && onGlobalUserSelect(u)}
              >
                <div className="user-avatar" style={{ background: "linear-gradient(135deg, #FF6B6B, #8B3DFF)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", width: "44px", height: "44px", flexShrink: 0 }}>
                  {u.name?.[0]?.toUpperCase()}
                </div>
                <div className="chat-item-content">
                  <div className="chat-item-header">
                    <span className="chat-item-name">{u.name}</span>
                  </div>
                  <div className="chat-item-header" style={{ marginBottom: 0 }}>
                    <span className="chat-item-preview">@{u.username}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ChatList;
