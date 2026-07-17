import api from "./axios";
import type { User } from "../types";

export const registerUser = async (
  name: string,
  username: string,
  email: string,
  password: string,
  publicKey?: string,
  encryptedPrivateKey?: string
): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/auth/register", {
    name,
    username,
    email,
    password,
    publicKey,
    encryptedPrivateKey
  });
  return res.data;
};

export const loginUser = async (
  email: string,
  password: string,
  publicKey?: string
): Promise<{ token: string, user: {id: number}, encryptedPrivateKey?: string }> => {
  const res = await api.post<{ token: string, user: {id: number}, encryptedPrivateKey?: string }>("/auth/login", {
    email,
    password,
    publicKey
  });
  return res.data;
};

export const fetchMe = async (): Promise<User> => {
  const res = await api.get<User>("/auth/me");
  return res.data;
};

export const updatePublicKey = async (publicKey: string): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/auth/keys", { publicKey });
  return res.data;
};

export const backupKey = async (encryptedPrivateKey: string): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/auth/backup-key", { encryptedPrivateKey });
  return res.data;
};

export const searchUsers = async (query: string): Promise<User[]> => {
  if (!query) return [];
  const res = await api.get<User[]>(`/auth/users/search?query=${encodeURIComponent(query)}`);
  return res.data;
};

export const toggleRequireConnection = async (requireConnection: boolean): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/auth/toggle-connection", { requireConnection });
  return res.data;
};
