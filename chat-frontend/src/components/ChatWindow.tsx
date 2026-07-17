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
import { getLocalMessages, saveMessagesLocally, saveSingleMessageLocally, type LocalMessage } from "../db/localDb";

interface Props {
  chat: Chat | null;
  onMessageSent?: () => void;
}

const ChatWindow = ({ chat, onMessageSent }: Props) => {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
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
      // First, load from local DB
      const localMsgs = await getLocalMessages(chat.id);
      if (localMsgs && localMsgs.length > 0) {
        setMessages(localMsgs);
        scrollToBottom();
      }

      // Then background sync with server
      const data = await fetchMessages(chat.id);
      await saveMessagesLocally(chat.id, data);
      
      const updatedLocalMsgs = await getLocalMessages(chat.id);
      setMessages(updatedLocalMsgs);
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
    if (isConnected) {
      socket.emit("join_chat", String(chat.id));
      console.log("Joined chat (re-emit)", chat.id);
    }

    // Listen for incoming messages from other users in real-time
    const handleReceiveMessage = (data: {
      chatId: number;
      senderId: number;
      receiverId: number;
      content: string;
      timestamp?: string;
      created_at?: string;
      id?: number;
    }) => {
      console.log("Received message event:", data);

      if (Number(data.chatId) !== Number(chat.id)) return;

      // Add message to UI immediately without reloading
      const isMyMessage = Number(data.senderId) === Number(user?.id);

      const newMessage: LocalMessage = {
        id: data.id || Date.now(),
        chatId: chat.id,
        senderId: data.senderId,
        receiverId: isMyMessage ? chat.otherUser.id : (user?.id || 0),
        content: data.content,
        created_at: data.created_at || data.timestamp,
        syncStatus: 'synced',
      };
      
      // Save it locally too
      saveSingleMessageLocally(chat.id, newMessage);

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
  }, [socket, chat?.id, isConnected]);

  const handleSend = async () => {
    if (!text.trim() || !chat) return;

    const messageText = text.trim();
    setText("");

    try {
      // Create pending message
      const tempId = Date.now();
      const pendingMsg: LocalMessage = {
        id: tempId,
        chatId: chat.id,
        senderId: user?.id || 0,
        receiverId: chat.otherUser.id,
        content: messageText,
        created_at: new Date().toISOString(),
        issent: true,
        syncStatus: 'pending'
      };
      
      await saveSingleMessageLocally(chat.id, pendingMsg, 'pending');
      setMessages((prev) => [...prev, pendingMsg]);
      scrollToBottom();

      // Send via API to persist the message
      const newMsg = await sendMessage(chat.id, messageText);
      console.log("✅ Message sent and saved:", newMsg);

      // Save real message, we should ideally delete the pending one from db 
      // but for simplicity we'll just reload the messages or update it.
      await saveSingleMessageLocally(chat.id, newMsg, 'synced');
      const updatedLocalMsgs = await getLocalMessages(chat.id);
      // Remove temp from local state
      setMessages(updatedLocalMsgs.filter(m => m.id !== tempId));

      onMessageSent?.();
      scrollToBottom();

      // Broadcast to other users via socket for real-time delivery
      if (socket && isConnected) {
        console.log("📤 [ChatWindow] ABOUT TO emit message_persisted");
        console.log("   Socket ID:", socket.id);
        console.log("   Chat ID:", chat.id);
        console.log("   Message ID:", newMsg.id);

        socket.emit("message_persisted", {
          chatId: chat.id,
          messageData: {
            id: newMsg.id,
            senderId: newMsg.senderId,
            receiverId: chat.otherUser.id,
            content: newMsg.content,
            created_at: newMsg.created_at,
          },
        });

        console.log("✅ [ChatWindow] message_persisted event emitted");
      } else {
        console.warn("⚠️ Socket not ready:", { socket: !!socket, isConnected });
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
            {/* Messages array is already sorted by timestamp (oldest first) */}
            {/* Each message includes isSent flag from database */}
            {messages.map((msg) => {
              // Database has already computed isSent:
              // isSent = true if sender_id equals current user id (RHS - right side)
              // isSent = false if sender_id is different (LHS - left side)
              console.log(`Message ${msg.id} from sender ${msg.senderId} (current user ${user?.id}) isSent flag: ${msg.issent}`);
              console.log(msg);
              const isSent = msg.issent ?? (Number(msg.senderId) === Number(user?.id));

              // Log for debugging to verify the logic
              console.log(`Message ${msg.id}: ${isSent ? "SENT (RHS)" : "RECEIVED (LHS)"}, Content="${msg.content.substring(0, 20)}..."`);

              // Render message with appropriate styling
              // CSS class "sent" positions on right, "received" positions on left
              return (
                <div
                  key={msg.id}
                  className={`message ${isSent ? "sent" : "received"}`}
                  style={{
                    justifyContent: isSent ? "flex-end" : "flex-start",
                  }}
                >
                  <div className="message-bubble">
                    <div className="message-content">
                      {msg.content}
                      {msg.syncStatus === 'pending' && <span style={{fontSize: '0.8em', marginLeft: '5px'}}>⏳</span>}
                    </div>
                    <div className="message-time">
                      {new Date(msg.created_at || "").toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {/* Only show edit/delete buttons for messages sent by current user */}
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
