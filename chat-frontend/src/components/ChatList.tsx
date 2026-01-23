import type { Chat } from "../types/chat";

interface Props {
  chats: Chat[];
  activeChat: Chat | null;
  onSelect: (chat: Chat) => void;
  onChatCreated?: () => void;
}

const ChatList = ({ chats, activeChat, onSelect }: Props) => {
  return (
    <div className="chat-list">
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
            className={`chat-item ${activeChat?.id === chat.id ? "active" : ""}`}
            onClick={() => onSelect(chat)}
          >
            <div className="chat-item-name">{chat.otherUser.name}</div>
            <div className="chat-item-preview">
              {chat.lastMessage ?? "No messages yet"}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ChatList;
