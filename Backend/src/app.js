import express from "express";
import cors from "cors";
import authRoutes from "./routes/authroutes.js";
import chatRoutes from "./routes/chatroutes.js";
import connectionRoutes from "./routes/connectionRoutes.js";

const app = express();
app.use(express.json());
app.use(cors());
// request logging middleware removed for production
app.use((req, res, next) => next());
app.use("/auth", authRoutes);
app.use("/chats", chatRoutes);
app.use("/connections", connectionRoutes);

export default app;

