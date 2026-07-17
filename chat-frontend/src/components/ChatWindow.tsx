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
import { getLocalMessages, saveMessagesLocally, saveSingleMessageLocally, deleteMessageLocally, type LocalMessage, getMyPrivateKey } from "../db/localDb";
import { encryptMessage, decryptMessage } from "../utils/crypto";

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
      
      // Decrypt messages from server
      const privateKey = user ? await getMyPrivateKey(user.id) : undefined;
      const decryptedData = await Promise.all(data.map(async (msg: Message) => {
        const isMyMessage = Number(msg.senderId) === Number(user?.id);
        
        // If it's our own message, we can't decrypt it (it's encrypted for the recipient).
        // Use the local plaintext version if available.
        if (isMyMessage) {
           const localMsg = localMsgs?.find(m => m.id === msg.id);
           if (localMsg) return localMsg;
           return { ...msg, content: "[Sent Message - Ciphertext]" };
        }
        
        // If it's from the other user, decrypt it
        if (privateKey) {
          try {
             const decryptedContent = await decryptMessage(msg.content, privateKey);
             return { ...msg, content: decryptedContent };
          } catch(err: any) {
             socket?.emit("client_error", { context: "ChatWindow.tsx loadMessages", message: err.message, stack: err.stack, content: msg.content });
          }
        }
        return msg; // Fallback to plaintext if decryption fails (e.g. old messages)
      }));

      await saveMessagesLocally(chat.id, decryptedData as Message[]);
      
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
      if (isMyMessage) {
        return; // We already added our own message locally in handleSend
      }

      const processIncomingMessage = async () => {
        let finalContent = data.content;
        const privateKey = user ? await getMyPrivateKey(user.id) : undefined;
        if (privateKey) {
          try {
            const decryptedContent = await decryptMessage(data.content, privateKey);
            finalContent = decryptedContent;
          } catch (err: any) {
            console.error("Socket message decryption failed", err);
            socket?.emit("client_error", { context: "ChatWindow.tsx processIncomingMessage", message: err.message, stack: err.stack, content: data.content });
          }
        }

        const newMessage: LocalMessage = {
          id: data.id || Date.now(),
          chatId: chat.id,
          senderId: data.senderId,
          receiverId: user?.id || 0,
          content: finalContent,
          created_at: data.created_at || data.timestamp,
          syncStatus: 'synced',
        };
        
        // Save it locally too
        await saveSingleMessageLocally(chat.id, newMessage);

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
      
      processIncomingMessage();
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

      // Get recipient public key
      const recipientPublicKey = chat.otherUser.public_key;
      let finalContentToSend = messageText;
      
      if (recipientPublicKey) {
         finalContentToSend = await encryptMessage(messageText, recipientPublicKey);
      } else {
         console.warn("Recipient has no public key, sending plaintext!");
      }

      // Send via API to persist the message (sends encrypted text)
      const newMsg = await sendMessage(chat.id, finalContentToSend);
      console.log("✅ Message sent and saved:", newMsg);

      // Save real message locally using our PLAINTEXT
      const localSyncedMsg = { ...newMsg, content: messageText };
      await saveSingleMessageLocally(chat.id, localSyncedMsg, 'synced');
      
      // Remove temp from local DB and state
      await deleteMessageLocally(tempId);
      const updatedLocalMsgs = await getLocalMessages(chat.id);
      setMessages(updatedLocalMsgs);

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
        prev.map((msg) => (msg.id === messageId ? { ...msg, ...updated } : msg))
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
      // Delete locally first (optimistic UI update)
      await deleteMessageLocally(messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));

      try {
        // Delete from server
        await deleteMessage(chat.id, messageId);
      } catch (err: any) {
        // If it's 404 (already deleted from server), ignore the error
        if (err?.response?.status !== 404) {
          throw err;
        }
      }
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
                      {new Date(msg.created_at || "").toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Kolkata"
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
