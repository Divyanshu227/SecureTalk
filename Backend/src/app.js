import express from "express";
import cors from "cors";
import authRoutes from "./routes/authroutes.js";
import chatRoutes from "./routes/chatroutes.js";
import messageRoutes from "./routes/messageroutes.js";

const app = express();
app.use(express.json());
app.use(cors());
app.use("/auth", authRoutes);
app.use("/chats", chatRoutes);
app.use("/messages", messageRoutes);
app.use((req, res, next) => {
  console.log("INCOMING:", req.method, req.url);
  next();
});


export default app;

