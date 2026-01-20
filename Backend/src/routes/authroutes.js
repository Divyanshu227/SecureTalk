import express from "express";
import { register, login, getMe, getAllUsers } from "../controllers/authcontroller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.get("/users", authMiddleware, getAllUsers);

export default router;
