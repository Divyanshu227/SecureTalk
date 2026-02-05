import express from "express";
import { register, login, getMe, getAllUsers } from "../controllers/authcontroller.js";
import authMiddleware from "../middleware/authMiddleware.js";
// Explanation: This file sets up the authentication routes for the application. It includes routes for user registration, login, fetching the authenticated user's information, and retrieving a list of all users except the authenticated user. The routes that require authentication use the authMiddleware to ensure that only authenticated users can access them.
const router = express.Router();
router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.get("/users", authMiddleware, getAllUsers);

export default router;
