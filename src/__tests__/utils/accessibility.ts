/**
 * Test utilities for accessibility testing
 * Used for ensuring WCAG AA compliance across features
 */

import { expect } from 'vitest';

/**
 * WCAG AA contrast ratio requirements
 */
export const CONTRAST_RATIOS = {
  NORMAL_TEXT: 4.5, // 4.5:1 for normal text
  LARGE_TEXT: 3.0, // 3:1 for large text (18pt+ or 14pt+ bold)
  UI_COMPONENTS: 3.0, // 3:1 for UI components and graphical objects
} as const;

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 formula
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio as a number (e.g., 4.5 for 4.5:1)
 */
export function getContrastRatio(
  foreground: { r: number; g: number; b: number },
  background: { r: number; g: number; b: number }
): number {
  const l1 = getRelativeLuminance(foreground.r, foreground.g, foreground.b);
  const l2 = getRelativeLuminance(background.r, background.g, background.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
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
 * Check if contrast ratio meets WCAG AA standard
 */
export function meetsContrastRequirement(
  ratio: number,
  requirement: 'normal' | 'large' | 'ui' = 'normal'
): boolean {
  const minRatio =
    requirement === 'normal'
      ? CONTRAST_RATIOS.NORMAL_TEXT
      : requirement === 'large'
      ? CONTRAST_RATIOS.LARGE_TEXT
      : CONTRAST_RATIOS.UI_COMPONENTS;
  return ratio >= minRatio;
}

/**
 * Verify element has accessible name
 */
export function hasAccessibleName(element: HTMLElement): boolean {
  const ariaLabel = element.getAttribute('aria-label');
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  const title = element.getAttribute('title');
  const textContent = element.textContent?.trim();

  return !!(ariaLabel || ariaLabelledBy || title || textContent);
}

/**
 * Verify element has accessible description
 */
export function hasAccessibleDescription(element: HTMLElement): boolean {
  const ariaDescription = element.getAttribute('aria-description');
  const ariaDescribedBy = element.getAttribute('aria-describedby');
  const title = element.getAttribute('title');

  return !!(ariaDescription || ariaDescribedBy || title);
}

/**
 * Check if element is keyboard accessible
 */
export function isKeyboardAccessible(element: HTMLElement): boolean {
  const tabIndex = element.getAttribute('tabindex');
  const isInteractive = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(
    element.tagName
  );

  // Element is keyboard accessible if:
  // 1. It's an interactive element by default
  // 2. It has tabindex >= 0
  return isInteractive || (tabIndex !== null && parseInt(tabIndex) >= 0);
}

/**
 * Check if element has proper ARIA role
 */
export function hasProperRole(element: HTMLElement, expectedRole?: string): boolean {
  const role = element.getAttribute('role');
  
  if (expectedRole) {
    return role === expectedRole;
  }

  // If no expected role, just check that interactive elements have some role
  const isInteractive = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(
    element.tagName
  );
  
  return !isInteractive || role !== null;
}

/**
 * Verify focus indicator is visible
 */
export function hasFocusIndicator(element: HTMLElement): boolean {
  const styles = window.getComputedStyle(element);
  const outline = styles.outline;
  const outlineWidth = styles.outlineWidth;
  const boxShadow = styles.boxShadow;

  // Check if element has visible outline or box-shadow for focus
  return (
    (outline !== 'none' && outlineWidth !== '0px') ||
    (boxShadow !== 'none' && boxShadow !== '')
  );
}

/**
 * Check if images have alt text
 */
export function hasAltText(img: HTMLImageElement): boolean {
  return img.hasAttribute('alt');
}

/**
 * Verify form input has associated label
 */
export function hasAssociatedLabel(input: HTMLInputElement): boolean {
  const id = input.id;
  const ariaLabel = input.getAttribute('aria-label');
  const ariaLabelledBy = input.getAttribute('aria-labelledby');

  if (ariaLabel || ariaLabelledBy) {
    return true;
  }

  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    return label !== null;
  }

  // Check if input is wrapped in a label
  const parentLabel = input.closest('label');
  return parentLabel !== null;
}

/**
 * Check if element is properly hidden from screen readers
 */
export function isProperlyHidden(element: HTMLElement): boolean {
  const ariaHidden = element.getAttribute('aria-hidden');
  const hidden = element.hasAttribute('hidden');
  const display = window.getComputedStyle(element).display;

  return ariaHidden === 'true' || hidden || display === 'none';
}

/**
 * Accessibility test helpers for common patterns
 */
export const a11yHelpers = {
  /**
   * Assert element has accessible name
   */
  expectAccessibleName(element: HTMLElement, name?: string) {
    expect(hasAccessibleName(element)).toBe(true);
    if (name) {
      const actualName =
        element.getAttribute('aria-label') ||
        element.textContent?.trim() ||
        element.getAttribute('title');
      expect(actualName).toContain(name);
    }
  },

  /**
   * Assert element is keyboard accessible
   */
  expectKeyboardAccessible(element: HTMLElement) {
    expect(isKeyboardAccessible(element)).toBe(true);
  },

  /**
   * Assert element has proper role
   */
  expectProperRole(element: HTMLElement, role?: string) {
    expect(hasProperRole(element, role)).toBe(true);
  },

  /**
   * Assert contrast ratio meets WCAG AA
   */
  expectContrastCompliance(
    foreground: string,
    background: string,
    requirement: 'normal' | 'large' | 'ui' = 'normal'
  ) {
    const fg = hexToRgb(foreground);
    const bg = hexToRgb(background);
    
    expect(fg).not.toBeNull();
    expect(bg).not.toBeNull();
    
    if (fg && bg) {
      const ratio = getContrastRatio(fg, bg);
      expect(meetsContrastRequirement(ratio, requirement)).toBe(true);
    }
  },

  /**
   * Assert all images have alt text
   */
  expectAllImagesHaveAlt(container: HTMLElement) {
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(hasAltText(img)).toBe(true);
    });
  },

  /**
   * Assert all inputs have labels
   */
  expectAllInputsHaveLabels(container: HTMLElement) {
    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach((input) => {
      const htmlInput = input as HTMLInputElement;
      expect(
        hasAssociatedLabel(htmlInput),
        `Input missing label: ${htmlInput.id || htmlInput.name || htmlInput.type}`
      ).toBe(true);
    });
  },
};

