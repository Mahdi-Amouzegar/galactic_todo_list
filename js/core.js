// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// core.js -- shared state + tiny helpers  |  React: store shape + utils

        const STORAGE_KEY = 'spaceTodoTasks';
        const MAX_LENGTH = 200;

        const input = document.getElementById('taskInput');
        const prioritySelect = document.getElementById('prioritySelect');
        const addBtn = document.getElementById('addBtn');
        const searchInput = document.getElementById('searchInput');
        const taskList = document.getElementById('taskList');
        const filterBtns = document.querySelectorAll('.filter-btn');
        const clearBtn = document.getElementById('clearDone');
        const totalCountEl = document.getElementById('totalCount');
        const doneCountEl = document.getElementById('doneCount');
        const remainCountEl = document.getElementById('remainCount');
        const progressFill = document.getElementById('progressFill');
        const progressPct = document.getElementById('progressPct');
        const progressBar = document.getElementById('progressBar');

        const PRIORITY_LABELS = { high: 'اولویت زیاد', medium: 'اولویت متوسط', low: 'اولویت کم' };

        let tasks = [];
        let currentFilter = 'all';
        let currentSort = 'newest';
        let searchQuery = '';
        let justAddedId = null;
        let editingId = null;
        let addDraftSessions = []; // سررسیدهای پیش‌نویس فرم افزودن
        let pendingLoc = null;     // محل پیش‌نویس فرم افزودن {lat, lng}
        let pendingKind = 'task';  // نوع مورد جدید: task | series | plan
        let expandedPlans = new Set(); // شناسه برنامه‌های باز (رشته)
        let childDrafts = {};      // سررسیدهای پیش‌نویس کارها به تفکیک برنامه
        let planDraftKids = [];    // نام کارهای پیش‌نویس برنامه در فرم ساخت
        let seriesType = 'daily';    // نوع تکرار دوره در فرم ساخت
        let seriesN = 8;             // عدد تکرار ساعتی در فرم ساخت
        let seriesDays = [];         // روزهای انتخاب‌شده تکرار در فرم ساخت
        let prefs = { mapVisible: true, remindOn: true, remindMin: 60, digestOn: true, lastDigest: '', tourSeen: false, proMode: false, pendingKind: 'task', soundOn: true }; // ترجیحات (localStorage جدا)
        let selectedDay = null; // فیلتر روز تقویم: 'gy-gm-gd' یا null
        let calJy = 0, calJm = 1; // ماه جاری نمای تقویم

        // وضعیت پیکر تقویم
        let pickerMode = 'add';
        let pickerJy = 0, pickerJm = 1, pickerDay = null;
        let pickerCallback = null; // کال‌بک تأیید پیکر (مثلاً افزودن جلسه)

        // وظیفه‌ای که صفحه جزئیاتش باز است
        let currentDetailId = null;
        let relocateSess = null;      // {taskId, sessId} برای ثبت محل جلسه
        let pendingReturnDetail = null;

        // اختلاف ساعت دستگاه با سرور (میلی‌ثانیه)
        let timeOffsetMs = 0;

        /* ---------- ابزارها ---------- */

        const toFa = n => Number(n).toLocaleString('fa-IR');

        function faDate(iso) {
            try {
                const d = new Date(iso);
                if (isNaN(d)) return '';
                return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) +
                    '، ساعت ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
            } catch {
                return '';
            }
        }

        function uid() {
            if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
            return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        }

        // escape سریع با regex — بدون ساخت DOM
        // نکته: برای امنیت در innerHTML استفاده می‌شود. تک‌کوتیشن (') هم escape می‌شود
        // چون در attribute‌های HTML داخل template literal استفاده می‌کنیم.
        const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        const ESCAPE_REGEX = /[&<>"']/g;
        function escapeHtml(str) {
            if (str == null) return '';
            return String(str).replace(ESCAPE_REGEX, c => ESCAPE_MAP[c]);
        }

        // debounce: تأخیر در اجرای تابع تا وقتی کاربر متوقف شود
        // flush: اجرای فوری (برای قبل از بستن صفحه جزئیات)
        function debounce(fn, ms) {
            let timer = null;
            const wrapped = function (...args) {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    timer = null;
                    fn.apply(this, args);
                }, ms);
            };
            wrapped.cancel = () => { clearTimeout(timer); timer = null; };
            wrapped.flush = function (...args) {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                    fn.apply(this, args);
                }
            };
            return wrapped;
        }

        /* ---------- Focus trap و مودال‌های عمومی ---------- */

        // Focus trap: وقتی مودالی باز است، Tab و Shift+Tab نباید از مودال خارج شوند.
        // خروجی: تابع cleanup که باید هنگام بستن مودال صدا زده شود.
        function trapFocus(container) {
            if (!container) return () => {};
            const selectors = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
            const focusables = () => Array.from(container.querySelectorAll(selectors)).filter(el => {
                if (el.offsetParent === null) return false;
                if (el.getAttribute('aria-hidden') === 'true') return false;
                return true;
            });
            const handler = e => {
                if (e.key !== 'Tab') return;
                const list = focusables();
                if (list.length === 0) {
                    e.preventDefault();
                    return;
                }
                const first = list[0];
                const last = list[list.length - 1];
                const active = document.activeElement;
                if (e.shiftKey) {
                    if (active === first || !container.contains(active)) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (active === last || !container.contains(active)) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            };
            container.addEventListener('keydown', handler);
            return () => container.removeEventListener('keydown', handler);
        }

        // مودال تأیید (جایگزین confirm() بومی مرورگر)
        // options: { title, message, confirmText, cancelText, danger }
        // خروجی: Promise<boolean>
        function showConfirmModal(options) {
            const opts = options || {};
            const overlay = document.getElementById('confirmModal');
            if (!overlay) {
                // fallback به confirm بومی اگر مودال در HTML نبود
                return Promise.resolve(window.confirm(opts.message || 'مطمئن هستید؟'));
            }

            const titleEl = document.getElementById('confirmModalTitle');
            const msgEl = document.getElementById('confirmModalMessage');
            const okBtn = document.getElementById('confirmModalOk');
            const cancelBtn = document.getElementById('confirmModalCancel');

            if (titleEl) titleEl.textContent = opts.title || 'تأیید';
            if (msgEl) msgEl.textContent = opts.message || '';
            if (okBtn) {
                okBtn.textContent = opts.confirmText || 'تأیید';
                okBtn.classList.toggle('danger', Boolean(opts.danger));
            }
            if (cancelBtn) cancelBtn.textContent = opts.cancelText || 'انصراف';

            const previousFocus = document.activeElement;

            return new Promise(resolve => {
                let trapCleanup = null;

                const cleanup = () => {
                    overlay.style.display = 'none';
                    overlay.classList.remove('picker-overlay--stacked');
                    okBtn.removeEventListener('click', onOk);
                    cancelBtn.removeEventListener('click', onCancel);
                    overlay.removeEventListener('click', onOverlay);
                    document.removeEventListener('keydown', onKey);
                    if (trapCleanup) { trapCleanup(); trapCleanup = null; }

                    // بازگردانی فوکوس به المان قبلی
                    if (previousFocus && document.body.contains(previousFocus) && typeof previousFocus.focus === 'function') {
                        setTimeout(() => previousFocus.focus(), 30);
                    }
                };

                const finish = value => {
                    cleanup();
                    resolve(value);
                };

                const onOk = e => { e.preventDefault(); finish(true); };
                const onCancel = e => { e.preventDefault(); finish(false); };
                const onOverlay = e => { if (e.target === overlay) finish(false); };
                const onKey = e => {
                    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
                };

                okBtn.addEventListener('click', onOk);
                cancelBtn.addEventListener('click', onCancel);
                overlay.addEventListener('click', onOverlay);
                document.addEventListener('keydown', onKey);

                overlay.classList.add('picker-overlay--stacked');
                overlay.style.display = 'flex';
                trapCleanup = trapFocus(overlay);

                // فوکوس روی دکمه تأیید (یا انصراف اگر danger است)
                setTimeout(() => {
                    if (opts.danger) cancelBtn.focus();
                    else okBtn.focus();
                }, 60);
            });
        }

        // مودال اطلاعات (جایگزین details/expand برای توضیحات کوتاه)
        // options: { title, html, paragraphs, buttonText, fallbackAlert }
        // html: رشته HTML امن (خودت باید escapeHtml کنی) یا آرایه‌ای از پاراگراف‌ها
        function showInfoModal(options) {
            const opts = options || {};
            const overlay = document.getElementById('infoModal');
            if (!overlay) {
                if (opts.fallbackAlert) window.alert(opts.fallbackAlert);
                return Promise.resolve();
            }

            const titleEl = document.getElementById('infoModalTitle');
            const bodyEl = document.getElementById('infoModalBody');
            const okBtn = document.getElementById('infoModalOk');

            if (titleEl) titleEl.textContent = opts.title || 'اطلاعات';
            if (bodyEl) {
                if (Array.isArray(opts.paragraphs)) {
                    bodyEl.innerHTML = opts.paragraphs.map(p => `<p>${p}</p>`).join('');
                } else if (typeof opts.html === 'string') {
                    bodyEl.innerHTML = opts.html;
                } else {
                    bodyEl.innerHTML = '';
                }
            }
            if (okBtn) okBtn.textContent = opts.buttonText || 'فهمیدم';

            const previousFocus = document.activeElement;

            return new Promise(resolve => {
                let trapCleanup = null;

                const cleanup = () => {
                    overlay.style.display = 'none';
                    overlay.classList.remove('picker-overlay--stacked');
                    okBtn.removeEventListener('click', onOk);
                    overlay.removeEventListener('click', onOverlay);
                    document.removeEventListener('keydown', onKey);
                    if (trapCleanup) { trapCleanup(); trapCleanup = null; }

                    // بازگردانی فوکوس به المان قبلی
                    if (previousFocus && document.body.contains(previousFocus) && typeof previousFocus.focus === 'function') {
                        setTimeout(() => previousFocus.focus(), 30);
                    }
                };

                const finish = () => {
                    cleanup();
                    resolve();
                };

                const onOk = e => { e.preventDefault(); finish(); };
                const onOverlay = e => { if (e.target === overlay) finish(); };
                const onKey = e => {
                    if (e.key === 'Escape') { e.preventDefault(); finish(); }
                };

                okBtn.addEventListener('click', onOk);
                overlay.addEventListener('click', onOverlay);
                document.addEventListener('keydown', onKey);

                overlay.classList.add('picker-overlay--stacked');
                overlay.style.display = 'flex';
                trapCleanup = trapFocus(overlay);

                setTimeout(() => okBtn.focus(), 60);
            });
        }