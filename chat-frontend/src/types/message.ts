export interface Message {
  id: number;
  senderId: number ;
  receiverId: number ;
  content: string;
  senderContent?: string; // Self-encrypted copy only the sender can decrypt
  created_at?: string;
  updated_at?: string;
  issent?: boolean;  // Database computed flag: true if sent by current user, false if received
}
