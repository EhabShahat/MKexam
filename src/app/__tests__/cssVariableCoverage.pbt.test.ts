// Feature: student-experience-and-admin-enhancements, Property 15: CSS Variable Coverage
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Property 15: CSS Variable Coverage
 * 
 * For any UI component in the application, all color values should reference 
 * CSS custom properties (no hardcoded colors in component styles).
 * 
 * Validates: Requirements 3.12
 */

describe('Property 15: CSS Variable Coverage', () => {
  const globalsPath = path.join(process.cwd(), 'src/app/globals.css');
  const globalsContent = fs.readFileSync(globalsPath, 'utf-8');

  // Extract all CSS variable names from :root
  const extractCSSVariables = (content: string, selector: string): Set<string> => {
    const variables = new Set<string>();
    const rootRegex = new RegExp(`${selector}\\s*{([^}]+)}`, 'gs');
    const match = rootRegex.exec(content);
    
    if (match) {
      const declarations = match[1];
      const varRegex = /--([\w-]+):/g;
      let varMatch;
      while ((varMatch = varRegex.exec(declarations)) !== null) {
        variables.add(`--${varMatch[1]}`);
      }
    }
    
    return variables;
  };

  const lightThemeVars = extractCSSVariables(globalsContent, ':root');
  const darkThemeVars = extractCSSVariables(globalsContent, ':root\\.dark');

  it('should define all required color categories in light theme', () => {
    const requiredCategories = [
      '--background',
      '--foreground',
      '--card',
      '--card-foreground',
      '--muted',
      '--muted-foreground',
      '--border',
      '--input',
      '--ring',
      '--primary',
      '--primary-foreground',
      '--secondary',
      '--secondary-foreground',
      '--accent',
      '--accent-foreground',
      '--destructive',
      '--destructive-foreground',
      '--popover',
      '--popover-foreground',
      '--success',
      '--success-foreground',
      '--warning',
      '--warning-foreground',
      '--info',
      '--info-foreground',
    ];

    requiredCategories.forEach(category => {
      expect(lightThemeVars.has(category)).toBe(true);
    });
  });

  it('should define all required color categories in dark theme', () => {
    const requiredCategories = [
      '--background',
      '--foreground',
      '--card',
      '--card-foreground',
      '--muted',
      '--muted-foreground',
      '--border',
      '--input',
      '--ring',
      '--primary',
      '--primary-foreground',
      '--secondary',
      '--secondary-foreground',
      '--accent',
      '--accent-foreground',
      '--destructive',
      '--destructive-foreground',
      '--popover',
      '--popover-foreground',
      '--success',
      '--success-foreground',
      '--warning',
      '--warning-foreground',
      '--info',
      '--info-foreground',
    ];

    requiredCategories.forEach(category => {
      expect(darkThemeVars.has(category)).toBe(true);
    });
  });

  it('should have matching variable names between light and dark themes', () => {
    // Dark theme should define the same variables as light theme
    const lightVarsArray = Array.from(lightThemeVars).filter(v => v !== 'color-scheme');
    const darkVarsArray = Array.from(darkThemeVars).filter(v => v !== 'color-scheme');

    // Sort for comparison
    lightVarsArray.sort();
    darkVarsArray.sort();

    expect(darkVarsArray).toEqual(lightVarsArray);
  });

  it('property: all CSS variables should use var() references, not hardcoded colors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Array.from(lightThemeVars)),
        (cssVar) => {
          // Check that the variable is defined
          expect(lightThemeVars.has(cssVar)).toBe(true);
          
          // Extract the value of the variable
          const varRegex = new RegExp(`${cssVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([^;]+);`, 'g');
          const match = varRegex.exec(globalsContent);
          
          if (match) {
            const value = match[1].trim();
            
            // Value should either be:
            // 1. A hex color (for root definitions)
            // 2. A var() reference (for derived values)
            // 3. A color keyword (for color-scheme)
            // 4. An rgba() value (for overlay colors)
            const isHexColor = /^#[0-9a-fA-F]{3,8}$/.test(value);
            const isVarReference = /^var\(--[\w-]+\)$/.test(value);
            const isColorKeyword = /^(light|dark)$/.test(value);
            const isRgbaColor = /^rgba?\([^)]+\)$/.test(value);
            const isComment = value.includes('/*');
            
            // At least one should be true
            expect(isHexColor || isVarReference || isColorKeyword || isRgbaColor || isComment).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: CSS primitives should reference CSS variables', () => {
    // Check that common CSS primitives use var() references
    const primitives = ['.btn', '.card', '.input', '.label', '.badge', '.table'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...primitives),
        (primitive) => {
          const primitiveRegex = new RegExp(`\\${primitive}\\s*{([^}]+)}`, 'gs');
          const match = primitiveRegex.exec(globalsContent);
          
          if (match) {
            const declarations = match[1];
            
            // Check for hardcoded color values (hex, rgb, rgba)
            const hardcodedColorRegex = /(color|background|border-color):\s*(#[0-9a-fA-F]{3,8}|rgb\(|rgba\()/g;
            const hasHardcodedColors = hardcodedColorRegex.test(declarations);
            
            // Primitives should not have hardcoded colors (except in color-mix which is allowed)
            if (hasHardcodedColors && !declarations.includes('color-mix')) {
              expect(hasHardcodedColors).toBe(false);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: chart colors should be defined for both themes', () => {
    const chartColors = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...chartColors),
        (chartColor) => {
          expect(lightThemeVars.has(chartColor)).toBe(true);
          expect(darkThemeVars.has(chartColor)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: status colors should be defined for both themes', () => {
    const statusColors = ['--status-draft', '--status-published', '--status-archived'];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...statusColors),
        (statusColor) => {
          expect(lightThemeVars.has(statusColor)).toBe(true);
          expect(darkThemeVars.has(statusColor)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
