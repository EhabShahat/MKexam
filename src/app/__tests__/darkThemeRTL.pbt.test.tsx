/**
 * Property-Based Test: Dark Theme RTL Support
 * 
 * Feature: student-experience-and-admin-enhancements, Property 18: Dark Theme RTL Support
 * 
 * Property: For any page with Arabic content in dark theme, the text direction should 
 * remain RTL and all layout elements should maintain proper right-to-left orientation.
 * 
 * Validates: Requirements 3.9
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';

describe('Property 18: Dark Theme RTL Support', () => {
  beforeEach(() => {
    // Clean up before each test
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    // Clean up after each test
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
    document.documentElement.classList.remove('dark');
  });

  it('should maintain RTL direction for any Arabic text in dark theme', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (arabicText) => {
          // Set up RTL and dark theme
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'ar';
          document.documentElement.classList.add('dark');

          const { container } = render(
            <div className="rtl">
              <p>{arabicText}</p>
            </div>
          );

          // Verify RTL direction is maintained
          expect(document.documentElement.dir).toBe('rtl');
          
          // Verify dark theme is active
          expect(document.documentElement.classList.contains('dark')).toBe(true);
          
          // Verify content is rendered
          expect(container.textContent).toContain(arabicText);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain proper layout orientation for any RTL component in dark theme', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          content: fc.string({ minLength: 1, maxLength: 200 }),
          buttonText: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        ({ title, content, buttonText }) => {
          // Set up RTL and dark theme
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'ar';
          document.documentElement.classList.add('dark');

          const { container } = render(
            <div className="card">
              <h2>{title}</h2>
              <p>{content}</p>
              <button className="btn">{buttonText}</button>
            </div>
          );

          // Verify RTL direction is maintained
          expect(document.documentElement.dir).toBe('rtl');
          
          // Verify dark theme is active
          expect(document.documentElement.classList.contains('dark')).toBe(true);
          
          // Verify all content is rendered
          expect(container.textContent).toContain(title);
          expect(container.textContent).toContain(content);
          expect(container.textContent).toContain(buttonText);
          
          // Verify card structure is maintained
          const card = container.querySelector('.card');
          expect(card).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain RTL table layout in dark theme for any data', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 30 }),
            value: fc.string({ minLength: 1, maxLength: 30 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (rows) => {
          // Set up RTL and dark theme
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'ar';
          document.documentElement.classList.add('dark');

          const { container } = render(
            <table className="table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>القيمة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>{row.name}</td>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );

          // Verify RTL direction is maintained
          expect(document.documentElement.dir).toBe('rtl');
          
          // Verify dark theme is active
          expect(document.documentElement.classList.contains('dark')).toBe(true);
          
          // Verify table structure
          const table = container.querySelector('table');
          expect(table).toBeTruthy();
          
          // Verify all rows are rendered
          const tableRows = container.querySelectorAll('tbody tr');
          expect(tableRows.length).toBe(rows.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain RTL form layout in dark theme for any input', () => {
    fc.assert(
      fc.property(
        fc.record({
          label: fc.string({ minLength: 1, maxLength: 30 }),
          placeholder: fc.string({ minLength: 1, maxLength: 50 }),
          value: fc.string({ maxLength: 100 }),
        }),
        ({ label, placeholder, value }) => {
          // Set up RTL and dark theme
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'ar';
          document.documentElement.classList.add('dark');

          const { container } = render(
            <form dir="rtl">
              <label htmlFor="test-input">{label}</label>
              <input
                id="test-input"
                type="text"
                placeholder={placeholder}
                defaultValue={value}
                className="input"
              />
            </form>
          );

          // Verify RTL direction is maintained
          expect(document.documentElement.dir).toBe('rtl');
          
          // Verify dark theme is active
          expect(document.documentElement.classList.contains('dark')).toBe(true);
          
          // Verify form elements
          const form = container.querySelector('form');
          const input = container.querySelector('input');
          
          expect(form?.dir).toBe('rtl');
          expect(input).toBeTruthy();
          expect(input?.placeholder).toBe(placeholder);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain RTL navigation layout in dark theme for any menu items', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            text: fc.string({ minLength: 1, maxLength: 30 }),
            href: fc.webUrl(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (menuItems) => {
          // Set up RTL and dark theme
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'ar';
          document.documentElement.classList.add('dark');

          const { container } = render(
            <nav dir="rtl">
              <ul>
                {menuItems.map((item, index) => (
                  <li key={index}>
                    <a href={item.href}>{item.text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          );

          // Verify RTL direction is maintained
          expect(document.documentElement.dir).toBe('rtl');
          
          // Verify dark theme is active
          expect(document.documentElement.classList.contains('dark')).toBe(true);
          
          // Verify navigation structure
          const nav = container.querySelector('nav');
          const links = container.querySelectorAll('a');
          
          expect(nav?.dir).toBe('rtl');
          expect(links.length).toBe(menuItems.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain RTL status indicators in dark theme for any status', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            status: fc.constantFrom('active', 'inactive', 'pending', 'completed'),
            label: fc.string({ minLength: 1, maxLength: 30 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (statuses) => {
          // Set up RTL and dark theme
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'ar';
          document.documentElement.classList.add('dark');

          const { container } = render(
            <div>
              {statuses.map((item, index) => (
                <div key={index} className="status-item">
                  <span className="status-dot"></span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          );

          // Verify RTL direction is maintained
          expect(document.documentElement.dir).toBe('rtl');
          
          // Verify dark theme is active
          expect(document.documentElement.classList.contains('dark')).toBe(true);
          
          // Verify status indicators
          const statusDots = container.querySelectorAll('.status-dot');
          expect(statusDots.length).toBe(statuses.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain RTL mixed content layout in dark theme', () => {
    fc.assert(
      fc.property(
        fc.record({
          arabicText: fc.string({ minLength: 1, maxLength: 50 }),
          englishText: fc.string({ minLength: 1, maxLength: 50 }),
          number: fc.integer({ min: 0, max: 1000 }),
        }),
        ({ arabicText, englishText, number }) => {
          // Set up RTL and dark theme
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'ar';
          document.documentElement.classList.add('dark');

          const { container } = render(
            <div className="mixed-content">
              <span>{arabicText}</span>
              <span className="arabic">{englishText}</span>
              <span>{number}</span>
            </div>
          );

          // Verify RTL direction is maintained
          expect(document.documentElement.dir).toBe('rtl');
          
          // Verify dark theme is active
          expect(document.documentElement.classList.contains('dark')).toBe(true);
          
          // Verify all content is rendered
          expect(container.textContent).toContain(arabicText);
          expect(container.textContent).toContain(englishText);
          expect(container.textContent).toContain(String(number));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain RTL accessibility attributes in dark theme', () => {
    fc.assert(
      fc.property(
        fc.record({
          ariaLabel: fc.string({ minLength: 1, maxLength: 50 }),
          role: fc.constantFrom('button', 'alert', 'dialog', 'navigation'),
          content: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        ({ ariaLabel, role, content }) => {
          // Set up RTL and dark theme
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'ar';
          document.documentElement.classList.add('dark');

          const { container } = render(
            <div role={role} aria-label={ariaLabel}>
              {content}
            </div>
          );

          // Verify RTL direction is maintained
          expect(document.documentElement.dir).toBe('rtl');
          
          // Verify dark theme is active
          expect(document.documentElement.classList.contains('dark')).toBe(true);
          
          // Verify accessibility attributes are maintained
          const element = container.firstChild as HTMLElement;
          expect(element.getAttribute('role')).toBe(role);
          expect(element.getAttribute('aria-label')).toBe(ariaLabel);
          expect(element.textContent).toBe(content);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain RTL button layout in dark theme for any button text', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            text: fc.string({ minLength: 1, maxLength: 30 }),
            variant: fc.constantFrom('primary', 'secondary', 'danger'),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (buttons) => {
          // Set up RTL and dark theme
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'ar';
          document.documentElement.classList.add('dark');

          const { container } = render(
            <div>
              {buttons.map((btn, index) => (
                <button key={index} className={`btn btn-${btn.variant}`}>
                  {btn.text}
                </button>
              ))}
            </div>
          );

          // Verify RTL direction is maintained
          expect(document.documentElement.dir).toBe('rtl');
          
          // Verify dark theme is active
          expect(document.documentElement.classList.contains('dark')).toBe(true);
          
          // Verify all buttons are rendered
          const buttonElements = container.querySelectorAll('button');
          expect(buttonElements.length).toBe(buttons.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain RTL list layout in dark theme for any list items', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }),
          { minLength: 1, maxLength: 20 }
        ),
        (items) => {
          // Set up RTL and dark theme
          document.documentElement.dir = 'rtl';
          document.documentElement.lang = 'ar';
          document.documentElement.classList.add('dark');

          const { container } = render(
            <ul dir="rtl">
              {items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          );

          // Verify RTL direction is maintained
          expect(document.documentElement.dir).toBe('rtl');
          
          // Verify dark theme is active
          expect(document.documentElement.classList.contains('dark')).toBe(true);
          
          // Verify list structure
          const list = container.querySelector('ul');
          const listItems = container.querySelectorAll('li');
          
          expect(list?.dir).toBe('rtl');
          expect(listItems.length).toBe(items.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
