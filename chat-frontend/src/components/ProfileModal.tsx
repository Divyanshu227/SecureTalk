import { useState, useEffect } from "react";
import type { User } from "../types";
import { getConnectionStatus, sendConnectionRequest } from "../api/connections";

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onMessage: (userId: number) => void;
}

export default function ProfileModal({ user, onClose, onMessage }: ProfileModalProps) {
  const [status, setStatus] = useState<'connected' | 'pending_sent' | 'pending_received' | 'none' | 'loading'>('loading');
  
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await getConnectionStatus(user.id);
        setStatus(res.status);
      } catch (err) {
        console.error(err);
        setStatus('none');
      }
    }
    loadStatus();
  }, [user.id]);

  const handleConnect = async () => {
    try {
      await sendConnectionRequest(user.id);
      setStatus('pending_sent');
    } catch (err) {
      console.error(err);
      alert("Failed to send connection request");
    }
  };

  const handleAction = () => {
    if (user.require_connection && status !== 'connected') {
      if (status === 'none') {
        handleConnect();
      } else if (status === 'pending_received') {
        alert("Check your inbox to accept their request.");
      }
    } else {
      onMessage(user.id);
      onClose();
    }
  };

  let actionText = "Message";
  let actionDisabled = false;

  if (user.require_connection && status !== 'connected') {
    if (status === 'loading') {
      actionText = "Loading...";
      actionDisabled = true;
    } else if (status === 'pending_sent') {
      actionText = "Request Pending";
      actionDisabled = true;
    } else if (status === 'pending_received') {
      actionText = "Accept Request (Inbox)";
      actionDisabled = true;
    } else {
      actionText = "Connect";
    }
  }

  return (
    <>
      <div className="edit-dialog-overlay" onClick={onClose} />
      <div className="edit-dialog" style={{ minWidth: "300px", textAlign: "center" }}>
        <div style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
          margin: "0 auto 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: "2rem",
          fontWeight: "bold"
        }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        
        <h3 style={{ margin: "0 0 4px 0" }}>{user.name}</h3>
        <div style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>@{user.username}</div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
          <button 
            onClick={handleAction} 
            disabled={actionDisabled}
          >
            {actionText}
          </button>
        </div>
      </div>
    </>
  );
}
