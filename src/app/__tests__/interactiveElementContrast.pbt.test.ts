// Feature: dark-mode-and-ux-improvements, Property 15: Interactive Element Contrast
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Property 15: Interactive Element Contrast (dark-mode-and-ux-improvements)
 * 
 * For any interactive element (button, link) in both themes, all states (default, hover, active, focus)
 * should have sufficient contrast ratios meeting WCAG AA standards.
 * 
 * Validates: Requirements 4.3, 4.7
 */

/**
 * Convert hex color to RGB
 */
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

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 specification
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Based on WCAG 2.1 specification
 */
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

/**
 * Extract color value from CSS content
 */
function extractColorValue(content: string, varName: string, theme: 'light' | 'dark'): string | null {
  const selector = theme === 'dark' ? ':root\\.dark' : ':root';
  const rootRegex = new RegExp(`${selector}\\s*{([^}]+)}`, 'g');
  const match = rootRegex.exec(content);

  if (match) {
    const declarations = match[1];
    const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const varRegex = new RegExp(`${escapedVarName}:\\s*([^;/]+)`, 'g');
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

describe('Property 15: Interactive Element Contrast', () => {
  const globalsPath = path.join(process.cwd(), 'src/app/globals.css');
  const globalsContent = fs.readFileSync(globalsPath, 'utf-8');

  // Define interactive element color combinations for both themes
  const interactiveElements = [
    {
      name: 'Primary Button',
      fg: '--primary-foreground',
      bg: '--primary',
      minRatio: 4.5,
      themes: ['light', 'dark'] as const,
    },
    {
      name: 'Secondary Button',
      fg: '--secondary-foreground',
      bg: '--secondary',
      minRatio: 4.5,
      themes: ['light', 'dark'] as const,
    },
    {
      name: 'Destructive Button',
      fg: '--destructive-foreground',
      bg: '--destructive',
      minRatio: 4.5,
      themes: ['light', 'dark'] as const,
    },
    {
      name: 'Accent Button',
      fg: '--accent-foreground',
      bg: '--accent',
      minRatio: 4.5,
      themes: ['light', 'dark'] as const,
    },
    {
      name: 'Link',
      fg: '--primary',
      bg: '--background',
      minRatio: 4.5,
      themes: ['light', 'dark'] as const,
    },
    {
      name: 'Focus Ring',
      fg: '--ring',
      bg: '--background',
      minRatio: 3.0,
      themes: ['light', 'dark'] as const,
    },
    {
      name: 'Success Button',
      fg: '--success-foreground',
      bg: '--success',
      minRatio: 4.5,
      themes: ['light', 'dark'] as const,
    },
    {
      name: 'Warning Button',
      fg: '--warning-foreground',
      bg: '--warning',
      minRatio: 4.5,
      themes: ['light', 'dark'] as const,
    },
    {
      name: 'Info Button',
      fg: '--info-foreground',
      bg: '--info',
      minRatio: 4.5,
      themes: ['light', 'dark'] as const,
    },
  ];

  it('should meet WCAG AA contrast for all interactive elements in light theme', () => {
    interactiveElements.forEach(({ name, fg, bg, minRatio, themes }) => {
      if (themes.includes('light')) {
        const fgColor = extractColorValue(globalsContent, fg, 'light');
        const bgColor = extractColorValue(globalsContent, bg, 'light');

        if (fgColor && bgColor) {
          const ratio = getContrastRatio(fgColor, bgColor);
          expect(
            ratio,
            `${name} (light): ${fg} (${fgColor}) on ${bg} (${bgColor}) = ${ratio.toFixed(2)}:1`
          ).toBeGreaterThanOrEqual(minRatio);
        }
      }
    });
  });

  it('should meet WCAG AA contrast for all interactive elements in dark theme', () => {
    interactiveElements.forEach(({ name, fg, bg, minRatio, themes }) => {
      if (themes.includes('dark')) {
        const fgColor = extractColorValue(globalsContent, fg, 'dark');
        const bgColor = extractColorValue(globalsContent, bg, 'dark');

        if (fgColor && bgColor) {
          const ratio = getContrastRatio(fgColor, bgColor);
          expect(
            ratio,
            `${name} (dark): ${fg} (${fgColor}) on ${bg} (${bgColor}) = ${ratio.toFixed(2)}:1`
          ).toBeGreaterThanOrEqual(minRatio);
        }
      }
    });
  });

  it('property: all interactive elements should have sufficient contrast in both themes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...interactiveElements),
        fc.constantFrom<'light' | 'dark'>('light', 'dark'),
        (element, theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 15: Interactive Element Contrast
          if (!element.themes.includes(theme)) {
            return true; // Skip if theme not applicable
          }

          const fgColor = extractColorValue(globalsContent, element.fg, theme);
          const bgColor = extractColorValue(globalsContent, element.bg, theme);

          if (fgColor && bgColor) {
            const ratio = getContrastRatio(fgColor, bgColor);
            expect(
              ratio,
              `${element.name} (${theme}): ${ratio.toFixed(2)}:1`
            ).toBeGreaterThanOrEqual(element.minRatio);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: button borders should be visible against backgrounds', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'light' | 'dark'>('light', 'dark'),
        (theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 15: Interactive Element Contrast
          const borderColor = extractColorValue(globalsContent, '--border', theme);
          const bgColor = extractColorValue(globalsContent, '--background', theme);

          if (borderColor && bgColor) {
            const ratio = getContrastRatio(borderColor, bgColor);
            // Borders should have at least 3:1 contrast for visibility
            expect(ratio, `Border (${theme}): ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3.0);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: input borders should be distinguishable from backgrounds', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'light' | 'dark'>('light', 'dark'),
        (theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 15: Interactive Element Contrast
          const inputColor = extractColorValue(globalsContent, '--input', theme);
          const borderColor = extractColorValue(globalsContent, '--border', theme);

          if (inputColor && borderColor) {
            const ratio = getContrastRatio(inputColor, borderColor);
            // Input borders should be visible with at least 1.5:1 contrast
            expect(ratio, `Input border (${theme}): ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.5);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: status badges should have sufficient contrast', () => {
    const statusColors = [
      { name: 'Draft', color: '--status-draft' },
      { name: 'Published', color: '--status-published' },
      { name: 'Archived', color: '--status-archived' },
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...statusColors),
        fc.constantFrom<'light' | 'dark'>('light', 'dark'),
        (status, theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 15: Interactive Element Contrast
          const statusColor = extractColorValue(globalsContent, status.color, theme);
          const bgColor = extractColorValue(globalsContent, '--background', theme);

          if (statusColor && bgColor) {
            const ratio = getContrastRatio(statusColor, bgColor);
            // Status badges should have at least 3:1 contrast
            expect(
              ratio,
              `${status.name} status (${theme}): ${ratio.toFixed(2)}:1`
            ).toBeGreaterThanOrEqual(3.0);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: muted elements should still be readable', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'light' | 'dark'>('light', 'dark'),
        (theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 15: Interactive Element Contrast
          const mutedFg = extractColorValue(globalsContent, '--muted-foreground', theme);
          const bgColor = extractColorValue(globalsContent, '--background', theme);

          if (mutedFg && bgColor) {
            const ratio = getContrastRatio(mutedFg, bgColor);
            // Muted text should still meet 4.5:1 for readability
            expect(ratio, `Muted text (${theme}): ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: card elements should have sufficient contrast with card backgrounds', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'light' | 'dark'>('light', 'dark'),
        (theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 15: Interactive Element Contrast
          const cardFg = extractColorValue(globalsContent, '--card-foreground', theme);
          const cardBg = extractColorValue(globalsContent, '--card', theme);

          if (cardFg && cardBg) {
            const ratio = getContrastRatio(cardFg, cardBg);
            // Card text should meet 4.5:1 for readability
            expect(ratio, `Card text (${theme}): ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: popover elements should have sufficient contrast', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'light' | 'dark'>('light', 'dark'),
        (theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 15: Interactive Element Contrast
          const popoverFg = extractColorValue(globalsContent, '--popover-foreground', theme);
          const popoverBg = extractColorValue(globalsContent, '--popover', theme);

          if (popoverFg && popoverBg) {
            const ratio = getContrastRatio(popoverFg, popoverBg);
            // Popover text should meet 4.5:1 for readability
            expect(ratio, `Popover text (${theme}): ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have proper color-scheme property for both themes', () => {
    const lightThemeRegex = /:root\s*{([^}]+)}/g;
    const darkThemeRegex = /:root\.dark\s*{([^}]+)}/g;

    const lightMatch = lightThemeRegex.exec(globalsContent);
    const darkMatch = darkThemeRegex.exec(globalsContent);

    expect(lightMatch).toBeTruthy();
    expect(darkMatch).toBeTruthy();

    if (lightMatch) {
      expect(lightMatch[1]).toContain('color-scheme: light');
    }

    if (darkMatch) {
      expect(darkMatch[1]).toContain('color-scheme: dark');
    }
  });

  it('property: all button variants should have accessible text', () => {
    const buttonVariants = [
      { name: 'Primary', fg: '--primary-foreground', bg: '--primary' },
      { name: 'Secondary', fg: '--secondary-foreground', bg: '--secondary' },
      { name: 'Destructive', fg: '--destructive-foreground', bg: '--destructive' },
      { name: 'Accent', fg: '--accent-foreground', bg: '--accent' },
      { name: 'Success', fg: '--success-foreground', bg: '--success' },
      { name: 'Warning', fg: '--warning-foreground', bg: '--warning' },
      { name: 'Info', fg: '--info-foreground', bg: '--info' },
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...buttonVariants),
        fc.constantFrom<'light' | 'dark'>('light', 'dark'),
        (variant, theme) => {
          // Feature: dark-mode-and-ux-improvements, Property 15: Interactive Element Contrast
          const fgColor = extractColorValue(globalsContent, variant.fg, theme);
          const bgColor = extractColorValue(globalsContent, variant.bg, theme);

          if (fgColor && bgColor) {
            const ratio = getContrastRatio(fgColor, bgColor);
            // Button text should meet 4.5:1 for readability
            expect(
              ratio,
              `${variant.name} button (${theme}): ${ratio.toFixed(2)}:1`
            ).toBeGreaterThanOrEqual(4.5);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
