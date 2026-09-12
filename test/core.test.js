// © Mahdi Amouzegar — All rights reserved | مهدی آموزگار — همه حقوق محفوظ است
// test/core.test.js — تست‌های helpers

import { describe, it, expect, vi } from 'vitest';
import { escapeHtml, toFa, uid, debounce } from '../js/core.js';

describe('core — escapeHtml', () => {
    it('کاراکترهای HTML را escape می‌کند', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        expect(escapeHtml('a & b')).toBe('a &amp; b');
        expect(escapeHtml('"quote"')).toBe('&quot;quote&quot;');
        expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('برای null و undefined رشته خالی برمی‌گرداند', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('برای اعداد و booleans کار می‌کند', () => {
        expect(escapeHtml(123)).toBe('123');
        expect(escapeHtml(true)).toBe('true');
    });

    it('متن امن را دست‌نخورده برمی‌گرداند', () => {
        expect(escapeHtml('سلام دنیا')).toBe('سلام دنیا');
    });

    it('متن ترکیبی را درست escape می‌کند', () => {
        expect(escapeHtml('<a href="x">link</a>'))
            .toBe('&lt;a href=&quot;x&quot;&gt;link&lt;/a&gt;');
    });
});

describe('core — toFa', () => {
    it('عدد را به فارسی تبدیل می‌کند', () => {
        expect(toFa(123)).toBe('۱۲۳');
        expect(toFa(0)).toBe('۰');
        expect(toFa(1000000)).toMatch(/[۰-۹]/);
    });

    it('با جداکننده هزارگان کار می‌کند', () => {
        const result = toFa(1000);
        expect(result).toMatch(/۱/);
        expect(result).toMatch(/۰/);
    });

    it('با رشته عددی کار می‌کند', () => {
        expect(toFa('42')).toBe('۴۲');
    });
});

describe('core — uid', () => {
    it('یک رشته برمی‌گرداند', () => {
        expect(typeof uid()).toBe('string');
    });

    it('برای هر فراخوانی یکتا است', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) ids.add(uid());
        expect(ids.size).toBe(100);
    });

    it('طول قابل قبول دارد', () => {
        const id = uid();
        expect(id.length).toBeGreaterThan(5);
    });
});

describe('core — debounce', () => {
    it('تابع را با تأخیر صدا می‌زند', async () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(60);
        expect(fn).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });

    it('فراخوانی‌های پیاپی را ادغام می‌کند', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        debounced();
        debounced();

        vi.advanceTimersByTime(150);
        expect(fn).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });

    it('cancel کار می‌کند', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        debounced.cancel();

        vi.advanceTimersByTime(150);
        expect(fn).not.toHaveBeenCalled();

        vi.useRealTimers();
    });

    it('flush فوراً صدا می‌زند', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        debounced.flush();
        expect(fn).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });

    it('آرگومان‌ها را به تابع اصلی پاس می‌دهد', () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('a', 'b', 42);
        vi.advanceTimersByTime(150);

        expect(fn).toHaveBeenCalledWith('a', 'b', 42);

        vi.useRealTimers();
    });
});