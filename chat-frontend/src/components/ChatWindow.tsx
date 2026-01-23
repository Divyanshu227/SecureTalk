import { useEffect, useState, useRef } from "react";
import type { Chat, Message } from "../types";
import {
  fetchMessages,
  sendMessage,
  editMessage,
  deleteMessage,
} from "../api/message";
import { useAuth } from "../auth/AuthContext";
import { useSocket } from "../contexts/SocketContext";

interface Props {
  chat: Chat | null;
  onMessageSent?: () => void;
}

const ChatWindow = ({ chat, onMessageSent }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastChatIdRef = useRef<number | null>(null);
  const wasConnectedRef = useRef(false);

  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    if (!chat) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchMessages(chat.id);
      setMessages(data);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Failed to load messages", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [chat?.id]);

  // Join chat room when chat changes or socket reconnects
  useEffect(() => {
    if (socket && chat && isConnected) {
      socket.emit("join_chat", String(chat.id));
      
      // Reload messages only on reconnect (when wasConnected was false and now is true)
      // or when chat changes
      const chatChanged = lastChatIdRef.current !== chat.id;
      const reconnected = !wasConnectedRef.current && isConnected;
      
      if (chatChanged || reconnected) {
        loadMessages();
        lastChatIdRef.current = chat.id;
      }
      
      wasConnectedRef.current = isConnected;
    } else if (!isConnected) {
      wasConnectedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, chat?.id, isConnected]);

  // Listen for real-time messages from all users
  useEffect(() => {
    if (!socket || !chat) return;

    const handleReceiveMessage = (data: { chatId: number; senderId: number; content: string }) => {
      if (data.chatId !== chat.id) return;

      // Reload messages to get the complete list with proper IDs from backend
      // This handles both messages from other users and our own messages sent via socket
      loadMessages();
    };

    socket.on("receive_message", handleReceiveMessage);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, chat?.id]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || !chat || !user) return;

    const messageText = text.trim();
    setText("");

    try {
      // Send message via API (primary method - ensures persistence)
      const msg = await sendMessage(chat.id, messageText);

      // Also emit via socket for real-time delivery to other users
      if (socket && isConnected) {
        socket.emit("send_message", {
          chatId: chat.id,
          content: messageText,
        });
      }

      // Update UI with the message from API response
      // This ensures we have the correct ID and timestamp from backend
      setMessages((prev) => {
        // Check if this exact message already exists to avoid duplicates
        const exists = prev.some((m) => m.id === msg.id);
        if (exists) return prev;
        return [...prev, msg];
      });

      onMessageSent?.();
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Failed to send message", error);
      setText(messageText); // Restore text on error
    }
  };

  const handleEdit = async (messageId: number) => {
    if (!editText.trim() || !chat) return;

    try {
      const updated = await editMessage(chat.id, messageId, editText);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? updated : msg))
      );
      setEditingId(null);
      setEditText("");
    } catch {
      console.error("Failed to edit message");
    }
  };

  const handleDelete = async (messageId: number) => {
    if (!chat) return;

    try {
      await deleteMessage(chat.id, messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch {
      console.error("Failed to delete message");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!chat) {
    return <div className="chat-empty">Select a chat to start messaging</div>;
  }

  return (
    <div className="chat-main">
      <div className="chat-header">
        <h3>{chat.otherUser.name}</h3>
        <span style={{ fontSize: "0.9em", opacity: 0.8 }}>
          {chat.otherUser.email}
        </span>
      </div>

      <div className="chat-messages" ref={messagesContainerRef}>
        {loading ? (
          <div className="chat-empty">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">No messages yet. Start the conversation!</div>
        ) : (
          <>
            {messages.map((msg) => {
              const isSent = msg.senderId === user?.id || Number(msg.senderId) === user?.id;
              return (
              <div
                key={msg.id}
                className={`message ${isSent ? "sent" : "received"}`}
              >
                <div className="message-bubble">
                  <div className="message-content">{msg.content}</div>
                  <div className="message-time">
                    {new Date(msg.created_at || "").toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                {isSent && (
                  <div className="message-actions">
                    <button
                      className="secondary"
                      onClick={() => {
                        setEditingId(msg.id);
                        setEditText(msg.content);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="danger"
                      onClick={() => handleDelete(msg.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {editingId && (
        <>
          <div
            className="edit-dialog-overlay"
            onClick={() => setEditingId(null)}
          />
          <div className="edit-dialog">
            <h3>Edit Message</h3>
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleEdit(editingId);
                }
              }}
              autoFocus
            />
            <div className="edit-dialog-actions">
              <button
                className="secondary"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleEdit(editingId);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}

      <div className="chat-input-area">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default ChatWindow;
