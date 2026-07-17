import api from "./axios";
import type { Message } from "../types";
// exp
export const fetchMessages = async (chatId: number): Promise<Message[]> => {
  const res = await api.get<Message[]>(`/chats/${chatId}/messages`);
  return res.data;
};

export const sendMessage = async (
  chatId: number,
  content: string,
  senderContent?: string
): Promise<Message> => {
  const res = await api.post<Message>(`/chats/${chatId}/messages`, {
    content,
    senderContent,
  });
  console.log("Message sent:", res.data);
  return res.data;
};

export const editMessage = async (
  chatId: number,
  messageId: number,
  content: string
): Promise<Message> => {
  const res = await api.put<Message>(`/chats/${chatId}/messages/${messageId}`, {
    content,
  });
  return res.data;
};

export const deleteMessage = async (
  chatId: number,
  messageId: number
): Promise<{ message: string }> => {
  const res = await api.delete<{ message: string }>(
    `/chats/${chatId}/messages/${messageId}`
  );
  return res.data;
};
