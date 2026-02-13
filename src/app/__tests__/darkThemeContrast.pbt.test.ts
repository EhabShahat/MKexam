// Feature: student-experience-and-admin-enhancements, Property 16: Dark Theme Contrast Compliance
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Property 16: Dark Theme Contrast Compliance
 * 
 * For any text or interactive element in dark theme, the contrast ratio between 
 * foreground and background should meet or exceed WCAG AA standards 
 * (4.5:1 for normal text, 3:1 for large text and UI components).
 * 
 * Validates: Requirements 3.7, 3.13
 */

// Utility to parse hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Calculate relative luminance
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio between two colors
function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    return 0;
  }

  const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

// Extract color value from CSS content
function extractColorValue(content: string, varName: string, theme: 'light' | 'dark'): string | null {
  const selector = theme === 'dark' ? ':root\\.dark' : ':root';
  const rootRegex = new RegExp(`${selector}\\s*{([^}]+)}`, 'gs');
  const match = rootRegex.exec(content);

  if (match) {
    const declarations = match[1];
    const varRegex = new RegExp(`${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([^;/]+)`, 'g');
    const varMatch = varRegex.exec(declarations);

    if (varMatch) {
      const value = varMatch[1].trim();
      // Extract hex color, ignoring comments
      const hexMatch = /#[0-9a-fA-F]{6}/.exec(value);
      return hexMatch ? hexMatch[0] : null;
    }
  }

  return null;
}

describe('Property 16: Dark Theme Contrast Compliance', () => {
  const globalsPath = path.join(process.cwd(), 'src/app/globals.css');
  const globalsContent = fs.readFileSync(globalsPath, 'utf-8');

  // Define color pairs that should meet contrast requirements
  const textColorPairs = [
    { fg: '--foreground', bg: '--background', minRatio: 4.5, description: 'body text' },
    { fg: '--card-foreground', bg: '--card', minRatio: 4.5, description: 'card text' },
    { fg: '--muted-foreground', bg: '--background', minRatio: 4.5, description: 'muted text' },
    { fg: '--primary-foreground', bg: '--primary', minRatio: 4.5, description: 'primary button text' },
    { fg: '--accent-foreground', bg: '--accent', minRatio: 4.5, description: 'accent text' },
    { fg: '--destructive-foreground', bg: '--destructive', minRatio: 4.5, description: 'destructive button text' },
    { fg: '--popover-foreground', bg: '--popover', minRatio: 4.5, description: 'popover text' },
    { fg: '--success-foreground', bg: '--success', minRatio: 4.5, description: 'success text' },
    { fg: '--warning-foreground', bg: '--warning', minRatio: 4.5, description: 'warning text' },
    { fg: '--info-foreground', bg: '--info', minRatio: 4.5, description: 'info text' },
  ];

  const uiComponentPairs = [
    { fg: '--ring', bg: '--background', minRatio: 3.0, description: 'focus ring' },
  ];

  it('should meet WCAG AA contrast ratio for text in dark theme (4.5:1)', () => {
    textColorPairs.forEach(({ fg, bg, minRatio, description }) => {
      const fgColor = extractColorValue(globalsContent, fg, 'dark');
      const bgColor = extractColorValue(globalsContent, bg, 'dark');

      if (fgColor && bgColor) {
        const ratio = getContrastRatio(fgColor, bgColor);
        expect(ratio).toBeGreaterThanOrEqual(minRatio);
      }
    });
  });

  it('should meet WCAG AA contrast ratio for UI components in dark theme (3:1)', () => {
    uiComponentPairs.forEach(({ fg, bg, minRatio, description }) => {
      const fgColor = extractColorValue(globalsContent, fg, 'dark');
      const bgColor = extractColorValue(globalsContent, bg, 'dark');

      if (fgColor && bgColor) {
        const ratio = getContrastRatio(fgColor, bgColor);
        expect(ratio).toBeGreaterThanOrEqual(minRatio);
      }
    });
  });

  it('property: all text color pairs should meet WCAG AA standards in dark theme', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...textColorPairs),
        (colorPair) => {
          const fgColor = extractColorValue(globalsContent, colorPair.fg, 'dark');
          const bgColor = extractColorValue(globalsContent, colorPair.bg, 'dark');

          if (fgColor && bgColor) {
            const ratio = getContrastRatio(fgColor, bgColor);
            expect(ratio).toBeGreaterThanOrEqual(colorPair.minRatio);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: all UI component color pairs should meet WCAG AA standards in dark theme', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...uiComponentPairs),
        (colorPair) => {
          const fgColor = extractColorValue(globalsContent, colorPair.fg, 'dark');
          const bgColor = extractColorValue(globalsContent, colorPair.bg, 'dark');

          if (fgColor && bgColor) {
            const ratio = getContrastRatio(fgColor, bgColor);
            expect(ratio).toBeGreaterThanOrEqual(colorPair.minRatio);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: chart colors should have sufficient contrast against dark background', () => {
    const chartColors = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'];
    const background = '--background';

    fc.assert(
      fc.property(
        fc.constantFrom(...chartColors),
        (chartColor) => {
          const fgColor = extractColorValue(globalsContent, chartColor, 'dark');
          const bgColor = extractColorValue(globalsContent, background, 'dark');

          if (fgColor && bgColor) {
            const ratio = getContrastRatio(fgColor, bgColor);
            // Chart colors should have at least 3:1 contrast for visibility
            expect(ratio).toBeGreaterThanOrEqual(3.0);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: status colors should have sufficient contrast in dark theme', () => {
    const statusColors = ['--status-draft', '--status-published', '--status-archived'];
    const background = '--background';

    fc.assert(
      fc.property(
        fc.constantFrom(...statusColors),
        (statusColor) => {
          const fgColor = extractColorValue(globalsContent, statusColor, 'dark');
          const bgColor = extractColorValue(globalsContent, background, 'dark');

          if (fgColor && bgColor) {
            const ratio = getContrastRatio(fgColor, bgColor);
            // Status colors should have at least 3:1 contrast
            expect(ratio).toBeGreaterThanOrEqual(3.0);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: secondary colors should meet contrast requirements', () => {
    const fgColor = extractColorValue(globalsContent, '--secondary-foreground', 'dark');
    const bgColor = extractColorValue(globalsContent, '--secondary', 'dark');

    if (fgColor && bgColor) {
      const ratio = getContrastRatio(fgColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('should have color-scheme property set to dark for dark theme', () => {
    const darkThemeRegex = /:root\.dark\s*{([^}]+)}/gs;
    const match = darkThemeRegex.exec(globalsContent);

    expect(match).toBeTruthy();
    if (match) {
      expect(match[1]).toContain('color-scheme: dark');
    }
  });
});
