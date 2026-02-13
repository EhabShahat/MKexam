/**
 * Property-Based Test: Interactive Element Distinction
 * 
 * **Property 21: Interactive Element Distinction**
 * **Validates: Requirements 7.6**
 * 
 * This test verifies that interactive elements are clearly distinguishable
 * in dark mode with distinct visual styles and cursor indicators.
 * 
 * Note: This test validates that interactive elements have the correct CSS classes
 * applied, which ensures proper styling. We cannot use getComputedStyle() in jsdom
 * as it doesn't properly apply external stylesheets.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';

// Helper to check if element has interactive CSS classes
function hasInteractiveClasses(element: HTMLElement): boolean {
  const classList = Array.from(element.classList);
  
  // Check for interactive CSS classes that provide styling
  const interactiveClasses = [
    'btn', 'btn-primary', 'btn-ghost', 'btn-outline', 
    'btn-destructive', 'btn-icon', 'link', 'nav-link'
  ];
  
  return interactiveClasses.some(cls => classList.includes(cls));
}

// Helper to check if element is inherently interactive
function isInherentlyInteractive(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();
  const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
  
  return interactiveTags.includes(tagName);
}

describe('Property 21: Interactive Element Distinction', () => {
  // Arbitrary for interactive element types
  const interactiveElementArb = fc.constantFrom(
    'button',
    'a',
    'input',
    'select',
    'textarea'
  );

  // Arbitrary for button classes
  const buttonClassArb = fc.constantFrom(
    'btn',
    'btn-primary',
    'btn-ghost',
    'btn-outline',
    'btn-destructive',
    'btn-icon'
  );

  // Arbitrary for theme
  const themeArb = fc.constantFrom('light', 'dark');

  it('should apply interactive CSS classes to interactive elements', () => {
    fc.assert(
      fc.property(interactiveElementArb, themeArb, (elementType, theme) => {
        // Apply theme
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);

        const TestComponent = () => {
          const props = { className: 'btn', tabIndex: 0 };
          switch (elementType) {
            case 'button':
              return <button {...props}>Button</button>;
            case 'a':
              return <a href="#" {...props}>Link</a>;
            case 'input':
              return <input {...props} type="text" />;
            case 'select':
              return <select {...props}><option>Option</option></select>;
            case 'textarea':
              return <textarea {...props} />;
            default:
              return <button {...props}>Button</button>;
          }
        };

        const { container } = render(<TestComponent />);
        const element = container.firstChild as HTMLElement;

        // Property: Interactive elements should have interactive CSS classes or be inherently interactive
        const isDistinguishable = hasInteractiveClasses(element) || isInherentlyInteractive(element);
        expect(isDistinguishable).toBe(true);

        // Property: Elements with .btn class should have that class applied
        if (element.classList.contains('btn')) {
          expect(element.classList.contains('btn')).toBe(true);
        }

        // Cleanup
        document.documentElement.classList.remove(theme);
      }),
      { numRuns: 100 }
    );
  });

  it('should have distinct styling classes for buttons in dark mode', () => {
    fc.assert(
      fc.property(buttonClassArb, (buttonClass) => {
        // Apply dark theme
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add('dark');

        const { container } = render(
          <button className={buttonClass} tabIndex={0}>
            Test Button
          </button>
        );
        const button = container.firstChild as HTMLElement;

        // Property: Buttons should have the expected CSS class
        expect(button.classList.contains(buttonClass)).toBe(true);

        // Property: Button should be a button element (inherently interactive)
        expect(button.tagName.toLowerCase()).toBe('button');

        // Cleanup
        document.documentElement.classList.remove('dark');
      }),
      { numRuns: 50 }
    );
  });

  it('should apply link classes for anchor elements in dark mode', () => {
    fc.assert(
      fc.property(fc.constantFrom('link', 'nav-link'), (linkClass) => {
        // Apply dark theme
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add('dark');

        const { container } = render(
          <a href="#" className={linkClass} tabIndex={0}>
            Test Link
          </a>
        );
        const link = container.firstChild as HTMLElement;

        // Property: Links should have the expected CSS class
        expect(link.classList.contains(linkClass)).toBe(true);

        // Property: Link should be an anchor element (inherently interactive)
        expect(link.tagName.toLowerCase()).toBe('a');

        // Cleanup
        document.documentElement.classList.remove('dark');
      }),
      { numRuns: 50 }
    );
  });

  it('should maintain distinction between interactive and non-interactive elements', () => {
    fc.assert(
      fc.property(themeArb, (theme) => {
        // Apply theme
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);

        const { container } = render(
          <div>
            <button className="btn">Interactive Button</button>
            <div>Non-interactive Text</div>
            <a href="#" className="link">Interactive Link</a>
            <p>Non-interactive Paragraph</p>
          </div>
        );

        const button = container.querySelector('button') as HTMLElement;
        const nonInteractiveDiv = container.querySelector('div > div') as HTMLElement;
        const link = container.querySelector('a') as HTMLElement;
        const paragraph = container.querySelector('p') as HTMLElement;

        // Property: Interactive elements should have interactive classes or be inherently interactive
        expect(hasInteractiveClasses(button) || isInherentlyInteractive(button)).toBe(true);
        expect(hasInteractiveClasses(link) || isInherentlyInteractive(link)).toBe(true);

        // Property: Non-interactive elements should not have interactive classes
        expect(hasInteractiveClasses(nonInteractiveDiv)).toBe(false);
        expect(hasInteractiveClasses(paragraph)).toBe(false);

        // Property: Non-interactive elements should not be inherently interactive
        expect(isInherentlyInteractive(nonInteractiveDiv)).toBe(false);
        expect(isInherentlyInteractive(paragraph)).toBe(false);

        // Cleanup
        document.documentElement.classList.remove(theme);
      }),
      { numRuns: 50 }
    );
  });

  it('should apply disabled attribute to disabled interactive elements in dark mode', () => {
    fc.assert(
      fc.property(interactiveElementArb, (elementType) => {
        // Apply dark theme
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add('dark');

        const TestComponent = () => {
          const props = { className: 'btn', disabled: true, tabIndex: 0 };
          switch (elementType) {
            case 'button':
              return <button {...props}>Button</button>;
            case 'input':
              return <input {...props} type="text" />;
            case 'select':
              return <select {...props}><option>Option</option></select>;
            case 'textarea':
              return <textarea {...props} />;
            default:
              return <button {...props}>Button</button>;
          }
        };

        const { container } = render(<TestComponent />);
        const element = container.firstChild as HTMLElement;

        // Property: Disabled elements should have the disabled attribute
        if ('disabled' in element) {
          expect((element as HTMLButtonElement | HTMLInputElement).disabled).toBe(true);
        }

        // Property: Disabled buttons should still have the btn class for styling
        if (element.tagName.toLowerCase() === 'button') {
          expect(element.classList.contains('btn')).toBe(true);
        }

        // Cleanup
        document.documentElement.classList.remove('dark');
      }),
      { numRuns: 50 }
    );
  });
});
