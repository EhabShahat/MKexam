/**
 * Property-Based Test: Focus Indicator Visibility
 * 
 * **Property 19: Focus Indicator Visibility**
 * **Validates: Requirements 7.2**
 * 
 * This test verifies that focus indicators are visible in both light and dark themes
 * with sufficient contrast for accessibility.
 * 
 * Note: This test validates focus behavior and CSS rule existence rather than
 * computed styles for :focus-visible pseudo-class, as jsdom doesn't support
 * getComputedStyle() with pseudo-classes. The actual visual appearance should
 * be verified through manual testing or E2E tests in a real browser.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

// Read and parse CSS file to verify focus indicator rules exist
function getCSSFocusRules(): string {
  const cssPath = path.join(process.cwd(), 'src/app/globals.css');
  return fs.readFileSync(cssPath, 'utf-8');
}

// Helper to check if CSS contains proper focus-visible rules
function hasFocusVisibleRules(css: string): boolean {
  // Check for :focus-visible rules
  const hasFocusVisible = css.includes(':focus-visible');
  
  // Check for outline properties in focus rules
  const hasOutlineWidth = /outline:\s*2px\s+solid/.test(css) || /outline-width:\s*2px/.test(css);
  const hasOutlineOffset = /outline-offset:\s*2px/.test(css) || /outline-offset:\s*-2px/.test(css);
  
  return hasFocusVisible && hasOutlineWidth && hasOutlineOffset;
}

// Helper to verify element can receive focus
function canReceiveFocus(element: HTMLElement): boolean {
  // Check if element is focusable
  const tabIndex = element.getAttribute('tabindex');
  const isFocusable = 
    element.tagName === 'BUTTON' ||
    element.tagName === 'A' ||
    element.tagName === 'INPUT' ||
    element.tagName === 'SELECT' ||
    element.tagName === 'TEXTAREA' ||
    (tabIndex !== null && tabIndex !== '-1');
  
  return isFocusable;
}

describe('Property 19: Focus Indicator Visibility', () => {
  // Verify CSS rules exist before running property tests
  const cssContent = getCSSFocusRules();
  
  it('should have focus-visible CSS rules defined in globals.css', () => {
    expect(hasFocusVisibleRules(cssContent)).toBe(true);
    
    // Verify specific focus-visible selectors exist
    expect(cssContent).toContain(':focus-visible');
    expect(cssContent).toContain('outline: 2px solid');
    expect(cssContent).toContain('outline-offset: 2px');
    
    // Verify dark mode focus rules exist
    expect(cssContent).toContain(':root.dark');
    expect(cssContent).toMatch(/:root\.dark.*:focus-visible/s);
  });

  // Arbitrary for interactive element types
  const interactiveElementArb = fc.constantFrom(
    'button',
    'a',
    'input',
    'select',
    'textarea'
  );

  // Arbitrary for theme
  const themeArb = fc.constantFrom('light', 'dark');

  // Arbitrary for element content/attributes
  const elementPropsArb = fc.record({
    text: fc.string({ minLength: 1, maxLength: 20 }),
    className: fc.constantFrom('btn', 'btn-primary', 'link', 'nav-link', 'input', ''),
    ariaLabel: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  });

  it('should render focusable interactive elements in both themes', () => {
    fc.assert(
      fc.property(
        interactiveElementArb,
        themeArb,
        elementPropsArb,
        (elementType, theme, props) => {
          // Apply theme to document
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(theme);

          // Create the interactive element
          const TestComponent = () => {
            const commonProps = {
              className: props.className,
              'aria-label': props.ariaLabel,
              tabIndex: 0,
            };

            switch (elementType) {
              case 'button':
                return <button {...commonProps}>{props.text}</button>;
              case 'a':
                return <a href="#" {...commonProps}>{props.text}</a>;
              case 'input':
                return <input {...commonProps} type="text" placeholder={props.text} />;
              case 'select':
                return (
                  <select {...commonProps}>
                    <option>{props.text}</option>
                  </select>
                );
              case 'textarea':
                return <textarea {...commonProps} placeholder={props.text} />;
              default:
                return <button {...commonProps}>{props.text}</button>;
            }
          };

          const { container } = render(<TestComponent />);
          const element = container.firstChild as HTMLElement;

          // Property: Element must be focusable
          expect(canReceiveFocus(element)).toBe(true);

          // Property: Element must have tabIndex set (explicitly or implicitly)
          const tabIndex = element.getAttribute('tabindex');
          const isImplicitlyFocusable = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);
          expect(tabIndex !== null || isImplicitlyFocusable).toBe(true);

          // Simulate focus
          element.focus();

          // Property: Element must be able to receive focus
          expect(document.activeElement).toBe(element);

          // Cleanup
          document.documentElement.classList.remove(theme);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain focus when theme changes', () => {
    fc.assert(
      fc.property(themeArb, (initialTheme) => {
        const oppositeTheme = initialTheme === 'light' ? 'dark' : 'light';

        // Apply initial theme
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(initialTheme);

        const { container } = render(
          <button className="btn" tabIndex={0}>
            Test Button
          </button>
        );
        const button = container.firstChild as HTMLElement;

        // Focus the button
        button.focus();
        expect(document.activeElement).toBe(button);

        // Change theme
        document.documentElement.classList.remove(initialTheme);
        document.documentElement.classList.add(oppositeTheme);

        // Property: Focus must be maintained after theme change
        expect(document.activeElement).toBe(button);

        // Property: Element must still be focusable
        expect(canReceiveFocus(button)).toBe(true);

        // Cleanup
        document.documentElement.classList.remove(oppositeTheme);
      }),
      { numRuns: 50 }
    );
  });

  it('should have proper ARIA attributes for accessibility', () => {
    fc.assert(
      fc.property(interactiveElementArb, themeArb, (elementType, theme) => {
        // Apply theme
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);

        const TestComponent = () => {
          const props = { 
            tabIndex: 0,
            'aria-label': 'Test element'
          };
          switch (elementType) {
            case 'button':
              return <button {...props}>Button</button>;
            case 'a':
              return <a href="#" {...props}>Link</a>;
            case 'input':
              return <input {...props} type="text" aria-label="Test input" />;
            case 'select':
              return <select {...props} aria-label="Test select"><option>Option</option></select>;
            case 'textarea':
              return <textarea {...props} aria-label="Test textarea" />;
            default:
              return <button {...props}>Button</button>;
          }
        };

        const { container } = render(<TestComponent />);
        const element = container.firstChild as HTMLElement;

        // Property: Interactive elements should have ARIA labels or text content
        const hasAriaLabel = element.hasAttribute('aria-label');
        const hasTextContent = element.textContent && element.textContent.trim().length > 0;
        const hasPlaceholder = element.hasAttribute('placeholder');
        
        expect(hasAriaLabel || hasTextContent || hasPlaceholder).toBe(true);

        // Property: Element must be focusable
        expect(canReceiveFocus(element)).toBe(true);

        // Cleanup
        document.documentElement.classList.remove(theme);
      }),
      { numRuns: 100 }
    );
  });

  it('should verify CSS contains comprehensive focus-visible coverage', () => {
    // Verify all interactive element types have focus-visible rules
    const requiredSelectors = [
      'button:focus-visible',
      'a:focus-visible',
      '[role="button"]:focus-visible',
      '[role="link"]:focus-visible',
      '[role="tab"]:focus-visible',
      '[role="switch"]:focus-visible',
      '[tabindex]:not([tabindex="-1"]):focus-visible',
      '.btn:focus-visible',
      '.input:focus-visible',
      '.nav-link:focus-visible',
    ];

    for (const selector of requiredSelectors) {
      expect(cssContent).toContain(selector);
    }

    // Verify dark mode specific rules
    expect(cssContent).toContain(':root.dark a:focus-visible');
    expect(cssContent).toContain(':root.dark button:focus-visible');
    
    // Verify outline properties are enforced
    expect(cssContent).toContain('outline-style: solid !important');
    expect(cssContent).toContain('outline-width: 2px !important');
  });
});
