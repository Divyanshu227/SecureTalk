import { useEffect, useState, useRef, useCallback } from "react";
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

  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  }, []);

  const loadMessages = useCallback(async () => {
    if (!chat) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchMessages(chat.id);
      // Ensure messages are sorted by timestamp
      const sortedMessages = [...data].sort((a, b) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeA - timeB;
      });
      setMessages(sortedMessages);
      scrollToBottom();
    } catch (error) {
      console.error("Failed to load messages", error);
    } finally {
      setLoading(false);
    }
  }, [chat, scrollToBottom]);

  // Load messages when chat changes
  useEffect(() => {
    loadMessages();
  }, [chat?.id, loadMessages]);

  // Join chat room and listen for messages
  useEffect(() => {
    if (!socket || !chat) {
      return;
    }

    // Join the chat room
    socket.emit("join_chat", String(chat.id));
    console.log("Joined chat", chat.id);

    // Listen for incoming messages from other users in real-time
    const handleReceiveMessage = (data: { 
      chatId: number; 
      senderId: number; 
      content: string;
      timestamp?: string;
      created_at?: string;
      id?: number;
    }) => {
      console.log("Received message event:", data);
      
      if (data.chatId !== chat.id) return;

      // Add message to UI immediately without reloading
      const newMessage: Message = {
        id: data.id || Date.now(),
        senderId: data.senderId,
        content: data.content,
        created_at: data.created_at || data.timestamp,
      };

      setMessages((prev) => {
        // Check if message already exists (don't add duplicates)
        if (prev.some(msg => msg.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
      
      // Scroll to bottom after state update
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 0);
    };

    socket.on("receive_message", handleReceiveMessage);
    console.log("Socket listener registered for chat", chat.id);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      console.log("Socket listener removed for chat", chat.id);
      socket.emit("leave_chat", String(chat.id));
    };
  }, [socket, chat?.id]);

  const handleSend = async () => {
    if (!text.trim() || !chat) return;

    const messageText = text.trim();
    setText("");

    try {
      // Send via API to persist the message
      const newMsg = await sendMessage(chat.id, messageText);
      console.log("✅ Message sent and saved:", newMsg);

      // Update local state immediately with the API response
      setMessages((prev) => [...prev, newMsg]);
      onMessageSent?.();
      scrollToBottom();

      // Broadcast to other users via socket for real-time delivery
      if (socket && isConnected) {
        console.log("📤 Emitting message_persisted to server:", {
          chatId: chat.id,
          messageData: {
            id: newMsg.id,
            senderId: newMsg.senderId,
            content: newMsg.content,
            created_at: newMsg.created_at,
          },
        });
        socket.emit("message_persisted", {
          chatId: chat.id,
          messageData: {
            id: newMsg.id,
            senderId: newMsg.senderId,
            content: newMsg.content,
            created_at: newMsg.created_at,
          },
        });
      }
    } catch (error) {
      console.error("Failed to send message", error);
      setText(messageText);
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
              // Normalize IDs to numbers for consistent comparison
              const senderId = Number(msg.senderId);
              const currentUserId = Number(user?.id);
              const isSent = senderId === currentUserId;
              
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
