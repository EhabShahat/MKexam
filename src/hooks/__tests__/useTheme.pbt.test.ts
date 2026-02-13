// Feature: dark-mode-and-ux-improvements, Property 8: Theme Persistence Round Trip
// Feature: student-experience-and-admin-enhancements, Property 12: Theme Storage Round-Trip
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { useTheme, Theme } from '../useTheme';

/**
 * Property 8: Theme Persistence Round Trip (dark-mode-and-ux-improvements)
 * Property 12: Theme Storage Round-Trip (student-experience-and-admin-enhancements)
 * 
 * For any theme selection (light or dark), storing the preference in localStorage 
 * and then loading it should return the same theme value.
 * 
 * Validates: Requirements 3.4
 */

describe('Property 8 & 12: Theme Persistence Round Trip', () => {
  let localStorageMock: { [key: string]: string };

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

    // Mock matchMedia for system preference detection
    // Default to dark mode preference
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
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark', 'theme-transitioning');
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('property: storing and retrieving theme should return the same value', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (theme) => {
          const { result } = renderHook(() => useTheme());

          // Set the theme
          act(() => {
            result.current.setTheme(theme);
          });

          // Verify it was stored with the correct key
          expect(localStorage.setItem).toHaveBeenCalledWith('theme-preference', theme);
          expect(localStorageMock['theme-preference']).toBe(theme);

          // Verify the hook state matches
          expect(result.current.theme).toBe(theme);

          // Simulate a new hook instance (page reload)
          const { result: newResult } = renderHook(() => useTheme());

          // The new instance should load the stored theme
          expect(newResult.current.theme).toBe(theme);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: toggle should alternate between light and dark', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (initialTheme) => {
          // Set initial theme in localStorage
          localStorageMock['theme-preference'] = initialTheme;

          const { result } = renderHook(() => useTheme());

          // Initial theme should match
          expect(result.current.theme).toBe(initialTheme);

          // Toggle once
          act(() => {
            result.current.toggleTheme();
          });

          const expectedAfterToggle = initialTheme === 'light' ? 'dark' : 'light';
          expect(result.current.theme).toBe(expectedAfterToggle);
          expect(localStorageMock['theme-preference']).toBe(expectedAfterToggle);

          // Toggle again
          act(() => {
            result.current.toggleTheme();
          });

          // Should be back to initial theme
          expect(result.current.theme).toBe(initialTheme);
          expect(localStorageMock['theme-preference']).toBe(initialTheme);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: setTheme should apply theme class to document root', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (theme) => {
          const { result } = renderHook(() => useTheme());

          act(() => {
            result.current.setTheme(theme);
          });

          // Check that the theme class is applied to document root
          if (typeof document !== 'undefined') {
            expect(document.documentElement.classList.contains(theme)).toBe(true);
            
            // The opposite theme should not be present
            const oppositeTheme = theme === 'light' ? 'dark' : 'light';
            expect(document.documentElement.classList.contains(oppositeTheme)).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: multiple theme changes should persist correctly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<Theme>('light', 'dark'), { minLength: 1, maxLength: 10 }),
        (themeSequence) => {
          const { result } = renderHook(() => useTheme());

          // Apply each theme in sequence
          themeSequence.forEach((theme) => {
            act(() => {
              result.current.setTheme(theme);
            });

            // Verify current state
            expect(result.current.theme).toBe(theme);
            expect(localStorageMock['theme-preference']).toBe(theme);
          });

          // The final theme should be the last one in the sequence
          const finalTheme = themeSequence[themeSequence.length - 1];
          expect(result.current.theme).toBe(finalTheme);
          expect(localStorageMock['theme-preference']).toBe(finalTheme);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should default to dark theme when no preference is stored and no system preference', () => {
    // Ensure localStorage is empty
    localStorageMock = {};

    const { result } = renderHook(() => useTheme());

    // Should default to dark theme (Requirement 2.1)
    expect(result.current.theme).toBe('dark');
  });

  it('should handle localStorage unavailability gracefully', () => {
    // Mock localStorage to throw errors
    global.localStorage = {
      getItem: vi.fn(() => {
        throw new Error('localStorage unavailable');
      }),
      setItem: vi.fn(() => {
        throw new Error('localStorage unavailable');
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null),
    } as Storage;

    const { result } = renderHook(() => useTheme());

    // Should still work with default theme (dark)
    expect(result.current.theme).toBe('dark');

    // Should still be able to change theme (just not persist)
    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
  });

  it('should ignore invalid theme values in localStorage', () => {
    // Set an invalid theme value
    localStorageMock['theme-preference'] = 'invalid-theme';

    const { result } = renderHook(() => useTheme());

    // Should default to dark theme
    expect(result.current.theme).toBe('dark');
  });

  it('property: theme persistence should survive multiple hook instances', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (theme) => {
          // First instance sets the theme
          const { result: firstInstance } = renderHook(() => useTheme());
          
          act(() => {
            firstInstance.current.setTheme(theme);
          });

          // Second instance should load the same theme
          const { result: secondInstance } = renderHook(() => useTheme());
          expect(secondInstance.current.theme).toBe(theme);

          // Third instance should also load the same theme
          const { result: thirdInstance } = renderHook(() => useTheme());
          expect(thirdInstance.current.theme).toBe(theme);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 6: Dark Mode Default (dark-mode-and-ux-improvements)
 * 
 * For any first-time visit without stored theme preference and without system preference,
 * the application should apply dark mode as the default theme.
 * 
 * Validates: Requirements 2.1
 */
describe('Property 6: Dark Mode Default', () => {
  let localStorageMock: { [key: string]: string };

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

    // Mock matchMedia to be unavailable (simulating no system preference support)
    (global as any).matchMedia = undefined;

    // Mock document.documentElement
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark', 'theme-transitioning');
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('property: should default to dark theme when no stored preference and no system preference', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // No stored preference
        () => {
          // Feature: dark-mode-and-ux-improvements, Property 6: Dark Mode Default
          
          // Ensure localStorage is empty
          localStorageMock = {};

          const { result } = renderHook(() => useTheme());

          // Should default to dark theme (Requirement 2.1)
          expect(result.current.theme).toBe('dark');

          // Verify no system preference was detected
          expect(result.current.systemPreference).toBeNull();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply dark theme class to document root by default', () => {
    // Ensure localStorage is empty
    localStorageMock = {};

    const { result } = renderHook(() => useTheme());

    // Should default to dark theme
    expect(result.current.theme).toBe('dark');

    // Check that dark class is applied to document root
    if (typeof document !== 'undefined') {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    }
  });

  it('property: dark mode default should persist across multiple hook instances', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          // Feature: dark-mode-and-ux-improvements, Property 6: Dark Mode Default
          
          // Ensure localStorage is empty
          localStorageMock = {};

          // First instance
          const { result: firstInstance } = renderHook(() => useTheme());
          expect(firstInstance.current.theme).toBe('dark');

          // Second instance should also default to dark
          const { result: secondInstance } = renderHook(() => useTheme());
          expect(secondInstance.current.theme).toBe('dark');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 7: System Preference Detection (dark-mode-and-ux-improvements)
 * 
 * For any system color scheme preference (light or dark), the application should correctly
 * detect it using the prefers-color-scheme media query when no stored preference exists.
 * 
 * Validates: Requirements 2.8
 */
describe('Property 7: System Preference Detection', () => {
  let localStorageMock: { [key: string]: string };

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

    // Mock document.documentElement
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark', 'theme-transitioning');
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('property: should detect dark system preference correctly', () => {
    fc.assert(
      fc.property(
        fc.constant('dark'),
        (systemPref) => {
          // Feature: dark-mode-and-ux-improvements, Property 7: System Preference Detection
          
          // Mock matchMedia to return dark preference
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

          // Ensure no stored preference
          localStorageMock = {};

          const { result } = renderHook(() => useTheme());

          // Should detect dark system preference
          expect(result.current.systemPreference).toBe('dark');
          
          // Should apply dark theme (since no stored preference)
          expect(result.current.theme).toBe('dark');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: should detect light system preference correctly', () => {
    fc.assert(
      fc.property(
        fc.constant('light'),
        (systemPref) => {
          // Feature: dark-mode-and-ux-improvements, Property 7: System Preference Detection
          
          // Mock matchMedia to return light preference
          global.matchMedia = vi.fn((query: string) => ({
            matches: query === '(prefers-color-scheme: light)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          })) as any;

          // Ensure no stored preference
          localStorageMock = {};

          const { result } = renderHook(() => useTheme());

          // Should detect light system preference
          expect(result.current.systemPreference).toBe('light');
          
          // Should apply light theme (since no stored preference)
          expect(result.current.theme).toBe('light');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: stored preference should override system preference', () => {
    fc.assert(
      fc.property(
        fc.record({
          systemPref: fc.constantFrom<Theme>('light', 'dark'),
          storedPref: fc.constantFrom<Theme>('light', 'dark'),
        }),
        ({ systemPref, storedPref }) => {
          // Feature: dark-mode-and-ux-improvements, Property 7: System Preference Detection
          
          // Mock matchMedia to return system preference
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

          // Set stored preference
          localStorageMock['theme-preference'] = storedPref;

          const { result } = renderHook(() => useTheme());

          // Should detect system preference
          expect(result.current.systemPreference).toBe(systemPref);
          
          // But should apply stored preference (overrides system)
          expect(result.current.theme).toBe(storedPref);

          // Should indicate override if they differ
          if (systemPref !== storedPref) {
            expect(result.current.isSystemPreferenceOverridden).toBe(true);
          } else {
            expect(result.current.isSystemPreferenceOverridden).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null when matchMedia is not available', () => {
    // Mock matchMedia to be unavailable
    (global as any).matchMedia = undefined;

    // Ensure no stored preference
    localStorageMock = {};

    const { result } = renderHook(() => useTheme());

    // Should return null for system preference
    expect(result.current.systemPreference).toBeNull();
    
    // Should default to dark theme
    expect(result.current.theme).toBe('dark');
  });

  it('should handle matchMedia errors gracefully', () => {
    // Mock matchMedia to return an object that throws when matches is accessed
    global.matchMedia = vi.fn((query: string) => {
      const mockMediaQueryList = {
        get matches() {
          throw new Error('matchMedia error');
        },
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
      return mockMediaQueryList as any;
    }) as any;

    // Ensure no stored preference
    localStorageMock = {};

    const { result } = renderHook(() => useTheme());

    // Should return null for system preference (error handled)
    expect(result.current.systemPreference).toBeNull();
    
    // Should default to dark theme
    expect(result.current.theme).toBe('dark');
  });
});
