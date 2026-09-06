// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// time.js -- server-corrected clock  |  React: hooks/useNow.js
        /* ---------- زمان مبنا: سرور امن، با fallback به ساعت دستگاه ---------- */

        function getNow() {
            return new Date(Date.now() + timeOffsetMs);
        }

        function scheduleBadgeFade(badge) {
            setTimeout(() => badge.classList.add('fade'), 4000);
            setTimeout(() => { badge.style.display = 'none'; }, 5000);
        }

        async function syncServerTime() {
            const badge = document.getElementById('timeSource');
            const sources = [
                async (signal) => {
                    const r = await fetch('https://worldtimeapi.org/api/timezone/Asia/Tehran', { signal });
                    if (!r.ok) throw new Error('bad response');
                    const j = await r.json();
                    return typeof j.unixtime === 'number' ? j.unixtime * 1000 : Date.parse(j.datetime);
                },
                async (signal) => {
                    const r = await fetch('https://timeapi.io/api/time/current/zone?timeZone=Asia%2FTehran', { signal });
                    if (!r.ok) throw new Error('bad response');
                    const j = await r.json();
                    return Date.parse(j.dateTime);
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
                    badge.textContent = '✓ زمان از سرور اینترنتی دریافت شد';
                    badge.classList.add('online');
                    scheduleBadgeFade(badge);
                    return;
                } catch { /* سرور بعدی */ }
            }
            badge.textContent = '⚠ آفلاین — مبنا ساعت دستگاه است';
            badge.classList.add('offline');
            scheduleBadgeFade(badge);
        }

