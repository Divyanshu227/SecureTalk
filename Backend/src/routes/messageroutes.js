import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { sendMessage, getMessages } from "../controllers/messageController.js";

const router = express.Router();

router.post("/:chatId", authMiddleware, sendMessage);
router.get("/:chatId", authMiddleware, getMessages);

export default router;
