// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// app.js -- event wiring + boot  |  React: App.jsx composition root
        /* ---------- رویدادها (تفویض رویداد، بدون onclick درون‌خطی) ---------- */

        addBtn.addEventListener('click', addTask);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

        document.getElementById('dueBtn').addEventListener('click', () => openPicker('add'));
        document.getElementById('dueChips').addEventListener('click', e => {
            const b = e.target.closest('[data-dchip]');
            if (!b) return;
            addDraftSessions = addDraftSessions.filter(s => String(s.id) !== b.dataset.dchip);
            updateDueChips();
        });
        document.getElementById('locBtn').addEventListener('click', () => {
            ensureMapVisible();
            switchToTab('map');
            document.getElementById('panelMap').scrollIntoView({ behavior: 'smooth' });
            mapHint('روی نقشه کلیک کنید تا محل وظیفه جدید انتخاب شود');
        });
        document.getElementById('locChip').addEventListener('click', e => {
            if (!e.target.closest('[data-locclear]')) return;
            pendingLoc = null;
            if (pickMarker && mapReady) { map.removeLayer(pickMarker); pickMarker = null; }
            updateLocChip();
        });
        document.getElementById('myLocBtn').addEventListener('click', () => { ensureMapVisible(); locateUser(true); });
        document.getElementById('fsBtn').addEventListener('click', toggleFullscreen);
        document.getElementById('fsExit').addEventListener('click', toggleFullscreen);
        document.getElementById('routeClearBtn').addEventListener('click', clearRoute);

        document.getElementById('sortSelect').addEventListener('change', e => {
            currentSort = e.target.value;
            render();
        });

        document.querySelectorAll('.kind-btn').forEach(b => {
            b.addEventListener('click', () => {
                document.querySelectorAll('.kind-btn').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                pendingKind = b.dataset.kind;
                const isGroup = pendingKind === 'group';
                const locBtn = document.getElementById('locBtn');
                locBtn.style.opacity = isGroup ? '0.4' : '';
                locBtn.style.pointerEvents = isGroup ? 'none' : '';
                input.placeholder = isGroup ? 'عنوان گروه وظیفه (مثلاً خرید بازار)...' : 'وظیفه جدید را بنویسید...';
                if (isGroup) {
                    pendingLoc = null;
                    if (pickMarker && mapReady) { map.removeLayer(pickMarker); pickMarker = null; }
                    updateLocChip();
                }
            });
        });

        document.querySelectorAll('.mobile-tab').forEach(b => {
            b.addEventListener('click', () => switchToTab(b.dataset.tab));
        });

        document.querySelectorAll('#levelRow .kind-btn').forEach(b => {
            b.addEventListener('click', () => applyLevel(b.dataset.level));
        });

        renderTemplateBox();
        document.getElementById('templateBtn').addEventListener('click', () => {
            const box = document.getElementById('templateBox');
            box.style.display = box.style.display === 'none' ? 'flex' : 'none';
        });
        document.getElementById('templateBox').addEventListener('click', e => {
            const b = e.target.closest('[data-template]');
            if (!b) return;
            createGroupFromTemplate(b.dataset.template);
            document.getElementById('templateBox').style.display = 'none';
        });

        /* بج نمونه‌کار حذف شد؛ لینک سازنده در فوتر است */

        document.getElementById('mapToggle').addEventListener('click', () => {
            prefs.mapVisible = !prefs.mapVisible;
            savePrefs();
            applyMapVisibility();
        });

        function initSettings() {
            const on = document.getElementById('setRemindOn');
            const mins = document.getElementById('setRemindMin');
            const dig = document.getElementById('setDigestOn');
            on.checked = prefs.remindOn !== false;
            mins.value = String(prefs.remindMin || 60);
            dig.checked = prefs.digestOn !== false;
            on.addEventListener('change', () => { prefs.remindOn = on.checked; savePrefs(); });
            mins.addEventListener('change', () => { prefs.remindMin = parseInt(mins.value, 10) || 60; savePrefs(); });
            dig.addEventListener('change', () => { prefs.digestOn = dig.checked; savePrefs(); });
            document.getElementById('notifPermBtn').addEventListener('click', async () => {
                await ensureNotifPerm();
                updateNotifStatus();
            });
            document.getElementById('notifTestBtn').addEventListener('click', async () => {
                const ok = await ensureNotifPerm();
                if (ok) fireNotification('🔔 اعلان آزمایشی', 'یادآورها فعال‌اند و درست کار می‌کنند.');
                updateNotifStatus();
            });
            updateNotifStatus();
        }

        function applyLevel(level, save) {
            if (!['beginner', 'intermediate', 'advanced'].includes(level)) level = 'beginner';
            prefs.level = level;
            if (save !== false) savePrefs();
            document.body.setAttribute('data-level', level);
            document.querySelectorAll('#levelRow .kind-btn').forEach(b => b.classList.toggle('active', b.dataset.level === level));
            if (level === 'beginner' && pendingKind !== 'task') {
                pendingKind = 'task';
                document.querySelectorAll('#kindRow .kind-btn').forEach(x => x.classList.toggle('active', x.dataset.kind === 'task'));
                input.placeholder = 'وظیفه جدید را بنویسید...';
            }
        }

        // PWA: نصب به‌عنوان اپلیکیشن (نیازمند https، مثل گیت‌هاب پیجز)
        let deferredPrompt = null;
        const installBtn = document.getElementById('installBtn');
        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            deferredPrompt = e;
            if (installBtn) installBtn.style.display = '';
        });
        if (installBtn) installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            installBtn.style.display = 'none';
        });
        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            if (installBtn) installBtn.style.display = 'none';
        });
        if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').catch(() => {});
            });
        }

        document.getElementById('pickerPrev').addEventListener('click', () => shiftPickerMonth(-1));
        document.getElementById('pickerNext').addEventListener('click', () => shiftPickerMonth(1));
        document.getElementById('pickerDays').addEventListener('click', e => {
            const dayBtn = e.target.closest('[data-day]');
            if (!dayBtn || dayBtn.disabled) return;
            pickerDay = parseInt(dayBtn.dataset.day, 10);
            document.getElementById('pickerError').textContent = '';
            renderPicker();
        });
        document.getElementById('pickerConfirm').addEventListener('click', confirmPicker);
        document.getElementById('pickerRemove').addEventListener('click', removePickerDue);
        document.getElementById('pickerCancel').addEventListener('click', closePicker);
        document.querySelector('.picker-chips').addEventListener('click', e => {
            const b = e.target.closest('[data-preset]');
            if (!b) return;
            document.getElementById('pickerError').textContent = '';
            applyPreset(b.dataset.preset);
        });
        document.getElementById('calBtn').addEventListener('click', openCal);
        document.getElementById('calClose').addEventListener('click', closeCal);
        document.getElementById('calPrev').addEventListener('click', () => shiftCalMonth(-1));
        document.getElementById('calNext').addEventListener('click', () => shiftCalMonth(1));
        document.getElementById('calDays').addEventListener('click', e => {
            const b = e.target.closest('[data-calday]');
            if (!b) return;
            setSelectedDay(b.dataset.calday);
            closeCal();
            switchToTab('tasks');
        });
        document.getElementById('dayChip').addEventListener('click', () => setSelectedDay(null));
        document.getElementById('trashBtn').addEventListener('click', openTrash);
        document.getElementById('trashBack').addEventListener('click', closeTrash);
        document.getElementById('trashEmpty').addEventListener('click', () => {
            if (!trash.length) return;
            if (!confirm('سطل زباله کاملاً خالی شود؟')) return;
            trash = [];
            saveTrash();
            renderTrash();
            render();
        });
        document.getElementById('trashList').addEventListener('click', e => {
            const b = e.target.closest('[data-tact]');
            if (!b) return;
            if (b.dataset.tact === 'restore') restoreTrash(b.dataset.tid);
            else if (b.dataset.tact === 'purge') {
                if (!confirm('برای همیشه حذف شود؟')) return;
                trash = trash.filter(x => String(x.id) !== String(b.dataset.tid));
                saveTrash();
                renderTrash();
                render();
            }
        });
        document.getElementById('calOverlay').addEventListener('click', e => {
            if (e.target.id === 'calOverlay') closeCal();
        });
        document.getElementById('pickerOverlay').addEventListener('click', e => {
            if (e.target.id === 'pickerOverlay') closePicker();
        });
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            const overlay = document.getElementById('pickerOverlay');
            if (overlay.style.display === 'flex') closePicker();
            else if (document.getElementById('calOverlay').style.display === 'flex') closeCal();
            else if (document.getElementById('trashPage').style.display === 'block') closeTrash();
            else if (currentDetailId) closeDetail();
            else if (document.querySelector('.map-wrap.fullscreen')) toggleFullscreen();
        });

        let searchTimer = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                searchQuery = searchInput.value;
                render();
            }, 150);
        });

        taskList.addEventListener('click', e => {
            // حالت ویرایش: کلیک روی اینپوت‌ها نباید کاری کند
            if (e.target.classList.contains('task-edit-input') || e.target.classList.contains('child-input')) return;

            // حذف چیپ سررسید پیش‌نویس زیرکار
            const cdchip = e.target.closest('[data-cdchip]');
            if (cdchip) {
                const gid = cdchip.dataset.gid;
                childDrafts[gid] = (childDrafts[gid] || []).filter(s => String(s.id) !== cdchip.dataset.cdchip);
                render();
                return;
            }

            const childEl = e.target.closest('.child-item');
            const item = e.target.closest('.task-item');
            if (!item) return;
            const scopeEl = childEl || item;
            const id = scopeEl.dataset.id;
            const actionEl = e.target.closest('[data-action]');
            if (!actionEl && editingId) return;

            const action = actionEl ? actionEl.dataset.action : null;
            if (action === 'toggle') toggleTask(id);
            else if (action === 'delete') deleteTask(id, scopeEl);
            else if (action === 'edit-btn') startEdit(id);
            else if (action === 'edit-ok') {
                const inp = scopeEl.querySelector('.task-edit-input');
                commitEdit(id, inp ? inp.value : '');
            }
            else if (action === 'edit-cancel') cancelEdit();
            else if (action === 'detail') openDetail(id);
            else if (action === 'locate') { ensureMapVisible(); flyToTask(id); }
            else if (action === 'pin') {
                const found = findTask(id);
                if (found) {
                    found.task.pinned = !found.task.pinned;
                    saveTasks();
                    render();
                }
            }
            else if (action === 'unarchive') {
                const found = findTask(id);
                if (found) {
                    found.task.archived = false;
                    saveTasks();
                    render();
                }
            }
            else if (action === 'pick-loc') {
                const found = findTask(id);
                if (!found) return;
                ensureMapVisible();
                if (found.task.location) flyToTask(id);
                else if (!mapReady) mapHint('نقشه در دسترس نیست (آفلاین؟)');
                else {
                    relocateTaskId = id;
                    switchToTab('map');
                    document.getElementById('panelMap').scrollIntoView({ behavior: 'smooth' });
                    mapHint('روی نقشه کلیک کنید تا محل ثبت شود');
                }
            }
            else if (action === 'check-all') {
                const g = tasks.find(t => String(t.id) === String(id) && t.kind === 'group');
                if (g) {
                    (g.children || []).forEach(c => { c.completed = true; });
                    saveTasks();
                    render();
                }
            }
            else if (action === 'expand') {
                const gid = String(id);
                if (expandedGroups.has(gid)) expandedGroups.delete(gid);
                else expandedGroups.add(gid);
                render();
            }
            else if (action === 'child-date') {
                openPicker('child', iso => {
                    const arr = childDrafts[id] || (childDrafts[id] = []);
                    arr.push({ id: uid(), at: iso });
                    render();
                    const ni = taskList.querySelector(`.task-item[data-id="${id}"] .child-input`);
                    if (ni) ni.focus();
                });
            }
            else if (action === 'child-add') addChild(id);
        });

        taskList.addEventListener('dblclick', e => {
            const textEl = e.target.closest('[data-action="edit"]');
            if (!textEl) return;
            const scopeEl = textEl.closest('.child-item') || textEl.closest('.task-item');
            if (scopeEl) startEdit(scopeEl.dataset.id);
        });

        taskList.addEventListener('keydown', e => {
            if (e.target.classList.contains('child-input')) {
                if (e.key === 'Enter') {
                    const item = e.target.closest('.task-item');
                    if (item) addChild(item.dataset.id);
                }
                return;
            }
            const editInput = e.target.closest('.task-edit-input');
            if (!editInput) return;
            const scopeEl = editInput.closest('.child-item') || editInput.closest('.task-item');
            if (!scopeEl) return;
            if (e.key === 'Enter') commitEdit(scopeEl.dataset.id, editInput.value);
            else if (e.key === 'Escape') cancelEdit();
        });

        taskList.addEventListener('focusout', e => {
            const editInput = e.target.closest('.task-edit-input');
            if (!editInput) return;
            // اگر فوکوس هنوز داخل همان آیتم است (مثلاً کلیک روی دکمه‌ای داخلش)، ذخیره نکن
            const item = editInput.closest('.task-item');
            if (item && item.contains(e.relatedTarget)) return;
            const scopeEl = editInput.closest('.child-item') || item;
            if (!scopeEl) return;
            commitEdit(scopeEl.dataset.id, editInput.value);
        });

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                render();
            });
        });

        clearBtn.addEventListener('click', clearCompleted);
        document.getElementById('archiveDone').addEventListener('click', archiveDone);

        // ورود صوتی فارسی — فقط موبایلِ دارای Web Speech API
        (function initMic() {
            const btn = document.getElementById('micBtn');
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
            if (!SR || !isMobile) {
                btn.style.display = 'none';
                return;
            }
            let rec = null;
            let baseText = '';
            btn.addEventListener('click', () => {
                if (rec) {
                    rec.stop();
                    return;
                }
                rec = new SR();
                rec.lang = 'fa-IR';
                rec.interimResults = true;
                rec.maxAlternatives = 1;
                baseText = input.value ? input.value.trim() + ' ' : '';
                btn.classList.add('listening');
                rec.onresult = e => {
                    let txt = '';
                    for (const r of e.results) txt += r[0].transcript;
                    input.value = (baseText + txt).slice(0, MAX_LENGTH);
                    input.focus();
                };
                const stop = () => {
                    rec = null;
                    btn.classList.remove('listening');
                };
                rec.onend = stop;
                rec.onerror = stop;
                try {
                    rec.start();
                } catch {
                    stop();
                }
            });
        })();

        // میان‌برهای کیبورد: / جست‌وجو، n وظیفه جدید
        const anyOverlayOpen = () =>
            document.getElementById('pickerOverlay').style.display === 'flex' ||
            document.getElementById('calOverlay').style.display === 'flex' ||
            document.getElementById('trashPage').style.display === 'block' ||
            document.getElementById('lightbox').style.display === 'flex' ||
            Boolean(currentDetailId);

        document.addEventListener('keydown', e => {
            if (e.key !== '/' && e.key !== 'n' && e.key !== 'N' && e.key !== 'ن') return;
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
            if (anyOverlayOpen()) return;
            e.preventDefault();
            switchToTab('tasks');
            if (e.key === '/') searchInput.focus();
            else {
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                input.focus();
            }
        });

        // مرتب‌سازی دستی با درگ (حالت «دستی»)
        let dragId = null;
        taskList.addEventListener('dragstart', e => {
            const item = e.target.closest('.task-item');
            if (!item || currentSort !== 'manual' || e.target.closest('.child-item')) {
                e.preventDefault();
                return;
            }
            dragId = item.dataset.id;
            e.dataTransfer.effectAllowed = 'move';
            try {
                e.dataTransfer.setData('text/plain', dragId);
            } catch { /* نادیده */ }
            item.classList.add('dragging');
        });
        taskList.addEventListener('dragover', e => {
            if (!dragId) return;
            const item = e.target.closest('.task-item');
            if (!item || item.dataset.id === dragId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('drop-target');
        });
        taskList.addEventListener('dragleave', e => {
            const item = e.target.closest('.task-item');
            if (item) item.classList.remove('drop-target');
        });
        taskList.addEventListener('drop', e => {
            const item = e.target.closest('.task-item');
            if (!item || !dragId || item.dataset.id === dragId) return;
            e.preventDefault();
            const from = tasks.findIndex(t => String(t.id) === String(dragId));
            const to = tasks.findIndex(t => String(t.id) === String(item.dataset.id));
            if (from < 0 || to < 0) return;
            const [moved] = tasks.splice(from, 1);
            tasks.splice(to, 0, moved);
            dragId = null;
            saveTasks();
            render();
        });
        taskList.addEventListener('dragend', () => {
            dragId = null;
            taskList.querySelectorAll('.drop-target,.dragging').forEach(el => el.classList.remove('drop-target', 'dragging'));
        });

        // پیشنهاد هوشمند تاریخ از متن
        let smartTimer = null;
        let smartDismissedFor = '';
        const hideSmart = () => {
            document.getElementById('smartChip').style.display = 'none';
        };
        input.addEventListener('input', () => {
            clearTimeout(smartTimer);
            smartTimer = setTimeout(() => {
                const v = input.value.trim();
                hideSmart();
                if (!v || v === smartDismissedFor) return;
                const iso = parseFaDateTime(v, getNow());
                if (!iso) return;
                if (addDraftSessions.some(s => Math.abs(new Date(s.at).getTime() - new Date(iso).getTime()) < 60000)) return;
                document.getElementById('smartChipText').textContent = `📅 پیشنهاد: ${faShort(iso)}`;
                document.getElementById('smartChip').style.display = 'flex';
                document.getElementById('smartAccept').onclick = () => {
                    addDraftSessions.push({ id: uid(), at: iso });
                    updateDueChips();
                    hideSmart();
                    input.focus();
                };
                document.getElementById('smartDismiss').onclick = () => {
                    smartDismissedFor = v;
                    hideSmart();
                };
            }, 400);
        });

        // پر کردن انتخاب‌های ساعت و دقیقه با اعداد فارسی
        (function initTimeSelects() {
            const hourSel = document.getElementById('pickerHour');
            const minSel = document.getElementById('pickerMinute');
            for (let h = 0; h < 24; h++) {
                const o = document.createElement('option');
                o.value = String(h).padStart(2, '0');
                o.textContent = toFa(h);
                hourSel.appendChild(o);
            }
            for (let m = 0; m < 60; m += 5) {
                const o = document.createElement('option');
                o.value = String(m).padStart(2, '0');
                o.textContent = toFa(m);
                minSel.appendChild(o);
            }
        })();

        // تاریخ امروز شمسی در هدر
        try {
            document.getElementById('todayLine').textContent =
                'امروز: ' + new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
        } catch { /* نادیده */ }
        bindDetailInputs();
        loadPrefs();
        if (!prefs.tourSeen) {
            document.getElementById('welcomeOverlay').style.display = 'flex';
            document.getElementById('welcomeStart').addEventListener('click', () => {
                document.getElementById('welcomeOverlay').style.display = 'none';
                prefs.tourSeen = true;
                savePrefs();
                input.focus();
            }, { once: true });
        }
        initSettings();
        applyMapVisibility();
        loadTasks().then(async () => {
            await loadTrash();
            if (!prefs.level) {
                prefs.level = tasks.length ? 'advanced' : 'beginner';
                savePrefs();
            }
            applyLevel(prefs.level, false);
            updateDueChips();
            render();
            renderTrash();
            initMap();
            syncServerTime();
            startReminderLoop();
        });
    
// Future React entry point can import state/actions from here.
window.TodoApp = { getTasks: () => tasks, findTask, saveTasks, render };
