// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// picker.js -- Jalali date+time picker dialog  |  React: <DuePicker/>
        /* ---------- پیکر گرافیکی تاریخ جلالی + ساعت ---------- */

        let conflictArmed = false;

        function openPicker(mode, onConfirm) {
            pickerMode = mode;
            pickerCallback = typeof onConfirm === 'function' ? onConfirm : null;
            const lastAdd = addDraftSessions.length ? addDraftSessions[addDraftSessions.length - 1].at : null;
            const draft = mode === 'add' ? lastAdd : null;
            const base = draft ? new Date(draft) : new Date(getNow().getTime() + 24 * 3600 * 1000);
            const j = gregorianToJalali(base.getFullYear(), base.getMonth() + 1, base.getDate());
            pickerJy = j.jy;
            pickerJm = j.jm;
            pickerDay = draft ? j.jd : null;
            document.getElementById('pickerHour').value = String(base.getHours()).padStart(2, '0');
            document.getElementById('pickerMinute').value = String(Math.floor(base.getMinutes() / 5) * 5).padStart(2, '0');
            document.getElementById('pickerError').textContent = '';
            document.getElementById('pickerRemove').style.display = mode === 'add' ? '' : 'none';
            renderPicker();
            document.getElementById('pickerOverlay').style.display = 'flex';
        }

        function closePicker() {
            document.getElementById('pickerOverlay').style.display = 'none';
        }

        function shiftPickerMonth(delta) {
            pickerJm += delta;
            if (pickerJm < 1) { pickerJm = 12; pickerJy -= 1; }
            if (pickerJm > 12) { pickerJm = 1; pickerJy += 1; }
            const maxDay = jalaliMonthLength(pickerJy, pickerJm);
            if (pickerDay && pickerDay > maxDay) pickerDay = null;
            renderPicker();
        }

        function renderPicker() {
            conflictArmed = false;
            const now = getNow();
            const tj = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());

            document.getElementById('pickerMonthLabel').textContent = JALALI_MONTHS[pickerJm - 1] + ' ' + toFa(pickerJy);

            const g = jalaliToGregorian(pickerJy, pickerJm, 1);
            const firstWeekday = new Date(g.gy, g.gm - 1, g.gd).getDay(); // 0=یکشنبه ... 6=شنبه
            const leading = (firstWeekday + 1) % 7; // شروع هفته از شنبه
            const monthLen = jalaliMonthLength(pickerJy, pickerJm);

            let html = '';
            for (let i = 0; i < leading; i++) html += '<span class="picker-day empty"></span>';
            for (let d = 1; d <= monthLen; d++) {
                const isPast = pickerJy < tj.jy ||
                    (pickerJy === tj.jy && pickerJm < tj.jm) ||
                    (pickerJy === tj.jy && pickerJm === tj.jm && d < tj.jd);
                const isToday = pickerJy === tj.jy && pickerJm === tj.jm && d === tj.jd;
                const cls = 'picker-day' + (isToday ? ' today' : '') + (pickerDay === d ? ' selected' : '');
                html += `<button class="${cls}" data-day="${d}" ${isPast ? 'disabled' : ''} aria-label="${toFa(d)} ${JALALI_MONTHS[pickerJm - 1]}">${toFa(d)}</button>`;
            }
            document.getElementById('pickerDays').innerHTML = html;
        }

        function confirmPicker() {
            const err = document.getElementById('pickerError');
            if (!pickerDay) {
                err.textContent = 'لطفاً یک روز انتخاب کنید.';
                return;
            }
            const g = jalaliToGregorian(pickerJy, pickerJm, pickerDay);
            const h = parseInt(document.getElementById('pickerHour').value, 10);
            const mi = parseInt(document.getElementById('pickerMinute').value, 10);
            const picked = new Date(g.gy, g.gm - 1, g.gd, h, mi, 0, 0);
            // اعتبارسنجی: سررسید باید بعد از زمان جاری (مبنای سرور) باشد
            if (picked.getTime() <= getNow().getTime()) {
                err.textContent = 'زمان سررسید باید بعد از زمان جاری باشد.';
                return;
            }
            const hit = findConflict(picked.getTime());
            if (hit && !conflictArmed) {
                conflictArmed = true;
                err.textContent = `⚠ تداخل با «${hit.owner}» (${faShort(hit.at)}) — برای تأیید دوباره بزنید.`;
                return;
            }
            const iso = picked.toISOString();
            if (pickerCallback) {
                const cb = pickerCallback;
                pickerCallback = null;
                closePicker();
                cb(iso);
            } else {
                addDraftSessions.push({ id: uid(), at: iso });
                updateDueChips();
                closePicker();
            }
        }

        function removePickerDue() {
            addDraftSessions = [];
            updateDueChips();
            closePicker();
        }

        // نزدیک‌ترین جلسه آینده هر مالک، در پنجره ۳۰ دقیقه‌ای؟
        function findConflict(ms) {
            const now = getNow().getTime();
            const list = allSessions(true);
            for (const s of list) {
                const v = new Date(s.at).getTime();
                if (isNaN(v) || v < now) continue;
                if (Math.abs(v - ms) < 30 * 60 * 1000) return s;
            }
            return null;
        }

        // میان‌برها: امروز عصر / فردا ۹ صبح / هفته بعد (همیشه آینده)
        function applyPreset(name) {
            const now = getNow();
            let base;
            if (name === 'evening') {
                base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0);
                if (base.getTime() <= now.getTime()) base.setDate(base.getDate() + 1);
            } else if (name === 'tomorrow') {
                base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0);
            } else {
                base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 9, 0, 0, 0);
            }
            const j = gregorianToJalali(base.getFullYear(), base.getMonth() + 1, base.getDate());
            pickerJy = j.jy;
            pickerJm = j.jm;
            pickerDay = j.jd;
            document.getElementById('pickerHour').value = String(base.getHours()).padStart(2, '0');
            document.getElementById('pickerMinute').value = '00';
            renderPicker();
        }

