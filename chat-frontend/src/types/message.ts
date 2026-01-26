export interface Message {
  id: number;
  senderId: number | string;
  content: string;
  created_at?: string;
  updated_at?: string;
}
