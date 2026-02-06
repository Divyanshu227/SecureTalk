export interface Message {
  id: number;
  senderId: number ;
  receiverId: number ;
  content: string;
  created_at?: string;
  updated_at?: string;
  issent?: boolean;  // Database computed flag: true if sent by current user, false if received
}
