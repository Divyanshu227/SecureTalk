import { useState, useEffect } from "react";
import { decryptFile } from "../utils/crypto";

interface Props {
  content: string; // [MEDIA]:/uploads/xyz.enc:AES_KEY:IV:mimeType:filename
}

const MediaMessage = ({ content }: Props) => {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const parts = content.split(":");
  const url = parts[1];
  const aesKey = parts[2];
  const iv = parts[3];
  const mimeType = parts[4];
  const filename = parts.slice(5).join(":"); // In case filename has colons

  useEffect(() => {
    let objectUrl: string | null = null;
    
    const loadMedia = async () => {
      try {
        const fullUrl = `http://localhost:5000${url}`;
        const response = await fetch(fullUrl);
        if (!response.ok) throw new Error("Failed to fetch encrypted media");
        
        const encryptedBlob = await response.blob();
        const decryptedBlob = await decryptFile(encryptedBlob, aesKey, iv, mimeType);
        
        objectUrl = URL.createObjectURL(decryptedBlob);
        setMediaUrl(objectUrl);
      } catch (err) {
        console.error("Media decrypt error:", err);
        setError("Failed to decrypt media.");
      } finally {
        setLoading(false);
      }
    };

    loadMedia();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, aesKey, iv, mimeType]);

  if (loading) {
    return <div style={{ fontStyle: "italic", opacity: 0.7 }}>Loading media ({filename})...</div>;
  }

  if (error) {
    return <div style={{ color: "red", fontStyle: "italic" }}>{error}</div>;
  }

  if (mediaUrl) {
    const style = { maxWidth: "100%", maxHeight: "300px", borderRadius: "8px", marginTop: "8px" };
    
    if (mimeType.startsWith("image/")) {
      return (
        <div>
          <div>📎 {filename}</div>
          <img src={mediaUrl} alt={filename} style={style} />
        </div>
      );
    }
    
    if (mimeType.startsWith("video/")) {
      return (
        <div>
          <div>📎 {filename}</div>
          <video src={mediaUrl} controls style={style} />
        </div>
      );
    }
    
    if (mimeType.startsWith("audio/")) {
      return (
        <div>
          <div>📎 {filename}</div>
          <audio src={mediaUrl} controls style={{ ...style, width: "100%" }} />
        </div>
      );
    }
  }

  return (
    <div>
      <div>📎 {filename}</div>
      {mediaUrl && (
        <a href={mediaUrl} download={filename} style={{ color: "var(--primary)" }}>
          Download File
        </a>
      )}
    </div>
  );
};

export default MediaMessage;
