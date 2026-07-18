import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadDir = path.join(process.cwd(), "uploads");

async function migrate() {
  if (!fs.existsSync(uploadDir)) {
    console.log("No uploads directory found. Nothing to migrate.");
    return;
  }

  const files = fs.readdirSync(uploadDir);
  const encFiles = files.filter(f => f.endsWith(".enc"));

  if (encFiles.length === 0) {
    console.log("No .enc files found. Nothing to migrate.");
    return;
  }

  console.log(`Found ${encFiles.length} files to migrate.`);

  for (const file of encFiles) {
    const filePath = path.join(uploadDir, file);
    const publicId = file.replace(".enc", "");
    
    console.log(`Uploading ${file}...`);
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        resource_type: "raw",
        folder: "securetalk_uploads",
        public_id: publicId,
        format: "enc",
      });
      console.log(`✅ Uploaded ${file} to Cloudinary! URL: ${result.secure_url}`);
    } catch (err) {
      console.error(`❌ Failed to upload ${file}:`, err);
    }
  }

  console.log("Migration complete!");
}

migrate();
