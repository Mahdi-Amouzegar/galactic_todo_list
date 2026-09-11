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
                    if (!AC) return null;
                    audioCtx = new AC();
                }
                if (audioCtx.state === 'suspended') {
                    // resume فقط بعد از user gesture مجاز است. اگر رد شود،
                    // فقط یک warning در Console می‌آید که با catch مدیریت می‌شود.
                    const p = audioCtx.resume();
                    if (p && typeof p.catch === 'function') p.catch(() => {});
                }
                return audioCtx;
            } catch {
                return null;
            }
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

        // اعلان ماندگار سیستمی از طریق سرویس‌ورکر: وقتی تب در پس‌زمینه است هم
        // در مرکز اعلان سیستم‌عامل دیده می‌شود (برخلاف new Notification صفحه).
        // خروجی Promise<boolean> است تا فقط در صورت نمایش موفق، «یادآوری شد» ثبت شود.
        function fireNotification(title, body, tag) {
            if (!notifGranted()) return Promise.resolve(false);
            const opts = { body, tag, icon: 'icons/icon-192.png', dir: 'rtl', lang: 'fa' };
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                return navigator.serviceWorker.ready
                    .then(reg => reg.showNotification(title, opts))
                    .then(() => true)
                    .catch(() => legacyNotif(title, opts));
            }
            return Promise.resolve(legacyNotif(title, opts));
        }

        function legacyNotif(title, opts) {
            try {
                new Notification(title, opts);
                return true;
            } catch {
                return false;
            }
        }

        function markReminded(taskId, sessId, which) {
            const found = findTask(taskId);
            if (!found) return;
            const s = (found.task.sessions || []).find(x => String(x.id) === String(sessId));
            if (s) {
                if (which === 'due') s.remindedDue = true;
                else s.reminded = true;
                saveTasks();
            }
        }

        function checkReminders() {
            if (!prefs.remindOn || !notifGranted()) return;
            const now = Date.now();
            // تلورانس دو دقیقه‌ای برای دریفت تایمر ۶۰ ثانیه‌ای و برگشت از پس‌زمینه
            const REMINDER_GRACE = 2 * 60 * 1000;
            const NEAR_DUE_MIN = 5;
            allSessions(true).forEach(s => {
                const rm = (s.remindMin != null) ? s.remindMin : prefs.remindMin;
                if (!rm) return; // ۰ یعنی خاموش برای این جلسه
                const v = new Date(s.at).getTime();
                if (isNaN(v)) return;

                // ۱) هشدار زودهنگام: زمان انتخاب‌شده در تنظیمات قبل از جلسه
                const leadTarget = v - rm * 60 * 1000;
                if (!s.reminded && now >= leadTarget && now < v) {
                    fireNotification('⏰ یادآور جلسه', `${s.owner} — ${faShort(s.at)}`, 'sess-' + s.id).then(ok => {
                        if (ok) {
                            playChime();
                            markReminded(s.taskId, s.id, 'lead');
                        }
                    });
                }

                // ۲) هشدار نزدیک جلسه: دقیقاً ۵ دقیقه قبل، با تلورانس برای تأخیر اجرای تایمر
                const nearDueTarget = v - NEAR_DUE_MIN * 60 * 1000;
                if (!s.remindedDue && now >= nearDueTarget && now < v && now - nearDueTarget <= REMINDER_GRACE) {
                    fireNotification('🔔 ۵ دقیقه تا جلسه', `${s.owner} — ${faShort(s.at)}`, 'due-' + s.id).then(ok => {
                        if (ok) {
                            playChime();
                            markReminded(s.taskId, s.id, 'due');
                        }
                    });
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
            fireNotification('📅 برنامه امروز', body, 'digest-' + day).then(ok => {
                if (ok) {
                    playChime();
                    prefs.lastDigest = day;
                    savePrefs();
                }
            });
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
