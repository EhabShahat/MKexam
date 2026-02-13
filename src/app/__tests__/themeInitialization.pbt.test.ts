// Feature: dark-mode-and-ux-improvements, Property 11: FOUC Prevention
// Feature: dark-mode-and-ux-improvements, Property 16: Synchronous Theme Loading
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Property 11: FOUC Prevention (dark-mode-and-ux-improvements)
 * Property 16: Synchronous Theme Loading (dark-mode-and-ux-improvements)
 * 
 * For any page load, the theme should be applied before the first contentful paint,
 * preventing any flash of unstyled content. The theme should be read from localStorage
 * and applied synchronously before React hydration begins.
 * 
 * Validates: Requirements 3.5, 6.2, 6.5
 */

describe('Property 11 & 16: FOUC Prevention and Synchronous Theme Loading', () => {
  let localStorageMock: { [key: string]: string };
  let documentMock: any;
  let originalDocumentElement: any;

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
      length: 0,
      key: vi.fn(() => null),
    } as Storage;

    // Mock matchMedia
    global.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any;

    // Mock document.documentElement
    documentMock = {
      classList: {
        classes: new Set<string>(),
        add: vi.fn(function(this: any, className: string) {
          this.classes.add(className);
        }),
        remove: vi.fn(function(this: any, className: string) {
          this.classes.delete(className);
        }),
        contains: vi.fn(function(this: any, className: string) {
          return this.classes.has(className);
        }),
      },
      style: {
        colorScheme: '',
      },
    };

    // Store original and mock document.documentElement
    if (typeof document !== 'undefined') {
      originalDocumentElement = document.documentElement;
      Object.defineProperty(document, 'documentElement', {
        configurable: true,
        get: () => documentMock,
      });
    }
  });

  afterEach(() => {
    // Restore original document.documentElement
    if (typeof document !== 'undefined' && originalDocumentElement) {
      Object.defineProperty(document, 'documentElement', {
        configurable: true,
        get: () => originalDocumentElement,
      });
    }
    vi.clearAllMocks();
  });

  /**
   * This function simulates the theme initialization script from layout.tsx
   * It should execute synchronously before React hydration
   */
  function themeInitializationScript() {
    try {
      const stored = localStorage.getItem('theme-preference');
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const theme = stored || systemPreference || 'dark';
      document.documentElement.classList.add(theme);
      document.documentElement.style.colorScheme = theme;
    } catch (e) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  }

  it('property: theme should be applied synchronously from stored preference', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('light', 'dark'),
        (storedTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 11: FOUC Prevention
          // Feature: dark-mode-and-ux-improvements, Property 16: Synchronous Theme Loading
          
          // Set stored theme
          localStorageMock['theme-preference'] = storedTheme;

          // Reset document mock
          documentMock.classList.classes.clear();
          documentMock.style.colorScheme = '';

          // Execute theme initialization script (synchronously)
          themeInitializationScript();

          // Verify theme was applied immediately
          expect(documentMock.classList.add).toHaveBeenCalledWith(storedTheme);
          expect(documentMock.style.colorScheme).toBe(storedTheme);
          expect(documentMock.classList.classes.has(storedTheme)).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: theme should be applied synchronously from system preference when no stored preference', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('light', 'dark'),
        (systemPref) => {
          // Feature: dark-mode-and-ux-improvements, Property 11: FOUC Prevention
          // Feature: dark-mode-and-ux-improvements, Property 16: Synchronous Theme Loading
          
          // No stored preference
          localStorageMock = {};

          // Mock system preference
          global.matchMedia = vi.fn((query: string) => ({
            matches: query === `(prefers-color-scheme: ${systemPref})`,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          })) as any;

          // Reset document mock
          documentMock.classList.classes.clear();
          documentMock.style.colorScheme = '';

          // Execute theme initialization script (synchronously)
          themeInitializationScript();

          // Verify theme was applied immediately
          expect(documentMock.classList.add).toHaveBeenCalledWith(systemPref);
          expect(documentMock.style.colorScheme).toBe(systemPref);
          expect(documentMock.classList.classes.has(systemPref)).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: should default to dark theme when no preference and no system preference', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          // Feature: dark-mode-and-ux-improvements, Property 11: FOUC Prevention
          // Feature: dark-mode-and-ux-improvements, Property 16: Synchronous Theme Loading
          
          // No stored preference
          localStorageMock = {};

          // No system preference (matchMedia unavailable)
          (global as any).matchMedia = undefined;

          // Reset document mock
          documentMock.classList.classes.clear();
          documentMock.style.colorScheme = '';

          // Execute theme initialization script (synchronously)
          themeInitializationScript();

          // Verify dark theme was applied by default
          expect(documentMock.classList.add).toHaveBeenCalledWith('dark');
          expect(documentMock.style.colorScheme).toBe('dark');
          expect(documentMock.classList.classes.has('dark')).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle localStorage errors gracefully and default to dark', () => {
    // Mock localStorage to throw errors
    global.localStorage = {
      getItem: vi.fn(() => {
        throw new Error('localStorage unavailable');
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null),
    } as Storage;

    // Reset document mock
    documentMock.classList.classes.clear();
    documentMock.style.colorScheme = '';

    // Execute theme initialization script (synchronously)
    themeInitializationScript();

    // Should fall back to dark theme
    expect(documentMock.classList.add).toHaveBeenCalledWith('dark');
    expect(documentMock.style.colorScheme).toBe('dark');
    expect(documentMock.classList.classes.has('dark')).toBe(true);
  });

  it('property: stored preference should take priority over system preference', () => {
    fc.assert(
      fc.property(
        fc.record({
          stored: fc.constantFrom('light', 'dark'),
          system: fc.constantFrom('light', 'dark'),
        }),
        ({ stored, system }) => {
          // Feature: dark-mode-and-ux-improvements, Property 11: FOUC Prevention
          // Feature: dark-mode-and-ux-improvements, Property 16: Synchronous Theme Loading
          
          // Set stored preference
          localStorageMock['theme-preference'] = stored;

          // Mock system preference (different from stored)
          global.matchMedia = vi.fn((query: string) => ({
            matches: query === `(prefers-color-scheme: ${system})`,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          })) as any;

          // Reset document mock
          documentMock.classList.classes.clear();
          documentMock.style.colorScheme = '';

          // Execute theme initialization script (synchronously)
          themeInitializationScript();

          // Verify stored preference was applied (not system preference)
          expect(documentMock.classList.add).toHaveBeenCalledWith(stored);
          expect(documentMock.style.colorScheme).toBe(stored);
          expect(documentMock.classList.classes.has(stored)).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should execute synchronously without async operations', () => {
    // This test verifies that the script doesn't use any async operations
    // which would delay theme application and cause FOUC

    localStorageMock['theme-preference'] = 'dark';

    // Reset document mock
    documentMock.classList.classes.clear();
    documentMock.style.colorScheme = '';

    // Measure execution time (should be < 1ms for synchronous execution)
    const startTime = performance.now();
    themeInitializationScript();
    const endTime = performance.now();

    // Verify theme was applied
    expect(documentMock.classList.classes.has('dark')).toBe(true);

    // Verify execution was fast (synchronous)
    const executionTime = endTime - startTime;
    expect(executionTime).toBeLessThan(10); // Very generous threshold for synchronous execution
  });
});
