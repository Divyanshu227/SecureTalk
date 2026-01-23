export interface Message {
  id: number;
  senderId: number;
  content: string;
  created_at?: string;
  updated_at?: string;
}
