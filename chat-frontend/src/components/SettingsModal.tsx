import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { toggleRequireConnection } from "../api/auth";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { user, setUser } = useAuth();
  const [requireConnection, setRequireConnection] = useState(user?.require_connection ?? true);
  const [loading, setLoading] = useState(false);

  // Sync state if user context updates
  useEffect(() => {
    if (user) {
      setRequireConnection(user.require_connection ?? true);
    }
  }, [user]);

  const handleToggle = async () => {
    if (!user) return;
    const newValue = !requireConnection;
    setRequireConnection(newValue);
    setLoading(true);
    
    try {
      await toggleRequireConnection(newValue);
      // Update local user state
      setUser({ ...user, require_connection: newValue });
    } catch (err) {
      console.error(err);
      alert("Failed to update privacy settings");
      setRequireConnection(!newValue); // Revert
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="edit-dialog-overlay" onClick={onClose} />
      <div className="edit-dialog" style={{ minWidth: "350px" }}>
        <h3>Settings</h3>
        
        <div style={{ marginTop: "24px", marginBottom: "24px" }}>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div>
              <div style={{ fontWeight: "600", marginBottom: "4px" }}>Require Connection</div>
              <div style={{ fontSize: "0.85em", color: "var(--text-secondary, #999)", maxWidth: "220px" }}>
                When enabled, users must send a request and connect with you before they can message you.
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={requireConnection}
              onChange={handleToggle}
              disabled={loading}
              style={{ width: "20px", height: "20px" }}
            />
          </label>
        </div>

        <div className="edit-dialog-actions">
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
