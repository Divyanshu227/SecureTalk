import express from "express";
import { register, login, getMe, searchUsers, updatePublicKey, backupKey, toggleRequireConnection } from "../controllers/authcontroller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/register", register);
router.post("/login", login);
router.post("/keys", authMiddleware, updatePublicKey);
router.post("/backup-key", authMiddleware, backupKey);
router.post("/toggle-connection", authMiddleware, toggleRequireConnection);
router.get("/me", authMiddleware, getMe);
router.get("/users/search", authMiddleware, searchUsers);

export default router;
