// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
// Service Worker: آفلاین‌سازی پوسته برنامه (فقط فایل‌های همین‌سایت)
const CACHE = 'space-todo-v26';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=11',
  './manifest.webmanifest',
  './fonts/vazirmatn-arabic.woff2',
  './fonts/vazirmatn-latin.woff2',
  './icons/logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.ico',
  './icons/favicon-96x96.png',
  './icons/favicon.svg',
  './js/core.js?v=7',
  './js/jalali.js?v=7',
  './js/time.js?v=7',
  './js/notify.js?v=8',
  './js/store.js?v=8',
  './js/sessions.js?v=8',
  './js/picker.js?v=7',
  './js/map.js?v=7',
  './js/detail.js?v=9',
  './js/ui.js?v=10',
  './js/app.js?v=8'
];

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
      const w = ws.find(x => x.url.includes('index.html') || x.url.endsWith('/'));
      if (w) return w.focus();
      return clients.openWindow('./');
    })
  );
});

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // فونت، نقشه و CDNها همیشه از شبکه (کش نمی‌شوند)
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
