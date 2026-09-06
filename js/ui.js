// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// ui.js -- main list render + filters  |  React: <TaskList/> + <GroupCard/>
        /* ---------- ویرایش ---------- */

        function startEdit(id) {
            editingId = id;
            render();
            const editInput = taskList.querySelector('.task-edit-input');
            if (editInput) {
                editInput.focus();
                editInput.setSelectionRange(editInput.value.length, editInput.value.length);
            }
        }

        function commitEdit(id, value) {
            const text = value.trim().replace(/\s+/g, ' ');
            const found = findTask(id);
            const task = found ? found.task : null;
            if (task) {
                if (text) task.text = text.slice(0, MAX_LENGTH);
                saveTasks();
            }
            editingId = null;
            render();
        }

        function cancelEdit() {
            editingId = null;
            render();
        }

        /* ---------- فیلتر و جستجو ---------- */

        function taskMatches(t, q) {
            if (!q) return true;
            return t.text.includes(q) || (t.description || '').includes(q);
        }

        function visibleChildren(g) {
            const q = searchQuery.trim();
            let kids = g.children || [];
            if (currentFilter === 'archived') kids = kids.filter(c => c.archived);
            else kids = kids.filter(c => !c.archived);
            if (q && !taskMatches(g, q)) kids = kids.filter(c => taskMatches(c, q));
            if (selectedDay) kids = kids.filter(c => hasSessionOn(c, selectedDay));
            if (currentFilter === 'hasloc') kids = kids.filter(c => c.location);
            else if (currentFilter === 'hasdue') kids = kids.filter(c => (c.sessions || []).length);
            return [...kids.filter(c => c.pinned), ...kids.filter(c => !c.pinned)];
        }

        function getFiltered() {
            const q = searchQuery.trim();
            const base = t => {
                if (t.kind === 'group') {
                    if (currentFilter === 'archived') {
                        return t.archived || (t.children || []).some(c => c.archived);
                    }
                    if (t.archived) return false;
                    if (q) {
                        if (taskMatches(t, q)) return true;
                        return (t.children || []).some(c => taskMatches(c, q));
                    }
                    if (currentFilter === 'hasloc') {
                        return Boolean(t.location) || (t.children || []).some(c => c.location && !c.archived);
                    }
                    if (currentFilter === 'hasdue') {
                        return (t.sessions || []).length > 0 || (t.children || []).some(c => (c.sessions || []).length && !c.archived);
                    }
                    if (currentFilter === 'completed') return groupIsDone(t);
                    if (currentFilter === 'active') return !groupIsDone(t);
                    return true;
                }
                if (currentFilter === 'archived') return Boolean(t.archived);
                if (t.archived) return false;
                if (q) return taskMatches(t, q);
                if (currentFilter === 'hasloc') return Boolean(t.location);
                if (currentFilter === 'hasdue') return (t.sessions || []).length > 0;
                if (currentFilter === 'active') return !t.completed;
                if (currentFilter === 'completed') return t.completed;
                return true;
            };
            let list = tasks.filter(t => {
                if (!base(t)) return false;
                if (!selectedDay) return true;
                if (t.kind === 'group') {
                    return hasSessionOn(t, selectedDay) || (t.children || []).some(c => hasSessionOn(c, selectedDay));
                }
                return hasSessionOn(t, selectedDay);
            });
            if (currentSort === 'due') {
                const key = t => {
                    if (t.kind === 'group') return groupDueKey(t);
                    const u = nearestUpcoming(t);
                    return u ? new Date(u.at).getTime() : Infinity;
                };
                list = [...list].sort((a, b) => key(a) - key(b));
            } else if (currentSort === 'oldest') {
                list = [...list].reverse();
            } else if (currentSort === 'alpha') {
                list = [...list].sort((a, b) => a.text.localeCompare(b.text, 'fa'));
            }
            return [...list.filter(t => t.pinned), ...list.filter(t => !t.pinned)];
        }

        /* ---------- رندر ---------- */

        /* ---------- آمار هفتگی ---------- */

        function renderStats(total, done) {
            const box = document.getElementById('statsBox');
            if (!box) return;
            const now = getNow();
            const days = [];
            for (let i = 6; i >= 0; i--) days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
            const key = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
            const counts = days.map(() => 0);
            const bump = iso => {
                if (!iso) return;
                const d = new Date(iso);
                if (isNaN(d)) return;
                const idx = days.findIndex(x => key(x) === key(d));
                if (idx >= 0) counts[idx]++;
            };
            tasks.forEach(t => {
                if (t.archived) return;
                if (t.kind === 'group') (t.children || []).forEach(c => { if (c.completed && !c.archived) bump(c.completedAt); });
                else if (t.completed) bump(t.completedAt);
            });
            const max = Math.max(1, ...counts);
            const rate = total > 0 ? Math.round((done / total) * 100) : 0;
            box.innerHTML = `<div class="stats-title">📊 ۷ روز گذشته · نرخ تکمیل ${toFa(rate)}٪</div><div class="bars">` +
                days.map((d, i) => {
                    let wd = '';
                    try {
                        wd = d.toLocaleDateString('fa-IR', { weekday: 'narrow' });
                    } catch { /* نادیده */ }
                    const h = Math.max(3, Math.round((counts[i] / max) * 100));
                    return `<div class="bar-col" title="${toFa(counts[i])} انجام‌شده"><div class="bar${counts[i] === 0 ? ' empty' : ''}" style="height: ${h}%;"></div><span>${wd}</span></div>`;
                }).join('') + `</div>`;
        }

        function renderTemplateBox() {
            const box = document.getElementById('templateBox');
            if (!box) return;
            box.innerHTML = GROUP_TEMPLATES.map(x => `<button type="button" class="due-chip" data-template="${x.id}" style="cursor: pointer;">${escapeHtml(x.title)}</button>`).join('');
        }

        /* ---------- سطل زباله ---------- */

        function renderTrash() {
            const el = document.getElementById('trashList');
            if (!el) return;
            if (!trash.length) {
                el.innerHTML = '<div class="session-empty">سطل زباله خالی است.</div>';
                return;
            }
            const sorted = [...trash].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
            el.innerHTML = sorted.map(x => {
                let dstr = '';
                try {
                    dstr = new Date(x.deletedAt).toLocaleDateString('fa-IR', { day: 'numeric', month: 'long' });
                } catch { /* نادیده */ }
                return `<div class="session-item">
                    <span class="session-num">${x.kind === 'group' ? '📁' : '📝'}</span>
                    <span class="session-date">${escapeHtml(x.text)} <small>(${dstr})</small></span>
                    <button class="btn-icon btn-edit" data-tact="restore" data-tid="${escapeHtml(String(x.id))}" aria-label="بازگردانی">↩</button>
                    <button class="btn-icon btn-delete" data-tact="purge" data-tid="${escapeHtml(String(x.id))}" aria-label="حذف همیشگی">✕</button>
                </div>`;
            }).join('');
        }

        function openTrash() {
            renderTrash();
            document.getElementById('trashPage').style.display = 'block';
            document.body.style.overflow = 'hidden';
        }

        function closeTrash() {
            document.getElementById('trashPage').style.display = 'none';
            document.body.style.overflow = '';
            render();
        }

        /* ---------- تقویم ماهانه جلسات ---------- */

        function shiftCalMonth(delta) {
            calJm += delta;
            if (calJm < 1) { calJm = 12; calJy -= 1; }
            if (calJm > 12) { calJm = 1; calJy += 1; }
            renderCalendar();
        }

        function setSelectedDay(key) {
            selectedDay = (selectedDay === key) ? null : key;
            render();
            renderCalendar();
        }

        function renderCalendar() {
            document.getElementById('calLabel').textContent = JALALI_MONTHS[calJm - 1] + ' ' + toFa(calJy);
            const g = jalaliToGregorian(calJy, calJm, 1);
            const leading = (new Date(g.gy, g.gm - 1, g.gd).getDay() + 1) % 7;
            const monthLen = jalaliMonthLength(calJy, calJm);
            const now = getNow();
            const tj = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
            const byDay = {};
            allSessions(false).forEach(s => {
                const d = new Date(s.at);
                if (isNaN(d)) return;
                const k = dayKey(d);
                (byDay[k] = byDay[k] || []).push(s);
            });
            let html = '';
            for (let i = 0; i < leading; i++) html += '<span class="picker-day empty"></span>';
            for (let d = 1; d <= monthLen; d++) {
                const gg = jalaliToGregorian(calJy, calJm, d);
                const k = gg.gy + '-' + gg.gm + '-' + gg.gd;
                const list = byDay[k] || [];
                const isToday = calJy === tj.jy && calJm === tj.jm && d === tj.jd;
                const cls = 'picker-day cal-day' + (isToday ? ' today' : '') + (selectedDay === k ? ' selected' : '');
                const dots = list.slice(0, 3).map(s => `<span class="dot d-${s.priority || 'low'}"></span>`).join('');
                const more = list.length > 3 ? `<span class="dot-more">${toFa(list.length - 3)}+</span>` : '';
                html += `<button class="${cls}" data-calday="${k}" aria-label="${toFa(d)} ${JALALI_MONTHS[calJm - 1]}${list.length ? '، ' + toFa(list.length) + ' جلسه' : ''}">${toFa(d)}<span class="cal-dots">${dots}${more}</span></button>`;
            }
            document.getElementById('calDays').innerHTML = html;
        }

        function openCal() {
            let base;
            if (selectedDay) {
                const [y, m, d] = selectedDay.split('-').map(Number);
                base = gregorianToJalali(y, m, d);
            } else {
                const n = getNow();
                base = gregorianToJalali(n.getFullYear(), n.getMonth() + 1, n.getDate());
            }
            calJy = base.jy;
            calJm = base.jm;
            renderCalendar();
            document.getElementById('calOverlay').style.display = 'flex';
        }

        function closeCal() {
            document.getElementById('calOverlay').style.display = 'none';
        }

        function childHtml(c) {
            if (String(c.id) === String(editingId)) {
                return `<div class="child-item" data-id="${escapeHtml(String(c.id))}">
                    <div class="edit-wrap">
                        <input type="text" class="task-edit-input" value="${escapeHtml(c.text)}" maxlength="${MAX_LENGTH}" aria-label="ویرایش زیرکار">
                        <button class="btn-icon btn-ok" data-action="edit-ok" aria-label="تأیید ویرایش">✓</button>
                        <button class="btn-icon btn-cancel" data-action="edit-cancel" aria-label="انصراف">✕</button>
                    </div>
                </div>`;
            }
            const n = nearestUpcoming(c);
            return `<div class="child-item ${c.completed ? 'completed' : ''} ${String(c.id) === String(justAddedId) ? 'just-added' : ''}" data-id="${escapeHtml(String(c.id))}">
                <button class="task-checkbox ${c.completed ? 'checked' : ''}" data-action="toggle"
                    aria-label="${c.completed ? 'برگرداندن به انجام نشده' : 'علامت‌گذاری به عنوان انجام شده'}"
                    aria-pressed="${c.completed}"></button>
                <span class="child-text" data-action="edit" title="برای ویرایش دو بار کلیک کنید">${escapeHtml(c.text)}</span>
                ${n ? `<span class="child-due">📅 ${faShort(n.at)}</span>` : ''}
                ${c.location ? '<span class="child-due">📍</span>' : ''}
                ${(c.photos || []).length ? '<span class="child-due">📷</span>' : ''}
                ${c.recur && c.recur !== 'none' ? '<span class="child-due" title="تکرارشونده">🔁</span>' : ''}
                <span class="child-actions">
                    ${currentFilter === 'archived'
                        ? `<button class="child-btn detail" data-action="unarchive" aria-label="بازگردانی از بایگانی">↩</button>
                    <button class="child-btn delete" data-action="delete" aria-label="حذف زیرکار">✕</button>`
                        : `<button class="child-btn loc ${c.location ? 'has' : ''}" data-action="pick-loc" aria-label="${c.location ? 'نمایش محل روی نقشه' : 'ثبت محل روی نقشه'}">📍</button>
                    <button class="child-btn detail" data-action="detail" aria-label="جزئیات زیرکار">📋</button>
                    <button class="child-btn delete" data-action="delete" aria-label="حذف زیرکار">✕</button>`}
                </span>
            </div>`;
        }

        function groupHtml(task) {
            const st = groupStats(task);
            const q = searchQuery.trim();
            const open = expandedGroups.has(String(task.id)) || (q !== '' && !taskMatches(task, q));
            const kids = visibleChildren(task);
            const drafts = childDrafts[task.id] || [];
            const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
            return `<div class="task-item group-item prio-${task.priority}"${currentSort === 'manual' ? ' draggable="true"' : ''} data-id="${escapeHtml(String(task.id))}">
                <button class="group-caret" data-action="expand" aria-label="باز و بسته کردن گروه">${open ? '▾' : '◂'}</button>
                <div class="task-content">
                    <div class="task-text">📁 ${escapeHtml(task.text)}</div>
                    <div class="task-meta">
                        <span class="priority-badge p-${task.priority}">${PRIORITY_LABELS[task.priority]}</span>${task.recur && task.recur !== 'none' ? '<span title="تکرارشونده">🔁</span>' : ''}
                        <span>زیرکار: ${toFa(st.done)} از ${toFa(st.total)}</span>
                        ${(task.photos || []).length ? `<span title="${toFa(task.photos.length)} عکس">📷</span>` : ''}
                        <div class="mini-progress"><div class="mini-progress-fill" style="width: ${pct}%;"></div></div>
                        ${st.total > 0 && st.done < st.total ? '<button class="mini-link lvl-int" data-action="check-all" aria-label="انجام شدن همه زیرکارها">✓ همه انجام شد</button>' : ''}
                    </div>
                    ${(task.sessions && task.sessions.length) ? sessionSummaryHtml(task) : ''}
                    ${open ? `<div class="group-body">
                        ${kids.length ? kids.map(c => childHtml(c)).join('') : '<div class="session-empty">هنوز زیرکاری ثبت نشده است.</div>'}
                        ${drafts.length ? `<div class="due-chips" style="display: flex; margin: 0;">${drafts.map(s => `<span class="due-chip">📅 ${faShort(s.at)}<button type="button" data-cdchip="${escapeHtml(String(s.id))}" data-gid="${escapeHtml(String(task.id))}" aria-label="حذف">✕</button></span>`).join('')}</div>` : ''}
                        <div class="child-add">
                            <input type="text" class="child-input" placeholder="زیرکار جدید..." maxlength="${MAX_LENGTH}" aria-label="عنوان زیرکار جدید">
                            <select class="child-prio lvl-int" aria-label="اولویت زیرکار">
                                <option value="low">کم</option>
                                <option value="medium" selected>متوسط</option>
                                <option value="high">زیاد</option>
                            </select>
                            <button class="btn-icon btn-detail lvl-int" data-action="child-date" aria-label="تعیین سررسید زیرکار">📅</button>
                            <button class="btn-add btn-child-add" data-action="child-add">افزودن</button>
                        </div>
                    </div>` : ''}
                </div>
                <div class="task-actions">
                    ${currentFilter === 'archived'
                        ? `<button class="btn-icon btn-edit" data-action="unarchive" aria-label="بازگردانی از بایگانی">↩</button>
                    <button class="btn-icon btn-delete" data-action="delete" aria-label="حذف گروه">✕</button>`
                        : `<button class="btn-icon btn-pin lvl-int ${task.pinned ? 'on' : ''}" data-action="pin" aria-label="سنجاق به بالا" aria-pressed="${task.pinned ? 'true' : 'false'}">📌</button>
                    <button class="btn-icon btn-detail" data-action="detail" aria-label="جزئیات گروه">📋</button>
                    <button class="btn-icon btn-delete" data-action="delete" aria-label="حذف گروه">✕</button>`}
                </div>
            </div>`;
        }

        let snackTimer = null;

        function showUndoFor(ids, label) {
            const bar = document.getElementById('snackbar');
            if (!bar) return;
            document.getElementById('snackMsg').textContent = label;
            bar.classList.add('show');
            clearTimeout(snackTimer);
            snackTimer = setTimeout(hideSnackbar, 6000);
            document.getElementById('snackUndo').onclick = () => {
                [...ids].reverse().forEach(restoreTrash);
                hideSnackbar();
            };
        }

        function hideSnackbar() {
            clearTimeout(snackTimer);
            const bar = document.getElementById('snackbar');
            if (bar) bar.classList.remove('show');
        }

        function render() {
            scheduleMarkerRefresh();
            const live = tasks.filter(t => !t.archived);
            const filtered = getFiltered();
            const total = live.length;
            const done = live.filter(t => t.kind === 'group' ? groupIsDone(t) : t.completed).length;
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);

            totalCountEl.textContent = toFa(total);
            doneCountEl.textContent = toFa(done);
            remainCountEl.textContent = toFa(total - done);
            renderStats(total, done);
            const activeCount = total - done;
            const tb = document.getElementById('trashCount');
            if (tb) tb.textContent = trash.length ? ` (${toFa(trash.length)})` : '';
            const chip = document.getElementById('dayChip');
            if (chip) {
                if (selectedDay) {
                    const [gy, gm, gd] = selectedDay.split('-').map(Number);
                    chip.style.display = '';
                    chip.innerHTML = `📅 ${new Date(gy, gm - 1, gd).toLocaleDateString('fa-IR', { day: 'numeric', month: 'long' })} <b>✕</b>`;
                } else chip.style.display = 'none';
            }
            let archivedCount = 0;
            let locCount = 0;
            let dueCount = 0;
            tasks.forEach(t => {
                if (t.archived) { archivedCount++; return; }
                if (t.location) locCount++;
                if ((t.sessions || []).length) dueCount++;
                if (t.kind === 'group') (t.children || []).forEach(c => {
                    if (c.archived) { archivedCount++; return; }
                    if (c.location) locCount++;
                    if ((c.sessions || []).length) dueCount++;
                });
            });
            const FILTER_LABELS = { all: 'همه', active: 'انجام نشده', completed: 'انجام شده', archived: '📦 بایگانی', hasloc: '📍 محل‌دار', hasdue: '📅 سررسیددار' };
            const COUNTS = { all: total, active: activeCount, completed: done, archived: archivedCount, hasloc: locCount, hasdue: dueCount };
            filterBtns.forEach(b => {
                const f = b.dataset.filter;
                if (!f || !(f in COUNTS)) return;
                b.textContent = FILTER_LABELS[f] + ` (${toFa(COUNTS[f])})`;
            });
            progressFill.style.width = pct + '%';
            progressPct.textContent = toFa(pct) + '٪';
            progressBar.setAttribute('aria-valuenow', pct);

            clearBtn.style.display = done > 0 ? 'block' : 'none';
            const archBtn = document.getElementById('archiveDone');
            if (archBtn) archBtn.style.display = done > 0 ? 'block' : 'none';

            if (filtered.length === 0) {
                let msg;
                if (searchQuery) {
                    msg = 'نتیجه‌ای برای جستجو یافت نشد';
                } else if (currentFilter === 'completed') {
                    msg = 'هنوز وظیفه انجام شده‌ای ندارید';
                } else if (currentFilter === 'active') {
                    msg = 'همه وظایف انجام شده‌اند!';
                } else {
                    msg = 'لیست وظایف خالی است';
                }
                taskList.innerHTML = `
                    <div class="empty-state">
                        <div class="icon">✦</div>
                        <p>${msg}</p>
                        ${tasks.length === 0 && !searchQuery ? '<p class="empty-hint">برای شروع عنوان را بنویسید و «افزودن» را بزنید — با 📅 تاریخ و با 📍 محل هم می‌توانید اضافه کنید.</p>' : ''}
                    </div>`;
                justAddedId = null;
                return;
            }

            taskList.innerHTML = filtered.map(task => {
                if (task.kind === 'group') return groupHtml(task);
                if (String(task.id) === String(editingId)) {
                    return `
                    <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${escapeHtml(String(task.id))}">
                        <div class="task-content">
                            <div class="edit-wrap">
                                <input type="text" class="task-edit-input" value="${escapeHtml(task.text)}" maxlength="${MAX_LENGTH}" aria-label="ویرایش وظیفه">
                                <button class="btn-icon btn-ok" data-action="edit-ok" aria-label="تأیید ویرایش">✓</button>
                                <button class="btn-icon btn-cancel" data-action="edit-cancel" aria-label="انصراف از ویرایش">✕</button>
                            </div>
                        </div>
                    </div>`;
                }
                return `
                <div class="task-item prio-${task.priority} ${task.completed ? 'completed' : ''} ${task.id === justAddedId ? 'just-added' : ''}"${currentSort === 'manual' ? ' draggable="true"' : ''} data-id="${escapeHtml(String(task.id))}">
                    <button class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle"
                        aria-label="${task.completed ? 'برگرداندن به انجام نشده' : 'علامت‌گذاری به عنوان انجام شده'}"
                        aria-pressed="${task.completed}"></button>
                    <div class="task-content">
                        <div class="task-text" data-action="edit" title="برای ویرایش دو بار کلیک کنید">${escapeHtml(task.text)}</div>
                        <div class="task-meta">
                            <span class="priority-badge p-${task.priority}">${PRIORITY_LABELS[task.priority]}</span>${task.recur && task.recur !== 'none' ? '<span title="تکرارشونده">🔁</span>' : ''}
                            <span class="created-date">${faDate(task.createdAt)}</span>
                            ${(task.photos || []).length ? `<span title="${toFa(task.photos.length)} عکس">📷</span>` : ''}
                            ${task.location ? '<button class="mini-link" data-action="locate" aria-label="نمایش محل روی نقشه">📍 نقشه</button>' : ''}
                        </div>
                        ${sessionSummaryHtml(task)}
                    </div>
                    <div class="task-actions">
                        ${currentFilter === 'archived'
                            ? `<button class="btn-icon btn-edit" data-action="unarchive" aria-label="بازگردانی از بایگانی">↩</button>
                        <button class="btn-icon btn-delete" data-action="delete" aria-label="حذف وظیفه">✕</button>`
                            : `<button class="btn-icon btn-pin lvl-int ${task.pinned ? 'on' : ''}" data-action="pin" aria-label="سنجاق به بالا" aria-pressed="${task.pinned ? 'true' : 'false'}">📌</button>
                        <button class="btn-icon btn-detail" data-action="detail" aria-label="جزئیات و اطلاعات بیشتر">📋</button>
                        <button class="btn-icon btn-edit" data-action="edit-btn" aria-label="ویرایش وظیفه">✎</button>
                        <button class="btn-icon btn-delete" data-action="delete" aria-label="حذف وظیفه">✕</button>`}
                    </div>
                </div>`;
            }).join('');

            justAddedId = null;
        }

