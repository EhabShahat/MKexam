/**
 * Unit tests for error handling in useTheme hook
 * 
 * Tests cover:
 * - localStorage errors are handled gracefully
 * - Invalid theme values are cleared from storage
 * - Theme system works without localStorage
 * - Theme system works without matchMedia
 * - Appropriate fallbacks are used
 */

import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('useTheme - Error Handling', () => {
  let localStorageMock: Record<string, string>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    
    Object.defineProperty(window, 'localStorage', {
      value: {
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
      },
      writable: true,
    });

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Spy on console.warn
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('localStorage error handling', () => {
    it('should handle localStorage.getItem errors gracefully', () => {
      // Mock getItem to throw an error
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('localStorage is disabled');
      });

      const { result } = renderHook(() => useTheme());

      // Should fall back to dark mode
      expect(result.current.theme).toBe('dark');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read theme from localStorage'),
        expect.any(Error)
      );
    });

    it('should handle localStorage.setItem errors gracefully', () => {
      // Create a special mock that allows the test operation but throws for actual usage
      let testCallCount = 0;
      (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation((key: string, value: string) => {
        if (key === '__localStorage_test__') {
          // Allow the isLocalStorageAvailable test to pass
          testCallCount++;
          return;
        }
        // Throw error for actual theme setting
        throw new Error('localStorage is full');
      });

      const { result } = renderHook(() => useTheme());

      // Should still be able to change theme (just not persist it)
      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to persist theme to localStorage',
        expect.any(Error)
      );
    });

    it('should handle localStorage.removeItem errors gracefully when clearing invalid values', () => {
      // Set an invalid value
      localStorageMock['theme-preference'] = 'invalid-theme';

      // Create a special mock that allows the test operation but throws for removeItem
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === '__localStorage_test__') return null; // Allow isLocalStorageAvailable test
        return localStorageMock[key] || null;
      });

      (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation((key: string, value: string) => {
        if (key === '__localStorage_test__') return; // Allow isLocalStorageAvailable test
        localStorageMock[key] = value;
      });

      (window.localStorage.removeItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === '__localStorage_test__') return; // Allow isLocalStorageAvailable test
        throw new Error('Cannot remove item');
      });

      const { result } = renderHook(() => useTheme());

      // Should still work and fall back to dark mode
      expect(result.current.theme).toBe('dark');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Invalid theme value in localStorage: "invalid-theme". Clearing.'
      );
    });

    it('should work when localStorage is completely unavailable', () => {
      // Remove localStorage entirely
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useTheme());

      // Should fall back to system preference (dark in our mock)
      expect(result.current.theme).toBe('dark');
    });
  });

  describe('Invalid value handling', () => {
    it('should clear invalid theme value from localStorage', () => {
      localStorageMock['theme-preference'] = 'invalid-theme';

      renderHook(() => useTheme());

      // Should have attempted to remove the invalid value
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('theme-preference');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Invalid theme value in localStorage: "invalid-theme". Clearing.'
      );
    });

    it('should clear empty string from localStorage', () => {
      // Set empty string directly in the mock
      localStorageMock['theme-preference'] = '';
      
      // Ensure the mock returns the empty string (handle falsy values correctly)
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === '__localStorage_test__') return null; // Allow isLocalStorageAvailable test
        return key in localStorageMock ? localStorageMock[key] : null;
      });

      // Clear any previous calls from setup
      vi.clearAllMocks();

      // Verify the empty string is actually stored
      expect(window.localStorage.getItem('theme-preference')).toBe('');

      renderHook(() => useTheme());

      // Should have attempted to remove the invalid value
      // Filter out calls to __localStorage_test__ which is used for availability check
      const removeItemCalls = (window.localStorage.removeItem as ReturnType<typeof vi.fn>).mock.calls
        .filter(call => call[0] !== '__localStorage_test__');
      
      expect(removeItemCalls).toHaveLength(1);
      expect(removeItemCalls[0][0]).toBe('theme-preference');
    });

    it('should clear numeric value from localStorage', () => {
      localStorageMock['theme-preference'] = '123';

      renderHook(() => useTheme());

      // Should have attempted to remove the invalid value
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('theme-preference');
    });

    it('should clear object-like value from localStorage', () => {
      localStorageMock['theme-preference'] = '{"theme":"dark"}';

      renderHook(() => useTheme());

      // Should have attempted to remove the invalid value
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('theme-preference');
    });

    it('should accept valid "light" value', () => {
      localStorageMock['theme-preference'] = 'light';

      // Clear any previous calls from setup
      vi.clearAllMocks();

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('light');
      // Filter out calls to __localStorage_test__ which is used for availability check
      const removeItemCalls = (window.localStorage.removeItem as ReturnType<typeof vi.fn>).mock.calls
        .filter(call => call[0] !== '__localStorage_test__');
      expect(removeItemCalls).toHaveLength(0);
    });

    it('should accept valid "dark" value', () => {
      localStorageMock['theme-preference'] = 'dark';

      // Clear any previous calls from setup
      vi.clearAllMocks();

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('dark');
      // Filter out calls to __localStorage_test__ which is used for availability check
      const removeItemCalls = (window.localStorage.removeItem as ReturnType<typeof vi.fn>).mock.calls
        .filter(call => call[0] !== '__localStorage_test__');
      expect(removeItemCalls).toHaveLength(0);
    });
  });

  describe('matchMedia error handling', () => {
    it('should handle matchMedia errors gracefully', () => {
      // Mock matchMedia to be undefined (not available)
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: undefined,
      });

      // The hook should handle the unavailability gracefully and not throw
      let result: any;
      expect(() => {
        const hookResult = renderHook(() => useTheme());
        result = hookResult.result;
      }).not.toThrow();

      // Should fall back to dark mode
      expect(result.current.theme).toBe('dark');
      expect(result.current.systemPreference).toBeNull();
    });

    it('should work when matchMedia is undefined', () => {
      // Remove matchMedia entirely
      Object.defineProperty(window, 'matchMedia', {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useTheme());

      // Should fall back to dark mode
      expect(result.current.theme).toBe('dark');
      expect(result.current.systemPreference).toBeNull();
    });

    it('should handle matchMedia.matches throwing an error', () => {
      // Mock matchMedia to return an object that throws when accessing matches
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({
          get matches() {
            throw new Error('Cannot access matches');
          },
          media: '(prefers-color-scheme: dark)',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { result } = renderHook(() => useTheme());

      // Should fall back to dark mode
      expect(result.current.theme).toBe('dark');
    });
  });

  describe('Fallback behavior', () => {
    it('should use dark mode as default when no storage or system preference', () => {
      // Remove both localStorage and matchMedia
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });
      Object.defineProperty(window, 'matchMedia', {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('dark');
    });

    it('should prefer localStorage over system preference', () => {
      localStorageMock['theme-preference'] = 'light';

      // Mock system preference as dark
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { result } = renderHook(() => useTheme());

      // Should use localStorage value (light) not system preference (dark)
      expect(result.current.theme).toBe('light');
    });

    it('should use system preference when localStorage is empty', () => {
      // Mock system preference as light
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-color-scheme: light)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { result } = renderHook(() => useTheme());

      // Should use system preference (light)
      expect(result.current.theme).toBe('light');
    });
  });

  describe('Theme switching with errors', () => {
    it('should still switch theme even if localStorage fails', () => {
      // Mock setItem to throw an error
      (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('localStorage is full');
      });

      const { result } = renderHook(() => useTheme());

      // Initial theme
      expect(result.current.theme).toBe('dark');

      // Switch theme
      act(() => {
        result.current.setTheme('light');
      });

      // Theme should change even though persistence failed
      expect(result.current.theme).toBe('light');
    });

    it('should toggle theme even if localStorage fails', () => {
      // Mock setItem to throw an error
      (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('localStorage is full');
      });

      const { result } = renderHook(() => useTheme());

      // Initial theme
      expect(result.current.theme).toBe('dark');

      // Toggle theme
      act(() => {
        result.current.toggleTheme();
      });

      // Theme should toggle even though persistence failed
      expect(result.current.theme).toBe('light');
    });
  });
});
