import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { createChat, getChats } from "../controllers/chatController.js";
import { sendMessage, getMessages, editMessage, deleteMessage } from "../controllers/messageController.js";

const router = express.Router();
// explanation: This file sets up the chat-related routes for the application. It includes routes for creating chats, fetching chats, sending messages, retrieving messages, editing messages, and deleting messages. All routes use the authMiddleware to ensure that only authenticated users can access them.
router.post("/", authMiddleware, createChat);
router.get("/", authMiddleware, getChats);
router.post("/:chatId/messages", authMiddleware, sendMessage);
router.get("/:chatId/messages", authMiddleware, getMessages);
router.put("/:chatId/messages/:messageId", authMiddleware, editMessage);
router.delete("/:chatId/messages/:messageId", authMiddleware, deleteMessage);

export default router;
