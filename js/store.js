'use strict';
// store.js -- IndexedDB + CRUD actions (single write path)  |  React: Redux slice / Zustand store
        /* ---------- ذخیره‌سازی: IndexedDB ---------- */

        const IDB_NAME = 'spaceTodoDB';
        const IDB_STORE = 'tasks';
        const IDB_VERSION = 1;
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
                    };
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
            }
            return idbPromise;
        }

        function idbGetAll() {
            return idbOpen().then(db => new Promise((resolve, reject) => {
                const tx = db.transaction(IDB_STORE, 'readonly');
                const rq = tx.objectStore(IDB_STORE).getAll();
                rq.onsuccess = () => resolve(rq.result || []);
                rq.onerror = () => reject(rq.error);
            }));
        }

        function idbPutAll(items) {
            return idbOpen().then(db => new Promise((resolve, reject) => {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                const store = tx.objectStore(IDB_STORE);
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
                    .map(s => ({ id: typeof s.id !== 'undefined' ? s.id : uid(), at: s.at }))
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
                description: typeof t.description === 'string' ? t.description.slice(0, 1000) : '',
                phone: typeof t.phone === 'string' ? t.phone.slice(0, 20) : '',
                address: typeof t.address === 'string' ? t.address.slice(0, 500) : '',
                url: typeof t.url === 'string' ? t.url.slice(0, 300) : '',
                sessions,
                kind,
                children,
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
                    raw = await idbGetAll();
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
                ? idbPutAll(snapshot)
                : (function () {
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
                        return Promise.resolve();
                    } catch (e) {
                        return Promise.reject(e);
                    }
                })();
            p.catch(() => {
                alert('خطا در ذخیره‌سازی محلی.');
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
            const k = g.children || [];
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
                const u = nearestUpcoming(c);
                if (u) {
                    const v = new Date(u.at).getTime();
                    if (v < best) best = v;
                }
            });
            return best;
        }

        function toggleTask(id) {
            const found = findTask(id);
            if (found) {
                found.task.completed = !found.task.completed;
                saveTasks();
                render();
            }
        }

        function deleteTask(id, el) {
            const remove = () => {
                const found = findTask(id);
                if (!found) return;
                if (found.parent) {
                    found.parent.children = found.parent.children.filter(c => String(c.id) !== String(id));
                } else {
                    tasks = tasks.filter(t => String(t.id) !== String(id));
                }
                saveTasks();
                render();
            };
            if (el) {
                el.classList.add('removing');
                setTimeout(remove, 220);
            } else {
                remove();
            }
        }

        function clearCompleted() {
            let done = tasks.filter(t => t.kind !== 'group' && t.completed).length;
            tasks.forEach(t => {
                if (t.kind === 'group') done += (t.children || []).filter(c => c.completed).length;
            });
            if (done === 0) return;
            if (!confirm(`${toFa(done)} وظیفه انجام‌شده حذف شود؟`)) return;
            tasks = tasks.filter(t => !(t.kind !== 'group' && t.completed));
            tasks.forEach(t => {
                if (t.kind === 'group') t.children = (t.children || []).filter(c => !c.completed);
            });
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
            g.children.unshift({
                id: uid(),
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

