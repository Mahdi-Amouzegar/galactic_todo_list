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
            const kids = g.children || [];
            if (!q || taskMatches(g, q)) return kids;
            return kids.filter(c => taskMatches(c, q));
        }

        function getFiltered() {
            const q = searchQuery.trim();
            let list = tasks.filter(t => {
                if (t.kind === 'group') {
                    if (q) {
                        if (taskMatches(t, q)) return true;
                        return (t.children || []).some(c => taskMatches(c, q));
                    }
                    if (currentFilter === 'completed') return groupIsDone(t);
                    if (currentFilter === 'active') return !groupIsDone(t);
                    return true;
                }
                if (q) return taskMatches(t, q);
                if (currentFilter === 'active') return !t.completed;
                if (currentFilter === 'completed') return t.completed;
                return true;
            });
            if (currentSort === 'due') {
                const key = t => {
                    if (t.kind === 'group') return groupDueKey(t);
                    const u = nearestUpcoming(t);
                    return u ? new Date(u.at).getTime() : Infinity;
                };
                list = [...list].sort((a, b) => key(a) - key(b));
            }
            return list;
        }

        /* ---------- رندر ---------- */

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
            return `<div class="child-item ${c.completed ? 'completed' : ''}" data-id="${escapeHtml(String(c.id))}">
                <button class="task-checkbox ${c.completed ? 'checked' : ''}" data-action="toggle"
                    aria-label="${c.completed ? 'برگرداندن به انجام نشده' : 'علامت‌گذاری به عنوان انجام شده'}"
                    aria-pressed="${c.completed}"></button>
                <span class="child-text" data-action="edit" title="برای ویرایش دو بار کلیک کنید">${escapeHtml(c.text)}</span>
                ${n ? `<span class="child-due">📅 ${faShort(n.at)}</span>` : ''}
                ${c.location ? '<span class="child-due">📍</span>' : ''}
                <span class="child-actions">
                    <button class="mini-link" data-action="detail" aria-label="جزئیات زیرکار">📋</button>
                    <button class="mini-link danger" data-action="delete" aria-label="حذف زیرکار">✕</button>
                </span>
            </div>`;
        }

        function groupHtml(task) {
            const st = groupStats(task);
            const open = expandedGroups.has(String(task.id));
            const kids = visibleChildren(task);
            const drafts = childDrafts[task.id] || [];
            const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
            return `<div class="task-item group-item" data-id="${escapeHtml(String(task.id))}">
                <button class="group-caret" data-action="expand" aria-label="باز و بسته کردن گروه">${open ? '▾' : '▸'}</button>
                <div class="task-content">
                    <div class="task-text">📁 ${escapeHtml(task.text)}</div>
                    <div class="task-meta">
                        <span class="priority-badge p-${task.priority}">${PRIORITY_LABELS[task.priority]}</span>
                        <span>زیرکار: ${toFa(st.done)} از ${toFa(st.total)}</span>
                        <div class="mini-progress"><div class="mini-progress-fill" style="width: ${pct}%;"></div></div>
                    </div>
                    ${(task.sessions && task.sessions.length) ? sessionSummaryHtml(task) : ''}
                    ${open ? `<div class="group-body">
                        ${kids.length ? kids.map(c => childHtml(c)).join('') : '<div class="session-empty">هنوز زیرکاری ثبت نشده است.</div>'}
                        ${drafts.length ? `<div class="due-chips" style="display: flex; margin: 0;">${drafts.map(s => `<span class="due-chip">📅 ${faShort(s.at)}<button type="button" data-cdchip="${escapeHtml(String(s.id))}" data-gid="${escapeHtml(String(task.id))}" aria-label="حذف">✕</button></span>`).join('')}</div>` : ''}
                        <div class="child-add">
                            <input type="text" class="child-input" placeholder="زیرکار جدید..." maxlength="${MAX_LENGTH}" aria-label="عنوان زیرکار جدید">
                            <select class="child-prio" aria-label="اولویت زیرکار">
                                <option value="low">کم</option>
                                <option value="medium" selected>متوسط</option>
                                <option value="high">زیاد</option>
                            </select>
                            <button class="btn-icon btn-detail" data-action="child-date" aria-label="تعیین سررسید زیرکار">📅</button>
                            <button class="btn-add btn-child-add" data-action="child-add">افزودن</button>
                        </div>
                    </div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="btn-icon btn-detail" data-action="detail" aria-label="جزئیات گروه">📋</button>
                    <button class="btn-icon btn-delete" data-action="delete" aria-label="حذف گروه">✕</button>
                </div>
            </div>`;
        }

        function render() {
            refreshMarkers();
            const filtered = getFiltered();
            const total = tasks.length;
            const done = tasks.filter(t => t.kind === 'group' ? groupIsDone(t) : t.completed).length;
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);

            totalCountEl.textContent = toFa(total);
            doneCountEl.textContent = toFa(done);
            remainCountEl.textContent = toFa(total - done);
            progressFill.style.width = pct + '%';
            progressPct.textContent = toFa(pct) + '٪';
            progressBar.setAttribute('aria-valuenow', pct);

            clearBtn.style.display = done > 0 ? 'block' : 'none';

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
                <div class="task-item ${task.completed ? 'completed' : ''} ${task.id === justAddedId ? 'just-added' : ''}" data-id="${escapeHtml(String(task.id))}">
                    <button class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle"
                        aria-label="${task.completed ? 'برگرداندن به انجام نشده' : 'علامت‌گذاری به عنوان انجام شده'}"
                        aria-pressed="${task.completed}"></button>
                    <div class="task-content">
                        <div class="task-text" data-action="edit" title="برای ویرایش دو بار کلیک کنید">${escapeHtml(task.text)}</div>
                        <div class="task-meta">
                            <span class="priority-badge p-${task.priority}">${PRIORITY_LABELS[task.priority]}</span>
                            <span>${faDate(task.createdAt)}</span>
                            ${task.location ? '<button class="mini-link" data-action="locate" aria-label="نمایش محل روی نقشه">📍 نقشه</button>' : ''}
                        </div>
                        ${sessionSummaryHtml(task)}
                    </div>
                    <div class="task-actions">
                        <button class="btn-icon btn-detail" data-action="detail" aria-label="جزئیات و اطلاعات بیشتر">📋</button>
                        <button class="btn-icon btn-edit" data-action="edit-btn" aria-label="ویرایش وظیفه">✎</button>
                        <button class="btn-icon btn-delete" data-action="delete" aria-label="حذف وظیفه">✕</button>
                    </div>
                </div>`;
            }).join('');

            justAddedId = null;
        }

