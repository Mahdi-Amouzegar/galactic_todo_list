// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
// Service Worker: آفلاین‌سازی پوسته برنامه (فقط فایل‌های همین‌سایت)
const CACHE = 'space-todo-v8';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=4',
  './manifest.webmanifest',
  './fonts/vazirmatn-arabic.woff2',
  './fonts/vazirmatn-latin.woff2',
  './js/core.js?v=4',
  './js/jalali.js?v=4',
  './js/time.js?v=4',
  './js/notify.js',
  './js/store.js?v=4',
  './js/sessions.js?v=4',
  './js/picker.js?v=4',
  './js/map.js?v=4',
  './js/detail.js?v=4',
  './js/ui.js?v=4',
  './js/app.js?v=4'
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
