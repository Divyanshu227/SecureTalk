import pool from "../config/db.js";
import jwt from "jsonwebtoken";

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
    console.log(
      "Socket connected:",
      socket.id,
      "User:",
      socket.user.id
    );

    socket.on("join_chat", (chatId) => {
      socket.join(chatId);
      console.log(
        `User ${socket.user.id} joined chat ${chatId}`
      );
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
          content: messageData.content,
          id: messageData.id,
          created_at: messageData.created_at,
          timestamp: messageData.created_at,
        };

        // Broadcast to users in the specific chat room
        io.to(String(chatId)).emit("receive_message", messageEvent);

        // Also broadcast to all connected users for sidebar updates
        io.emit("message_update", {
          ...messageEvent,
          type: "new_message"
        });

        console.log(`Message from user ${messageData.senderId} broadcast to chat ${chatId}`);

      } catch (err) {
        console.error("MESSAGE PERSISTENCE ERROR:", err.message);
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

    socket.on("disconnect", () => {
      console.log(
        "Socket disconnected:",
        socket.id,
        "User:",
        socket.user.id
      );
    });
  });
};
