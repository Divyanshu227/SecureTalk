export interface Chat {
  id: number;
  lastMessage: string | null;
  lastMessageTime?: string | null;
  otherUser: {
    id: number;
    name: string;
    email: string;
    public_key?: string;
    last_seen?: string | null;
    isOnline?: boolean;
  };
}
