'use strict';
// core.js -- shared state + tiny helpers  |  React: store shape + utils

        'use strict';

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
        let pendingKind = 'task';  // نوع مورد جدید: task | group
        let expandedGroups = new Set(); // شناسه گروه‌های باز (رشته)
        let childDrafts = {};      // سررسیدهای پیش‌نویس زیرکارها به تفکیک گروه
        let prefs = { mapVisible: true }; // ترجیحات رابط کاربری (localStorage جدا)

        // وضعیت پیکر تقویم
        let pickerMode = 'add';
        let pickerJy = 0, pickerJm = 1, pickerDay = null;
        let pickerCallback = null; // کال‌بک تأیید پیکر (مثلاً افزودن جلسه)

        // وظیفه‌ای که صفحه جزئیاتش باز است
        let currentDetailId = null;

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

        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

