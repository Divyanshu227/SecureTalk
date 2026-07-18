import pool from "../config/db.js";
import jwt from "jsonwebtoken";

export const onlineUsers = new Map();

export const initChatSocket = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication token missing"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error("Invalid authentication token"));
    }
  });

  io.on("connection", (socket) => {
    // socket connected
    const userId = socket.user.id;
    
    // Add to online users
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} connected. Total online: ${onlineUsers.size}`);
    
    // Broadcast status to all connected clients
    io.emit("user_status", { userId, isOnline: true });

    // When a user connects, they might want to know who is online right now
    socket.on("get_initial_status", (callback) => {
      // Return array of online user IDs
      if (typeof callback === "function") {
        callback(Array.from(onlineUsers.keys()));
      }
    });

    socket.on("join_chat", (chatId) => {
      const roomId = String(chatId);
      socket.join(roomId);
    });

    // Listen for message persistence confirmation from backend
    // When REST API saves a message, frontend will emit this
    socket.on("message_persisted", (data) => {
      try {
        const { chatId, messageData } = data;

        if (!chatId || !messageData) {
          return;
        }

        const messageEvent = {
          chatId,
          senderId: messageData.senderId,
          receiverId: messageData.receiverId,
          content: messageData.content,
          id: messageData.id,
          created_at: messageData.created_at,
          timestamp: messageData.created_at,
        };

        io.to(String(chatId)).emit("receive_message", messageEvent);
        // Also broadcast to all connected users for sidebar updates
        io.emit("message_update", messageEvent);

      } catch (err) {
        console.error("❌ MESSAGE PERSISTENCE ERROR:", err.message);
      }
    });

    socket.on("send_message", (data) => {
      // Legacy support - can be removed once frontend fully uses message_persisted
      try {
        const { chatId, content } = data;

        if (!chatId || !content) {
          return;
        }

        io.to(chatId).emit("receive_message", {
          chatId,
          senderId: socket.user.id,
          content,
          timestamp: new Date().toISOString(),
        });

      } catch (err) {
        console.error("SEND MESSAGE ERROR:", err.message);
      }
    });

    socket.on("client_error", (data) => {
      console.error("❌ CLIENT ERROR FROM USER", socket.user?.id, ":", data);
    });

    socket.on("mark_delivered", async ({ messageId, chatId }) => {
      try {
        await pool.query("UPDATE messages SET status = 'delivered' WHERE messageid = $1 AND status = 'sent'", [messageId]);
        io.to(String(chatId)).emit("message_status_update", { messageId, chatId, status: 'delivered' });
      } catch (err) {
        console.error("Mark delivered error:", err);
      }
    });

    socket.on("mark_chat_read", async (chatId) => {
      try {
        const userId = socket.user.id;
        const result = await pool.query(
          "UPDATE messages SET status = 'read' WHERE chatid = $1 AND receiverid = $2 AND status IN ('sent', 'delivered') RETURNING messageid",
          [chatId, userId]
        );
        if (result.rowCount > 0) {
          const messageIds = result.rows.map(r => r.messageid);
          io.to(String(chatId)).emit("messages_status_update", { messageIds, chatId, status: 'read' });
        }
      } catch (err) {
        console.error("Mark chat read error:", err);
      }
    });

    socket.on("disconnect", async () => {
      // socket disconnected
      const userId = socket.user.id;
      onlineUsers.delete(userId);
      console.log(`User ${userId} disconnected. Total online: ${onlineUsers.size}`);
      
      const lastSeen = new Date();
      
      try {
        await pool.query("UPDATE users SET last_seen = $1 WHERE id = $2", [lastSeen, userId]);
      } catch (err) {
        console.error("Failed to update last_seen for user", userId, err);
      }
      
      io.emit("user_status", { userId, isOnline: false, last_seen: lastSeen.toISOString() });
    });

    socket.on("leave_chat", (chatId) => {
      const roomId = String(chatId);
      socket.leave(roomId);
    });
  });
};
