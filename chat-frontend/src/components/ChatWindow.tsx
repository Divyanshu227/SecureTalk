import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Chat, Message } from "../types";
import {
  fetchMessages,
  sendMessage,
  editMessage,
  deleteMessage,
} from "../api/message";
import { useAuth } from "../auth/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { getLocalMessages, saveMessagesLocally, saveSingleMessageLocally, deleteMessageLocally, type LocalMessage, getMyPrivateKey, addToOutbox, getOutboxForChat, removeFromOutbox } from "../db/localDb";
import { encryptMessage, decryptMessage, encryptFile } from "../utils/crypto";
import { uploadFile } from "../api/upload";
import MediaMessage from "./MediaMessage";
import ForwardModal from "./ForwardModal";

interface Props {
  chat: Chat | null;
  onMessageSent: () => void;
  onBack?: () => void;
}

const ChatWindow = ({ chat, onMessageSent, onBack }: Props) => {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, msg: LocalMessage } | null>(null);
  const [replyingTo, setReplyingTo] = useState<LocalMessage | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<LocalMessage | null>(null);

  // Close context menu on clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleContextMenu = (clientX: number, clientY: number, msg: LocalMessage) => {
    let x = clientX;
    let y = clientY;
    if (window.innerWidth - x < 150) x = window.innerWidth - 160;
    if (window.innerHeight - y < 250) y = window.innerHeight - 260;
    setContextMenu({ x, y, msg });
  };

  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  // Drain outbox when connectivity is restored
  useEffect(() => {
    if (!chat) return;

    const syncOutbox = async () => {
      // Don't try to sync if browser knows it's offline
      if (!navigator.onLine) return;
      
      const pending = await getOutboxForChat(chat.id);
      if (pending.length === 0) return;
      console.log(`🔄 Syncing ${pending.length} pending message(s)...`);

      for (const entry of pending) {
        try {
          const newMsg = await sendMessage(chat.id, entry.encryptedContent, entry.senderContent);
          const localSyncedMsg = { ...newMsg, content: entry.plaintext };
          await saveSingleMessageLocally(chat.id, localSyncedMsg, 'synced');
          await deleteMessageLocally(entry.id);
          await removeFromOutbox(entry.id);

          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== entry.id);
            const realMsg: LocalMessage = { ...localSyncedMsg, chatId: chat.id, syncStatus: 'synced', issent: true };
            if (filtered.some(m => m.id === newMsg.id)) return filtered;
            return [...filtered, realMsg];
          });

          if (socket && isConnected) {
            socket.emit("message_persisted", {
              chatId: chat.id,
              messageData: { id: newMsg.id, senderId: newMsg.senderId, receiverId: chat.otherUser.id, content: newMsg.content, created_at: newMsg.created_at },
            });
          }
          console.log(`✅ Synced outbox message ${entry.id}`);
        } catch (err) {
          console.error(`❌ Failed to sync outbox message ${entry.id}:`, err);
        }
      }
      onMessageSent?.();
    };

    // Try sync immediately if we think we are connected
    if (isConnected && navigator.onLine) {
      syncOutbox();
    }

    // Also listen for browser-level network restoration
    window.addEventListener('online', syncOutbox);
    
    // Fallback: poll every 5 seconds in case events fire before network is fully usable
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        syncOutbox();
      }
    }, 5000);
    
    return () => {
      window.removeEventListener('online', syncOutbox);
      clearInterval(intervalId);
    };
  }, [isConnected, chat?.id]);

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
        
        // If it's our own message, try to decrypt senderContent with our own key
        if (isMyMessage) {
           // First try local plaintext copy
           const localMsg = localMsgs?.find(m => m.id === msg.id);
           if (localMsg) return localMsg;
           // Then try decrypting senderContent (self-encrypted copy)
           if (privateKey && msg.senderContent) {
             try {
               const decryptedContent = await decryptMessage(msg.senderContent, privateKey);
               return { ...msg, content: decryptedContent };
             } catch { /* fallthrough */ }
           }
           return { ...msg, content: "[Sent Message - Ciphertext]" };
        }
        
        // If it's from the other user, decrypt it with our private key
        if (privateKey) {
          try {
             const decryptedContent = await decryptMessage(msg.content, privateKey);
             return { ...msg, content: decryptedContent };
          } catch(err: unknown) {
             const e = err as { message?: string; stack?: string };
             socket?.emit("client_error", { context: "ChatWindow.tsx loadMessages", message: e.message, stack: e.stack, content: msg.content });
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
  }, [chat?.id, scrollToBottom, user?.id]);

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
          } catch (err: unknown) {
            const e = err as { message?: string; stack?: string };
            console.error("Socket message decryption failed", err);
            socket?.emit("client_error", { context: "ChatWindow.tsx processIncomingMessage", message: e.message, stack: e.stack, content: data.content });
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

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || text;
    if (!textToSend.trim() || !chat) return;

    const messageTextRaw = textToSend.trim();
    let messageText = messageTextRaw;
    if (replyingTo) {
      const preview = replyingTo.content.substring(0, 40).replace(/\n/g, ' ') + (replyingTo.content.length > 40 ? '...' : '');
      messageText = `[REPLY:${replyingTo.id}:${preview}]:${messageTextRaw}`;
      setReplyingTo(null);
    }
    
    if (!overrideText) setText("");

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

      // Get recipient public key and our own public key
      const recipientPublicKey = chat.otherUser.public_key;
      let finalContentToSend = messageText;
      let senderContentToSend: string | undefined;
      
      if (recipientPublicKey) {
         finalContentToSend = await encryptMessage(messageText, recipientPublicKey);
      } else {
         console.warn("Recipient has no public key, sending plaintext!");
      }

      // Self-encrypt the message so the sender can decrypt it after re-login
      if (user?.public_key) {
        senderContentToSend = await encryptMessage(messageText, user.public_key);
      }

      // Send via API to persist the message (sends encrypted text + self-encrypted copy)
      try {
        const newMsg = await sendMessage(chat.id, finalContentToSend, senderContentToSend);
        console.log("✅ Message sent and saved:", newMsg);

        // Save real message locally using our PLAINTEXT
        const localSyncedMsg = { ...newMsg, content: messageText };
        await saveSingleMessageLocally(chat.id, localSyncedMsg, 'synced');
        
        // Remove temp from state and replace with the real message
        await deleteMessageLocally(tempId);
        setMessages((prev) => {
          const filtered = prev.filter(m => m.id !== tempId);
          const realMsg: LocalMessage = {
            ...localSyncedMsg,
            chatId: chat.id,
            syncStatus: 'synced',
            issent: true,
          };
          if (filtered.some(m => m.id === newMsg.id)) return filtered;
          return [...filtered, realMsg];
        });

        onMessageSent?.();
        scrollToBottom();

        // Broadcast to other users via socket for real-time delivery
        if (socket && isConnected) {
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
        }
      } catch (sendError) {
        // Network failure — save to outbox for retry when back online
        console.warn("⚠️ Send failed, saving to outbox for retry:", sendError);
        await addToOutbox({
          id: tempId,
          chatId: chat.id,
          encryptedContent: finalContentToSend,
          senderContent: senderContentToSend,
          plaintext: messageText,
          created_at: new Date().toISOString(),
        });
        // Keep the pending message visible in UI with ⏳ indicator
      }
    } catch (error) {
      console.error("Failed to prepare message", error);
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
      } catch (err: unknown) {
        // If it's 404 (already deleted from server), ignore the error
        const e = err as { response?: { status?: number } };
        if (e?.response?.status !== 404) {
          throw err;
        }
      }
    } catch {
      console.error("Failed to delete message");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chat) return;

    setUploading(true);
    try {
      // 1. Encrypt file with a one-time AES key
      const { encryptedBlob, aesKeyBase64, ivBase64 } = await encryptFile(file);
      
      // 2. Upload the encrypted blob
      const url = await uploadFile(encryptedBlob, file.name + ".enc");
      
      // 3. Construct media message payload
      const mediaPayload = `[MEDIA]:${url}:${aesKeyBase64}:${ivBase64}:${file.type}:${file.name}`;
      
      // 4. Send as normal message
      await handleSend(mediaPayload);
    } catch (err) {
      console.error("Failed to upload and send file:", err);
      alert("Failed to send file. Please try again.");
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleForward = async (targetChat: Chat) => {
    if (!forwardingMsg) return;
    setUploading(true);
    try {
      let finalContentToSend = forwardingMsg.content;
      let senderContentToSend: string | undefined;
      if (targetChat.otherUser.public_key) {
         finalContentToSend = await encryptMessage(forwardingMsg.content, targetChat.otherUser.public_key);
      }
      if (user?.public_key) {
        senderContentToSend = await encryptMessage(forwardingMsg.content, user.public_key);
      }
      const newMsg = await sendMessage(targetChat.id, finalContentToSend, senderContentToSend);
      const localSyncedMsg = { ...newMsg, content: forwardingMsg.content };
      await saveSingleMessageLocally(targetChat.id, localSyncedMsg, 'synced');
    } catch (err) {
      console.error(err);
      alert("Failed to forward message");
    } finally {
      setUploading(false);
      setForwardingMsg(null);
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
    <>
      <div className="chat-header">
        <div className="chat-header-user">
          {onBack && (
            <button className="icon-btn show-mobile-only" onClick={onBack} style={{ marginRight: "8px" }}>
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
          )}
          <button className="icon-btn" style={{ marginRight: "8px" }} onClick={onBack || (() => {})}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div style={{ position: "relative" }}>
            <div className="user-avatar" style={{ background: "linear-gradient(135deg, #FF6B6B, #8B3DFF)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", width: "40px", height: "40px", fontSize: "1.2rem" }}>
              {chat.otherUser.name?.[0]?.toUpperCase()}
            </div>
            <div className="online-indicator"></div>
          </div>
          <div>
            <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
              {chat.otherUser.name}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent-blue)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Online</div>
          </div>
        </div>
        
        <div className="chat-header-actions">
          <button className="icon-btn"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></button>
          <button className="icon-btn"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
          <button className="icon-btn"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>
          <button className="icon-btn"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg></button>
        </div>
      </div>

      <div className="chat-messages" ref={messagesContainerRef}>
        <div style={{ textAlign: "center", margin: "10px 0" }}>
          <span style={{ background: "rgba(255, 255, 255, 0.05)", padding: "4px 12px", borderRadius: "10px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Today</span>
        </div>

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
              
              let displayContent = msg.content;
              let replyBlock = null;
              if (displayContent.startsWith("[REPLY:")) {
                const match = displayContent.match(/^\[REPLY:(\d+):(.*?)\]:(.*)$/s);
                if (match) {
                  const [, , preview, actualContent] = match;
                  displayContent = actualContent;
                  replyBlock = (
                    <div className="reply-preview-block" style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '8px', marginBottom: '8px', fontSize: '0.85rem', borderLeft: '3px solid var(--accent-purple)' }}>
                      <div style={{ color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '2px', fontSize: '0.75rem' }}>Replied Message</div>
                      <div style={{ opacity: 0.8 }}>{preview}</div>
                    </div>
                  );
                }
              }

              return (
                <div key={msg.id} className={`message-wrapper ${isSent ? "sent" : "received"}`}>
                  {!isSent && (
                    <div className="user-avatar" style={{ background: "linear-gradient(135deg, #FF6B6B, #8B3DFF)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", width: "32px", height: "32px", flexShrink: 0, marginTop: "auto" }}>
                      {chat.otherUser.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div 
                    className="message-bubble"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleContextMenu(e.clientX, e.clientY, msg);
                    }}
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      pressTimerRef.current = setTimeout(() => {
                        handleContextMenu(touch.clientX, touch.clientY, msg);
                      }, 500);
                    }}
                    onTouchEnd={() => {
                      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
                    }}
                    onTouchMove={() => {
                      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
                    }}
                  >
                    {replyBlock}
                    {displayContent.startsWith("[MEDIA]:") ? (
                      <MediaMessage content={displayContent} />
                    ) : (
                      displayContent
                    )}
                    {msg.syncStatus === 'pending' && <span style={{fontSize: '0.8em', marginLeft: '5px'}}>⏳</span>}
                    <div className="message-time-inline">
                      {new Date(msg.created_at || "").toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Kolkata"
                      })}
                      {isSent && (
                        <svg style={{ marginLeft: "4px", verticalAlign: "bottom" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      )}
                    </div>
                  </div>
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

      <div className="chat-input-wrapper" style={{ position: 'relative' }}>
        {replyingTo && (
          <div className="replying-to-banner" style={{ position: 'absolute', top: '-40px', left: '24px', right: '24px', background: 'rgba(20, 20, 30, 0.9)', backdropFilter: 'blur(10px)', padding: '10px 16px', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)', borderBottom: 'none', borderLeft: '3px solid var(--accent-purple)' }}>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: 'var(--accent-blue)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '2px' }}>Replying to message</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {replyingTo.content.startsWith("[MEDIA]:") ? "Media message" : replyingTo.content}
              </div>
            </div>
            <button className="icon-btn" onClick={() => setReplyingTo(null)} style={{ padding: '4px' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <div className="chat-input-container" style={replyingTo ? { borderRadius: '0 0 30px 30px' } : {}}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*"
          />
          <button 
            className="add-btn" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "⏳" : <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
          </button>
          
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={uploading}
          />
          
          <div style={{ display: "flex", gap: "12px", color: "var(--text-tertiary)" }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </div>

          <button className="send-btn" onClick={() => handleSend()} disabled={uploading}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: "rotate(45deg)", marginLeft: "-2px" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>

      {contextMenu && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'rgba(20, 20, 30, 0.95)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            zIndex: 1000,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            minWidth: '120px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="secondary"
            style={{ padding: '10px 16px', textAlign: 'left', borderRadius: '8px', fontSize: '0.9rem', width: '100%' }}
            onClick={() => {
              setReplyingTo(contextMenu.msg);
              setContextMenu(null);
            }}
          >
            Reply
          </button>
          <button
            className="secondary"
            style={{ padding: '10px 16px', textAlign: 'left', borderRadius: '8px', fontSize: '0.9rem', width: '100%' }}
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.msg.content.replace(/^\[REPLY:\d+:.*?\]:/s, ''));
              setContextMenu(null);
            }}
          >
            Copy
          </button>
          <button
            className="secondary"
            style={{ padding: '10px 16px', textAlign: 'left', borderRadius: '8px', fontSize: '0.9rem', width: '100%' }}
            onClick={() => {
              setForwardingMsg(contextMenu.msg);
              setContextMenu(null);
            }}
          >
            Forward
          </button>
          {/* Only allow edit and delete for our own messages */}
          {(contextMenu.msg.issent ?? Number(contextMenu.msg.senderId) === Number(user?.id)) && (
            <>
              <button
                className="secondary"
                style={{ padding: '10px 16px', textAlign: 'left', borderRadius: '8px', fontSize: '0.9rem', width: '100%' }}
                onClick={() => {
                  setEditingId(contextMenu.msg.id);
                  setEditText(contextMenu.msg.content.replace(/^\[REPLY:\d+:.*?\]:/s, ''));
                  setContextMenu(null);
                }}
              >
                Edit
              </button>
              <button
                className="danger"
                style={{ padding: '10px 16px', textAlign: 'left', borderRadius: '8px', fontSize: '0.9rem', color: '#FF6B6B', width: '100%' }}
                onClick={() => {
                  handleDelete(contextMenu.msg.id);
                  setContextMenu(null);
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {forwardingMsg && (
        <ForwardModal 
          onClose={() => setForwardingMsg(null)}
          onForward={handleForward}
        />
      )}
    </>
  );
};

export default ChatWindow;
