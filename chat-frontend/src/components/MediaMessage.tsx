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
  let urlIndex = 1;
  let url = parts[urlIndex];
  if (url === "http" || url === "https") {
    url = parts[urlIndex] + ":" + parts[urlIndex + 1];
    urlIndex++;
  }
  const aesKey = parts[urlIndex + 1];
  const iv = parts[urlIndex + 2];
  const mimeType = parts[urlIndex + 3];
  const filename = parts.slice(urlIndex + 4).join(":");

  useEffect(() => {
    let objectUrl: string | null = null;
    
    const loadMedia = async () => {
      try {
        const fullUrl = url.startsWith("http") ? url : `http://localhost:5000${url}`;
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

  const DownloadIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', transform: 'translateY(2px)' }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  );

  const DownloadButton = () => {
    if (!mediaUrl) return null;
    return (
      <a 
        href={mediaUrl} 
        download={filename} 
        style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          marginTop: '8px',
          padding: '6px 14px',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          color: 'var(--text-primary)',
          borderRadius: '20px',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: 600,
          transition: 'all 0.2s',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'}
      >
        <DownloadIcon /> Download
      </a>
    );
  };

  const FileHeader = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '0.85rem', opacity: 0.9, wordBreak: 'break-all' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', flexShrink: 0 }}>
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
      </svg>
      {filename}
    </div>
  );

  if (loading) {
    return (
      <div style={{ padding: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
        <FileHeader />
        <div style={{ fontStyle: "italic", opacity: 0.6, fontSize: '0.85rem' }}>Decrypting securely...</div>
      </div>
    );
  }

  if (error) {
    return <div style={{ color: "#ff6b6b", fontStyle: "italic", fontSize: '0.85rem' }}>{error}</div>;
  }

  if (mediaUrl) {
    const mediaStyle = { maxWidth: "100%", maxHeight: "250px", borderRadius: "10px", objectFit: "cover" as any };
    const containerStyle = { background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '12px' };
    
    if (mimeType.startsWith("image/")) {
      return (
        <div style={containerStyle}>
          <FileHeader />
          <div style={{ position: 'relative' }}>
            <img src={mediaUrl} alt={filename} style={{ ...mediaStyle, width: '100%', border: '1px solid rgba(255,255,255,0.05)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <DownloadButton />
          </div>
        </div>
      );
    }
    
    if (mimeType.startsWith("video/")) {
      return (
        <div style={containerStyle}>
          <FileHeader />
          <video src={mediaUrl} controls style={{ ...mediaStyle, width: '100%', outline: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <DownloadButton />
          </div>
        </div>
      );
    }
    
    if (mimeType.startsWith("audio/")) {
      return (
        <div style={containerStyle}>
          <FileHeader />
          <audio src={mediaUrl} controls style={{ width: "100%", marginTop: '4px', outline: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <DownloadButton />
          </div>
        </div>
      );
    }
  }

  return (
    <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '12px', borderLeft: '3px solid var(--accent-blue)' }}>
      <FileHeader />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <span style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', fontWeight: 600 }}>{mimeType.split('/')[1] || 'FILE'}</span>
        <DownloadButton />
      </div>
    </div>
  );
};

export default MediaMessage;
