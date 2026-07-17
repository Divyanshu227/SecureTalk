import type { Chat } from "../types/chat";

interface Props {
  chats: Chat[];
  activeChat: Chat | null;
  onSelect: (chat: Chat) => void;
  onChatCreated?: () => void;
}

const ChatList = ({ chats, activeChat, onSelect }: Props) => {
  return (
    <div className="chat-list-scroll">
      {chats.length === 0 ? (
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
      ) : (
        chats.map((chat) => (
          <div
            key={chat.id}
            className={`chat-list-item ${activeChat?.id === chat.id ? "active" : ""}`}
            onClick={() => onSelect(chat)}
          >
            <div className="user-avatar" style={{ background: "linear-gradient(135deg, #FF6B6B, #8B3DFF)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
              {chat.otherUser.name?.[0]?.toUpperCase()}
            </div>
            <div className="chat-item-content">
              <div className="chat-item-header">
                <span className="chat-item-name">{chat.otherUser.name}</span>
                <span className="chat-item-time">10:28 AM</span>
              </div>
              <div className="chat-item-preview">
                {chat.lastMessage ?? "No messages yet"}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ChatList;
