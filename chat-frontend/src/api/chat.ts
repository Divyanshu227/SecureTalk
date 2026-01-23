import api from "./axios";
import type { Chat } from "../types";

export const fetchChats = async (): Promise<Chat[]> => {
  const res = await api.get<Chat[]>("/chats");
  return res.data;
};

export const createChat = async (otherUserId: number): Promise<{ chatId: number }> => {
  const res = await api.post<{ chatId: number }>("/chats", {
    otherUserId,
  });
  return res.data;
};

export const fetchUsers = async (): Promise<{ id: number; name: string; email: string }[]> => {
  const res = await api.get<{ id: number; name: string; email: string }[]>("/auth/users");
  return res.data;
};

