// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// notify.js -- offline reminders + morning digest  |  React: hooks/useReminders.js
        function notifSupported() {
            return 'Notification' in window;
        }

        function notifGranted() {
            return notifSupported() && Notification.permission === 'granted';
        }

        function updateNotifStatus() {
            const el = document.getElementById('notifStatus');
            if (!el) return;
            el.classList.remove('ok');
            if (!notifSupported()) {
                el.textContent = 'مرورگر شما اعلان پشتیبانی نمی‌کند.';
            } else if (Notification.permission === 'granted') {
                el.textContent = '✓ اعلان‌ها فعال‌اند.';
                el.classList.add('ok');
            } else if (Notification.permission === 'denied') {
                el.textContent = 'اعلان‌ها مسدود شده‌اند؛ از تنظیمات مرورگر فعال کنید.';
            } else {
                el.textContent = 'برای دریافت یادآور، دکمه فعال‌سازی را بزنید.';
            }
        }

        async function ensureNotifPerm() {
            if (!notifSupported()) return false;
            if (Notification.permission === 'granted') return true;
            try {
                return (await Notification.requestPermission()) === 'granted';
            } catch {
                return false;
            }
        }

        let audioCtx = null;

        function ensureAudio() {
            try {
                if (!audioCtx) {
                    const AC = window.AudioContext || window.webkitAudioContext;
                    if (!AC) return;
                    audioCtx = new AC();
                }
                if (audioCtx.state === 'suspended') audioCtx.resume();
            } catch { /* نادیده */ }
        }

        // زنگ ملایم کاملاً آفلاین (بدون فایل صوتی): دو نت سینوسی
        function playChime() {
            if (prefs.soundOn === false) return;
            try {
                ensureAudio();
                if (!audioCtx || audioCtx.state !== 'running') return;
                const t0 = audioCtx.currentTime;
                [[659.25, 0], [880, 0.35]].forEach(([freq, dt]) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0.0001, t0 + dt);
                    gain.gain.exponentialRampToValueAtTime(0.25, t0 + dt + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.9);
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(t0 + dt);
                    osc.stop(t0 + dt + 1);
                });
            } catch { /* نادیده */ }
        }

        function fireNotification(title, body, tag) {
            if (!notifGranted()) return false;
            try {
                new Notification(title, { body, tag, icon: 'icons/icon-192.png', dir: 'rtl', lang: 'fa' });
                return true;
            } catch {
                return false;
            }
        }

        function markReminded(taskId, sessId) {
            const found = findTask(taskId);
            if (!found) return;
            const s = (found.task.sessions || []).find(x => String(x.id) === String(sessId));
            if (s) {
                s.reminded = true;
                saveTasks();
            }
        }

        function checkReminders() {
            if (!prefs.remindOn || !notifGranted()) return;
            const now = Date.now();
            allSessions(true).forEach(s => {
                if (s.reminded) return;
                const rm = (s.remindMin != null) ? s.remindMin : prefs.remindMin;
                if (!rm) return; // ۰ یعنی خاموش برای این جلسه
                const v = new Date(s.at).getTime();
                if (isNaN(v) || v <= now || v - now > rm * 60 * 1000) return;
                if (fireNotification('⏰ یادآور جلسه', `${s.owner} — ${faShort(s.at)}`, 'sess-' + s.id)) {
                    playChime();
                    markReminded(s.taskId, s.id);
                }
            });
        }

        function checkDigest() {
            if (!prefs.digestOn || !notifGranted()) return;
            const now = getNow();
            if (now.getHours() < 6) return;
            const day = dayKey(now);
            if (prefs.lastDigest === day) return;
            const todays = allSessions(true).filter(s => dayKey(new Date(s.at)) === day);
            const body = todays.length
                ? `امروز ${toFa(todays.length)} جلسه داری: ${todays.slice(0, 3).map(s => s.owner).join('، ')}${todays.length > 3 ? ' و…' : ''}`
                : 'امروز جلسه‌ای نداری 🎉';
            if (fireNotification('📅 برنامه امروز', body, 'digest-' + day)) {
                playChime();
                prefs.lastDigest = day;
                savePrefs();
            }
        }

        function startReminderLoop() {
            const run = () => {
                try {
                    checkReminders();
                    checkDigest();
                } catch { /* نادیده */ }
            };
            run();
            setInterval(run, 60000);
            document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
        }
