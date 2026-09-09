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

        function validLoc(v) {
            return (v && Number.isFinite(+v.lat) && Number.isFinite(+v.lng) &&
                Math.abs(+v.lat) <= 90 && Math.abs(+v.lng) <= 180)
                ? { lat: +v.lat, lng: +v.lng }
                : null;
        }

        // پاک‌سازی و اعتبارسنجی + مهاجرت مدل قدیمی (dueAt تکی، kind گروه→برنامه)
        function sanitizeTask(t) {
            const sessions = Array.isArray(t.sessions)
                ? t.sessions
                    .filter(s => s && typeof s.at === 'string' && !isNaN(new Date(s.at)))
                    .map(s => ({ id: typeof s.id !== 'undefined' ? s.id : uid(), at: s.at, reminded: Boolean(s.reminded), location: validLoc(s.location), remindMin: (s.remindMin === null || s.remindMin === undefined) ? null : (Number.isFinite(+s.remindMin) && +s.remindMin >= 0 ? Math.floor(+s.remindMin) : null) }))
                : [];
            // حذف تکراری‌های هم‌دقیقه (ممکن است با اختلاف ثانیه ثبت شده باشند)
            for (let i = sessions.length - 1; i >= 0; i--) {
                if (sessions.findIndex(x => sameMinute(x.at, sessions[i].at)) !== i) sessions.splice(i, 1);
            }
            // مهاجرت: سررسید تکی نسخه‌های قبلی تبدیل به اولین جلسه می‌شود
            if (sessions.length === 0 && typeof t.dueAt === 'string' && !isNaN(new Date(t.dueAt))) {
                sessions.push({ id: uid(), at: t.dueAt });
            }
            const kind = (t.kind === 'plan' || t.kind === 'group')
                ? 'plan'
                : (t.kind === 'series' ? 'series' : 'task');
            // زیرکارها: فقط یک سطح، با همان اعتبارسنجی (بدون تودرتویی)
            const children = kind === 'plan' && Array.isArray(t.children)
                ? t.children
                    .filter(c => c && typeof c.id !== 'undefined' && typeof c.text === 'string' && c.text.trim() !== '' && c.kind !== 'plan')
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
                startAt: (typeof t.startAt === 'string' && !isNaN(new Date(t.startAt))) ? t.startAt : null,
                endAt: (typeof t.endAt === 'string' && !isNaN(new Date(t.endAt))) ? t.endAt : null,
                description: typeof t.description === 'string' ? t.description.slice(0, 1000) : '',
                phone: typeof t.phone === 'string' ? t.phone.slice(0, 20) : '',
                address: typeof t.address === 'string' ? t.address.slice(0, 500) : '',
                url: typeof t.url === 'string' ? t.url.slice(0, 300) : '',
                sessions,
                kind,
                children,
                pinned: Boolean(t.pinned),
                recur: ['daily', 'weekly', 'monthly', 'custom', 'hourly', 'weeklyDays', 'monthlyDays'].includes(t.recur) ? t.recur : 'none',
                recurN: (Number.isFinite(+t.recurN) && +t.recurN >= 1 && +t.recurN <= 365) ? Math.floor(+t.recurN) : null,
                recurDays: Array.isArray(t.recurDays) ? [...new Set(t.recurDays.map(x => Math.floor(+x)).filter(x => x >= 0 && x <= 31))].slice(0, 31) : [],
                archived: Boolean(t.archived),
                photos: Array.isArray(t.photos) ? t.photos
                    .filter(p => p && typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image') && p.dataUrl.length < 1500000)
                    .slice(0, 8)
                    .map(p => ({ id: typeof p.id !== 'undefined' ? p.id : uid(), dataUrl: p.dataUrl, addedAt: typeof p.addedAt === 'string' ? p.addedAt : new Date().toISOString() }))
                    : [],
                location: kind === 'plan' ? null : validLoc(t.location)
            };
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

        function addTask(forceKind) {
            const text = input.value.trim().replace(/\s+/g, ' ');
            if (!text) {
                input.classList.remove('input-error');
                void input.offsetWidth; // ری‌استارت انیمیشن لرزش
                input.classList.add('input-error');
                input.focus();
                return;
            }
            const kind = forceKind || pendingKind || 'task';
            const isPlan = kind === 'plan';
            const isSeries = kind === 'series';
            let recur = 'none';
            let recurN = null;
            let recurDays = [];
            let sessions = addDraftSessions.map(s => ({ ...s }));
            if (isSeries) {
                const errEl = document.getElementById('seriesError');
                if (errEl) errEl.textContent = '';
                if (seriesType === 'dates') {
                    sessions.sort((a, b) => new Date(a.at) - new Date(b.at));
                } else if (['hourly', 'daily', 'weekly', 'monthly'].includes(seriesType)) {
                    recur = seriesType;
                    sessions = [];
                } else if (seriesType === 'hourlyN') {
                    const n = parseInt(document.getElementById('seriesN').value, 10);
                    if (!(n >= 1 && n <= 168)) {
                        if (errEl) errEl.textContent = 'عدد ساعت بین ۱ تا ۱۶۸ باشد';
                        input.focus();
                        return;
                    }
                    recur = 'hourly';
                    recurN = n;
                    sessions = [];
                } else if (seriesType === 'weeklyDays' || seriesType === 'monthlyDays') {
                    if (!seriesDays.length) {
                        if (errEl) errEl.textContent = 'حداقل یک روز انتخاب کنید';
                        input.focus();
                        return;
                    }
                    recur = seriesType;
                    recurDays = [...seriesDays];
                    sessions = [];
                }
            }
            justAddedId = uid();
            tasks.unshift({
                id: justAddedId,
                text: text.slice(0, MAX_LENGTH),
                completed: false,
                completedAt: null,
                priority: prioritySelect.value,
                recur,
                recurN,
                recurDays,
                description: document.getElementById('descInput').value.trim().slice(0, 1000),
                createdAt: new Date().toISOString(),
                phone: '',
                address: '',
                url: '',
                kind: isPlan ? 'plan' : (isSeries ? 'series' : 'task'),
                children: isPlan ? planDraftKids.map(k => blankTask(k)) : [],
                pinned: false,
                archived: false,
                timeSpent: 0,
                timerStartedAt: null,
                sessions,
                location: !isPlan && pendingLoc ? { ...pendingLoc } : null,
                photos: []
            });
            if (isPlan) expandedPlans.add(String(justAddedId));
            saveTasks();
            input.value = '';
            input.classList.remove('input-error');
            addDraftSessions = [];
            updateDueChips();
            planDraftKids = [];
            renderPlanKids();
            document.getElementById('descInput').value = '';
            document.getElementById('prioritySelect').value = 'medium';
            const sErr = document.getElementById('seriesError');
            if (sErr) sErr.textContent = '';
            pendingLoc = null;
            if (pickMarker && mapReady) { map.removeLayer(pickMarker); pickMarker = null; }
            updateLocChip();
            input.focus();
            render();
            if (kind === 'series') {
                const newId = justAddedId;
                justAddedId = null;
                openDetail(newId);
            }
        }

        // یافتن وظیفه یا زیرکار در همه‌جا (برمی‌گرداند {task, parent})
        function findTask(id) {
            for (const t of tasks) {
                if (String(t.id) === String(id)) return { task: t, parent: null };
                if (t.kind === 'plan') {
                    const c = (t.children || []).find(x => String(x.id) === String(id));
                    if (c) return { task: c, parent: t };
                }
            }
            return null;
        }

        function planStats(g) {
            const k = visibleChildren(g);
            return { total: k.length, done: k.filter(c => c.completed).length };
        }

        function planIsDone(g) {
            const s = planStats(g);
            return s.total > 0 && s.done === s.total;
        }

        function planDueKey(g) {
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

        function addInterval(date, recur, n) {
            const d = new Date(date.getTime());
            if (recur === 'daily') d.setDate(d.getDate() + 1);
            else if (recur === 'weekly') d.setDate(d.getDate() + 7);
            else if (recur === 'monthly') {
                const day = d.getDate();
                d.setDate(1);
                d.setMonth(d.getMonth() + 1);
                d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
            }
            else if (recur === 'custom' && n >= 1) d.setDate(d.getDate() + n);
            else if (recur === 'hourly' && n >= 1) d.setTime(d.getTime() + n * 3600 * 1000);
            return d;
        }

        function nextWeekday(base, days) {
            const set = (days || []).filter(d => d >= 0 && d <= 6);
            if (!set.length) return null;
            for (let i = 1; i <= 7; i++) {
                const d = new Date(base.getTime());
                d.setDate(d.getDate() + i);
                if (set.includes(d.getDay())) {
                    d.setHours(base.getHours(), base.getMinutes(), 0, 0);
                    return d;
                }
            }
            return null;
        }

        function nextMonthday(base, days) {
            const set = [...new Set((days || []).filter(d => d >= 1 && d <= 31))].sort((a, b) => a - b);
            if (!set.length) return null;
            for (let m = 0; m < 13; m++) {
                const y = base.getFullYear();
                const mo = base.getMonth() + m;
                for (const dd of set) {
                    if (dd > daysInMonth(y, mo)) continue;
                    const c = new Date(y, mo, dd, base.getHours(), base.getMinutes(), 0, 0);
                    if (c.getTime() > base.getTime()) return c;
                }
            }
            return null;
        }

        // تکمیل وظیفه تکرارشونده: جلسه بعدی ساخته و وظیفه فعال می‌ماند (false یعنی نساز)
        function advanceRecur(task) {
            const r = task.recur;
            const n = r === 'custom'
                ? ((task.recurN >= 1 && task.recurN <= 365) ? task.recurN : 0)
                : r === 'hourly'
                    ? ((task.recurN >= 1 && task.recurN <= 168) ? task.recurN : 0)
                    : 0;
            if ((r === 'custom' || r === 'hourly') && !n) return false;
            const list = task.sessions || [];
            let base = Date.now();
            if (list.length) {
                base = list.reduce((m, s) => {
                    const v = new Date(s.at).getTime();
                    return isNaN(v) ? m : Math.max(m, v);
                }, base);
            }
            const b = new Date(base);
            let next = null;
            if (r === 'weeklyDays') next = nextWeekday(b, task.recurDays);
            else if (r === 'monthlyDays') next = nextMonthday(b, task.recurDays);
            else next = addInterval(b, r, n);
            if (!next || next.getTime() <= base) return false;
            task.sessions.push({ id: uid(), at: next.toISOString(), reminded: false, remindMin: null, location: null });
            return true;
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
            const g = parentId ? tasks.find(t => String(t.id) === String(parentId) && t.kind === 'plan') : null;
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
            if (found.task.completed && found.task.recur && found.task.recur !== 'none' && advanceRecur(found.task)) {
                found.task.completed = false;
            }
            saveTasks();
            render();
        }

        function deleteTask(id, el) {
            const pre = findTask(id);
            if (pre && !pre.parent && pre.task.kind === 'plan' && (pre.task.children || []).length > 0) {
                if (!confirm(`این برنامه ${toFa(pre.task.children.length)} کار دارد. همه با هم به سطل منتقل شوند؟`)) return;
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
                if (t.kind === 'plan') (t.children || []).forEach(c => {
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
                if (t.kind === 'plan') (t.children || []).forEach(c => { if (c.completed && !c.archived) ids.push(c.id); });
                else if (t.completed && !t.archived) ids.push(t.id);
            });
            if (ids.length === 0) return;
            if (!confirm(`${toFa(ids.length)} وظیفه انجام‌شده به سطل زباله منتقل شود؟`)) return;
            ids.forEach(moveToTrashById);
            render();
            showUndoFor(ids, `${toFa(ids.length)} مورد به سطل منتقل شد`);
        }

        const PLAN_TEMPLATES = [
            { id: 'travel', title: '✈️ سفر', children: ['بررسی تاریخ و ساعت حرکت', 'بررسی مدارک شناسایی', 'بررسی بلیت و رزرو محل اقامت', 'بررسی شارژر موبایل و کابل‌ها', 'شارژ پاوربانک', 'آماده کردن داروهای ضروری', 'آماده کردن لباس‌های مناسب مقصد و آب‌وهوا', 'آماده کردن لوازم بهداشتی', 'بررسی پول نقد و کارت‌های بانکی', 'بررسی وسایل ضروری شخصی', 'شارژ کامل موبایل', 'بررسی خانه قبل از خروج'] },
            { id: 'road-trip', title: '🚗 سفر با خودرو', children: ['بررسی روغن موتور', 'بررسی آب و مایعات خودرو', 'بررسی فشار و سلامت لاستیک‌ها', 'بررسی لاستیک زاپاس', 'بررسی ترمزها', 'بررسی چراغ‌ها و راهنماها', 'بررسی برف‌پاک‌کن و شیشه‌شوی', 'بررسی باتری', 'بررسی مدارک خودرو', 'آماده کردن جعبه ابزار', 'آماده کردن تجهیزات اضطراری', 'شارژ موبایل و پاوربانک'] },
            { id: 'moving', title: '🏠 اسباب‌کشی', children: ['تعیین تاریخ اسباب‌کشی', 'هماهنگی خودرو یا باربری', 'تهیه کارتن و لوازم بسته‌بندی', 'جمع‌آوری وسایل غیرضروری', 'بسته‌بندی اتاق‌ها', 'بسته‌بندی وسایل آشپزخانه', 'بسته‌بندی وسایل شکستنی', 'آماده کردن مدارک و وسایل ارزشمند', 'بررسی وضعیت خانه جدید', 'هماهنگی آب، برق، گاز و اینترنت', 'انتقال وسایل', 'بررسی خانه قدیمی پس از تخلیه'] },
            { id: 'cleaning', title: '🧹 خانه‌تکانی', children: ['مرتب کردن وسایل اضافی', 'دور ریختن وسایل غیرقابل استفاده', 'تمیز کردن آشپزخانه', 'تمیز کردن یخچال', 'تمیز کردن اجاق و فر', 'تمیز کردن سرویس‌های بهداشتی', 'گردگیری اتاق‌ها', 'تمیز کردن پنجره‌ها', 'جارو و شست‌وشوی کف', 'مرتب کردن کمدها', 'شست‌وشوی ملحفه‌ها و پرده‌ها', 'جمع‌آوری و مرتب کردن وسایل نهایی'] },
            { id: 'shopping', title: '🛒 خرید ماهانه', children: ['بررسی موجودی مواد غذایی', 'بررسی مواد شوینده', 'بررسی لوازم بهداشتی', 'بررسی اقلام مصرفی خانه', 'تهیه فهرست خرید', 'بررسی بودجه خرید', 'خرید اقلام ضروری', 'بررسی اقلام خریداری‌شده', 'مرتب کردن خریدها در خانه'] },
            { id: 'doctor', title: '🩺 مراجعه به پزشک', children: ['انتخاب پزشک', 'گرفتن نوبت', 'ثبت تاریخ و ساعت مراجعه', 'ثبت آدرس مطب', 'آماده کردن مدارک لازم', 'آماده کردن فهرست داروهای مصرفی', 'یادداشت سؤال‌ها و موارد مهم', 'همراه داشتن نتایج آزمایش‌ها و مدارک پزشکی مرتبط', 'تنظیم یادآور مراجعه', 'ثبت توصیه‌ها و اقدامات بعد از مراجعه'] },
            { id: 'exam', title: '📚 آمادگی برای امتحان', children: ['مشخص کردن تاریخ امتحان', 'جمع‌آوری منابع', 'مشخص کردن فصل‌های مورد مطالعه', 'برنامه‌ریزی مطالعه', 'مطالعه مباحث اصلی', 'مرور یادداشت‌ها', 'حل تمرین‌ها', 'حل نمونه سؤال', 'بررسی اشتباهات', 'مرور نهایی', 'آماده کردن وسایل روز امتحان'] },
            { id: 'party', title: '🎉 برگزاری مهمانی', children: ['تعیین تاریخ و ساعت', 'تهیه فهرست مهمانان', 'اطلاع دادن به مهمانان', 'تعیین منوی غذا', 'تهیه فهرست خرید', 'خرید مواد موردنیاز', 'آماده کردن خانه', 'آماده کردن غذا', 'آماده کردن پذیرایی', 'مرتب کردن خانه بعد از مهمانی'] }
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

        function createPlanCustom(name, kids, opts) {
            const title = String(name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_LENGTH);
            if (!title) return null;
            const g = blankTask(title);
            g.kind = 'plan';
            g.children = (kids || []).filter(k => k && k.trim()).map(k => blankTask(k.trim().slice(0, MAX_LENGTH)));
            g.startAt = opts && opts.startAt ? opts.startAt : null;
            g.endAt = opts && opts.endAt ? opts.endAt : null;
            tasks.unshift(g);
            expandedPlans.add(String(g.id));
            justAddedId = g.id;
            saveTasks();
            render();
            return g.id;
        }

        function addChild(gid) {
            const g = tasks.find(t => String(t.id) === String(gid) && t.kind === 'plan');
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
