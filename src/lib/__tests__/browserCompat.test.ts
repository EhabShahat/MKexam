import { describe, it, expect, vi } from 'vitest';
import {
  isLocalStorageAvailable,
  isSessionStorageAvailable,
  isMatchMediaAvailable,
  getBrowserInfo,
  isCSSCustomPropertiesSupported,
  isPrefersColorSchemeSupported,
} from '../browserCompat';

describe('browserCompat utilities', () => {
  describe('isLocalStorageAvailable', () => {
    it('should return true when localStorage is available', () => {
      expect(isLocalStorageAvailable()).toBe(true);
    });
  });

  describe('isSessionStorageAvailable', () => {
    it('should return true when sessionStorage is available', () => {
      expect(isSessionStorageAvailable()).toBe(true);
    });
  });

  describe('isMatchMediaAvailable', () => {
    it('should return true when matchMedia is available', () => {
      expect(isMatchMediaAvailable()).toBe(true);
    });
  });

  describe('getBrowserInfo', () => {
    it('should detect browser information', () => {
      const info = getBrowserInfo();
      expect(info).toHaveProperty('type');
      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('isSupported');
      expect(['chrome', 'firefox', 'safari', 'edge', 'unknown']).toContain(info.type);
    });

    it('should return valid browser type', () => {
      const info = getBrowserInfo();
      expect(typeof info.type).toBe('string');
      expect(typeof info.version).toBe('string');
      expect(typeof info.isSupported).toBe('boolean');
    });
  });

  describe('isCSSCustomPropertiesSupported', () => {
    it('should return true when CSS custom properties are supported', () => {
      // Mock CSS.supports to return true for CSS custom properties
      Object.defineProperty(window, 'CSS', {
        value: {
          supports: vi.fn().mockImplementation((property: string, value: string) => {
            return property === '--test' && value === '0';
          }),
        },
        writable: true,
      });

      expect(isCSSCustomPropertiesSupported()).toBe(true);
    });

    it('should return false when CSS.supports is not available', () => {
      // Mock CSS to not have supports method
      Object.defineProperty(window, 'CSS', {
        value: {},
        writable: true,
      });

      expect(isCSSCustomPropertiesSupported()).toBe(false);
    });
  });

  describe('isPrefersColorSchemeSupported', () => {
    it('should return true when prefers-color-scheme is supported', () => {
      expect(isPrefersColorSchemeSupported()).toBe(true);
    });
  });
});
