// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// store.js -- IndexedDB + CRUD actions (single write path)  |  React: Redux slice / Zustand store
        /* ---------- ذخیره‌سازی: IndexedDB ---------- */

        const IDB_NAME = 'spaceTodoDB';
        const IDB_STORE = 'tasks';
        const IDB_TRASH = 'trash';
        const IDB_VERSION = 2;
        const useIDB = typeof indexedDB !== 'undefined';
        let idbPromise = null;

        function idbOpen() {
            if (!useIDB) return Promise.reject(new Error('no-indexeddb'));
            if (!idbPromise) {
                idbPromise = new Promise((resolve, reject) => {
                    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
                    req.onupgradeneeded = () => {
                        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
                            req.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
                        }
                        if (!req.result.objectStoreNames.contains(IDB_TRASH)) {
                            req.result.createObjectStore(IDB_TRASH, { keyPath: 'id' });
                        }
                    };
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
            }
            return idbPromise;
        }

        function idbGetAll(storeName) {
            return idbOpen().then(db => new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const rq = tx.objectStore(storeName).getAll();
                rq.onsuccess = () => resolve(rq.result || []);
                rq.onerror = () => reject(rq.error);
            }));
        }

        function idbPutAll(storeName, items) {
            return idbOpen().then(db => new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                store.clear();
                items.forEach(item => store.put(item));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            }));
        }

        // پاک‌سازی و اعتبارسنجی یک وظیفه + مهاجرت از مدل قدیمی (dueAt تکی)
        function sanitizeTask(t) {
            const sessions = Array.isArray(t.sessions)
                ? t.sessions
                    .filter(s => s && typeof s.at === 'string' && !isNaN(new Date(s.at)))
                    .map(s => ({ id: typeof s.id !== 'undefined' ? s.id : uid(), at: s.at, reminded: Boolean(s.reminded) }))
                : [];
            // مهاجرت: سررسید تکی نسخه‌های قبلی تبدیل به اولین جلسه می‌شود
            if (sessions.length === 0 && typeof t.dueAt === 'string' && !isNaN(new Date(t.dueAt))) {
                sessions.push({ id: uid(), at: t.dueAt });
            }
            const kind = t.kind === 'group' ? 'group' : 'task';
            // زیرکارها: فقط یک سطح، با همان اعتبارسنجی (بدون تودرتویی)
            const children = kind === 'group' && Array.isArray(t.children)
                ? t.children
                    .filter(c => c && typeof c.id !== 'undefined' && typeof c.text === 'string' && c.text.trim() !== '' && c.kind !== 'group')
                    .map(c => sanitizeTask({ ...c, kind: 'task', children: undefined }))
                : [];
            return {
                id: t.id,
                text: String(t.text).slice(0, MAX_LENGTH),
                completed: Boolean(t.completed),
                priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
                createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
                completedAt: (typeof t.completedAt === 'string' && !isNaN(new Date(t.completedAt))) ? t.completedAt : null,
                timeSpent: Number.isFinite(+t.timeSpent) && +t.timeSpent > 0 ? Math.floor(+t.timeSpent) : 0,
                timerStartedAt: (typeof t.timerStartedAt === 'string' && !isNaN(new Date(t.timerStartedAt))) ? t.timerStartedAt : null,
                description: typeof t.description === 'string' ? t.description.slice(0, 1000) : '',
                phone: typeof t.phone === 'string' ? t.phone.slice(0, 20) : '',
                address: typeof t.address === 'string' ? t.address.slice(0, 500) : '',
                url: typeof t.url === 'string' ? t.url.slice(0, 300) : '',
                sessions,
                kind,
                children,
                pinned: Boolean(t.pinned),
                recur: ['daily', 'weekly', 'monthly'].includes(t.recur) ? t.recur : 'none',
                archived: Boolean(t.archived),
                photos: Array.isArray(t.photos) ? t.photos
                    .filter(p => p && typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image') && p.dataUrl.length < 1500000)
                    .slice(0, 8)
                    .map(p => ({ id: typeof p.id !== 'undefined' ? p.id : uid(), dataUrl: p.dataUrl, addedAt: typeof p.addedAt === 'string' ? p.addedAt : new Date().toISOString() }))
                    : [],
                location: kind === 'group' ? null : ((t.location && Number.isFinite(+t.location.lat) && Number.isFinite(+t.location.lng) &&
                    Math.abs(+t.location.lat) <= 90 && Math.abs(+t.location.lng) <= 180)
                    ? { lat: +t.location.lat, lng: +t.location.lng }
                    : null)
            };
        }

        // خواندن قالب قدیمی localStorage (فقط برای مهاجرت یک‌باره به IndexedDB)
        function readLegacyStorage() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) return [];
                return parsed.filter(t =>
                    t && typeof t.id !== 'undefined' &&
                    typeof t.text === 'string' && t.text.trim() !== ''
                );
            } catch {
                return [];
            }
        }

        async function loadTasks() {
            let raw = [];
            if (useIDB) {
                try {
                    raw = await idbGetAll(IDB_STORE);
                } catch {
                    raw = [];
                }
            }
            // مهاجرت یک‌باره از localStorage به IndexedDB
            if (raw.length === 0) {
                const legacy = readLegacyStorage();
                if (legacy.length > 0) {
                    tasks = legacy.map(sanitizeTask);
                    await saveTasks();
                    try { localStorage.removeItem(STORAGE_KEY); } catch { /* نادیده */ }
                    return;
                }
            }
            tasks = raw
                .filter(t => t && typeof t.id !== 'undefined' && typeof t.text === 'string' && t.text.trim() !== '')
                .map(sanitizeTask);
        }

        // ذخیره غیردرنگ: حافظه و رابط کاربری فوری به‌روز می‌شود، نوشتن در IDB در پس‌زمینه
        function saveTasks() {
            const snapshot = tasks.map(t => ({ ...t, sessions: t.sessions.map(s => ({ ...s })) }));
            const p = useIDB
                ? idbPutAll(IDB_STORE, snapshot)
                : (function () {
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
                        return Promise.resolve();
                    } catch (e) {
                        return Promise.reject(e);
                    }
                })();
            p.catch(() => {
                console.error('storage save failed');
                if (!saveTasks._warned) {
                    saveTasks._warned = true;
                    alert('خطا در ذخیره‌سازی محلی.');
                }
            });
            return p;
        }

        /* ---------- عملیات ---------- */

        function addTask() {
            const text = input.value.trim().replace(/\s+/g, ' ');
            if (!text) {
                input.classList.remove('input-error');
                void input.offsetWidth; // ری‌استارت انیمیشن لرزش
                input.classList.add('input-error');
                input.focus();
                return;
            }
            justAddedId = uid();
            const isGroup = pendingKind === 'group';
            tasks.unshift({
                id: justAddedId,
                text: text.slice(0, MAX_LENGTH),
                completed: false,
                priority: prioritySelect.value,
                createdAt: new Date().toISOString(),
                description: '',
                phone: '',
                address: '',
                url: '',
                kind: isGroup ? 'group' : 'task',
                children: [],
                sessions: addDraftSessions.map(s => ({ ...s })),
                location: !isGroup && pendingLoc ? { ...pendingLoc } : null
            });
            if (isGroup) expandedGroups.add(String(justAddedId));
            saveTasks();
            input.value = '';
            input.classList.remove('input-error');
            addDraftSessions = [];
            updateDueChips();
            pendingLoc = null;
            if (pickMarker && mapReady) { map.removeLayer(pickMarker); pickMarker = null; }
            updateLocChip();
            input.focus();
            render();
        }

        // یافتن وظیفه یا زیرکار در همه‌جا (برمی‌گرداند {task, parent})
        function findTask(id) {
            for (const t of tasks) {
                if (String(t.id) === String(id)) return { task: t, parent: null };
                if (t.kind === 'group') {
                    const c = (t.children || []).find(x => String(x.id) === String(id));
                    if (c) return { task: c, parent: t };
                }
            }
            return null;
        }

        function groupStats(g) {
            const k = visibleChildren(g);
            return { total: k.length, done: k.filter(c => c.completed).length };
        }

        function groupIsDone(g) {
            const s = groupStats(g);
            return s.total > 0 && s.done === s.total;
        }

        function groupDueKey(g) {
            const now = getNow().getTime();
            let best = Infinity;
            (g.sessions || []).forEach(s => {
                const v = new Date(s.at).getTime();
                if (v >= now && v < best) best = v;
            });
            (g.children || []).forEach(c => {
                if (c.archived) return;
                const u = nearestUpcoming(c);
                if (u) {
                    const v = new Date(u.at).getTime();
                    if (v < best) best = v;
                }
            });
            return best;
        }

        let trash = [];

        function daysInMonth(gy, gm) {
            return new Date(gy, gm + 1, 0).getDate();
        }

        function addInterval(date, recur) {
            const d = new Date(date.getTime());
            if (recur === 'daily') d.setDate(d.getDate() + 1);
            else if (recur === 'weekly') d.setDate(d.getDate() + 7);
            else if (recur === 'monthly') {
                const day = d.getDate();
                d.setDate(1);
                d.setMonth(d.getMonth() + 1);
                d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
            }
            return d;
        }

        // تکمیل وظیفه تکرارشونده: جلسه بعدی ساخته و وظیفه فعال می‌ماند
        function advanceRecur(task) {
            const list = task.sessions || [];
            let base = Date.now();
            if (list.length) {
                base = list.reduce((m, s) => {
                    const v = new Date(s.at).getTime();
                    return isNaN(v) ? m : Math.max(m, v);
                }, base);
            }
            task.sessions.push({ id: uid(), at: addInterval(new Date(base), task.recur).toISOString(), reminded: false });
        }

        async function loadTrash() {
            if (useIDB) {
                try {
                    trash = await idbGetAll(IDB_TRASH);
                } catch {
                    trash = [];
                }
            }
            purgeTrash(false);
        }

        function saveTrash() {
            const p = useIDB ? idbPutAll(IDB_TRASH, trash) : Promise.resolve();
            p.catch(() => {});
            return p;
        }

        // حذف خودکار موارد قدیمی‌تر از ۳۰ روز
        function purgeTrash(renderAfter) {
            const cut = Date.now() - 30 * 86400000;
            const before = trash.length;
            trash = trash.filter(x => {
                try {
                    return new Date(x.deletedAt).getTime() > cut;
                } catch {
                    return false;
                }
            });
            if (trash.length !== before) {
                saveTrash();
                if (renderAfter !== false) render();
            }
        }

        function moveToTrashById(id) {
            const found = findTask(id);
            if (!found) return false;
            if (found.parent) found.parent.children = found.parent.children.filter(c => String(c.id) !== String(id));
            else tasks = tasks.filter(t => String(t.id) !== String(id));
            trash.unshift({ ...found.task, parentId: found.parent ? found.parent.id : null, deletedAt: new Date().toISOString() });
            saveTrash();
            saveTasks();
            return true;
        }

        function restoreTrash(id) {
            const i = trash.findIndex(x => String(x.id) === String(id));
            if (i < 0) return;
            const [item] = trash.splice(i, 1);
            const { parentId, deletedAt, ...rest } = item;
            const g = parentId ? tasks.find(t => String(t.id) === String(parentId) && t.kind === 'group') : null;
            if (g) (g.children = g.children || []).unshift(rest);
            else tasks.unshift(rest);
            saveTrash();
            saveTasks();
            render();
            renderTrash();
        }

        function toggleTask(id) {
            const found = findTask(id);
            if (!found) return;
            found.task.completed = !found.task.completed;
            found.task.completedAt = found.task.completed ? new Date().toISOString() : null;
            if (found.task.completed && found.task.recur && found.task.recur !== 'none') {
                advanceRecur(found.task);
                found.task.completed = false;
            }
            saveTasks();
            render();
        }

        function deleteTask(id, el) {
            const pre = findTask(id);
            if (pre && !pre.parent && pre.task.kind === 'group' && (pre.task.children || []).length > 0) {
                if (!confirm(`این گروه ${toFa(pre.task.children.length)} زیرکار دارد. همه با هم به سطل منتقل شوند؟`)) return;
            }
            const remove = () => {
                if (!moveToTrashById(id)) return;
                render();
                showUndoFor([id], 'به سطل زباله منتقل شد');
            };
            if (el) {
                el.classList.add('removing');
                setTimeout(remove, 220);
            } else {
                remove();
            }
        }

        function archiveDone() {
            let n = 0;
            tasks.forEach(t => {
                if (t.kind === 'group') (t.children || []).forEach(c => {
                    if (c.completed && !c.archived) { c.archived = true; n++; }
                });
                else if (t.completed && !t.archived) { t.archived = true; n++; }
            });
            if (!n) return;
            saveTasks();
            render();
        }

        function clearCompleted() {
            const ids = [];
            tasks.forEach(t => {
                if (t.kind === 'group') (t.children || []).forEach(c => { if (c.completed && !c.archived) ids.push(c.id); });
                else if (t.completed && !t.archived) ids.push(t.id);
            });
            if (ids.length === 0) return;
            if (!confirm(`${toFa(ids.length)} وظیفه انجام‌شده به سطل زباله منتقل شود؟`)) return;
            ids.forEach(moveToTrashById);
            render();
            showUndoFor(ids, `${toFa(ids.length)} مورد به سطل منتقل شد`);
        }

        const GROUP_TEMPLATES = [
            { id: 'weekly-shop', title: '🛒 خرید هفتگی', children: ['نان', 'میوه', 'سبزی', 'لبنیات', 'گوشت و مرغ', 'خشکبار'] },
            { id: 'trip', title: '✈️ آماده‌سازی سفر', children: ['بلیط رفت و برگشت', 'رزرو هتل', 'بستن چمدان', 'مدارک شناسایی', 'شارژر و پاوربانک'] },
            { id: 'clean', title: '🧹 نظافت خانه', children: ['گردگیری', 'جارو و تی', 'آشپزخانه', 'حمام و سرویس', 'شستن لباس‌ها'] }
        ];

        function blankTask(text) {
            return {
                id: uid(),
                text: text.slice(0, MAX_LENGTH),
                completed: false,
                completedAt: null,
                priority: 'medium',
                createdAt: new Date().toISOString(),
                description: '',
                phone: '',
                address: '',
                url: '',
                kind: 'task',
                children: [],
                pinned: false,
                recur: 'none',
                timeSpent: 0,
                timerStartedAt: null,
                sessions: [],
                location: null,
                photos: []
            };
        }

        function createGroupFromTemplate(tid) {
            const tpl = GROUP_TEMPLATES.find(x => x.id === tid);
            if (!tpl) return;
            const g = blankTask(tpl.title);
            g.kind = 'group';
            g.children = tpl.children.map(name => blankTask(name));
            tasks.unshift(g);
            expandedGroups.add(String(g.id));
            justAddedId = g.id;
            saveTasks();
            render();
        }

        function addChild(gid) {
            const g = tasks.find(t => String(t.id) === String(gid) && t.kind === 'group');
            if (!g) return;
            const item = taskList.querySelector(`.task-item[data-id="${gid}"]`);
            const inp = item ? item.querySelector('.child-input') : null;
            const prio = item ? item.querySelector('.child-prio') : null;
            const text = inp ? inp.value.trim().replace(/\s+/g, ' ') : '';
            if (!text) {
                if (inp) {
                    inp.focus();
                    inp.classList.remove('input-error');
                    void inp.offsetWidth;
                    inp.classList.add('input-error');
                }
                return;
            }
            justAddedId = uid();
            g.children.unshift({
                id: justAddedId,
                text: text.slice(0, MAX_LENGTH),
                completed: false,
                priority: prio && ['high', 'medium', 'low'].includes(prio.value) ? prio.value : 'medium',
                createdAt: new Date().toISOString(),
                description: '',
                phone: '',
                address: '',
                url: '',
                kind: 'task',
                children: [],
                sessions: (childDrafts[gid] || []).map(s => ({ ...s })),
                location: null
            });
            childDrafts[gid] = [];
            saveTasks();
            render();
            const ni = taskList.querySelector(`.task-item[data-id="${gid}"] .child-input`);
            if (ni) ni.focus();
        }

