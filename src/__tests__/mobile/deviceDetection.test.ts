/**
 * Tests for device detection utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isMobileDevice,
  isTabletDevice,
  isDesktopDevice,
  hasTouchCapability,
  getOrientation,
  getSafeAreaInsets,
  getDeviceInfo,
} from '@/lib/mobile/deviceDetection';
import {
  mockWindowDimensions,
  mockTouchCapability,
  mockSafeAreaInsets,
  resetMobileMocks,
} from './setup';

describe('Device Detection', () => {
  beforeEach(() => {
    resetMobileMocks();
  });

  afterEach(() => {
    resetMobileMocks();
  });

  describe('isMobileDevice', () => {
    it('should return true for mobile viewport widths', () => {
      mockWindowDimensions(375, 667);
      expect(isMobileDevice()).toBe(true);
    });

    it('should return false for tablet and desktop widths', () => {
      mockWindowDimensions(768, 1024);
      expect(isMobileDevice()).toBe(false);
      
      mockWindowDimensions(1920, 1080);
      expect(isMobileDevice()).toBe(false);
    });

    it('should handle edge case at 768px boundary', () => {
      mockWindowDimensions(767, 1024);
      expect(isMobileDevice()).toBe(true);
      
      mockWindowDimensions(768, 1024);
      expect(isMobileDevice()).toBe(false);
    });
  });

  describe('isTabletDevice', () => {
    it('should return true for tablet viewport widths', () => {
      mockWindowDimensions(768, 1024);
      expect(isTabletDevice()).toBe(true);
      
      mockWindowDimensions(900, 1200);
      expect(isTabletDevice()).toBe(true);
    });

    it('should return false for mobile and desktop widths', () => {
      mockWindowDimensions(375, 667);
      expect(isTabletDevice()).toBe(false);
      
      mockWindowDimensions(1920, 1080);
      expect(isTabletDevice()).toBe(false);
    });
  });

  describe('isDesktopDevice', () => {
    it('should return true for desktop viewport widths', () => {
      mockWindowDimensions(1920, 1080);
      expect(isDesktopDevice()).toBe(true);
    });

    it('should return false for mobile and tablet widths', () => {
      mockWindowDimensions(375, 667);
      expect(isDesktopDevice()).toBe(false);
      
      mockWindowDimensions(768, 1024);
      expect(isDesktopDevice()).toBe(false);
    });
  });

  describe('hasTouchCapability', () => {
    it('should return true when touch is supported', () => {
      mockTouchCapability(true);
      expect(hasTouchCapability()).toBe(true);
    });

    it('should return false when touch is not supported', () => {
      mockTouchCapability(false);
      expect(hasTouchCapability()).toBe(false);
    });
  });

  describe('getOrientation', () => {
    it('should return portrait when height > width', () => {
      mockWindowDimensions(375, 667);
      expect(getOrientation()).toBe('portrait');
    });

    it('should return landscape when width > height', () => {
      mockWindowDimensions(667, 375);
      expect(getOrientation()).toBe('landscape');
    });

    it('should return landscape when height equals width', () => {
      mockWindowDimensions(500, 500);
      expect(getOrientation()).toBe('landscape');
    });
  });

  describe('getSafeAreaInsets', () => {
    it('should return safe area insets when available', () => {
      mockSafeAreaInsets(44, 0, 34, 0);
      const insets = getSafeAreaInsets();
      
      expect(insets.top).toBe(44);
      expect(insets.right).toBe(0);
      expect(insets.bottom).toBe(34);
      expect(insets.left).toBe(0);
    });

    it('should return zero insets when not available', () => {
      const insets = getSafeAreaInsets();
      
      expect(insets.top).toBe(0);
      expect(insets.right).toBe(0);
      expect(insets.bottom).toBe(0);
      expect(insets.left).toBe(0);
    });
  });

  describe('getDeviceInfo', () => {
    it('should return complete device information', () => {
      mockWindowDimensions(375, 667);
      mockTouchCapability(true);
      
      const info = getDeviceInfo();
      
      expect(info.isMobile).toBe(true);
      expect(info.isTablet).toBe(false);
      expect(info.isDesktop).toBe(false);
      expect(info.hasTouch).toBe(true);
      expect(info.orientation).toBe('portrait');
      expect(info.viewportWidth).toBe(375);
      expect(info.viewportHeight).toBe(667);
    });
  });
});
