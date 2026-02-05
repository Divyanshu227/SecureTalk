import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { sendMessage, getMessages } from "../controllers/messageController.js";

const router = express.Router();
// explanation: This file sets up the message-related routes for the application. It includes routes for sending and retrieving messages within a specific chat. All routes use the authMiddleware to ensure that only authenticated users can access them.
router.post("/:chatId", authMiddleware, sendMessage);
router.get("/:chatId", authMiddleware, getMessages);

export default router;
