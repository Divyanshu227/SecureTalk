import { useAuth } from "../auth/AuthContext";

// Basic icons to simulate the left navigation bar
const Icons = {
  Chat: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  Contacts: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Groups: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Calls: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  Settings: () => (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const AppSidebar = ({ onSettingsClick }: { onSettingsClick: () => void }) => {
  const { user } = useAuth();

  return (
    <div className="app-sidebar glass-panel">
      <div className="brand-logo">
        <svg fill="currentColor" viewBox="0 0 24 24" style={{ width: "28px", height: "28px", color: "#fff" }}>
          <path d="M11 2L2 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      </div>
      
      <div className="nav-item active">
        <Icons.Chat />
        <span>Chats</span>
      </div>
      <div className="nav-item">
        <Icons.Contacts />
        <span>Contacts</span>
      </div>
      <div className="nav-item">
        <Icons.Groups />
        <span>Groups</span>
      </div>
      <div className="nav-item">
        <Icons.Calls />
        <span>Calls</span>
      </div>
      
      <div className="sidebar-spacer"></div>
      
      <div className="nav-item" onClick={onSettingsClick}>
        <Icons.Settings />
        <span>Settings</span>
      </div>

      <div className="pro-widget">
        <h4>Upgrade to Pro 👑</h4>
        <p>Unlock premium features and custom themes.</p>
        <button className="primary" style={{ padding: "8px", width: "100%", fontSize: "0.85rem" }}>Upgrade Now</button>
      </div>

      <div className="user-profile-mini">
        <div className="user-avatar" style={{ background: "linear-gradient(45deg, #FF6B6B, #FF8E53)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--success-green)" }}>Online</div>
        </div>
      </div>
    </div>
  );
};

export default AppSidebar;
