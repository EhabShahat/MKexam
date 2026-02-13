/**
 * Property-Based Tests for Dark Theme Chart Rendering
 * 
 * Feature: student-experience-and-admin-enhancements
 * Property 17: Dark Theme Chart Rendering
 * 
 * Validates: Requirements 3.8
 * 
 * Property: For any chart configuration, applying dark theme should result in
 * all chart elements using colors with sufficient contrast against the dark background.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getThemedChartOptions, getChartColors, getThemedDataset } from '../chartTheme';

describe('Property 17: Dark Theme Chart Rendering', () => {
  it('should provide sufficient contrast for all text elements in dark theme', () => {
    fc.assert(
      fc.property(
        fc.record({
          responsive: fc.boolean(),
          maintainAspectRatio: fc.boolean(),
        }),
        (config) => {
          const options = getThemedChartOptions('dark', config);
          const colors = getChartColors('dark');

          // Verify text colors are defined and light (for dark background)
          expect(options.plugins.legend.labels.color).toBeDefined();
          expect(options.plugins.tooltip.titleColor).toBeDefined();
          expect(options.plugins.tooltip.bodyColor).toBeDefined();
          expect(options.scales.x.ticks.color).toBeDefined();
          expect(options.scales.y.ticks.color).toBeDefined();

          // Verify text color is light (should be close to white for dark theme)
          // Dark theme text should have high luminance
          expect(colors.text).toMatch(/^#[a-fA-F0-9]{6}$/);
          
          // Extract RGB values from hex color
          const hex = colors.text.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          
          // Calculate relative luminance (simplified)
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          
          // Dark theme text should be bright (luminance > 0.7)
          expect(luminance).toBeGreaterThan(0.7);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use appropriate colors for chart elements in dark theme', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'tertiary', 'quaternary'),
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (colorKey, data, label) => {
          const dataset = getThemedDataset('dark', colorKey as any, label, data);
          const colors = getChartColors('dark');

          // Verify dataset has required properties
          expect(dataset.label).toBe(label);
          expect(dataset.data).toEqual(data);
          expect(dataset.backgroundColor).toBeDefined();
          expect(dataset.borderColor).toBeDefined();

          // Verify color is from the dark theme palette
          const expectedColor = colors[colorKey as keyof typeof colors];
          expect(dataset.backgroundColor).toBe(expectedColor);

          // Verify border color has full opacity
          expect(dataset.borderColor).toMatch(/rgba\(.+,\s*1\)/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide grid and border colors with appropriate contrast in dark theme', () => {
    fc.assert(
      fc.property(
        fc.record({
          responsive: fc.boolean(),
        }),
        (customOptions) => {
          const options = getThemedChartOptions('dark', customOptions);
          const colors = getChartColors('dark');

          // Verify grid colors are defined
          expect(options.scales.x.grid.color).toBeDefined();
          expect(options.scales.y.grid.color).toBeDefined();

          // Verify border colors are defined
          expect(options.scales.x.border.color).toBeDefined();
          expect(options.scales.y.border.color).toBeDefined();

          // Grid colors should be semi-transparent
          expect(colors.grid).toMatch(/rgba\(.+,\s*0\.\d+\)/);

          // Border colors should be fully opaque
          expect(colors.border).toMatch(/rgba\(.+,\s*1\)/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain consistent theming across all chart options in dark theme', () => {
    fc.assert(
      fc.property(
        fc.record({
          responsive: fc.boolean(),
          maintainAspectRatio: fc.boolean(),
        }),
        (customOptions) => {
          const darkOptions = getThemedChartOptions('dark', customOptions);
          const lightOptions = getThemedChartOptions('light', customOptions);

          // Verify that dark and light themes have different colors
          expect(darkOptions.plugins.legend.labels.color).not.toBe(
            lightOptions.plugins.legend.labels.color
          );

          expect(darkOptions.scales.x.ticks.color).not.toBe(
            lightOptions.scales.x.ticks.color
          );

          // Verify structure is consistent between themes
          expect(Object.keys(darkOptions)).toEqual(Object.keys(lightOptions));
          expect(Object.keys(darkOptions.plugins)).toEqual(Object.keys(lightOptions.plugins));
          expect(Object.keys(darkOptions.scales)).toEqual(Object.keys(lightOptions.scales));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide tooltip styling with sufficient contrast in dark theme', () => {
    fc.assert(
      fc.property(
        fc.record({
          responsive: fc.boolean(),
        }),
        (customOptions) => {
          const options = getThemedChartOptions('dark', customOptions);

          // Verify tooltip has dark background
          expect(options.plugins.tooltip.backgroundColor).toBeDefined();
          expect(options.plugins.tooltip.backgroundColor).toMatch(/rgba\(30,\s*41,\s*59/);

          // Verify tooltip text is light colored
          expect(options.plugins.tooltip.titleColor).toBeDefined();
          expect(options.plugins.tooltip.bodyColor).toBeDefined();

          // Verify tooltip has border
          expect(options.plugins.tooltip.borderColor).toBeDefined();
          expect(options.plugins.tooltip.borderWidth).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should merge custom options without losing theme colors', () => {
    fc.assert(
      fc.property(
        fc.record({
          responsive: fc.boolean(),
          plugins: fc.option(fc.record({
            title: fc.option(fc.record({
              display: fc.boolean(),
              text: fc.string({ minLength: 1, maxLength: 50 }),
            })),
          })),
        }),
        (customOptions) => {
          const options = getThemedChartOptions('dark', customOptions);

          // Verify custom options are preserved
          if (customOptions.responsive !== undefined) {
            expect(options.responsive).toBe(customOptions.responsive);
          }

          if (customOptions.plugins?.title) {
            expect(options.plugins.title).toEqual(customOptions.plugins.title);
          }

          // Verify theme colors are still present
          expect(options.plugins.legend.labels.color).toBeDefined();
          expect(options.scales.x.ticks.color).toBeDefined();
          expect(options.scales.y.ticks.color).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
