import api from "./axios";

export interface ConnectionRequest {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_username: string;
  sender_public_key: string;
  created_at: string;
}

export const sendConnectionRequest = async (receiverId: number): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/connections/request", { receiverId });
  return res.data;
};

export const updateConnectionRequest = async (id: number, status: 'accepted' | 'rejected'): Promise<{ message: string }> => {
  const res = await api.patch<{ message: string }>(`/connections/request/${id}`, { status });
  return res.data;
};

export const getPendingRequests = async (): Promise<ConnectionRequest[]> => {
  const res = await api.get<ConnectionRequest[]>("/connections/requests/pending");
  return res.data;
};

export const getConnectionStatus = async (otherUserId: number): Promise<{ status: 'connected' | 'pending_sent' | 'pending_received' | 'none', requestId?: number }> => {
  const res = await api.get<{ status: 'connected' | 'pending_sent' | 'pending_received' | 'none', requestId?: number }>(`/connections/status/${otherUserId}`);
  return res.data;
};
