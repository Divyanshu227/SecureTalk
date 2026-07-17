import api from "./axios";
import type { User } from "../types";

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  publicKey?: string
): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/auth/register", {
    name,
    email,
    password,
    publicKey
  });
  return res.data;
};

export const loginUser = async (
  email: string,
  password: string,
  publicKey?: string
): Promise<{ token: string }> => {
  const res = await api.post<{ token: string }>("/auth/login", {
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
