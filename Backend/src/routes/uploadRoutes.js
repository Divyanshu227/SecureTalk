import express from "express";
import multer from "multer";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const randomName = crypto.randomBytes(16).toString("hex");
    return {
      folder: "securetalk_uploads",
      format: "enc",
      public_id: randomName,
      resource_type: "raw" // Must be raw for encrypted blobs
    };
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Upload route
router.post("/", authMiddleware, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  res.json({
    url: req.file.path // Cloudinary returns the full absolute URL in req.file.path
  });
});

export default router;
