// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
// test/sessions.test.js — تست‌های منطق جلسات

import { describe, it, expect, beforeEach } from 'vitest';
import {
    faToEn,
    dayKey,
    hasSessionOn,
    sameMinute,
    hasSessionAt,
    taskMatches,
    parseFaDateTime,
    nearestUpcoming
} from '../js/sessions.js';
import { state } from '../js/core.js';

// helper: پاک کردن state قبل از هر تست
beforeEach(() => {
    state.tasks = [];
    state.searchQuery = '';
    state.currentFilter = 'all';
    state.selectedDay = null;
});

describe('sessions — faToEn', () => {
    it('ارقام فارسی را به انگلیسی تبدیل می‌کند', () => {
        expect(faToEn('۱۲۳')).toBe('123');
        expect(faToEn('۴۵۶۷۸۹۰')).toBe('4567890');
    });

    it('ارقام عربی را به انگلیسی تبدیل می‌کند', () => {
        expect(faToEn('١٢٣')).toBe('123');
    });

    it('متن غیرعددی را دست‌نخورده برمی‌گرداند', () => {
        expect(faToEn('سلام دنیا')).toBe('سلام دنیا');
    });

    it('ترکیب فارسی و انگلیسی را درست تبدیل می‌کند', () => {
        expect(faToEn('ساعت ۱۲:۳۰')).toBe('ساعت 12:30');
    });
});

describe('sessions — dayKey', () => {
    it('کلید روز را درست می‌سازد', () => {
        const d = new Date(2024, 0, 15); // ۱۵ ژانویه ۲۰۲۴
        expect(dayKey(d)).toBe('2024-1-15');
    });

    it('برای رشته ISO هم کار می‌کند', () => {
        const d = new Date(2024, 5, 20);
        expect(dayKey(d.toISOString())).toBe('2024-6-20');
    });
});

describe('sessions — sameMinute', () => {
    it('دو تاریخ با همان دقیقه را true برمی‌گرداند', () => {
        const a = new Date(2024, 0, 15, 10, 30, 0);
        const b = new Date(2024, 0, 15, 10, 30, 45); // ۴۵ ثانیه تفاوت
        expect(sameMinute(a, b)).toBe(true);
    });

    it('دو تاریخ با دقیقه متفاوت را false برمی‌گرداند', () => {
        const a = new Date(2024, 0, 15, 10, 30, 0);
        const b = new Date(2024, 0, 15, 10, 31, 0);
        expect(sameMinute(a, b)).toBe(false);
    });

    it('برای تاریخ نامعتبر false برمی‌گرداند', () => {
        expect(sameMinute('invalid', new Date())).toBe(false);
    });
});

describe('sessions — hasSessionAt', () => {
    it('وقتی جلسه با همان دقیقه وجود دارد true برمی‌گرداند', () => {
        const list = [{ at: new Date(2024, 0, 15, 10, 0).toISOString() }];
        const test = new Date(2024, 0, 15, 10, 0, 30).toISOString();
        expect(hasSessionAt(list, test)).toBe(true);
    });

    it('وقتی جلسه با دقیقه متفاوت false برمی‌گرداند', () => {
        const list = [{ at: new Date(2024, 0, 15, 10, 0).toISOString() }];
        const test = new Date(2024, 0, 15, 10, 5).toISOString();
        expect(hasSessionAt(list, test)).toBe(false);
    });

    it('برای آرایه خالی false برمی‌گرداند', () => {
        expect(hasSessionAt([], new Date().toISOString())).toBe(false);
    });
});

describe('sessions — hasSessionOn', () => {
    it('وقتی جلسه در آن روز وجود دارد true برمی‌گرداند', () => {
        const task = { sessions: [{ at: new Date(2024, 0, 15, 10, 0).toISOString() }] };
        expect(hasSessionOn(task, '2024-1-15')).toBe(true);
    });

    it('وقتی جلسه در روز دیگری است false برمی‌گرداند', () => {
        const task = { sessions: [{ at: new Date(2024, 0, 15, 10, 0).toISOString() }] };
        expect(hasSessionOn(task, '2024-1-16')).toBe(false);
    });

    it('برای task بدون sessions false برمی‌گرداند', () => {
        expect(hasSessionOn({}, '2024-1-15')).toBe(false);
    });
});

describe('sessions — taskMatches', () => {
    it('متن شامل عبارت است true برمی‌گرداند', () => {
        expect(taskMatches({ text: 'خرید نان' }, 'نان')).toBe(true);
    });

    it('توضیح شامل عبارت است true برمی‌گرداند', () => {
        expect(taskMatches({ text: 'خرید', description: 'از نانوایی' }, 'نانوایی')).toBe(true);
    });

    it('عدم تطابق false برمی‌گرداند', () => {
        expect(taskMatches({ text: 'خرید نان' }, 'شیر')).toBe(false);
    });

    it('عبارت خالی همیشه true برمی‌گرداند', () => {
        expect(taskMatches({ text: 'هر چیزی' }, '')).toBe(true);
        expect(taskMatches({ text: 'هر چیزی' }, null)).toBe(true);
    });
});

