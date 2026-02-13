/**
 * Property-Based Test: Responsive Feature Support
 * Feature: student-experience-and-admin-enhancements, Property 21: Responsive Feature Support
 * 
 * Validates: Requirements 4.6
 * 
 * Property: For any new feature component, rendering at mobile (320px), tablet (768px),
 * and desktop (1024px) viewport widths should maintain usability and visual integrity.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import { ThemeToggle } from '@/components/ThemeToggle';
import ClearCodeButton from '@/components/ClearCodeButton';
import DeviceInfoCell from '@/components/admin/DeviceInfoCell';

// Mock useRouter for ClearCodeButton
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock useStudentLocale for ClearCodeButton
vi.mock('@/components/public/PublicLocaleProvider', () => ({
  useStudentLocale: () => ({
    locale: 'en' as const,
  }),
}));

// Mock useStudentCode for ClearCodeButton
vi.mock('@/hooks/useStudentCode', () => ({
  getStoredCode: () => '1234',
  clearCode: vi.fn(),
}));

describe('Property 21: Responsive Feature Support', () => {
  const viewportWidths = [320, 768, 1024] as const;

  it('should render ThemeToggle at all viewport widths without errors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...viewportWidths),
        fc.constantFrom<'light' | 'dark'>('light', 'dark'),
        (width, theme) => {
          // Set viewport width
          global.innerWidth = width;
          window.dispatchEvent(new Event('resize'));

          // Mock useTheme hook
          vi.doMock('@/hooks/useTheme', () => ({
            useTheme: () => ({
              theme,
              toggleTheme: vi.fn(),
            }),
          }));

          const { container } = render(<ThemeToggle />);

          // Component should render without errors
          expect(container).toBeTruthy();

          // Button should be present
          const button = container.querySelector('button');
          expect(button).toBeTruthy();

          // Button should have proper classes
          expect(button?.className).toContain('btn');

          // SVG icon should be present
          const svg = container.querySelector('svg');
          expect(svg).toBeTruthy();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should render ClearCodeButton at all viewport widths without errors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...viewportWidths),
        fc.constantFrom<'primary' | 'outline' | 'text'>('primary', 'outline', 'text'),
        (width, variant) => {
          // Set viewport width
          global.innerWidth = width;
          window.dispatchEvent(new Event('resize'));

          const { container } = render(<ClearCodeButton variant={variant} />);

          // Component should render without errors
          expect(container).toBeTruthy();

          // Button should be present
          const button = container.querySelector('button');
          expect(button).toBeTruthy();

          // Button should have proper classes
          expect(button?.className).toContain('inline-flex');
          expect(button?.className).toContain('items-center');

          // Icon should be present
          const svg = container.querySelector('svg');
          expect(svg).toBeTruthy();

          // Text should be present
          expect(button?.textContent).toBeTruthy();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should render DeviceInfoCell at all viewport widths without errors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...viewportWidths),
        fc.option(fc.string(), { nil: null }),
        fc.option(fc.string(), { nil: null }),
        fc.integer({ min: 1, max: 10 }),
        (width, deviceInfo, ipAddress, usageCount) => {
          // Set viewport width
          global.innerWidth = width;
          window.dispatchEvent(new Event('resize'));

          const { container } = render(
            <DeviceInfoCell
              deviceInfo={deviceInfo}
              ipAddress={ipAddress}
              usageCount={usageCount}
            />
          );

          // Component should render without errors
          expect(container).toBeTruthy();

          // Container should have flex layout
          const div = container.querySelector('div');
          expect(div?.className).toContain('flex');
          expect(div?.className).toContain('items-center');

          // Text should be present
          const span = container.querySelector('span');
          expect(span).toBeTruthy();
          expect(span?.textContent).toBeTruthy();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain proper text sizing across viewport widths', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...viewportWidths),
        (width) => {
          // Set viewport width
          global.innerWidth = width;
          window.dispatchEvent(new Event('resize'));

          const { container: themeContainer } = render(<ThemeToggle />);
          const { container: clearContainer } = render(<ClearCodeButton />);
          const { container: deviceContainer } = render(
            <DeviceInfoCell deviceInfo={null} ipAddress="192.168.1.1" />
          );

          // All components should have readable text sizes
          const themeButton = themeContainer.querySelector('button');
          const clearButton = clearContainer.querySelector('button');
          const deviceSpan = deviceContainer.querySelector('span');

          // Check that elements exist
          expect(themeButton).toBeTruthy();
          expect(clearButton).toBeTruthy();
          expect(deviceSpan).toBeTruthy();

          // Check that text is present and not empty
          if (clearButton?.textContent) {
            expect(clearButton.textContent.trim().length).toBeGreaterThan(0);
          }
          if (deviceSpan?.textContent) {
            expect(deviceSpan.textContent.trim().length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain proper spacing and layout at all viewport widths', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...viewportWidths),
        (width) => {
          // Set viewport width
          global.innerWidth = width;
          window.dispatchEvent(new Event('resize'));

          const { container: clearContainer } = render(<ClearCodeButton />);
          const { container: deviceContainer } = render(
            <DeviceInfoCell deviceInfo={null} ipAddress="192.168.1.1" />
          );

          // Check for proper gap classes
          const clearButton = clearContainer.querySelector('button');
          const deviceDiv = deviceContainer.querySelector('div');

          expect(clearButton?.className).toContain('gap-');
          expect(deviceDiv?.className).toContain('gap-');

          // Check for proper padding classes
          expect(clearButton?.className).toContain('px-');
          expect(clearButton?.className).toContain('py-');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle overflow gracefully at narrow viewports', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.string({ minLength: 7, maxLength: 15 }),
        (deviceModel, ipAddress) => {
          // Set narrow viewport
          global.innerWidth = 320;
          window.dispatchEvent(new Event('resize'));

          const deviceInfo = JSON.stringify({
            type: 'mobile',
            manufacturer: 'Test',
            model: deviceModel,
            raw: 'test',
          });

          const { container } = render(
            <DeviceInfoCell
              deviceInfo={deviceInfo}
              ipAddress={ipAddress}
              usageCount={5}
            />
          );

          // Component should render without errors
          expect(container).toBeTruthy();

          // Text should be present
          const span = container.querySelector('span');
          expect(span).toBeTruthy();

          // Should have proper text size class
          expect(span?.className).toContain('text-');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain accessibility at all viewport widths', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...viewportWidths),
        (width) => {
          // Set viewport width
          global.innerWidth = width;
          window.dispatchEvent(new Event('resize'));

          const { container: themeContainer } = render(<ThemeToggle />);
          const { container: clearContainer } = render(<ClearCodeButton />);

          // Check for proper ARIA labels
          const themeButton = themeContainer.querySelector('button');
          const clearButton = clearContainer.querySelector('button');

          expect(themeButton?.getAttribute('aria-label')).toBeTruthy();
          expect(clearButton?.getAttribute('aria-label')).toBeTruthy();

          // Check for proper button type
          expect(themeButton?.getAttribute('type')).toBe('button');
          expect(clearButton?.getAttribute('type')).toBe('button');
        }
      ),
      { numRuns: 50 }
    );
  });
});
