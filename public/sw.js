// Cache only this public offline shell. Authenticated responses are never cached.
const CACHE = 'englishai-offline-shell-v1';
const SHELL = ['/offline.html','/offline.js','/offline.css','/favicon.svg','/manifest.webmanifest'];
self.addEventListener('install',(event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate',(event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('englishai-offline-shell-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch',(event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
    if (SHELL.includes(url.pathname)) {
        event.respondWith(caches.open(CACHE).then(async (cache) => await cache.match(url.pathname) || fetch(event.request)));
    } else if (event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request).catch(async () => {
            const cached = await caches.open(CACHE).then((cache) => cache.match('/offline.html'));
            return cached || new Response('Chưa tải thư viện offline. Hãy kết nối mạng để thử lại.',{ status: 503 });
        }));
    }
});
