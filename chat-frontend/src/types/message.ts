export interface Message {
  id: number;
  senderId: number | string;
  content: string;
  created_at?: string;
  updated_at?: string;
  isSent?: boolean;  // Database computed flag: true if sent by current user, false if received
}
