export interface Chat {
  id: number;
  lastMessage: string | null;
  otherUser: {
    id: number;
    name: string;
    email: string;
  };
}
