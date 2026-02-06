import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";
import pool from "./src/config/db.js";
import authMiddleware from "./src/middleware/authMiddleware.js";
import http from "http";
import { Server } from "socket.io";
import { initChatSocket } from "./src/socket/chatSocket.js";

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
initChatSocket(io);
io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    // socket disconnected
  });
});
server.listen(process.env.PORT || 5000, () => {
  // Server started
});
