import api from './axios';

export const subscribeToPush = async (subscription: PushSubscription) => {
  const response = await api.post('/push/subscribe', subscription);
  return response.data;
};

export const unsubscribeFromPush = async (endpoint: string) => {
  const response = await api.post('/push/unsubscribe', { endpoint });
  return response.data;
};

export const getVapidPublicKey = async () => {
  const response = await api.get('/push/vapidPublicKey');
  return response.data.publicKey;
};
