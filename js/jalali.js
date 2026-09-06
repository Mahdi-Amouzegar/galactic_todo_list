// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
'use strict';
// jalali.js -- pure Jalali calendar math (no DOM)  |  React: utils/jalali.js as-is
        /* ---------- تقویم جلالی (محاسبه دقیق کبیسه) ---------- */

        const JALALI_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
        const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

        // توجه: الگوریتم تقویم به تقسیم «برش به سمت صفر» نیاز دارد، نه Math.floor
        const jdiv = (a, b) => Math.trunc(a / b);
        const jmod = (a, b) => a - Math.trunc(a / b) * b;

        function jalCal(jy) {
            const breaks = JALALI_BREAKS;
            const bl = breaks.length;
            const gy = jy + 621;
            let leapJ = -14;
            let jp = breaks[0];
            let jm, jump, leap, leapG, march, n, i;
            if (jy < jp || jy >= breaks[bl - 1]) throw new Error('Invalid Jalali year ' + jy);
            for (i = 1; i < bl; i++) {
                jm = breaks[i];
                jump = jm - jp;
                if (jy < jm) break;
                leapJ = leapJ + jdiv(jump, 33) * 8 + jdiv(jmod(jump, 33), 4);
                jp = jm;
            }
            n = jy - jp;
            leapJ = leapJ + jdiv(n, 33) * 8 + jdiv(jmod(n, 33) + 3, 4);
            if (jmod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
            leapG = jdiv(gy, 4) - jdiv((jdiv(gy, 100) + 1) * 3, 4) - 150;
            march = 20 + leapJ - leapG;
            if (jump - n < 6) n = n - jump + jdiv(jump + 4, 33) * 33;
            leap = jmod(jmod(n + 1, 33) - 1, 4);
            if (leap === -1) leap = 4;
            return { leap, gy, march };
        }

        function g2d(gy, gm, gd) {
            let d = jdiv((gy + jdiv(gm - 8, 6) + 100100) * 1461, 4) +
                jdiv(153 * jmod(gm + 9, 12) + 2, 5) + gd - 34840408;
            d = d - jdiv(jdiv(gy + 100100 + jdiv(gm - 8, 6), 100) * 3, 4) + 752;
            return d;
        }

        function d2g(jdn) {
            let j = 4 * jdn + 139361631;
            j = j + jdiv(jdiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
            const i = jdiv(jmod(j, 1461), 4) * 5 + 308;
            const gd = jdiv(jmod(i, 153), 5) + 1;
            const gm = jmod(jdiv(i, 153), 12) + 1;
            const gy = jdiv(j, 1461) - 100100 + jdiv(8 - gm, 6);
            return { gy, gm, gd };
        }

        function j2d(jy, jm, jd) {
            const r = jalCal(jy);
            return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - jdiv(jm, 7) * (jm - 7) + jd - 1;
        }

        function d2j(jdn) {
            const gy = d2g(jdn).gy;
            let jy = gy - 621;
            const r = jalCal(jy);
            const jdn1f = g2d(gy, 3, r.march);
            let jd, jm;
            let k = jdn - jdn1f;
            if (k >= 0) {
                if (k <= 185) {
                    jm = 1 + jdiv(k, 31);
                    jd = jmod(k, 31) + 1;
                    return { jy, jm, jd };
                }
                k -= 186;
            } else {
                jy -= 1;
                k += 179;
                if (r.leap === 1) k += 1;
            }
            jm = 7 + jdiv(k, 30);
            jd = jmod(k, 30) + 1;
            return { jy, jm, jd };
        }

        function gregorianToJalali(gy, gm, gd) {
            return d2j(g2d(gy, gm, gd));
        }

        function jalaliToGregorian(jy, jm, jd) {
            return d2g(j2d(jy, jm, jd));
        }

        // تعداد روزهای ماه جلالی با در نظر گرفتن کبیسه (leap === 0 یعنی سال کبیسه)
        function jalaliMonthLength(jy, jm) {
            if (jm <= 6) return 31;
            if (jm <= 11) return 30;
            return jalCal(jy).leap === 0 ? 30 : 29;
        }

