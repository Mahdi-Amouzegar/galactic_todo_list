'use strict';
// detail.js -- detail page  |  React: <TaskDetail/> route
        /* ---------- صفحه جزئیات وظیفه ---------- */

        function getDetailTask() {
            const found = findTask(currentDetailId);
            return found ? found.task : null;
        }

        function openDetail(id) {
            currentDetailId = id;
            const task = getDetailTask();
            if (!task) return;
            document.getElementById('detailTitle').textContent = (task.kind === 'group' ? '📁 ' : '') + task.text;
            document.getElementById('fTitle').value = task.text;
            document.getElementById('fLocField').style.display = task.kind === 'group' ? 'none' : '';
            document.getElementById('fDesc').value = task.description || '';
            document.getElementById('fPhone').value = task.phone || '';
            document.getElementById('fAddr').value = task.address || '';
            document.getElementById('fUrl').value = task.url || '';
            document.getElementById('fPriority').value = task.priority || 'medium';
            document.getElementById('fPhoneError').textContent = '';
            updateUrlLink();
            renderDetailSessions();
            renderDetailLoc();
            document.getElementById('detailPage').style.display = 'block';
            document.body.style.overflow = 'hidden';
            document.getElementById('detailBack').focus();
        }

        function closeDetail() {
            currentDetailId = null;
            document.getElementById('detailPage').style.display = 'none';
            document.body.style.overflow = '';
            render();
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
            const task = getDetailTask();
            const raw = task ? (task.url || '').trim() : '';
            if (!raw) {
                link.style.display = 'none';
                link.removeAttribute('href');
                return;
            }
            link.href = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
            link.style.display = '';
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
                    <button class="btn-icon btn-delete" data-sess="${escapeHtml(String(s.id))}" aria-label="حذف جلسه ${toFa(i + 1)}">✕</button>
                </div>`;
            }).join('');
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
                    task.sessions.push({ id: uid(), at: iso });
                    saveTasks();
                    renderDetailSessions();
                    render();
                    flashSaved();
                });
            });
            document.getElementById('sessList').addEventListener('click', e => {
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
            document.getElementById('detailLocShow').addEventListener('click', () => {
                const t = getDetailTask();
                if (!t || !t.location) return;
                const id = t.id;
                closeDetail();
                ensureMapVisible();
                flyToTask(id);
            });
            document.getElementById('detailLocChange').addEventListener('click', () => {
                const t = getDetailTask();
                if (!t) return;
                relocateTaskId = t.id;
                closeDetail();
                ensureMapVisible();
                switchToTab('map');
                document.getElementById('panelMap').scrollIntoView({ behavior: 'smooth' });
                mapHint('روی نقشه کلیک کنید تا محل ثبت شود');
            });
            document.getElementById('detailLocRemove').addEventListener('click', () => {
                const t = getDetailTask();
                if (!t) return;
                t.location = null;
                saveTasks();
                renderDetailLoc();
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
            document.getElementById('detailBack').addEventListener('click', closeDetail);
            document.getElementById('detailDelete').addEventListener('click', () => {
                const task = getDetailTask();
                if (!task) return;
                if (!confirm(`«${task.text}» حذف شود؟`)) return;
                tasks = tasks.filter(t => t.id !== task.id);
                saveTasks();
                closeDetail();
            });
        }

