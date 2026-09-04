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

        // بج نمونه‌کار: باز/بسته با کلیک (سازگار با تاچ) + کیبورد
        (function initBadge() {
            const box = document.querySelector('.portfolio-badge__box');
            const link = document.querySelector('.portfolio-badge__link');
            if (!box || !link) return;
            const url = 'https://www.linkedin.com/in/mahdi-amouzegar/';
            const setOpen = open => {
                box.classList.toggle('open', open);
                box.setAttribute('aria-expanded', open ? 'true' : 'false');
                if (open) box.classList.add('seen');
            };
            box.addEventListener('click', e => {
                if (e.target === link || link.contains(e.target)) return;
                if (box.classList.contains('open')) {
                    setOpen(false);
                    window.open(url, '_blank', 'noopener,noreferrer');
                } else setOpen(true);
            });
            link.addEventListener('click', e => {
                e.stopPropagation();
                setOpen(false);
                box.classList.add('seen');
            });
            box.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpen(!box.classList.contains('open'));
                } else if (e.key === 'Escape') setOpen(false);
            });
            document.addEventListener('click', e => {
                if (box.classList.contains('open') && !box.contains(e.target)) setOpen(false);
            });
        })();

        document.getElementById('mapToggle').addEventListener('click', () => {
            prefs.mapVisible = !prefs.mapVisible;
            savePrefs();
            applyMapVisibility();
        });

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
        document.getElementById('pickerOverlay').addEventListener('click', e => {
            if (e.target.id === 'pickerOverlay') closePicker();
        });
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            const overlay = document.getElementById('pickerOverlay');
            if (overlay.style.display === 'flex') closePicker();
            else if (currentDetailId) closeDetail();
        });

        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value;
            render();
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

        bindDetailInputs();
        loadPrefs();
        applyMapVisibility();
        loadTasks().then(() => {
            updateDueChips();
            render();
            initMap();
            syncServerTime();
        });
    
// Future React entry point can import state/actions from here.
window.TodoApp = { getTasks: () => tasks, findTask, saveTasks, render };
