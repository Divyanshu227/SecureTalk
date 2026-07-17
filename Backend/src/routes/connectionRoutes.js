import express from "express";
import { sendRequest, updateRequest, getPendingRequests, getConnectionStatus } from "../controllers/connectionController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/request", authMiddleware, sendRequest);
router.patch("/request/:id", authMiddleware, updateRequest);
router.get("/requests/pending", authMiddleware, getPendingRequests);
router.get("/status/:otherUserId", authMiddleware, getConnectionStatus);

export default router;
