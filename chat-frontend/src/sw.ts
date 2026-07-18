/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: data.icon || '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: data.data,
      };
      event.waitUntil(self.registration.showNotification(data.title, options));
    } catch (e) {
      console.error('Error parsing push data', e);
      event.waitUntil(self.registration.showNotification("New Message", {
        body: "You have received a new secure message.",
        icon: '/icon-192x192.png'
      }));
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const urlToOpen = new URL('/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url.includes(self.location.origin)) {
          matchingClient = windowClient;
          break;
        }
      }
      if (matchingClient) {
        // If app is already open, focus it and optionally post a message to open specific chat
        matchingClient.focus();
        if (chatId) {
          matchingClient.postMessage({ type: 'OPEN_CHAT', chatId });
        }
      } else {
        // App is not open, open it
        self.clients.openWindow(urlToOpen);
      }
    })
  );
});
