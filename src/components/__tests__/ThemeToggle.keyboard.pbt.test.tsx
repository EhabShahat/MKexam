// Feature: dark-mode-and-ux-improvements, Property 13: Keyboard Accessibility
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fc from 'fast-check';
import { ThemeToggle } from '../ThemeToggle';
import * as useThemeModule from '@/hooks/useTheme';

/**
 * Property 13: Keyboard Accessibility (dark-mode-and-ux-improvements)
 * 
 * For any keyboard event (Enter or Space key) on the theme toggle,
 * the theme should switch between light and dark modes.
 * 
 * Validates: Requirements 3.7
 */

describe('Property 13: Keyboard Accessibility', () => {
  let mockToggleTheme: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockToggleTheme = vi.fn();
    
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'dark',
      setTheme: vi.fn(),
      toggleTheme: mockToggleTheme,
      systemPreference: null,
      isSystemPreferenceOverridden: false,
    });
  });

  it('property: Enter or Space key should toggle theme', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Enter', ' '),
        fc.constantFrom('light', 'dark'),
        (key, initialTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 13: Keyboard Accessibility
          
          // Reset mock
          mockToggleTheme.mockClear();
          
          // Mock the current theme
          vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
            theme: initialTheme as 'light' | 'dark',
            setTheme: vi.fn(),
            toggleTheme: mockToggleTheme,
            systemPreference: null,
            isSystemPreferenceOverridden: false,
          });

          // Render component
          const { container } = render(<ThemeToggle />);
          const button = container.querySelector('button');
          
          expect(button).toBeTruthy();
          
          // Simulate keyboard event
          fireEvent.keyDown(button!, { key });

          // Verify toggleTheme was called
          expect(mockToggleTheme).toHaveBeenCalledTimes(1);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: other keys should not toggle theme', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('a', 'b', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown'),
        fc.constantFrom('light', 'dark'),
        (key, initialTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 13: Keyboard Accessibility
          
          // Reset mock
          mockToggleTheme.mockClear();
          
          // Mock the current theme
          vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
            theme: initialTheme as 'light' | 'dark',
            setTheme: vi.fn(),
            toggleTheme: mockToggleTheme,
            systemPreference: null,
            isSystemPreferenceOverridden: false,
          });

          // Render component
          const { container } = render(<ThemeToggle />);
          const button = container.querySelector('button');
          
          expect(button).toBeTruthy();
          
          // Simulate keyboard event with non-toggle key
          fireEvent.keyDown(button!, { key });

          // Verify toggleTheme was NOT called
          expect(mockToggleTheme).not.toHaveBeenCalled();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: keyboard events should work with all component sizes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Enter', ' '),
        fc.constantFrom('sm', 'md', 'lg'),
        fc.constantFrom('light', 'dark'),
        (key, size, initialTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 13: Keyboard Accessibility
          
          // Reset mock
          mockToggleTheme.mockClear();
          
          // Mock the current theme
          vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
            theme: initialTheme as 'light' | 'dark',
            setTheme: vi.fn(),
            toggleTheme: mockToggleTheme,
            systemPreference: null,
            isSystemPreferenceOverridden: false,
          });

          // Render component with size prop
          const { container } = render(<ThemeToggle size={size as 'sm' | 'md' | 'lg'} />);
          const button = container.querySelector('button');
          
          expect(button).toBeTruthy();
          
          // Simulate keyboard event
          fireEvent.keyDown(button!, { key });

          // Verify toggleTheme was called
          expect(mockToggleTheme).toHaveBeenCalledTimes(1);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: keyboard events should work with labels', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Enter', ' '),
        fc.boolean(),
        fc.constantFrom('en', 'ar'),
        fc.constantFrom('light', 'dark'),
        (key, showLabel, locale, initialTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 13: Keyboard Accessibility
          
          // Reset mock
          mockToggleTheme.mockClear();
          
          // Mock the current theme
          vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
            theme: initialTheme as 'light' | 'dark',
            setTheme: vi.fn(),
            toggleTheme: mockToggleTheme,
            systemPreference: null,
            isSystemPreferenceOverridden: false,
          });

          // Render component with showLabel and locale props
          const { container } = render(
            <ThemeToggle 
              showLabel={showLabel} 
              locale={locale as 'en' | 'ar'} 
            />
          );
          const button = container.querySelector('button');
          
          expect(button).toBeTruthy();
          
          // Simulate keyboard event
          fireEvent.keyDown(button!, { key });

          // Verify toggleTheme was called
          expect(mockToggleTheme).toHaveBeenCalledTimes(1);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

});
