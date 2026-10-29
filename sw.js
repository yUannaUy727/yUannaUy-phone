// A basic service worker to make the app installable
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
});

self.addEventListener('fetch', (event) => {
  // This basic service worker doesn't intercept any requests.
  // It just lets the browser handle them as usual.
  return;
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const data = event.notification.data || {};
    const url = new URL('./', self.registration.scope);
    if (!data.test && data.chatId != null && ['private', 'group'].includes(data.chatType)) {
        url.searchParams.set('notificationChat', String(data.chatId));
        url.searchParams.set('notificationType', data.chatType);
    }
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const client = windows.find(c => {
            const candidate = new URL(c.url);
            return candidate.origin === url.origin && (candidate.pathname === url.pathname || candidate.pathname === url.pathname + 'index.html');
        });
        if (client) {
            await client.focus();
            if (!data.test) client.postMessage({ type: 'uwu-open-chat', chatId: data.chatId, chatType: data.chatType });
        } else await self.clients.openWindow(url.href);
    })());
});
