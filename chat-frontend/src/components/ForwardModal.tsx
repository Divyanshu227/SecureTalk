import { useState, useEffect } from "react";
import type { Chat } from "../types";
import { getLocalChats } from "../db/localDb";

interface Props {
  onClose: () => void;
  onForward: (chat: Chat) => void;
}

const ForwardModal = ({ onClose, onForward }: Props) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const local = await getLocalChats();
      if (local) {
        setChats(local);
      }
    };
    load();
  }, []);

  const filtered = chats.filter((c) =>
    c.otherUser.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content forward-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Forward to...</h3>
          <button className="icon-btn" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="search-box" style={{ margin: "0 0 16px 0", width: "100%" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text-tertiary)" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="chat-list-scroll" style={{ padding: 0, maxHeight: "300px", minHeight: "150px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-tertiary)", marginTop: "24px" }}>
              No chats found
            </div>
          ) : (
            filtered.map((c) => (
              <div 
                key={c.id} 
                className="chat-list-item" 
                onClick={() => onForward(c)}
              >
                <div className="user-avatar" style={{ background: "linear-gradient(135deg, #FF6B6B, #8B3DFF)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", width: "40px", height: "40px", flexShrink: 0 }}>
                  {c.otherUser.name?.[0]?.toUpperCase()}
                </div>
                <div className="chat-item-content">
                  <div className="chat-item-name">{c.otherUser.name}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
