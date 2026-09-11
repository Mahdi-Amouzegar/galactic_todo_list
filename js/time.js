// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// time.js -- server-corrected clock  |  React: hooks/useNow.js
        /* ---------- زمان مبنا: سرور امن، با fallback به ساعت دستگاه ---------- */

        function getNow() {
            return new Date(Date.now() + timeOffsetMs);
        }

        async function syncServerTime() {
            const icon = document.getElementById('timeSourceIcon');
            if (!icon) return;

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

            // حالت اولیه: در حال اتصال
            icon.textContent = '🕐';
            icon.title = 'در حال اتصال به سرور زمان...';
            icon.classList.remove('online', 'offline');

            for (const fn of sources) {
                try {
                    const ctrl = new AbortController();
                    const timer = setTimeout(() => ctrl.abort(), 6000);
                    const ms = await fn(ctrl.signal);
                    clearTimeout(timer);
                    if (!Number.isFinite(ms)) continue;
                    timeOffsetMs = ms - Date.now();
                    icon.textContent = '🕐';
                    icon.title = '✓ زمان آنلاین — همگام با سرور اینترنتی';
                    icon.classList.remove('offline');
                    icon.classList.add('online');
                    return;
                } catch { /* سرور بعدی */ }
            }

            // همه سرورها fail شدند
            icon.textContent = '🕐';
            icon.title = '⚠ آفلاین — مبنا ساعت دستگاه است';
            icon.classList.remove('online');
            icon.classList.add('offline');
        }