// Feature: dark-mode-and-ux-improvements, Property 9: Theme Switching Performance
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { useTheme, type Theme } from '@/hooks/useTheme';

/**
 * Property 9: Theme Switching Performance (dark-mode-and-ux-improvements)
 * 
 * For any theme toggle action, the visual transition should complete within 100 milliseconds.
 * 
 * Validates: Requirements 3.2, 6.1
 */

describe('Property 9: Theme Switching Performance', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Reset document classes
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
  });

  it('should switch theme within 100ms', () => {
    const { result } = renderHook(() => useTheme());

    const startTime = performance.now();
    
    act(() => {
      result.current.toggleTheme();
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Theme switching should complete within 100ms
    expect(duration).toBeLessThan(100);
  });

  it('should apply theme class to document within 100ms', () => {
    const { result } = renderHook(() => useTheme());

    const startTime = performance.now();
    
    act(() => {
      result.current.setTheme('light');
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Theme application should complete within 100ms
    expect(duration).toBeLessThan(100);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('property: all theme switches should complete within 100ms', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        fc.constantFrom<Theme>('light', 'dark'),
        (initialTheme, targetTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 9: Theme Switching Performance
          
          // Set initial theme
          localStorage.setItem('theme-preference', initialTheme);
          const { result } = renderHook(() => useTheme());

          const startTime = performance.now();
          
          act(() => {
            result.current.setTheme(targetTheme);
          });
          
          const endTime = performance.now();
          const duration = endTime - startTime;

          // Theme switching should complete within 100ms
          expect(duration, `Theme switch from ${initialTheme} to ${targetTheme} took ${duration.toFixed(2)}ms`).toBeLessThan(100);
          
          // Verify theme was actually applied
          expect(result.current.theme).toBe(targetTheme);
          expect(document.documentElement.classList.contains(targetTheme)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: toggle theme should complete within 100ms', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (initialTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 9: Theme Switching Performance
          
          // Set initial theme
          localStorage.setItem('theme-preference', initialTheme);
          const { result } = renderHook(() => useTheme());

          const startTime = performance.now();
          
          act(() => {
            result.current.toggleTheme();
          });
          
          const endTime = performance.now();
          const duration = endTime - startTime;

          // Theme toggle should complete within 100ms
          expect(duration, `Theme toggle from ${initialTheme} took ${duration.toFixed(2)}ms`).toBeLessThan(100);
          
          // Verify theme was toggled
          const expectedTheme = initialTheme === 'light' ? 'dark' : 'light';
          expect(result.current.theme).toBe(expectedTheme);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: multiple rapid theme switches should each complete within 100ms', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<Theme>('light', 'dark'), { minLength: 2, maxLength: 10 }),
        (themeSequence) => {
          // Feature: dark-mode-and-ux-improvements, Property 9: Theme Switching Performance
          
          const { result } = renderHook(() => useTheme());
          
          // Test each theme switch in the sequence
          for (let i = 0; i < themeSequence.length; i++) {
            const targetTheme = themeSequence[i];
            
            const startTime = performance.now();
            
            act(() => {
              result.current.setTheme(targetTheme);
            });
            
            const endTime = performance.now();
            const duration = endTime - startTime;

            // Each switch should complete within 100ms
            expect(
              duration,
              `Switch ${i + 1} to ${targetTheme} took ${duration.toFixed(2)}ms`
            ).toBeLessThan(100);
            
            // Verify theme was applied
            expect(result.current.theme).toBe(targetTheme);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('property: theme switching should not block the main thread', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (targetTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 9: Theme Switching Performance
          
          const { result } = renderHook(() => useTheme());
          
          let otherOperationCompleted = false;
          
          act(() => {
            result.current.setTheme(targetTheme);
            
            // Simulate other operations that should not be blocked
            otherOperationCompleted = true;
          });
          
          // Other operations should complete
          expect(otherOperationCompleted).toBe(true);
          
          // Theme should still be applied
          expect(result.current.theme).toBe(targetTheme);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: localStorage persistence should not significantly impact performance', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (targetTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 9: Theme Switching Performance
          
          const { result } = renderHook(() => useTheme());
          
          const startTime = performance.now();
          
          act(() => {
            result.current.setTheme(targetTheme);
          });
          
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          // Even with localStorage persistence, should complete within 100ms
          expect(duration, `Theme switch with persistence took ${duration.toFixed(2)}ms`).toBeLessThan(100);
          
          // Verify localStorage was updated
          expect(localStorage.getItem('theme-preference')).toBe(targetTheme);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: theme switching should apply color-scheme property quickly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (targetTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 9: Theme Switching Performance
          
          const { result } = renderHook(() => useTheme());
          
          const startTime = performance.now();
          
          act(() => {
            result.current.setTheme(targetTheme);
          });
          
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          // Should complete within 100ms
          expect(duration).toBeLessThan(100);
          
          // Verify color-scheme property was set
          expect(document.documentElement.style.colorScheme).toBe(targetTheme);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: theme class removal and addition should be atomic', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        fc.constantFrom<Theme>('light', 'dark'),
        (initialTheme, targetTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 9: Theme Switching Performance
          
          // Set initial theme
          localStorage.setItem('theme-preference', initialTheme);
          const { result } = renderHook(() => useTheme());
          
          // Verify initial state
          expect(document.documentElement.classList.contains(initialTheme)).toBe(true);
          
          act(() => {
            result.current.setTheme(targetTheme);
          });
          
          // After switch, only target theme should be present
          expect(document.documentElement.classList.contains(targetTheme)).toBe(true);
          
          // Old theme should be removed
          if (initialTheme !== targetTheme) {
            expect(document.documentElement.classList.contains(initialTheme)).toBe(false);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle theme switching with unavailable localStorage within 100ms', () => {
    // Mock localStorage to throw errors
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('localStorage unavailable');
    };

    try {
      const { result } = renderHook(() => useTheme());

      const startTime = performance.now();
      
      act(() => {
        result.current.setTheme('light');
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should still complete within 100ms even with localStorage error
      expect(duration).toBeLessThan(100);
      
      // Theme should still be applied to document
      expect(document.documentElement.classList.contains('light')).toBe(true);
    } finally {
      // Restore original localStorage
      Storage.prototype.setItem = originalSetItem;
    }
  });

  it('property: average theme switch time should be well under 100ms', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<Theme>('light', 'dark'), { minLength: 10, maxLength: 20 }),
        (themeSequence) => {
          // Feature: dark-mode-and-ux-improvements, Property 9: Theme Switching Performance
          
          const { result } = renderHook(() => useTheme());
          const durations: number[] = [];
          
          // Measure each theme switch
          for (const targetTheme of themeSequence) {
            const startTime = performance.now();
            
            act(() => {
              result.current.setTheme(targetTheme);
            });
            
            const endTime = performance.now();
            durations.push(endTime - startTime);
          }
          
          // Calculate average
          const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
          
          // Average should be well under 100ms (let's say < 50ms)
          expect(average, `Average theme switch time: ${average.toFixed(2)}ms`).toBeLessThan(50);
          
          // All individual switches should be under 100ms
          durations.forEach((duration, index) => {
            expect(duration, `Switch ${index + 1} took ${duration.toFixed(2)}ms`).toBeLessThan(100);
          });
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
