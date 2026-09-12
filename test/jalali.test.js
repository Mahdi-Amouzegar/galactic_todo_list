// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
// test/jalali.test.js — تست‌های تقویم جلالی

import { describe, it, expect } from 'vitest';
import {
    jalCal,
    g2d,
    d2g,
    j2d,
    d2j,
    gregorianToJalali,
    jalaliToGregorian,
    jalaliMonthLength,
    JALALI_MONTHS
} from '../js/jalali.js';

describe('jalali — jalCal', () => {
    it('سال ۱۴۰۳ را معتبر می‌شناسد', () => {
        const r = jalCal(1403);
        expect(r).toBeTruthy();
        expect(r.gy).toBe(2024);
        expect(typeof r.leap).toBe('number');
        expect(typeof r.march).toBe('number');
    });

    it('سال ۰ را معتبر می‌شناسد (بالاتر از حد پایین -61)', () => {
        // سال ۰ جلالی معادل ۶۲۱ میلادی است و در بازه معتبر [−61, 3178) قرار دارد
        expect(() => jalCal(0)).not.toThrow();
    });

    it('برای سال کمتر از -61 خطا می‌دهد', () => {
        expect(() => jalCal(-100)).toThrow();
    });

    it('برای سال بزرگ‌تر یا مساوی 3178 خطا می‌دهد', () => {
        expect(() => jalCal(3178)).toThrow();
        expect(() => jalCal(5000)).toThrow();
    });
});

describe('jalali — gregorianToJalali', () => {
    it('۱ ژانویه ۲۰۲۴ را به ۱۱ دی ۱۴۰۲ تبدیل می‌کند', () => {
        const j = gregorianToJalali(2024, 1, 1);
        expect(j.jy).toBe(1402);
        expect(j.jm).toBe(10);
        expect(j.jd).toBe(11);
    });

    it('۲۰ مارس ۲۰۲۴ را به ۱ فروردین ۱۴۰۳ تبدیل می‌کند', () => {
        const j = gregorianToJalali(2024, 3, 20);
        expect(j.jy).toBe(1403);
        expect(j.jm).toBe(1);
        expect(j.jd).toBe(1);
    });

    it('نوروز ۱۴۰۳ درست است', () => {
        const j = gregorianToJalali(2024, 3, 20);
        expect(j.jm).toBe(1);
        expect(j.jd).toBe(1);
    });

    it('نوروز ۱۴۰۲ درست است', () => {
        const j = gregorianToJalali(2023, 3, 21);
        expect(j.jy).toBe(1402);
        expect(j.jm).toBe(1);
        expect(j.jd).toBe(1);
    });
});

describe('jalali — jalaliToGregorian', () => {
    it('۱۱ دی ۱۴۰۲ را به ۱ ژانویه ۲۰۲۴ تبدیل می‌کند', () => {
        const g = jalaliToGregorian(1402, 10, 11);
        expect(g.gy).toBe(2024);
        expect(g.gm).toBe(1);
        expect(g.gd).toBe(1);
    });

    it('۱ فروردین ۱۴۰۳ را به ۲۰ مارس ۲۰۲۴ تبدیل می‌کند', () => {
        const g = jalaliToGregorian(1403, 1, 1);
        expect(g.gy).toBe(2024);
        expect(g.gm).toBe(3);
        expect(g.gd).toBe(20);
    });
});

describe('jalali — round-trip', () => {
    it('تبدیل رفت و برگشت برای چند تاریخ', () => {
        const cases = [
            [2024, 1, 1],
            [2024, 3, 20],
            [2024, 6, 15],
            [2024, 9, 22],
            [2024, 12, 31],
            [2020, 2, 29], // سال کبیسه میلادی
        ];
        for (const [gy, gm, gd] of cases) {
            const j = gregorianToJalali(gy, gm, gd);
            const g = jalaliToGregorian(j.jy, j.jm, j.jd);
            expect(g.gy).toBe(gy);
            expect(g.gm).toBe(gm);
            expect(g.gd).toBe(gd);
        }
    });
});

describe('jalali — jalaliMonthLength', () => {
    it('۶ ماه اول ۳۱ روز دارند', () => {
        for (let m = 1; m <= 6; m++) {
            expect(jalaliMonthLength(1403, m)).toBe(31);
        }
    });

    it('۶ ماه دوم ۳۰ روز دارند', () => {
        for (let m = 7; m <= 11; m++) {
            expect(jalaliMonthLength(1403, m)).toBe(30);
        }
    });

    it('اسفند در سال عادی ۲۹ روز دارد', () => {
        // 1402 سال عادی است
        const len = jalaliMonthLength(1402, 12);
        expect(len).toBe(29);
    });

    it('اسفند در سال کبیسه ۳۰ روز دارد', () => {
        // 1403 سال کبیسه است
        const len = jalaliMonthLength(1403, 12);
        expect(len).toBe(30);
    });
});

describe('jalali — JALALI_MONTHS', () => {
    it('۱۲ ماه دارد', () => {
        expect(JALALI_MONTHS.length).toBe(12);
    });

    it('نام ماه‌ها درست هستند', () => {
        expect(JALALI_MONTHS[0]).toBe('فروردین');
        expect(JALALI_MONTHS[11]).toBe('اسفند');
    });
});