/**
 * Run basic accessibility checks on rendered component
 */
export function runBasicA11yChecks(container: HTMLElement): void {

  // Check all images have alt text
  const images = container.querySelectorAll('img');
  images.forEach((img) => {
    expect(hasAltText(img), `Image missing alt text: ${img.src}`).toBe(true);
  });

  // Check all inputs have labels
  const inputs = container.querySelectorAll('input, select, textarea');
  inputs.forEach((input) => {
    const htmlInput = input as HTMLInputElement;
    expect(
      hasAssociatedLabel(htmlInput),
      `Input missing label: ${htmlInput.id || htmlInput.name || htmlInput.type}`
    ).toBe(true);
  });

  // Check all buttons have accessible names
  const buttons = container.querySelectorAll('button');
  buttons.forEach((button) => {
    expect(
      hasAccessibleName(button),
      `Button missing accessible name`
    ).toBe(true);
  });

  // Check all links have accessible names
  const links = container.querySelectorAll('a');
  links.forEach((link) => {
    expect(
      hasAccessibleName(link),
      `Link missing accessible name: ${link.href}`
    ).toBe(true);
  });
}

/**
 * Test keyboard navigation through interactive elements
 */
export function testKeyboardNavigation(container: HTMLElement): void {
  const interactiveElements = container.querySelectorAll(
    'button, a, input, select, textarea, [tabindex]'
  );

  interactiveElements.forEach((element) => {
    expect(
      isKeyboardAccessible(element as HTMLElement),
      `Element not keyboard accessible: ${element.tagName}`
    ).toBe(true);
  });
}
