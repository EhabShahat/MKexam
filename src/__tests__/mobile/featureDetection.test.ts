/**
 * Tests for feature detection utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  supportsHaptics,
  supportsVisualViewport,
  supportsPassiveEvents,
  supportsSafeAreaInsets,
  prefersReducedMotion,
  getFeatureSupport,
} from '@/lib/mobile/featureDetection';
import {
  mockVibrationAPI,
  mockVisualViewport,
  resetMobileMocks,
} from './setup';

describe('Feature Detection', () => {
  beforeEach(() => {
    resetMobileMocks();
  });

  afterEach(() => {
    resetMobileMocks();
  });

  describe('supportsHaptics', () => {
    it('should return true when vibration API is available', () => {
      mockVibrationAPI(true);
      expect(supportsHaptics()).toBe(true);
    });

    it('should return false when vibration API is not available', () => {
      mockVibrationAPI(false);
      expect(supportsHaptics()).toBe(false);
    });
  });

  describe('supportsVisualViewport', () => {
    it('should return true when Visual Viewport API is available', () => {
      mockVisualViewport(667);
      expect(supportsVisualViewport()).toBe(true);
    });

    it('should return false when Visual Viewport API is not available', () => {
      expect(supportsVisualViewport()).toBe(false);
    });
  });

  describe('supportsPassiveEvents', () => {
    it('should detect passive event listener support', () => {
      // This test depends on the browser environment
      // In jsdom, it should return a boolean
      const result = supportsPassiveEvents();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('supportsSafeAreaInsets', () => {
    it('should detect safe area inset support', () => {
      // This test depends on the browser environment
      const result = supportsSafeAreaInsets();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('prefersReducedMotion', () => {
    it('should detect reduced motion preference', () => {
      // This test depends on the browser environment
      const result = prefersReducedMotion();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getFeatureSupport', () => {
    it('should return complete feature support information', () => {
      const support = getFeatureSupport();
      
      expect(support).toHaveProperty('haptics');
      expect(support).toHaveProperty('visualViewport');
      expect(support).toHaveProperty('passiveEvents');
      expect(support).toHaveProperty('safeAreaInsets');
      expect(support).toHaveProperty('networkInformation');
      expect(support).toHaveProperty('intersectionObserver');
      expect(support).toHaveProperty('resizeObserver');
      expect(support).toHaveProperty('reducedMotion');
      
      expect(typeof support.haptics).toBe('boolean');
      expect(typeof support.visualViewport).toBe('boolean');
      expect(typeof support.passiveEvents).toBe('boolean');
    });
  });
});
