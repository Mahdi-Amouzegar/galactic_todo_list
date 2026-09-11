// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
// Service Worker: آفلاین‌سازی پوسته برنامه (فقط فایل‌های همین‌سایت)


// ─────────────────────────────────────────────────────────────────────────────
// راهنمای نسخه‌بندی CACHE
// ─────────────────────────────────────────────────────────────────────────────
// ساختار: space-todo-v<MAJOR>.<API>.<FEATURE>.<PHASE>-<DATE>
//
//   MAJOR    : تغییر بزرگ در معماری پروژه (مثلاً مهاجرت به framework جدید)
//   API      : تغییر در ساختار ذخیره‌سازی یا قرارداد داده (data contract)
//   FEATURE  : فیچر جدید یا بازسازی بزرگ (مثلاً بازسازی CSS، Light theme)
//   PHASE    : هر فاز از برنامه ارتقا (۰ تا ۷)
//   DATE     : تاریخ آخرین bump به فرمت YYYY-MM-DD (برای اطمینان از پاک شدن کش)
//
// راهنما:
//   - هر فاز برنامه ارتقا → PHASE + ۱
//   - هر فیچر جدید → FEATURE + ۱ و PHASE = ۰
//   - هر تغییر در ساختار داده → API + ۱ و بقیه صفر
//   - تغییر بزرگ معماری → MAJOR + ۱ و بقیه صفر
//
// تاریخچه:
//   v1.0.0.0-2026-09-11 — نقطه شروع (baseline) قبل از برنامه ارتقا
//   v1.0.0.1-2026-09-11 — فاز ۱: رفع باگ‌های بحرانی (saveTasks deep clone، idbPutAll guard)
//   v1.0.0.2-2026-09-11 — فاز ۲: امنیت (CSP، SRI، sanitizeUrl، escapeHtml سریع)
//   v1.0.0.3-2026-09-11 — فاز ۳: عملکرد (debounce، Task Index، cache allSessions، ترتیب منابع زمان)
// ─────────────────────────────────────────────────────────────────────────────
const CACHE = 'space-todo-v1.0.0.3-2026-09-11';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=1',
  './ui-fixes.css?v=1',
  './visual-fixes.css?v=1',
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
  './js/core.js?v=1',
  './js/jalali.js?v=1',
  './js/time.js?v=1',
  './js/notify.js?v=1',
  './js/store.js?v=1',
  './js/sessions.js?v=1',
  './js/picker.js?v=1',
  './js/map.js?v=1',
  './js/route-ui.js?v=1',
  './js/location-ui.js?v=1',
  './js/detail.js?v=1',
  './js/ui.js?v=1',
  './js/app.js?v=1'
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
    caches.open(CACHE).then(async cache => {
      let failed = 0;
      await Promise.all(ASSETS.map(async asset => {
        try {
          await cache.add(asset);
        } catch (_) {
          failed++;
        }
      }));
      // اگر بیش از ۳۰٪ assetها fail شوند، نصب را fail کن تا کاربر با SW ناقص نماند.
      if (failed > ASSETS.length * 0.3) {
        throw new Error(`SW install failed: ${failed}/${ASSETS.length} assets could not be cached`);
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isCodeAsset(request) {
  return request.destination === 'script' || request.destination === 'style' || /\.(?:js|css)$/i.test(new URL(request.url).pathname);
}

// برای code assets: اول شبکه، اگر fail شد (آفلاین) از کش.
// مهم: ابتدا exact match (با query)، سپس در صورت نبود، ignoreSearch.
// این ترتیب از باگ «نسخه قدیمی CSS بعد از bump» جلوگیری می‌کند.
function networkFirst(request) {
  return fetch(request).then(res => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
    }
    return res;
  }).catch(() =>
    caches.match(request).then(hit =>
      hit || caches.match(request, { ignoreSearch: true })
    )
  );
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const isDocument = e.request.mode === 'navigate' || e.request.destination === 'document';
  if (isDocument) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  if (isCodeAsset(e.request)) {
    e.respondWith(networkFirst(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }))
  );
});