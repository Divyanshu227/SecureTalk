import { useEffect } from 'react';
import { subscribeToPush, getVapidPublicKey } from '../api/push';
import { useAuth } from '../auth/AuthContext';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const initPush = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          console.log('Push notifications not supported in this browser');
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            console.log('Push notification permission denied');
            return;
          }

          const vapidPublicKey = await getVapidPublicKey();
          const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          });
        }

        await subscribeToPush(subscription);
        console.log('Push subscription saved successfully');

      } catch (error) {
        console.error('Failed to initialize push notifications', error);
      }
    };

    initPush();
  }, [user]);
};
