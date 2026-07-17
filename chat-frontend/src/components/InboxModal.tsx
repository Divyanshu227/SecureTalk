import { useState, useEffect } from "react";
import { getPendingRequests, updateConnectionRequest } from "../api/connections";
import type { ConnectionRequest } from "../api/connections";

interface InboxModalProps {
  onClose: () => void;
}

export default function InboxModal({ onClose }: InboxModalProps) {
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRequests() {
      try {
        const res = await getPendingRequests();
        setRequests(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadRequests();
  }, []);

  const handleAction = async (id: number, status: 'accepted' | 'rejected') => {
    try {
      await updateConnectionRequest(id, status);
      setRequests(requests.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
      alert(`Failed to ${status} request`);
    }
  };

  return (
    <>
      <div className="edit-dialog-overlay" onClick={onClose} />
      <div className="edit-dialog" style={{ minWidth: "400px" }}>
        <h3>Connection Requests</h3>
        
        {loading ? (
          <p style={{ textAlign: "center", color: "#999" }}>Loading...</p>
        ) : requests.length === 0 ? (
          <p style={{ textAlign: "center", color: "#999" }}>No pending requests</p>
        ) : (
          <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "16px" }}>
            {requests.map((req) => (
              <div
                key={req.id}
                style={{
                  padding: "12px",
                  borderBottom: "1px solid var(--border-color, #e0e0e0)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div>
                  <div style={{ fontWeight: "600", marginBottom: "2px" }}>{req.sender_name}</div>
                  <div style={{ fontSize: "0.85em", color: "var(--text-secondary, #999)" }}>@{req.sender_username}</div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => handleAction(req.id, 'accepted')} style={{ padding: "4px 12px", fontSize: "0.9em" }}>
                    Accept
                  </button>
                  <button className="secondary" onClick={() => handleAction(req.id, 'rejected')} style={{ padding: "4px 12px", fontSize: "0.9em" }}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="edit-dialog-actions">
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
