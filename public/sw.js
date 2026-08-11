// sw.js — minimal service worker: receives push events and shows a
// notification. Requires a real deployed Supabase Edge Function
// (supabase/functions/send-push) with real VAPID private key to actually
// send anything — that server-side delivery is NOT VERIFIED in this
// sandbox (no network/credentials available here).

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Family DoorDash Tracker', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
