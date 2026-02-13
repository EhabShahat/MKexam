// Feature: dark-mode-and-ux-improvements, Property 12: Theme Icon Consistency
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import { ThemeToggle } from '../ThemeToggle';
import * as useThemeModule from '@/hooks/useTheme';

/**
 * Property 12: Theme Icon Consistency (dark-mode-and-ux-improvements)
 * 
 * For any theme state, the theme toggle should display the appropriate icon
 * (moon for dark mode, sun for light mode).
 * 
 * Validates: Requirements 3.6
 */

describe('Property 12: Theme Icon Consistency', () => {
  it('property: dark theme should display moon icon', () => {
    fc.assert(
      fc.property(
        fc.constant('dark'),
        (theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 12: Theme Icon Consistency
          
          // Mock useTheme to return dark theme
          vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
            theme: theme as 'dark',
            setTheme: vi.fn(),
            toggleTheme: vi.fn(),
            systemPreference: null,
            isSystemPreferenceOverridden: false,
          });

          // Render component
          const { container } = render(<ThemeToggle />);
          
          // Find SVG elements
          const svgs = container.querySelectorAll('svg');
          expect(svgs.length).toBeGreaterThan(0);
          
          // Moon icon has a path element with specific d attribute
          const moonPath = container.querySelector('path[d*="M21 12.79"]');
          expect(moonPath).toBeTruthy();
          
          // Sun icon should not be present (it has circle and line elements)
          const sunCircle = container.querySelector('circle[cx="12"][cy="12"][r="5"]');
          expect(sunCircle).toBeFalsy();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: light theme should display sun icon', () => {
    fc.assert(
      fc.property(
        fc.constant('light'),
        (theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 12: Theme Icon Consistency
          
          // Mock useTheme to return light theme
          vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
            theme: theme as 'light',
            setTheme: vi.fn(),
            toggleTheme: vi.fn(),
            systemPreference: null,
            isSystemPreferenceOverridden: false,
          });

          // Render component
          const { container } = render(<ThemeToggle />);
          
          // Find SVG elements
          const svgs = container.querySelectorAll('svg');
          expect(svgs.length).toBeGreaterThan(0);
          
          // Sun icon has a circle element with specific attributes
          const sunCircle = container.querySelector('circle[cx="12"][cy="12"][r="5"]');
          expect(sunCircle).toBeTruthy();
          
          // Moon icon should not be present
          const moonPath = container.querySelector('path[d*="M21 12.79"]');
          expect(moonPath).toBeFalsy();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: icon should have aria-hidden attribute', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('light', 'dark'),
        (theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 12: Theme Icon Consistency
          
          // Mock useTheme
          vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
            theme: theme as 'light' | 'dark',
            setTheme: vi.fn(),
            toggleTheme: vi.fn(),
            systemPreference: null,
            isSystemPreferenceOverridden: false,
          });

          // Render component
          const { container } = render(<ThemeToggle />);
          
          // Find SVG element
          const svg = container.querySelector('svg');
          expect(svg).toBeTruthy();
          
          // Verify aria-hidden attribute is present
          expect(svg?.getAttribute('aria-hidden')).toBe('true');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: only one icon should be rendered at a time', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('light', 'dark'),
        (theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 12: Theme Icon Consistency
          
          // Mock useTheme
          vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
            theme: theme as 'light' | 'dark',
            setTheme: vi.fn(),
            toggleTheme: vi.fn(),
            systemPreference: null,
            isSystemPreferenceOverridden: false,
          });

          // Render component
          const { container } = render(<ThemeToggle />);
          
          // Should have exactly one SVG element
          const svgs = container.querySelectorAll('svg');
          expect(svgs.length).toBe(1);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: icon consistency across component props', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('light', 'dark'),
        fc.constantFrom('sm', 'md', 'lg'),
        fc.boolean(),
        fc.constantFrom('en', 'ar'),
        (theme, size, showLabel, locale) => {
          // Feature: dark-mode-and-ux-improvements, Property 12: Theme Icon Consistency
          
          // Mock useTheme
          vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
            theme: theme as 'light' | 'dark',
            setTheme: vi.fn(),
            toggleTheme: vi.fn(),
            systemPreference: null,
            isSystemPreferenceOverridden: false,
          });

          // Render component with various props
          const { container } = render(
            <ThemeToggle 
              size={size as 'sm' | 'md' | 'lg'}
              showLabel={showLabel}
              locale={locale as 'en' | 'ar'}
            />
          );
          
          // Verify correct icon is displayed regardless of other props
          if (theme === 'dark') {
            const moonPath = container.querySelector('path[d*="M21 12.79"]');
            expect(moonPath).toBeTruthy();
          } else {
            const sunCircle = container.querySelector('circle[cx="12"][cy="12"][r="5"]');
            expect(sunCircle).toBeTruthy();
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: icon should have proper SVG attributes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('light', 'dark'),
        (theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 12: Theme Icon Consistency
          
          // Mock useTheme
          vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
            theme: theme as 'light' | 'dark',
            setTheme: vi.fn(),
            toggleTheme: vi.fn(),
            systemPreference: null,
            isSystemPreferenceOverridden: false,
          });

          // Render component
          const { container } = render(<ThemeToggle />);
          
          // Find SVG element
          const svg = container.querySelector('svg');
          expect(svg).toBeTruthy();
          
          // Verify SVG has proper attributes
          expect(svg?.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
          expect(svg?.getAttribute('width')).toBe('20');
          expect(svg?.getAttribute('height')).toBe('20');
          expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
          expect(svg?.getAttribute('fill')).toBe('none');
          expect(svg?.getAttribute('stroke')).toBe('currentColor');
          expect(svg?.getAttribute('stroke-width')).toBe('2');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
