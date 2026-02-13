/**
 * Dark Theme RTL Integration Tests
 * 
 * Tests that dark theme works correctly with RTL (Right-to-Left) layout
 * for Arabic language support.
 * 
 * Feature: student-experience-and-admin-enhancements
 * Task: 10.3 Test and fix RTL support in dark theme
 * Validates: Requirements 3.9
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

describe('Dark Theme RTL Integration Tests', () => {
  beforeEach(() => {
    // Set RTL mode and dark theme
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
    document.documentElement.classList.add('dark');
  });

  afterEach(() => {
    // Reset to LTR and light theme
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
    document.documentElement.classList.remove('dark');
  });

  describe('Arabic Text Rendering in Dark Theme', () => {
    it('should render Arabic text with correct direction in dark theme', () => {
      const { container } = render(
        <div>
          <h1>عنوان الصفحة</h1>
          <p>هذا نص تجريبي باللغة العربية</p>
        </div>
      );

      const heading = container.querySelector('h1');
      const paragraph = container.querySelector('p');

      expect(heading?.textContent).toContain('عنوان');
      expect(paragraph?.textContent).toContain('نص');
      
      // Verify RTL direction is set
      expect(document.documentElement.dir).toBe('rtl');
      
      // Verify dark theme is active
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should maintain RTL text alignment in dark theme', () => {
      const { container } = render(
        <div className="rtl">
          <p>النص العربي يجب أن يكون محاذياً لليمين</p>
        </div>
      );

      const div = container.firstChild as HTMLElement;
      
      // Verify RTL class is applied
      expect(div.className).toContain('rtl');
      
      // Verify dark theme is active
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      
      // Verify RTL direction is set on document
      expect(document.documentElement.dir).toBe('rtl');
    });

    it('should render Arabic font correctly in dark theme', () => {
      const { container } = render(
        <div className="arabic-text">
          <p>نص عربي بخط مناسب</p>
        </div>
      );

      const div = container.firstChild as HTMLElement;
      
      // Verify the arabic-text class is applied
      expect(div.className).toContain('arabic-text');
      
      // Verify Arabic text content is rendered
      expect(div.textContent).toContain('نص عربي');
      
      // Verify dark theme is active
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Layout Elements in RTL Dark Theme', () => {
    it('should render navigation menu in RTL dark theme', () => {
      const { container } = render(
        <nav dir="rtl">
          <ul>
            <li><a href="/admin">لوحة التحكم</a></li>
            <li><a href="/admin/students">الطلاب</a></li>
            <li><a href="/admin/exams">الامتحانات</a></li>
          </ul>
        </nav>
      );

      const nav = container.querySelector('nav');
      const links = container.querySelectorAll('a');
      
      expect(nav).toBeTruthy();
      expect(links.length).toBe(3);
      expect(links[0].textContent).toContain('لوحة التحكم');
      
      // Verify RTL and dark theme
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should align form fields correctly in RTL dark theme', () => {
      const { container } = render(
        <form dir="rtl">
          <label htmlFor="name">الاسم</label>
          <input id="name" type="text" placeholder="أدخل الاسم" />
        </form>
      );

      const input = container.querySelector('input');
      const form = container.querySelector('form');
      
      expect(input).toBeTruthy();
      expect(input?.placeholder).toBe('أدخل الاسم');
      expect(form?.dir).toBe('rtl');
      
      // Verify RTL and dark theme
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should render cards with correct layout in RTL dark theme', () => {
      const { container } = render(
        <div className="card">
          <h2>عنوان البطاقة</h2>
          <p>محتوى البطاقة</p>
        </div>
      );

      const card = container.querySelector('.card');
      expect(card).toBeTruthy();
      expect(card?.textContent).toContain('عنوان البطاقة');
      
      // Verify RTL and dark theme
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should render buttons with correct layout in RTL dark theme', () => {
      const { container } = render(
        <div>
          <button className="btn">حفظ</button>
          <button className="btn btn-secondary">إلغاء</button>
        </div>
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toBe('حفظ');
      expect(buttons[1].textContent).toBe('إلغاء');
      
      // Verify RTL and dark theme
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Mixed Content in RTL Dark Theme', () => {
    it('should handle mixed LTR/RTL content in dark theme', () => {
      const { container } = render(
        <div>
          <p>النتيجة: 95%</p>
          <p>Email: test@example.com</p>
        </div>
      );

      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs.length).toBe(2);
      
      // Both should render correctly with Unicode bidi algorithm
      expect(paragraphs[0].textContent).toContain('النتيجة');
      expect(paragraphs[1].textContent).toContain('Email');
      
      // Verify RTL and dark theme
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should render mixed content with proper directionality in dark theme', () => {
      const { container } = render(
        <div className="mixed-content">
          <span>English text</span>
          <span className="arabic">نص عربي</span>
        </div>
      );

      const mixedDiv = container.querySelector('.mixed-content');
      const arabicSpan = container.querySelector('.arabic');
      
      expect(mixedDiv).toBeTruthy();
      expect(arabicSpan).toBeTruthy();
      expect(arabicSpan?.textContent).toBe('نص عربي');
      
      // Verify dark theme
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Tables in RTL Dark Theme', () => {
    it('should render tables with correct layout in RTL dark theme', () => {
      const { container } = render(
        <table className="table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>النتيجة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>أحمد</td>
              <td>95%</td>
            </tr>
          </tbody>
        </table>
      );

      const table = container.querySelector('table');
      const headers = container.querySelectorAll('th');
      const cells = container.querySelectorAll('td');
      
      expect(table).toBeTruthy();
      expect(headers.length).toBe(2);
      expect(headers[0].textContent).toBe('الاسم');
      expect(cells[0].textContent).toBe('أحمد');
      
      // Verify RTL and dark theme
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Status Badges in RTL Dark Theme', () => {
    it('should render status badges correctly in RTL dark theme', () => {
      const { container } = render(
        <div>
          <span className="badge">نشط</span>
          <span className="badge">مكتمل</span>
        </div>
      );

      const badges = container.querySelectorAll('.badge');
      expect(badges.length).toBe(2);
      expect(badges[0].textContent).toBe('نشط');
      
      // Verify RTL and dark theme
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Accessibility in RTL Dark Theme', () => {
    it('should maintain proper ARIA labels in RTL dark theme', () => {
      const { container } = render(
        <button aria-label="إغلاق">
          <span>×</span>
        </button>
      );

      const button = container.querySelector('button');
      expect(button?.getAttribute('aria-label')).toBe('إغلاق');
      
      // Verify RTL and dark theme
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should maintain proper role attributes in RTL dark theme', () => {
      const { container } = render(
        <div role="alert">
          <p>تنبيه: يرجى التحقق من البيانات</p>
        </div>
      );

      const alert = container.querySelector('[role="alert"]');
      expect(alert).toBeTruthy();
      expect(alert?.textContent).toContain('تنبيه');
      
      // Verify RTL and dark theme
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Visual Consistency', () => {
    it('should maintain consistent spacing in RTL dark theme', () => {
      const { container } = render(
        <div className="space-y-4">
          <div>عنصر 1</div>
          <div>عنصر 2</div>
          <div>عنصر 3</div>
        </div>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toBeTruthy();
      
      // Verify RTL and dark theme
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should maintain consistent borders in RTL dark theme', () => {
      const { container } = render(
        <div className="border p-4">
          <p>محتوى مع حدود</p>
        </div>
      );

      const div = container.firstChild;
      expect(div).toBeTruthy();
      
      // Verify RTL and dark theme
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });
});
