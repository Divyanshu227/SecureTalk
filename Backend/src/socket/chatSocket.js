import pool from "../config/db.js";
import jwt from "jsonwebtoken";

export const initChatSocket = (io) => {

  // 🔐 SOCKET AUTH MIDDLEWARE (JWT)
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication token missing"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // attach user to socket
      socket.user = decoded; // { id, email }
      next();
    } catch (err) {
      return next(new Error("Invalid authentication token"));
    }
  });

  // 🔌 SOCKET CONNECTION
  io.on("connection", (socket) => {
    console.log(
      "Socket connected:",
      socket.id,
      "User:",
      socket.user.id
    );

    // ✅ JOIN CHAT ROOM
    socket.on("join_chat", (chatId) => {
      socket.join(chatId);
      console.log(
        `User ${socket.user.id} joined chat ${chatId}`
      );
    });

    // ✅ SEND MESSAGE (SECURE)
    socket.on("send_message", async (data) => {
      try {
        const { chatId, content } = data;
        const senderId = socket.user.id; // 🔒 derived from JWT

        if (!chatId || !content) {
          return;
        }

        // store message in DB
        await pool.query(
          "INSERT INTO messages (chat_id, sender_id, content) VALUES ($1,$2,$3)",
          [chatId, senderId, content]
        );

        // emit message to all users in chat room
        io.to(chatId).emit("receive_message", {
          chatId,
          senderId,
          content,
        });

      } catch (err) {
        console.error("SEND MESSAGE ERROR:", err.message);
      }
    });

    // 🔌 DISCONNECT
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
