// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// time.js -- server-corrected clock  |  React: hooks/useNow.js
        /* ---------- زمان مبنا: سرور امن، با fallback به ساعت دستگاه ---------- */

        function getNow() {
            return new Date(Date.now() + timeOffsetMs);
        }

        async function syncServerTime() {
            const badge = document.getElementById('timeSource');
            if (!badge) return;

            // ترتیب منابع بر اساس دسترس‌پذیری از ایران:
            // ۱. timeapi.io — معمولاً از ایران در دسترس است
            // ۲. worldclockapi.com — جایگزین بین‌المللی
            // ۳. worldtimeapi.org — ممکن است از ایران فیلتر باشد
            const sources = [
                async (signal) => {
                    const r = await fetch('https://timeapi.io/api/time/current/zone?timeZone=Asia%2FTehran', { signal });
                    if (!r.ok) throw new Error('bad response');
                    const j = await r.json();
                    const ms = Date.parse(j.dateTime);
                    if (!Number.isFinite(ms)) throw new Error('bad date');
                    return ms;
                },
                async (signal) => {
                    const r = await fetch('https://worldclockapi.com/api/json/utc/now', { signal });
                    if (!r.ok) throw new Error('bad response');
                    const j = await r.json();
                    const ms = Date.parse(j.currentDateTime);
                    if (!Number.isFinite(ms)) throw new Error('bad date');
                    return ms;
                },
                async (signal) => {
                    const r = await fetch('https://worldtimeapi.org/api/timezone/Asia/Tehran', { signal });
                    if (!r.ok) throw new Error('bad response');
                    const j = await r.json();
                    const ms = typeof j.unixtime === 'number' ? j.unixtime * 1000 : Date.parse(j.datetime);
                    if (!Number.isFinite(ms)) throw new Error('bad date');
                    return ms;
                }
            ];

            for (const fn of sources) {
                try {
                    const ctrl = new AbortController();
                    const timer = setTimeout(() => ctrl.abort(), 6000);
                    const ms = await fn(ctrl.signal);
                    clearTimeout(timer);
                    if (!Number.isFinite(ms)) continue;
                    timeOffsetMs = ms - Date.now();
                    badge.textContent = '✓ زمان آنلاین';
                    badge.classList.add('online');
                    badge.classList.remove('offline');
                    badge.title = 'زمان از سرور اینترنتی دریافت شد';
                    scheduleBadgeFade(badge);
                    return;
                } catch { /* سرور بعدی */ }
            }
            badge.textContent = '⚠ آفلاین — مبنا ساعت دستگاه است';
            badge.classList.add('offline');
            badge.classList.remove('online');
            badge.title = 'دسترسی به سرور زمان ممکن نشد؛ از ساعت دستگاه استفاده می‌شود';
            scheduleBadgeFade(badge);
        }

        function scheduleBadgeFade(badge) {
            setTimeout(() => badge.classList.add('fade'), 4000);
            setTimeout(() => { badge.style.display = 'none'; }, 5000);
        }