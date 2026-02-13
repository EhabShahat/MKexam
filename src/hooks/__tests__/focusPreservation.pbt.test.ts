/**
 * Property-Based Test: Focus Preservation
 * 
 * **Property 20: Focus Preservation**
 * **Validates: Requirements 7.5**
 * 
 * This test verifies that the focused element remains focused after theme changes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { useTheme } from '../useTheme';

describe('Property 20: Focus Preservation', () => {
  let localStorageMock: { [key: string]: string };
  let testElementCounter = 0;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      key: vi.fn((index: number) => Object.keys(localStorageMock)[index] || null),
      length: 0,
    };

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Clean up document classes
    document.documentElement.classList.remove('light', 'dark');
    
    // Remove all test elements from previous runs
    const testElements = document.querySelectorAll('[data-test-element]');
    testElements.forEach(el => el.remove());
    
    // Blur any focused element to ensure clean state
    if (document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }
    
    // Reset counter for unique IDs
    testElementCounter = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove('light', 'dark');
    
    // Thorough cleanup of all test elements
    const testElements = document.querySelectorAll('[data-test-element]');
    testElements.forEach(el => el.remove());
    
    // Ensure no element is focused after test
    if (document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }
  });

  // Arbitrary for theme
  const themeArb = fc.constantFrom('light' as const, 'dark' as const);

  // Arbitrary for focusable element types
  const focusableElementArb = fc.constantFrom(
    'button',
    'input',
    'textarea',
    'select',
    'a'
  );

  it('should preserve focus on the active element when theme changes', async () => {
    await fc.assert(
      fc.asyncProperty(themeArb, themeArb, focusableElementArb, async (initialTheme, newTheme, elementType) => {
        // Skip if themes are the same (no change to test)
        if (initialTheme === newTheme) {
          return true;
        }

        // Set initial theme
        localStorageMock['theme-preference'] = initialTheme;

        // Create a focusable element with unique ID
        const uniqueId = `test-element-${++testElementCounter}`;
        const element = document.createElement(elementType);
        if (elementType === 'a') {
          element.setAttribute('href', '#');
        }
        element.setAttribute('tabindex', '0');
        element.setAttribute('id', uniqueId);
        element.setAttribute('data-test-element', 'true');
        document.body.appendChild(element);

        try {
          // Focus the element
          element.focus();
          expect(document.activeElement).toBe(element);

          // Render the hook
          const { result } = renderHook(() => useTheme());

          // Change theme
          act(() => {
            result.current.setTheme(newTheme);
          });

          // Wait for async focus restoration
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              // Property: The focused element should remain focused after theme change
              expect(document.activeElement).toBe(element);
              resolve();
            }, 100); // Increased timeout to ensure focus restoration completes
          });
        } finally {
          // Cleanup - ensure element is removed even if test fails
          if (element.parentNode) {
            document.body.removeChild(element);
          }
        }

        return true;
      }),
      { numRuns: 50 }
    );
  });

  it('should not throw error if focused element becomes unfocusable during theme change', async () => {
    await fc.assert(
      fc.asyncProperty(themeArb, themeArb, async (initialTheme, newTheme) => {
        // Skip if themes are the same
        if (initialTheme === newTheme) {
          return true;
        }

        // Set initial theme
        localStorageMock['theme-preference'] = initialTheme;

        // Create a focusable element with unique ID
        const uniqueId = `test-button-${++testElementCounter}`;
        const element = document.createElement('button');
        element.setAttribute('id', uniqueId);
        element.setAttribute('data-test-element', 'true');
        document.body.appendChild(element);

        try {
          // Focus the element
          element.focus();
          expect(document.activeElement).toBe(element);

          // Render the hook
          const { result } = renderHook(() => useTheme());

          // Remove the element before theme change (simulating element becoming unfocusable)
          document.body.removeChild(element);

          // Property: Theme change should not throw error even if focused element is removed
          expect(() => {
            act(() => {
              result.current.setTheme(newTheme);
            });
          }).not.toThrow();

          // Wait for any async operations to complete
          await new Promise(resolve => setTimeout(resolve, 100));
        } finally {
          // Cleanup - remove element if it still exists
          if (element.parentNode) {
            document.body.removeChild(element);
          }
        }

        return true;
      }),
      { numRuns: 30 }
    );
  });

  it('should preserve focus when toggling theme multiple times', async () => {
    await fc.assert(
      fc.asyncProperty(themeArb, fc.integer({ min: 2, max: 5 }), async (initialTheme, toggleCount) => {
        // Set initial theme
        localStorageMock['theme-preference'] = initialTheme;

        // Create a focusable element with unique ID
        const uniqueId = `test-input-${++testElementCounter}`;
        const element = document.createElement('input');
        element.setAttribute('type', 'text');
        element.setAttribute('id', uniqueId);
        element.setAttribute('data-test-element', 'true');
        document.body.appendChild(element);

        try {
          // Focus the element
          element.focus();
          expect(document.activeElement).toBe(element);

          // Render the hook
          const { result } = renderHook(() => useTheme());

          // Toggle theme multiple times with proper async handling
          for (let i = 0; i < toggleCount; i++) {
            act(() => {
              result.current.toggleTheme();
            });
            
            // Wait for focus restoration after each toggle (reduced from 100ms to 50ms)
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Property: Focus should be preserved after multiple theme toggles
          expect(document.activeElement).toBe(element);
        } finally {
          // Cleanup - ensure element is removed
          if (element.parentNode) {
            document.body.removeChild(element);
          }
        }

        return true;
      }),
      { numRuns: 20 }
    );
  }, 10000); // Increase timeout to 10 seconds for this test

  it('should not interfere with focus if no element was focused', () => {
    fc.assert(
      fc.property(themeArb, themeArb, (initialTheme, newTheme) => {
        // Skip if themes are the same
        if (initialTheme === newTheme) {
          return true;
        }

        // Set initial theme
        localStorageMock['theme-preference'] = initialTheme;

        // Ensure no element is focused (focus on body)
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur();
        }

        const activeBeforeChange = document.activeElement;

        // Render the hook
        const { result } = renderHook(() => useTheme());

        // Change theme
        act(() => {
          result.current.setTheme(newTheme);
        });

        // Property: If no element was focused, theme change should not change focus
        // (activeElement should remain body or similar)
        expect(document.activeElement).toBe(activeBeforeChange);

        return true;
      }),
      { numRuns: 30 }
    );
  });
});
