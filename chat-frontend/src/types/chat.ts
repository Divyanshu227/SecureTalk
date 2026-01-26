export interface Chat {
  id: number;
  lastMessage: string | null;
  lastMessageTime?: string | null;
  otherUser: {
    id: number;
    name: string;
    email: string;
  };
}
