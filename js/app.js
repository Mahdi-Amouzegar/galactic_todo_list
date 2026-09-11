// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// app.js -- event wiring + boot  |  React: App.jsx composition root

        /* ---------- رویدادها (تفویض رویداد، بدون onclick درون‌خطی) ---------- */

        addBtn.addEventListener('click', () => addTask(pendingKind));
        input.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(pendingKind); });

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
        function setKind(kind) {
            pendingKind = kind;
            prefs.pendingKind = kind;
            savePrefs();
            input.placeholder = kind === 'plan'
                ? 'نام برنامه (مثلاً سفر به تهران)...'
                : kind === 'series'
                    ? 'نام دوره (مثلاً جلسات فیزیوتراپی)...'
                    : 'کار جدید را بنویسید...';
            document.querySelectorAll('.kind3-btn').forEach(x => x.classList.toggle('active', x.dataset.kind === kind));
            const isPlan = kind === 'plan';
            const isSeries = kind === 'series';
            document.getElementById('locBtn').style.display = isPlan ? 'none' : '';
            if (isPlan && pendingLoc) {
                pendingLoc = null;
                if (pickMarker && mapReady) { map.removeLayer(pickMarker); pickMarker = null; }
                updateLocChip();
            }
            if (addDraftSessions.length && (isPlan || isSeries)) {
                addDraftSessions = [];
                updateDueChips();
            }
            const sc = document.getElementById('smartChip');
            if (sc && (isPlan || (isSeries && seriesType !== 'dates'))) sc.style.display = 'none';
            document.getElementById('planKidsWrap').style.display = isPlan ? '' : 'none';
            const md = document.getElementById('moreDetails');
            if (md) {
                md.style.display = isSeries ? '' : 'none';
                if (!isSeries) md.open = false;
            }
            document.getElementById('seriesRecurWrap').style.display = isSeries ? '' : 'none';
            const tb = document.getElementById('templateBtn');
            if (tb) tb.style.display = isPlan ? '' : 'none';
            const addB = document.getElementById('addBtn');
            if (addB) addB.textContent = isPlan ? 'افزودن برنامه' : isSeries ? 'افزودن دوره' : 'افزودن کار';
            updateDueRow();
            syncDisclosure();
        }

        function updateDueRow() {
            const isPlan = pendingKind === 'plan';
            const isDates = pendingKind === 'series' && seriesType === 'dates';
            const dueB = document.getElementById('dueBtn');
            if (dueB) dueB.style.display = (isPlan || pendingKind === 'series') ? 'none' : '';
            const sad = document.getElementById('seriesAddDate');
            if (sad) sad.style.display = isDates ? '' : 'none';
            const dc = document.getElementById('dueChips');
            const slot = document.getElementById('dueChipsSlot');
            if (dc && slot) {
                if (isDates) slot.appendChild(dc);
                else if (window.__dueHome && dc.parentElement !== window.__dueHome.p) {
                    window.__dueHome.p.insertBefore(dc, window.__dueHome.n);
                }
            }
        }

        function syncDisclosure() {
            const md = document.getElementById('moreDetails');
            if (md) md.open = prefs.proMode === true;
        }

        document.querySelectorAll('.kind3-btn').forEach(b => {
            b.addEventListener('click', () => {
                setKind(b.dataset.kind);
                input.focus();
            });
        });

        document.querySelectorAll('[data-srecur]').forEach(b => {
            b.addEventListener('click', () => {
                seriesType = b.dataset.srecur;
                document.querySelectorAll('[data-srecur]').forEach(x => x.classList.toggle('on', x === b));
                document.getElementById('seriesError').textContent = '';
                seriesDays = [];
                document.querySelectorAll('#seriesSubWeek .on, #seriesMonthChips .on').forEach(x => x.classList.remove('on'));
                document.getElementById('seriesSubHours').style.display = seriesType === 'hourlyN' ? '' : 'none';
                document.getElementById('seriesSubWeek').style.display = seriesType === 'weeklyDays' ? '' : 'none';
                document.getElementById('seriesSubMonth').style.display = seriesType === 'monthlyDays' ? '' : 'none';
                updateDueRow();
                if (seriesType !== 'dates' && addDraftSessions.length) {
                    addDraftSessions = [];
                    updateDueChips();
                }
            });
        });
        document.querySelectorAll('[data-snh]').forEach(b => {
            b.addEventListener('click', () => {
                document.getElementById('seriesN').value = b.dataset.snh;
            });
        });
        document.getElementById('seriesSubWeek').addEventListener('click', e => {
            const b = e.target.closest('[data-swday]');
            if (!b) return;
            const v = parseInt(b.dataset.swday, 10);
            const i = seriesDays.indexOf(v);
            if (i >= 0) { seriesDays.splice(i, 1); b.classList.remove('on'); }
            else { seriesDays.push(v); b.classList.add('on'); }
        });
        (function renderSeriesMonth() {
            const mc = document.getElementById('seriesMonthChips');
            if (!mc) return;
            let h = '';
            for (let d = 1; d <= 31; d++) h += `<button type="button" class="day-chip" data-smday="${d}">${toFa(d)}</button>`;
            mc.innerHTML = h;
        })();
        document.getElementById('seriesMonthChips').addEventListener('click', e => {
            const b = e.target.closest('[data-smday]');
            if (!b) return;
            const v = parseInt(b.dataset.smday, 10);
            const i = seriesDays.indexOf(v);
            if (i >= 0) { seriesDays.splice(i, 1); b.classList.remove('on'); }
            else { seriesDays.push(v); b.classList.add('on'); }
        });

        document.querySelectorAll('.mobile-tab').forEach(b => {
            b.addEventListener('click', () => switchToTab(b.dataset.tab));
        });
        document.getElementById('seriesAddDate').addEventListener('click', () => openPicker('add'));

        function renderPlanKids() {
            const box = document.getElementById('planKidChips');
            if (!box) return;
            box.innerHTML = planDraftKids.map((k, i) => `<span class="due-chip">📝 ${escapeHtml(k)}<button type="button" data-plankid="${i}" aria-label="حذف">✕</button></span>`).join('');
            box.style.display = planDraftKids.length ? 'flex' : 'none';
        }

        document.getElementById('planKidAdd').addEventListener('click', () => {
            const inp = document.getElementById('planKidInput');
            const v = inp.value.trim().replace(/\s+/g, ' ');
            if (!v) { inp.focus(); return; }
            planDraftKids.push(v.slice(0, MAX_LENGTH));
            inp.value = '';
            renderPlanKids();
            inp.focus();
        });
        document.getElementById('planKidInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('planKidAdd').click();
            }
        });
        document.getElementById('planKidChips').addEventListener('click', e => {
            const b = e.target.closest('[data-plankid]');
            if (!b) return;
            planDraftKids.splice(parseInt(b.dataset.plankid, 10), 1);
            renderPlanKids();
        });

        document.getElementById('templateBtn').addEventListener('click', openTemplateModal);
        document.getElementById('tplClose').addEventListener('click', closeTemplateModal);
        document.getElementById('templateModal').addEventListener('click', e => {
            if (e.target.id === 'templateModal') closeTemplateModal();
        });
        document.getElementById('tplList').addEventListener('click', e => {
            const b = e.target.closest('[data-tpl]');
            if (!b) return;
            const tpl = PLAN_TEMPLATES.find(x => x.id === b.dataset.tpl);
            if (!tpl) return;
            tplDraft = { name: tpl.title, kids: [...tpl.children], startAt: null, endAt: null };
            document.getElementById('tplName').value = tpl.title;
            renderTplDates();
            renderTplKids();
            document.getElementById('tplList').style.display = 'none';
            document.getElementById('tplConfig').style.display = '';
            document.getElementById('tplKidAdd').style.display = '';
            document.getElementById('tplBack').style.display = '';
            document.getElementById('tplCreate').style.display = '';
        });
        document.getElementById('tplBack').addEventListener('click', () => {
            tplDraft = null;
            renderTemplateList();
            document.getElementById('tplList').style.display = '';
            document.getElementById('tplConfig').style.display = 'none';
            document.getElementById('tplKidAdd').style.display = 'none';
            document.getElementById('tplBack').style.display = 'none';
            document.getElementById('tplCreate').style.display = 'none';
        });
        document.getElementById('tplKidAdd').addEventListener('click', () => {
            const inp = document.getElementById('tplKidInput');
            const v = inp.value.trim().replace(/\s+/g, ' ');
            if (!v || !tplDraft) { inp.focus(); return; }
            tplDraft.kids.push(v.slice(0, MAX_LENGTH));
            inp.value = '';
            renderTplKids();
            inp.focus();
        });
        document.getElementById('tplKidInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('tplKidAdd').click();
            }
        });
        document.getElementById('tplKids').addEventListener('click', e => {
            const b = e.target.closest('[data-tplkid]');
            if (!b || !tplDraft) return;
            tplDraft.kids.splice(parseInt(b.dataset.tplkid, 10), 1);
            renderTplKids();
        });
        document.getElementById('tplCreate').addEventListener('click', () => {
            if (!tplDraft) return;
            const name = document.getElementById('tplName').value.trim();
            if (!name) {
                document.getElementById('tplName').focus();
                return;
            }
            const kids = [...tplDraft.kids];
            const startAt = tplDraft.startAt;
            const endAt = tplDraft.endAt;
            closeTemplateModal();
            createPlanCustom(name, kids, { startAt, endAt });
        });
        function renderTplDates() {
            const el = document.getElementById('tplDatesLine');
            if (!el) return;
            if (!tplDraft) {
                el.textContent = '';
                return;
            }
            const fmt = iso => {
                try {
                    return new Date(iso).toLocaleDateString('fa-IR', { day: 'numeric', month: 'long' });
                } catch {
                    return '';
                }
            };
            const parts = [];
            if (tplDraft.startAt) parts.push('از ' + fmt(tplDraft.startAt));
            if (tplDraft.endAt) parts.push('تا ' + fmt(tplDraft.endAt));
            el.textContent = parts.length ? '📅 ' + parts.join(' ') : '';
        }
        document.getElementById('tplStartBtn').addEventListener('click', () => {
            if (!tplDraft) return;
            openPicker('tpldate', iso => {
                tplDraft.startAt = iso;
                if (tplDraft.endAt && new Date(tplDraft.endAt) < new Date(iso)) tplDraft.endAt = null;
                renderTplDates();
            });
        });
        document.getElementById('tplEndBtn').addEventListener('click', () => {
            if (!tplDraft) return;
            openPicker('tpldate', iso => {
                tplDraft.endAt = iso;
                renderTplDates();
            });
        });

        /* ---------- دکمه‌های هدر: راهنما و حریم خصوصی (مودال) ---------- */

        // دکمه «کارهایت، زمانت، مسیرت» → مودال اطلاعات
        document.getElementById('heroDescToggle').addEventListener('click', async () => {
            await showInfoModal({
                title: 'راه فردا',
                paragraphs: [
                    'وظایف و قرارهای روزانه را با یادآور، نقشه و تقویم شمسی مدیریت کن — <strong>بدون حساب کاربری</strong>، حتی آفلاین.',
                    '<strong>📝 کار:</strong> یک وظیفه ساده با تاریخ یا محل.',
                    '<strong>📂 برنامه:</strong> مجموعه‌ای از زیرکارها (مثلاً سفر، خانه‌تکانی).',
                    '<strong>📅 دوره:</strong> یک وظیفه تکرارشونده (روزانه، هفتگی، ماهانه یا سفارشی).',
                    'برای شروع، عنوان را در فیلد بالا بنویس و دکمه <strong>افزودن کار</strong> را بزن.'
                ],
                buttonText: 'شروع می‌کنم'
            });
            // بعد از بستن، فوکوس روی input در دسکتاپ
            if (window.matchMedia('(min-width: 901px)').matches) {
                const ti = document.getElementById('taskInput');
                if (ti) ti.focus({ preventScroll: true });
            }
        });

        // دکمه «🔒 حریم خصوصی» در هدر → مودال اطلاعات
        document.getElementById('privacyBtn').addEventListener('click', async () => {
            await showInfoModal({
                title: '🔒 حریم خصوصی شما',
                paragraphs: [
                    '<strong>همه اطلاعات شما</strong> (وظایف، تاریخ‌ها، محل‌ها و تصاویر) فقط در همین دستگاه و مرورگر خودتان ذخیره می‌شود و به هیچ سروری ارسال نمی‌شود.',
                    '<strong>نقشه</strong> فقط تصویر اینترنتی است و چیزی از شما آپلود نمی‌کند. سرویس‌های نقشه (OpenStreetMap، Esri) فقط tile تصویری دریافت می‌کنند، نه اطلاعات وظایف شما.',
                    '<strong>همگام‌سازی زمان</strong> با سرورهای عمومی (timeapi.io، worldclockapi.com) فقط برای اصلاح ساعت دستگاه است و هیچ اطلاعاتی ارسال نمی‌کند.',
                    '<strong>پشتیبان‌گیری:</strong> چون داده‌ها فقط روی دستگاه شماست، توصیه می‌شود از قابلیت Export (به‌زودی) یا پشتیبان‌گیری از مرورگر خود استفاده کنید.',
                    'برای پاک کردن کامل داده‌ها، از سطل زباله استفاده کنید یا داده‌های سایت را از تنظیمات مرورگر حذف کنید.'
                ],
                buttonText: 'فهمیدم'
            });
            // بعد از بستن، فوکوس روی input در دسکتاپ
            if (window.matchMedia('(min-width: 901px)').matches) {
                const ti = document.getElementById('taskInput');
                if (ti) ti.focus({ preventScroll: true });
            }
        });

        document.getElementById('mapToggle').addEventListener('click', () => {
            prefs.mapVisible = !prefs.mapVisible;
            savePrefs();
            applyMapVisibility();
            if (prefs.mapVisible) initMap();
        });

        function initSettings() {
            const on = document.getElementById('setRemindOn');
            const mins = document.getElementById('setRemindMin');
            const dig = document.getElementById('setDigestOn');
            on.checked = prefs.remindOn !== false;
            mins.value = String(prefs.remindMin || 60);
            dig.checked = prefs.digestOn !== false;
            const pro = document.getElementById('setProMode');
            if (pro) {
                pro.checked = prefs.proMode === true;
                pro.addEventListener('change', () => {
                    prefs.proMode = pro.checked;
                    savePrefs();
                    applyProMode();
                    syncDisclosure();
                });
            }
            on.addEventListener('change', () => { prefs.remindOn = on.checked; savePrefs(); });
            mins.addEventListener('change', () => { prefs.remindMin = parseInt(mins.value, 10) || 60; savePrefs(); });
            dig.addEventListener('change', () => { prefs.digestOn = dig.checked; savePrefs(); });
            const snd = document.getElementById('setSoundOn');
            if (snd) {
                snd.checked = prefs.soundOn !== false;
                snd.addEventListener('change', () => { prefs.soundOn = snd.checked; savePrefs(); });
            }
            document.getElementById('notifPermBtn').addEventListener('click', async () => {
                await ensureNotifPerm();
                updateNotifStatus();
            });
            document.getElementById('notifTestBtn').addEventListener('click', async () => {
                const ok = await ensureNotifPerm();
                if (ok) {
                    fireNotification('🔔 اعلان آزمایشی', 'یادآورها فعال‌اند و درست کار می‌کنند.');
                    playChime();
                }
                updateNotifStatus();
            });
            //window.addEventListener('pointerdown', ensureAudio);
            //window.addEventListener('keydown', ensureAudio);
            updateNotifStatus();
        }

        function applyProMode() {
            if (prefs.proMode) {
                tasks.forEach(t => { if (t.kind === 'plan') expandedPlans.add(String(t.id)); });
                render();
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
        document.getElementById('trashEmpty').addEventListener('click', async () => {
            if (!trash.length) return;
            const ok = await showConfirmModal({
                title: 'خالی کردن سطل زباله',
                message: 'همه موارد سطل زباله برای همیشه حذف شوند؟ این عمل قابل بازگشت نیست.',
                confirmText: 'خالی کن',
                cancelText: 'انصراف',
                danger: true
            });
            if (!ok) return;
            trash = [];
            saveTrash();
            renderTrash();
            render();
        });
        document.getElementById('trashList').addEventListener('click', async e => {
            const b = e.target.closest('[data-tact]');
            if (!b) return;
            if (b.dataset.tact === 'restore') restoreTrash(b.dataset.tid);
            else if (b.dataset.tact === 'purge') {
                const ok = await showConfirmModal({
                    title: 'حذف همیشگی',
                    message: 'این مورد برای همیشه حذف شود؟ این عمل قابل بازگشت نیست.',
                    confirmText: 'حذف کن',
                    cancelText: 'انصراف',
                    danger: true
                });
                if (!ok) return;
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
                // مدیریت متمرکز Escape — به ترتیب اولویت از بالا به پایین
        // (بالاترین z-index اول)
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;

            // ۱. مودال‌های stacked (z-index: 300)
            const namePrompt = document.getElementById('namePromptModal');
            if (namePrompt && namePrompt.style.display === 'flex') return; // خودش مدیریت می‌کند

            const nameConflict = document.getElementById('nameConflictModal');
            if (nameConflict && nameConflict.style.display === 'flex') return; // خودش مدیریت می‌کند

            const confirmModal = document.getElementById('confirmModal');
            if (confirmModal && confirmModal.style.display === 'flex') return; // خودش مدیریت می‌کند

            const infoModal = document.getElementById('infoModal');
            if (infoModal && infoModal.style.display === 'flex') return; // خودش مدیریت می‌کند

            // ۲. مودال‌های عمومی (z-index: 100)
            const picker = document.getElementById('pickerOverlay');
            if (picker && picker.style.display === 'flex') { closePicker(); return; }

            const cal = document.getElementById('calOverlay');
            if (cal && cal.style.display === 'flex') { closeCal(); return; }

            const tpl = document.getElementById('templateModal');
            if (tpl && tpl.style.display === 'flex') { closeTemplateModal(); return; }

            const saved = document.getElementById('savedLocationsModal');
            if (saved && saved.style.display === 'flex') {
                if (typeof closeManageModal === 'function') closeManageModal();
                else saved.style.display = 'none';
                return;
            }

            // ۳. صفحه‌های تمام‌صفحه (z-index: 60)
            const trash = document.getElementById('trashPage');
            if (trash && trash.style.display === 'block') { closeTrash(); return; }

            if (currentDetailId) { closeDetail(); return; }

            // ۴. نقشه تمام‌صفحه
            if (document.querySelector('.map-wrap.fullscreen')) toggleFullscreen();
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
    console.log('🟡 action =', action, '| id =', id, '| scopeEl =', scopeEl);
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
            else if (action === 'archive') {
                const found = findTask(id);
                if (found) {
                    found.task.archived = true;
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
                const g = tasks.find(t => String(t.id) === String(id) && t.kind === 'plan');
                if (g) {
                    (g.children || []).forEach(c => { c.completed = true; });
                    saveTasks();
                    render();
                }
            }
            else if (action === 'expand') {
                const gid = String(id);
                if (expandedPlans.has(gid)) expandedPlans.delete(gid);
                else expandedPlans.add(gid);
                render();
            }
            else if (action === 'child-date') {
                openPicker('child', iso => {
                    const arr = childDrafts[id] || (childDrafts[id] = []);
                    if (hasSessionAt(arr, iso)) {
                        const ci = taskList.querySelector(`.task-item[data-id="${id}"] .child-input`);
                        if (ci) {
                            ci.classList.remove('input-error');
                            void ci.offsetWidth;
                            ci.classList.add('input-error');
                        }
                        return;
                    }
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
                if (!v || v === smartDismissedFor || pendingKind === 'plan') return;
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

        // تاریخ امروز شمسی در هدر + سال کپی‌رایت فوتر
        try {
            document.getElementById('todayLine').textContent =
                'امروز: ' + new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
            document.getElementById('copyYear').textContent =
                new Date().toLocaleDateString('fa-IR', { year: 'numeric' });
        } catch { /* نادیده */ }
        bindDetailInputs();
        loadPrefs();
        (function () {
            const dc = document.getElementById('dueChips');
            if (dc) window.__dueHome = { p: dc.parentElement, n: dc.nextElementSibling };
        })();
        setKind(prefs.pendingKind || 'task');
        if (!prefs.tourSeen) {
            document.getElementById('welcomeOverlay').style.display = 'flex';
            document.getElementById('welcomeStart').addEventListener('click', () => {
                document.getElementById('welcomeOverlay').style.display = 'none';
                prefs.tourSeen = true;
                savePrefs();
                input.focus();
            }, { once: true });
        }
        // focus خودکار روی input فقط در دسکتاپ (روی موبایل، کیبورد نباید خودکار باز شود)
        if (window.matchMedia('(min-width: 901px)').matches && !prefs.tourSeen) {
            setTimeout(() => {
                const ti = document.getElementById('taskInput');
                if (ti) ti.focus({ preventScroll: true });
            }, 100);
        }
        initSettings();
        applyMapVisibility();
loadTasks().then(async () => {
    await loadTrash();
    if (prefs.proMode) tasks.forEach(t => { if (t.kind === 'plan') expandedPlans.add(String(t.id)); });
    updateDueChips();
    syncDisclosure();
    try {
        console.log('🔴 Before render in loadTasks.then');
        render();
        console.log('🟢 After render in loadTasks.then');
    } catch (err) {
        console.error('❌ Error in render (loadTasks.then):', err);
    }
    try {
        renderTrash();
        console.log('🟢 After renderTrash');
    } catch (err) {
        console.error('❌ Error in renderTrash:', err);
    }
    initMap();
    syncServerTime();
    startReminderLoop();
});

// Future React entry point can import state/actions from here.
window.TodoApp = { getTasks: () => tasks, findTask, saveTasks, render };