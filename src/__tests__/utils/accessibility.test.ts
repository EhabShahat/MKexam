/**
 * Tests for accessibility test utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getRelativeLuminance,
  getContrastRatio,
  hexToRgb,
  meetsContrastRequirement,
  CONTRAST_RATIOS,
} from './accessibility';

describe('accessibility test utilities', () => {
  describe('hexToRgb', () => {
    it('should convert hex to RGB', () => {
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should handle hex without hash', () => {
      expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('should return null for invalid hex', () => {
      expect(hexToRgb('invalid')).toBeNull();
      expect(hexToRgb('#zzz')).toBeNull();
    });
  });

  describe('getRelativeLuminance', () => {
    it('should calculate luminance for white', () => {
      const luminance = getRelativeLuminance(255, 255, 255);
      expect(luminance).toBeCloseTo(1, 2);
    });

    it('should calculate luminance for black', () => {
      const luminance = getRelativeLuminance(0, 0, 0);
      expect(luminance).toBeCloseTo(0, 2);
    });

    it('should calculate luminance for gray', () => {
      const luminance = getRelativeLuminance(128, 128, 128);
      expect(luminance).toBeGreaterThan(0);
      expect(luminance).toBeLessThan(1);
    });
  });

  describe('getContrastRatio', () => {
    it('should calculate 21:1 for black on white', () => {
      const ratio = getContrastRatio(
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 }
      );
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should calculate 1:1 for same colors', () => {
      const ratio = getContrastRatio(
        { r: 128, g: 128, b: 128 },
        { r: 128, g: 128, b: 128 }
      );
      expect(ratio).toBeCloseTo(1, 1);
    });

    it('should be symmetric', () => {
      const ratio1 = getContrastRatio(
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 }
      );
      const ratio2 = getContrastRatio(
        { r: 255, g: 255, b: 255 },
        { r: 0, g: 0, b: 0 }
      );
      expect(ratio1).toBeCloseTo(ratio2, 2);
    });
  });

  describe('meetsContrastRequirement', () => {
    it('should pass for high contrast ratios', () => {
      expect(meetsContrastRequirement(21, 'normal')).toBe(true);
      expect(meetsContrastRequirement(7, 'normal')).toBe(true);
      expect(meetsContrastRequirement(4.5, 'normal')).toBe(true);
    });

    it('should fail for low contrast ratios', () => {
      expect(meetsContrastRequirement(4.4, 'normal')).toBe(false);
      expect(meetsContrastRequirement(2.9, 'large')).toBe(false);
      expect(meetsContrastRequirement(2.9, 'ui')).toBe(false);
    });

    it('should use correct thresholds', () => {
      expect(meetsContrastRequirement(4.5, 'normal')).toBe(true);
      expect(meetsContrastRequirement(4.4, 'normal')).toBe(false);
      
      expect(meetsContrastRequirement(3.0, 'large')).toBe(true);
      expect(meetsContrastRequirement(2.9, 'large')).toBe(false);
      
      expect(meetsContrastRequirement(3.0, 'ui')).toBe(true);
      expect(meetsContrastRequirement(2.9, 'ui')).toBe(false);
    });
  });

  describe('CONTRAST_RATIOS', () => {
    it('should have correct WCAG AA values', () => {
      expect(CONTRAST_RATIOS.NORMAL_TEXT).toBe(4.5);
      expect(CONTRAST_RATIOS.LARGE_TEXT).toBe(3.0);
      expect(CONTRAST_RATIOS.UI_COMPONENTS).toBe(3.0);
    });
  });
});
