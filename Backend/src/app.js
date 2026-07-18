import express from "express";
import cors from "cors";
import authRoutes from "./routes/authroutes.js";
import chatRoutes from "./routes/chatroutes.js";
import connectionRoutes from "./routes/connectionRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import pushRoutes from "./routes/pushRoutes.js";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

const app = express();
app.use(express.json());
app.use(cors());
// request logging middleware removed for production
app.use((req, res, next) => next());
app.use("/auth", authRoutes);
app.use("/chats", chatRoutes);
app.use("/connections", connectionRoutes);
app.use("/upload", uploadRoutes);
app.use("/push", pushRoutes);
// Legacy uploads redirect to Cloudinary
app.get("/uploads/:filename", (req, res) => {
  const cloudinaryUrl = cloudinary.url(`securetalk_uploads/${req.params.filename}`, { resource_type: "raw" });
  res.redirect(cloudinaryUrl);
});

export default app;

