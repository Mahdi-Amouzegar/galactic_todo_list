// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// detail.js -- detail page  |  React: <TaskDetail/> route
        /* ---------- صفحه جزئیات وظیفه ---------- */

        function getDetailTask() {
            const found = findTask(currentDetailId);
            return found ? found.task : null;
        }

        function openDetail(id) {
            const pageEl = document.getElementById('detailPage');
            const wasAlreadyOpen = pageEl && pageEl.style.display === 'block';
            const prevScroll = wasAlreadyOpen ? pageEl.scrollTop : 0;

            currentDetailId = id;
            const task = getDetailTask();
            if (!task) return;
            document.getElementById('detailTitle').textContent = (task.kind === 'plan' ? '📁 ' : '') + task.text;
            document.getElementById('fTitle').value = task.text;
            document.getElementById('fLocField').style.display = task.kind === 'plan' ? 'none' : '';
            const locAccordion = document.querySelector('.detail-accordion.location');
            if (locAccordion) locAccordion.style.display = task.kind === 'plan' ? 'none' : '';
            document.getElementById('fDesc').value = task.description || '';
            document.getElementById('fPhone').value = task.phone || '';
            document.getElementById('fAddr').value = task.address || '';
            document.getElementById('fUrl').value = task.url || '';
            document.getElementById('fPriority').value = task.priority || 'medium';
            document.getElementById('fPin').checked = Boolean(task.pinned);
            document.getElementById('fRecur').value = task.recur || 'none';
            document.getElementById('fRecurN').value = task.recurN || (task.recur === 'hourly' ? 8 : 2);
            renderRecurRows();
            document.getElementById('fPhoneError').textContent = '';
            updateUrlLink();
            updateCallBtn();
            renderDetailSessions();
            if (typeof window.refreshSavedLocationUI === 'function') {
                window.refreshSavedLocationUI();
            }
            renderDetailPhotos();
            renderTimer();
            clearInterval(timerTick);
            timerTick = setInterval(() => { if (getDetailTask()) renderTimer(); }, 60000);
            pageEl.style.display = 'block';
            if (window.matchMedia('(max-width: 900px)').matches) {
                document.body.style.overflow = 'hidden';
            }
            if (!wasAlreadyOpen) {
                document.getElementById('detailBack').focus();
            } else {
                pageEl.scrollTop = prevScroll;
                requestAnimationFrame(() => { pageEl.scrollTop = prevScroll; });
            }
        }

        function closeDetail() {
            currentDetailId = null;
            clearInterval(timerTick);
            document.getElementById('detailPage').style.display = 'none';
            document.body.style.overflow = '';
            if (typeof window.__hideMobilePickBanner === 'function') {
                window.__hideMobilePickBanner();
            }
            render();
        }

        // ورود به حالت انتخاب مکان بدون بستن صفحه جزئیات
        function enterLocationPickMode(taskId, mode) {
            if (typeof ensureMapVisible === 'function') ensureMapVisible();
            if (typeof switchToTab === 'function') switchToTab('map');

            if (mode === 'change') {
                try { relocateTaskId = taskId; } catch (_) {}
                try { relocateSess = null; } catch (_) {}
                try { pendingReturnDetail = currentDetailId; } catch (_) {}

                // روی موبایل: صفحه جزئیات مخفی می‌شود تا کاربر مستقیم نقشه را ببیند.
                // بعد از انتخاب مکان، map.js#onMapClick با openDetail صفحه را برمی‌گرداند.
                if (window.matchMedia('(max-width: 900px)').matches) {
                    const pageEl = document.getElementById('detailPage');
                    if (pageEl) pageEl.style.display = 'none';
                    document.body.style.overflow = '';
                }

                if (typeof mapHint === 'function') mapHint('روی نقشه کلیک کنید تا محل جدید ثبت شود');
                if (typeof window.__showMobilePickBanner === 'function') {
                    window.__showMobilePickBanner('روی نقشه ضربه بزنید تا محل جدید ثبت شود. برای انصراف، دکمه لغو را بزنید.');
                }
            } else if (mode === 'show') {
                if (typeof flyToTask === 'function') flyToTask(taskId);
            } else if (mode === 'route') {
                if (typeof showRouteTo === 'function') showRouteTo(taskId);
            }
        }

        let saveHintTimer = null;
        function flashSaved(msg) {
            const hint = document.getElementById('saveHint');
            hint.textContent = msg || '✓ ذخیره شد';
            hint.classList.add('show');
            clearTimeout(saveHintTimer);
            saveHintTimer = setTimeout(() => hint.classList.remove('show'), 1500);
        }

        function updateUrlLink() {
            const link = document.getElementById('fUrlOpen');
            const copy = document.getElementById('fUrlCopy');
            const task = getDetailTask();
            const raw = task ? (task.url || '').trim() : '';
            if (!raw) {
                link.style.display = 'none';
                link.removeAttribute('href');
                copy.style.display = 'none';
                return;
            }
            link.href = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
            link.style.display = '';
            copy.style.display = '';
        }

        function updateCallBtn() {
            const btn = document.getElementById('fPhoneCall');
            const task = getDetailTask();
            const raw = task ? (task.phone || '').trim() : '';
            if (!raw) {
                btn.style.display = 'none';
                btn.removeAttribute('href');
                return;
            }
            btn.href = 'tel:' + raw.replace(/[\s()-]/g, '');
            btn.style.display = '';
        }

        function renderDetailSessions() {
            const task = getDetailTask();
            if (!task) return;
            const list = [...(task.sessions || [])].sort((a, b) => new Date(a.at) - new Date(b.at));
            document.getElementById('sessCount').textContent = list.length > 0 ? `(${toFa(list.length)})` : '';
            const el = document.getElementById('sessList');
            if (list.length === 0) {
                el.innerHTML = '<div class="session-empty">هنوز جلسه‌ای ثبت نشده است.</div>';
                return;
            }
            const now = getNow().getTime();
            el.innerHTML = list.map((s, i) => {
                const past = new Date(s.at).getTime() < now;
                return `<div class="session-item ${past ? 'past' : ''}">
                    <span class="session-num">${toFa(i + 1)}</span>
                    <span class="session-date">📅 ${faShort(s.at)}${past ? ' (گذشته)' : ''}</span>
                    <select class="sess-remind" data-sess-rem="${escapeHtml(String(s.id))}" aria-label="یادآور این جلسه">
                        <option value=""${s.remindMin == null ? ' selected' : ''}>⏰ پیش‌فرض</option>
                        <option value="5"${s.remindMin === 5 ? ' selected' : ''}>۵ دقیقه</option>
                        <option value="15"${s.remindMin === 15 ? ' selected' : ''}>۱۵ دقیقه</option>
                        <option value="30"${s.remindMin === 30 ? ' selected' : ''}>۳۰ دقیقه</option>
                        <option value="60"${s.remindMin === 60 ? ' selected' : ''}>۱ ساعت</option>
                        <option value="180"${s.remindMin === 180 ? ' selected' : ''}>۳ ساعت</option>
                        <option value="1440"${s.remindMin === 1440 ? ' selected' : ''}>۱ روز</option>
                        <option value="0"${s.remindMin === 0 ? ' selected' : ''}>خاموش</option>
                    </select>
                    <button class="btn-icon btn-detail ${s.location ? 'has-loc' : ''}" data-sess-loc="${escapeHtml(String(s.id))}" aria-label="ثبت محل جلسه">📍</button>
                    <button class="btn-icon btn-delete" data-sess="${escapeHtml(String(s.id))}" aria-label="حذف جلسه ${toFa(i + 1)}">✕</button>
                </div>`;
            }).join('');
        }

        function downscale(dataUrl, maxDim, quality, cb) {
            const img = new Image();
            img.onload = () => {
                try {
                    const r = Math.min(1, maxDim / Math.max(img.width, img.height));
                    const c = document.createElement('canvas');
                    c.width = Math.max(1, Math.round(img.width * r));
                    c.height = Math.max(1, Math.round(img.height * r));
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    cb(c.toDataURL('image/jpeg', quality));
                } catch {
                    cb(null);
                }
            };
            img.onerror = () => cb(null);
            img.src = dataUrl;
        }

        function renderDetailPhotos() {
            const task = getDetailTask();
            if (!task) return;
            const list = task.photos || [];
            document.getElementById('photoCount').textContent = list.length ? `(${toFa(list.length)})` : '';
            document.getElementById('photoGrid').innerHTML = list.length ? list.map(p => `
                <div class="photo-thumb">
                    <img src="${p.dataUrl}" data-photo-view="${escapeHtml(String(p.id))}" alt="تصویر وظیفه" loading="lazy">
                    <button data-photo-del="${escapeHtml(String(p.id))}" aria-label="حذف عکس">✕</button>
                </div>`).join('') : '<div class="session-empty">عکسی ثبت نشده است.</div>';
        }

        let timerTick = null;

        function currentSpent(task) {
            let s = Number(task.timeSpent) || 0;
            if (task.timerStartedAt) {
                s += (Date.now() - new Date(task.timerStartedAt).getTime()) / 1000;
            }
            return Math.max(0, Math.floor(s));
        }

        function faDuration(sec) {
            sec = Math.floor(sec);
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = sec % 60;
            if (h > 0) return `${toFa(h)} ساعت و ${toFa(m)} دقیقه`;
            if (m > 0) return `${toFa(m)} دقیقه`;
            return `${toFa(s)} ثانیه`;
        }

        function renderTimer() {
            const task = getDetailTask();
            if (!task) return;
            document.getElementById('timerLabel').textContent = faDuration(currentSpent(task));
            document.getElementById('timerToggle').textContent = task.timerStartedAt ? '⏸ توقف' : '▶ شروع';
        }

        function toggleTimer() {
            const task = getDetailTask();
            if (!task) return;
            if (task.timerStartedAt) {
                task.timeSpent = currentSpent(task);
                task.timerStartedAt = null;
            } else {
                task.timerStartedAt = new Date().toISOString();
            }
            saveTasks();
            renderTimer();
            flashSaved();
        }

        const WEEK_ORDER = [['شنبه', 6], ['یکشنبه', 0], ['دوشنبه', 1], ['سه‌شنبه', 2], ['چهارشنبه', 3], ['پنجشنبه', 4], ['جمعه', 5]];

        function renderRecurRows() {
            const task = getDetailTask();
            if (!task) return;
            const r = task.recur;
            document.getElementById('fRecurNRow').style.display = (r === 'custom' || r === 'hourly') ? '' : 'none';
            document.getElementById('fRecurWeekRow').style.display = r === 'weeklyDays' ? '' : 'none';
            document.getElementById('fRecurMonthRow').style.display = r === 'monthlyDays' ? '' : 'none';
            document.querySelector('#fRecurNRow .field-label').textContent = r === 'hourly' ? 'هر چند ساعت؟' : 'هر چند روز؟';
            const nInp = document.getElementById('fRecurN');
            nInp.max = r === 'hourly' ? 168 : 365;
            const wc = document.getElementById('fRecurWeekChips');
            if (wc) wc.innerHTML = WEEK_ORDER.map(([name, v]) => `<button type="button" class="day-chip${(task.recurDays || []).includes(v) ? ' on' : ''}" data-wday="${v}">${name}</button>`).join('');
            const mc = document.getElementById('fRecurMonthChips');
            if (mc) {
                let mhtml = '';
                for (let d = 1; d <= 31; d++) mhtml += `<button type="button" class="day-chip${(task.recurDays || []).includes(d) ? ' on' : ''}" data-mday="${d}">${toFa(d)}</button>`;
                mc.innerHTML = mhtml;
            }
        }

        function toggleRecurDay(v) {
            const task = getDetailTask();
            if (!task) return;
            task.recurDays = task.recurDays || [];
            const i = task.recurDays.indexOf(v);
            if (i >= 0) task.recurDays.splice(i, 1);
            else task.recurDays.push(v);
            saveTasks();
            render();
            renderRecurRows();
            flashSaved();
        }

        function bindDetailInputs() {
            document.getElementById('fTitle').addEventListener('input', e => {
                const task = getDetailTask();
                if (!task) return;
                const v = e.target.value.trim().replace(/\s+/g, ' ');
                if (!v) {
                    flashSaved('عنوان نمی‌تواند خالی باشد');
                    return;
                }
                task.text = v.slice(0, MAX_LENGTH);
                document.getElementById('detailTitle').textContent = task.text;
                saveTasks();
                render();
                flashSaved();
            });
            document.getElementById('fDesc').addEventListener('input', e => {
                const task = getDetailTask();
                if (!task) return;
                task.description = e.target.value.slice(0, 1000);
                saveTasks();
                flashSaved();
            });
            document.getElementById('fPhone').addEventListener('input', e => {
                const task = getDetailTask();
                if (!task) return;
                const v = e.target.value.trim();
                const err = document.getElementById('fPhoneError');
                if (v && !/^[0-9+\-\s()]{5,20}$/.test(v)) {
                    err.textContent = 'شماره تلفن معتبر نیست';
                    return;
                }
                err.textContent = '';
                task.phone = v;
                updateCallBtn();
                saveTasks();
                flashSaved();
            });
            document.getElementById('fAddr').addEventListener('input', e => {
                const task = getDetailTask();
                if (!task) return;
                task.address = e.target.value.slice(0, 500);
                saveTasks();
                flashSaved();
            });
            document.getElementById('fUrl').addEventListener('input', e => {
                const task = getDetailTask();
                if (!task) return;
                task.url = e.target.value.trim().slice(0, 300);
                updateUrlLink();
                saveTasks();
                flashSaved();
            });
            document.getElementById('addSessionBtn').addEventListener('click', () => {
                openPicker('session', iso => {
                    const task = getDetailTask();
                    if (!task) return;
                    if (hasSessionAt(task.sessions, iso)) {
                        flashSaved('این سررسید قبلاً ثبت شده است.');
                        return;
                    }
                    task.sessions.push({ id: uid(), at: iso });
                    saveTasks();
                    renderDetailSessions();
                    render();
                    flashSaved();
                });
            });
            document.getElementById('sessList').addEventListener('click', e => {
                const locBtn = e.target.closest('[data-sess-loc]');
                if (locBtn) {
                    relocateSess = { taskId: currentDetailId, sessId: locBtn.dataset.sessLoc };
                    relocateTaskId = null;
                    pendingReturnDetail = currentDetailId;
                    ensureMapVisible();
                    switchToTab('map');
                    // روی موبایل، صفحه جزئیات مخفی شود تا کاربر نقشه را ببیند
                    if (window.matchMedia('(max-width: 900px)').matches) {
                        const pageEl = document.getElementById('detailPage');
                        if (pageEl) pageEl.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                    mapHint('روی نقشه کلیک کنید تا محل جلسه ثبت شود');
                    if (typeof window.__showMobilePickBanner === 'function') {
                        window.__showMobilePickBanner('روی نقشه ضربه بزنید تا محل جلسه ثبت شود. برای انصراف، دکمه لغو را بزنید.');
                    }
                    return;
                }
                const btn = e.target.closest('[data-sess]');
                if (!btn) return;
                const task = getDetailTask();
                if (!task) return;
                task.sessions = task.sessions.filter(s => String(s.id) !== btn.dataset.sess);
                saveTasks();
                renderDetailSessions();
                render();
                flashSaved('جلسه حذف شد');
            });
            document.getElementById('sessList').addEventListener('change', e => {
                const sel = e.target.closest('[data-sess-rem]');
                if (!sel) return;
                const task = getDetailTask();
                if (!task) return;
                const s = (task.sessions || []).find(x => String(x.id) === String(sel.dataset.sessRem));
                if (!s) return;
                s.reminded = false;
                s.remindedDue = false;
                if (sel.value === '') s.remindMin = null;
                else s.remindMin = Math.max(0, parseInt(sel.value, 10) || 0);
                saveTasks();
                flashSaved();
            });
            document.getElementById('detailLocShow').addEventListener('click', () => {
                const t = getDetailTask();
                if (!t || !t.location) return;
                enterLocationPickMode(t.id, 'show');
            });
            document.getElementById('detailLocChange').addEventListener('click', () => {
                const t = getDetailTask();
                if (!t) return;
                enterLocationPickMode(t.id, 'change');
            });
            document.getElementById('detailLocRemove').addEventListener('click', () => {
                const t = getDetailTask();
                if (!t) return;
                t.location = null;
                saveTasks();
                if (typeof window.refreshSavedLocationUI === 'function') {
                    window.refreshSavedLocationUI();
                }
                render();
                refreshMarkers();
                flashSaved('محل حذف شد');
            });
            document.getElementById('fPriority').addEventListener('change', e => {
                const task = getDetailTask();
                if (!task) return;
                task.priority = ['high', 'medium', 'low'].includes(e.target.value) ? e.target.value : 'medium';
                saveTasks();
                render();
                refreshMarkers();
                flashSaved();
            });
            document.getElementById('fUrlCopy').addEventListener('click', async () => {
                const task = getDetailTask();
                if (!task || !(task.url || '').trim()) return;
                const raw = task.url.trim();
                const full = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
                let ok = false;
                try {
                    if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(full);
                        ok = true;
                    }
                } catch { /* fallback */ }
                if (!ok) {
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = full;
                        ta.style.position = 'fixed';
                        ta.style.opacity = '0';
                        document.body.appendChild(ta);
                        ta.select();
                        ok = document.execCommand('copy');
                        ta.remove();
                    } catch { /* نادیده */ }
                }
                flashSaved(ok ? 'پیوند کپی شد ✓' : 'کپی نشد');
            });
            document.getElementById('fPin').addEventListener('change', e => {
                const task = getDetailTask();
                if (!task) return;
                task.pinned = e.target.checked;
                saveTasks();
                render();
                flashSaved();
            });
            document.getElementById('fRecurWeekChips').addEventListener('click', e => {
                const b = e.target.closest('[data-wday]');
                if (b) toggleRecurDay(parseInt(b.dataset.wday, 10));
            });
            document.getElementById('fRecurMonthChips').addEventListener('click', e => {
                const b = e.target.closest('[data-mday]');
                if (b) toggleRecurDay(parseInt(b.dataset.mday, 10));
            });
            document.getElementById('fRecur').addEventListener('change', e => {
                const task = getDetailTask();
                if (!task) return;
                const v = e.target.value;
                task.recur = ['daily', 'weekly', 'monthly', 'custom', 'hourly', 'weeklyDays', 'monthlyDays'].includes(v) ? v : 'none';
                let warn = '';
                if (task.recur !== 'none' && (task.sessions || []).length > 1) {
                    task.sessions.sort((a, b) => new Date(a.at) - new Date(b.at));
                    task.sessions = [task.sessions[0]];
                    renderDetailSessions();
                    warn = 'فقط نزدیک‌ترین سررسید نگه داشته شد؛ بقیه حذف شدند';
                }
                if (task.recur === 'hourly' && !(task.recurN >= 1 && task.recurN <= 168)) task.recurN = 8;
                if (task.recur === 'custom') {
                    const n = parseInt(document.getElementById('fRecurN').value, 10);
                    if (n >= 1 && n <= 365) task.recurN = n;
                    else {
                        task.recur = 'none';
                        e.target.value = 'none';
                        warn = 'عدد روزهای تکرار (۱ تا ۳۶۵) را وارد کنید';
                    }
                }
                if ((task.recur === 'weeklyDays' || task.recur === 'monthlyDays') && !(task.recurDays || []).length) {
                    warn += (warn ? ' — ' : '') + 'حداقل یک روز انتخاب کنید';
                }
                saveTasks();
                render();
                renderRecurRows();
                flashSaved(warn || undefined);
            });
            document.getElementById('fRecurN').addEventListener('change', e => {
                const task = getDetailTask();
                if (!task) return;
                const maxN = task.recur === 'hourly' ? 168 : 365;
                const n = parseInt(e.target.value, 10);
                if ((task.recur === 'custom' || task.recur === 'hourly') && n >= 1 && n <= maxN) {
                    task.recurN = n;
                    saveTasks();
                    render();
                    flashSaved();
                } else {
                    flashSaved(`عدد بین ۱ تا ${toFa(maxN)}`);
                }
            });
            document.getElementById('detailLocRoute').addEventListener('click', () => {
                const t = getDetailTask();
                if (!t || !t.location) return;
                enterLocationPickMode(t.id, 'route');
            });
            const photoInput = document.getElementById('photoInput');
            photoInput.addEventListener('change', () => {
                const task = getDetailTask();
                if (!task) { photoInput.value = ''; return; }
                task.photos = task.photos || [];
                const files = [...photoInput.files].slice(0, Math.max(0, 8 - task.photos.length));
                photoInput.value = '';
                if (!files.length) {
                    flashSaved(task.photos.length >= 8 ? 'سقف ۸ عکس' : 'فایلی انتخاب نشد');
                    return;
                }
                let pending = files.length;
                const doneOne = () => {
                    if (--pending !== 0) return;
                    saveTasks();
                    renderDetailPhotos();
                    render();
                    flashSaved();
                };
                files.forEach(f => {
                    if (!f.type.startsWith('image/')) return doneOne();
                    const rd = new FileReader();
                    rd.onload = () => downscale(rd.result, 1024, 0.72, url => {
                        if (url) task.photos.push({ id: uid(), dataUrl: url, addedAt: new Date().toISOString() });
                        doneOne();
                    });
                    rd.onerror = doneOne;
                    rd.readAsDataURL(f);
                });
            });
            document.getElementById('photoGrid').addEventListener('click', e => {
                const del = e.target.closest('[data-photo-del]');
                if (del) {
                    const task = getDetailTask();
                    if (!task) return;
                    task.photos = (task.photos || []).filter(p => String(p.id) !== del.dataset.photoDel);
                    saveTasks();
                    renderDetailPhotos();
                    render();
                    flashSaved('عکس حذف شد');
                    return;
                }
                const img = e.target.closest('[data-photo-view]');
                if (img) {
                    document.getElementById('lightboxImg').src = img.src;
                    document.getElementById('lightbox').style.display = 'flex';
                }
            });
            document.getElementById('lightbox').addEventListener('click', () => {
                document.getElementById('lightbox').style.display = 'none';
                document.getElementById('lightboxImg').removeAttribute('src');
            });
            document.getElementById('timerToggle').addEventListener('click', toggleTimer);
            document.getElementById('detailBack').addEventListener('click', closeDetail);
            document.getElementById('detailDelete').addEventListener('click', () => {
                const task = getDetailTask();
                if (!task) return;
                if (!confirm(`«${task.text}» به سطل زباله منتقل شود؟`)) return;
                const id = task.id;
                closeDetail();
                moveToTrashById(id);
                render();
                showUndoFor([id], 'به سطل زباله منتقل شد');
            });
        }