describe('sessions — nearestUpcoming', () => {
    it('نزدیک‌ترین جلسه آینده را برمی‌گرداند', () => {
        const now = Date.now();
        const future1 = new Date(now + 60 * 60 * 1000).toISOString(); // ۱ ساعت بعد
        const future2 = new Date(now + 2 * 60 * 60 * 1000).toISOString(); // ۲ ساعت بعد
        const past = new Date(now - 60 * 60 * 1000).toISOString(); // ۱ ساعت قبل

        const task = { sessions: [{ at: future2 }, { at: future1 }, { at: past }] };
        const n = nearestUpcoming(task);
        expect(n.at).toBe(future1);
    });

    it('اگر همه جلسات گذشته باشند null برمی‌گرداند', () => {
        const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const task = { sessions: [{ at: past }] };
        expect(nearestUpcoming(task)).toBe(null);
    });

    it('برای task بدون sessions null برمی‌گرداند', () => {
        expect(nearestUpcoming({})).toBe(null);
        expect(nearestUpcoming({ sessions: [] })).toBe(null);
    });
});

describe('sessions — parseFaDateTime', () => {
    // برای تست، از یک "now" ثابت استفاده می‌کنیم
    const now = new Date(2024, 5, 15, 10, 0, 0); // ۱۵ ژوئن ۲۰۲۴، ۱۰ صبح

    it('«فردا» را می‌فهمد', () => {
        const iso = parseFaDateTime('فردا', now);
        expect(iso).toBeTruthy();
        const d = new Date(iso);
        expect(d.getDate()).toBe(16);
    });

    it('«پس فردا» را می‌فهمد', () => {
        const iso = parseFaDateTime('پس فردا', now);
        expect(iso).toBeTruthy();
        const d = new Date(iso);
        expect(d.getDate()).toBe(17);
    });

    it('«امروز» را می‌فهمد وقتی ساعت پیش‌فرض در آینده باشد', () => {
        // اگر الان ۶ صبح است، ساعت پیش‌فرض ۹ صبح امروز معتبر است
        const morningNow = new Date(2024, 5, 15, 6, 0, 0);
        const iso = parseFaDateTime('امروز', morningNow);
        expect(iso).toBeTruthy();
        const d = new Date(iso);
        expect(d.getDate()).toBe(15);
        expect(d.getHours()).toBe(9);
    });

    it('«امروز» را null برمی‌گرداند وقتی ساعت پیش‌فرض گذشته باشد', () => {
        // در ساعت ۱۰ صبح، ساعت پیش‌فرض ۹ امروز گذشته است → null
        const iso = parseFaDateTime('امروز', now);
        expect(iso).toBe(null);
    });

    it('«امروز ساعت ۱۴» را می‌فهمد (بعد از ساعت جاری)', () => {
        const iso = parseFaDateTime('امروز ساعت ۱۴', now);
        expect(iso).toBeTruthy();
        const d = new Date(iso);
        expect(d.getDate()).toBe(15);
        expect(d.getHours()).toBe(14);
    });

    it('«ساعت ۵» را به ۱۷ تفسیر می‌کند', () => {
        const iso = parseFaDateTime('امروز ساعت ۵', now);
        expect(iso).toBeTruthy();
        const d = new Date(iso);
        expect(d.getHours()).toBe(17);
    });

    it('«فردا ساعت ۹» را می‌فهمد', () => {
        const iso = parseFaDateTime('فردا ساعت ۹', now);
        expect(iso).toBeTruthy();
        const d = new Date(iso);
        expect(d.getDate()).toBe(16);
        expect(d.getHours()).toBe(9);
    });

    it('«۳ روز دیگر» را می‌فهمد', () => {
        const iso = parseFaDateTime('۳ روز دیگر', now);
        expect(iso).toBeTruthy();
        const d = new Date(iso);
        expect(d.getDate()).toBe(18);
    });

    it('«هفته بعد» را می‌فهمد', () => {
        const iso = parseFaDateTime('هفته بعد', now);
        expect(iso).toBeTruthy();
        const d = new Date(iso);
        expect(d.getDate()).toBe(22);
    });

    it('متن نامعتبر null برمی‌گرداند', () => {
        expect(parseFaDateTime('سلام', now)).toBe(null);
        expect(parseFaDateTime('', now)).toBe(null);
        expect(parseFaDateTime(null, now)).toBe(null);
    });

    it('«ساعت ۲۵» نامعتبر است', () => {
        expect(parseFaDateTime('فردا ساعت ۲۵', now)).toBe(null);
    });
});