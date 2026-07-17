import { useState, useEffect } from "react";
import { searchUsers } from "../api/auth";
import type { User } from "../types";

interface SearchModalProps {
  onClose: () => void;
  onUserSelect: (user: User) => void;
}

export default function SearchModal({ onClose, onUserSelect }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 0) {
        setLoading(true);
        try {
          const res = await searchUsers(query);
          setResults(res);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <>
      <div className="edit-dialog-overlay" onClick={onClose} />
      <div className="edit-dialog" style={{ minWidth: "400px" }}>
        <h3>Search Users</h3>
        <input 
          type="text" 
          placeholder="Search by name or @username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          style={{ width: "100%", padding: "10px", marginBottom: "16px", boxSizing: "border-box" }}
        />

        {loading ? (
          <p style={{ textAlign: "center", color: "#999" }}>Searching...</p>
        ) : results.length === 0 && query.length > 0 ? (
          <p style={{ textAlign: "center", color: "#999" }}>No users found</p>
        ) : (
          <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "16px" }}>
            {results.map((user) => (
              <div
                key={user.id}
                onClick={() => onUserSelect(user)}
                style={{
                  padding: "12px",
                  borderBottom: "1px solid var(--border-color, #e0e0e0)",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary, #f5f5f5)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontWeight: "600", marginBottom: "2px" }}>{user.name}</div>
                <div style={{ fontSize: "0.85em", color: "var(--text-secondary, #999)" }}>@{user.username}</div>
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
