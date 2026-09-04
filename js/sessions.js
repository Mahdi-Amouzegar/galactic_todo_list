'use strict';
// sessions.js -- session (due-date) domain logic  |  React: selectors
        /* ---------- سررسید ---------- */

        function faShort(iso) {
            const d = new Date(iso);
            return d.toLocaleDateString('fa-IR', { day: 'numeric', month: 'long' }) + '، ساعت ' +
                d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        }

        function updateDueChips() {
            const wrap = document.getElementById('dueChips');
            if (addDraftSessions.length === 0) {
                wrap.innerHTML = '';
                wrap.style.display = 'none';
                return;
            }
            wrap.style.display = 'flex';
            const sorted = [...addDraftSessions].sort((a, b) => new Date(a.at) - new Date(b.at));
            wrap.innerHTML = sorted.map(s =>
                `<span class="due-chip">📅 ${faShort(s.at)}<button type="button" data-dchip="${escapeHtml(String(s.id))}" aria-label="حذف این سررسید">✕</button></span>`
            ).join('');
        }

        function nearestUpcoming(task) {
            const now = getNow().getTime();
            return (task.sessions || [])
                .filter(s => new Date(s.at).getTime() >= now)
                .sort((a, b) => new Date(a.at) - new Date(b.at))[0] || null;
        }

        function sessionSummaryHtml(task) {
            const sessions = task.sessions || [];
            if (sessions.length === 0) return '';
            if (task.completed) {
                return `<span class="due-line past-all">📅 ${toFa(sessions.length)} جلسه</span>`;
            }
            const n = nearestUpcoming(task);
            if (n) {
                const now = getNow();
                const due = new Date(n.at);
                const startOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                const diffDays = Math.round((startOf(due) - startOf(now)) / 86400000);
                const extra = diffDays === 0 ? ' (امروز)' : diffDays === 1 ? ' (فردا)' : ` (${toFa(diffDays)} روز مانده)`;
                const count = sessions.length > 1 ? ` <span class="sess-count">${toFa(sessions.length)} جلسه</span>` : '';
                return `<span class="due-line">📅 جلسه بعد: ${faShort(n.at)}${extra}</span>${count}`;
            }
            return `<span class="due-line past-all">📅 ${toFa(sessions.length)} جلسه (همه گذشته)</span>`;
        }

