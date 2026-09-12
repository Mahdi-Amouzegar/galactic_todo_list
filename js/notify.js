// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
// notify.js -- offline reminders + morning digest (ESM)

import { state, toFa } from './core.js';
import { findTask, saveTasks } from './store.js';
import { allSessions, faShort, dayKey } from './sessions.js';
import { getNow } from './time.js';
import { savePrefs } from './map.js';

// ═══════════════════════════════════════════════════════════════════════════
// Notification support
// ═══════════════════════════════════════════════════════════════════════════

export function notifSupported() {
    return 'Notification' in window;
}

export function notifGranted() {
    return notifSupported() && Notification.permission === 'granted';
}

export function updateNotifStatus() {
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

export async function ensureNotifPerm() {
    if (!notifSupported()) return false;
    if (Notification.permission === 'granted') return true;
    try {
        return (await Notification.requestPermission()) === 'granted';
    } catch {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Audio
// ═══════════════════════════════════════════════════════════════════════════

let audioCtx = null;

export function ensureAudio() {
    try {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            audioCtx = new AC();
        }
        if (audioCtx.state === 'suspended') {
            const p = audioCtx.resume();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        }
        return audioCtx;
    } catch {
        return null;
    }
}

export function playChime() {
    if (state.prefs.soundOn === false) return;
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

// ═══════════════════════════════════════════════════════════════════════════
// Notification firing
// ═══════════════════════════════════════════════════════════════════════════

export function fireNotification(title, body, tag) {
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

export function legacyNotif(title, opts) {
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

// ═══════════════════════════════════════════════════════════════════════════
// Reminders check
// ═══════════════════════════════════════════════════════════════════════════

export function checkReminders() {
    if (!state.prefs.remindOn) return;
    if (!notifGranted()) return;
    const now = Date.now();
    const REMINDER_GRACE = 2 * 60 * 1000;
    const NEAR_DUE_MIN = 5;
    allSessions(true).forEach(s => {
        const rm = (s.remindMin != null) ? s.remindMin : state.prefs.remindMin;
        const v = new Date(s.at).getTime();
        if (isNaN(v)) return;

        // ۱. یادآور اصلی (مثلاً ۶۰ دقیقه قبل)
        if (rm && rm > 0) {
            const leadTarget = v - rm * 60 * 1000;
            if (!s.reminded && now >= leadTarget && now < v) {
                fireNotification('⏰ یادآور جلسه', `${s.owner} — ${faShort(s.at)}`, 'sess-' + s.id).then(ok => {
                    if (ok) {
                        playChime();
                        markReminded(s.taskId, s.id, 'lead');
                    }
                });
            }
        }

        // ۲. هشدار ۵ دقیقه قبل (همیشه، مستقل از rm)
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

// ═══════════════════════════════════════════════════════════════════════════
// Digest
// ═══════════════════════════════════════════════════════════════════════════

export function checkDigest() {
    if (!state.prefs.digestOn || !notifGranted()) return;
    const now = getNow();
    if (now.getHours() < 6) return;
    const day = dayKey(now);
    if (state.prefs.lastDigest === day) return;

    // نکته: allSessions(false) چون می‌خواهیم همه جلسات امروز (حتی completed) را ببینیم
    const todays = allSessions(false).filter(s => dayKey(new Date(s.at)) === day);
    const body = todays.length
        ? `امروز ${toFa(todays.length)} جلسه داری: ${todays.slice(0, 3).map(s => s.owner).join('، ')}${todays.length > 3 ? ' و…' : ''}`
        : 'امروز جلسه‌ای نداری 🎉';
    fireNotification('📅 برنامه امروز', body, 'digest-' + day).then(ok => {
        if (ok) {
            playChime();
            state.prefs.lastDigest = day;
            savePrefs();
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Reminder loop
// ═══════════════════════════════════════════════════════════════════════════

export function startReminderLoop() {
    const run = () => {
        try {
            checkReminders();
            checkDigest();
        } catch (e) {
            console.error('reminder loop error', e);
        }
    };
    run();
    setInterval(run, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ گام ۱۵: SHIM‌ها حذف شدند
// ═══════════════════════════════════════════════════════════════════════════