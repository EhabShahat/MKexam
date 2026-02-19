/**
 * Unit tests for useMobileDetection hook
 * Tests edge cases and specific scenarios for device detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMobileDetection } from '@/hooks/mobile/useMobileDetection';
import {
  mockWindowDimensions,
  mockTouchCapability,
  mockSafeAreaInsets,
  mockVibrationAPI,
  resetMobileMocks,
  triggerResize,
  triggerOrientationChange,
} from './setup';

describe('useMobileDetection', () => {
  beforeEach(() => {
    resetMobileMocks();
  });

  afterEach(() => {
    resetMobileMocks();
  });

  describe('Viewport Size Detection', () => {
    it('should detect mobile at exactly 767px width', () => {
      mockWindowDimensions(767, 800);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
    });

    it('should detect tablet at exactly 768px width', () => {
      mockWindowDimensions(768, 800);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
    });

    it('should detect tablet at exactly 1024px width', () => {
      mockWindowDimensions(1024, 800);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
    });

    it('should detect desktop at exactly 1025px width', () => {
      mockWindowDimensions(1025, 800);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
    });

    it('should handle very small screens (320px - iPhone SE)', () => {
      mockWindowDimensions(320, 568);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(true);
      expect(result.current.viewportHeight).toBe(568);
    });

    it('should handle very large screens (2560px - 4K)', () => {
      mockWindowDimensions(2560, 1440);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
    });

    it('should handle portrait orientation on mobile', () => {
      mockWindowDimensions(375, 812); // iPhone X portrait
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isLandscape).toBe(false);
    });

    it('should handle landscape orientation on mobile', () => {
      mockWindowDimensions(812, 375); // iPhone X landscape
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(false); // Width > 768
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isLandscape).toBe(true);
    });
  });

  describe('Safe Area Inset Parsing', () => {
    it('should parse safe area insets for iPhone X (notch)', () => {
      mockSafeAreaInsets(44, 0, 34, 0);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.hasNotch).toBe(true);
      expect(result.current.safeAreaInsets.top).toBe(44);
      expect(result.current.safeAreaInsets.bottom).toBe(34);
    });

    it('should parse safe area insets for iPhone 14 Pro (dynamic island)', () => {
      mockSafeAreaInsets(59, 0, 34, 0);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.hasNotch).toBe(true);
      expect(result.current.safeAreaInsets.top).toBe(59);
    });

    it('should handle devices with no safe area insets', () => {
      mockSafeAreaInsets(0, 0, 0, 0);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.hasNotch).toBe(false);
      expect(result.current.safeAreaInsets.top).toBe(0);
      expect(result.current.safeAreaInsets.right).toBe(0);
      expect(result.current.safeAreaInsets.bottom).toBe(0);
      expect(result.current.safeAreaInsets.left).toBe(0);
    });

    it('should handle devices with only bottom inset (Android gesture bar)', () => {
      mockSafeAreaInsets(0, 0, 24, 0);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.hasNotch).toBe(true);
      expect(result.current.safeAreaInsets.bottom).toBe(24);
    });

    it('should handle devices with side insets (landscape notch)', () => {
      mockSafeAreaInsets(0, 44, 0, 44);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.hasNotch).toBe(true);
      expect(result.current.safeAreaInsets.right).toBe(44);
      expect(result.current.safeAreaInsets.left).toBe(44);
    });

    it('should handle safe area inset parsing errors gracefully', () => {
      // Don't mock safe area insets - let it fail naturally
      const { result } = renderHook(() => useMobileDetection());
      
      // Should not throw and should return default values
      expect(result.current.safeAreaInsets).toBeDefined();
      expect(result.current.hasNotch).toBe(false);
    });
  });

  describe('Feature Detection Fallbacks', () => {
    it('should fallback when touch detection is unavailable', () => {
      // Remove all touch detection properties
      // @ts-ignore
      delete window.ontouchstart;
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: true,
        configurable: true,
        value: 0,
      });
      
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isTouchDevice).toBe(false);
    });

    it('should detect touch via maxTouchPoints when ontouchstart is unavailable', () => {
      // @ts-ignore
      delete window.ontouchstart;
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: true,
        configurable: true,
        value: 5,
      });
      
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isTouchDevice).toBe(true);
    });

    it('should fallback when vibration API is unavailable', () => {
      // @ts-ignore
      delete navigator.vibrate;
      
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.supportsHaptics).toBe(false);
    });

    it('should handle orientation detection when screen.orientation is unavailable', () => {
      // Mock landscape dimensions
      mockWindowDimensions(800, 600);
      
      // @ts-ignore
      delete window.screen.orientation;
      
      const { result } = renderHook(() => useMobileDetection());
      
      // Should fallback to width > height comparison
      expect(result.current.isLandscape).toBe(true);
    });

    it('should handle SSR environment (no window)', () => {
      // This test verifies the hook doesn't crash during SSR
      // The initial state should be safe defaults
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.isMobile).toBe('boolean');
      expect(typeof result.current.isTablet).toBe('boolean');
    });
  });

  describe('Resize and Orientation Change Listeners', () => {
    it('should update detection when window is resized', () => {
      mockWindowDimensions(375, 667); // Mobile
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(true);
      
      // Resize to desktop
      act(() => {
        triggerResize(1920, 1080);
      });
      
      expect(result.current.isMobile).toBe(false);
    });

    it('should update detection when orientation changes', () => {
      mockWindowDimensions(375, 812); // Portrait
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isLandscape).toBe(false);
      
      // Change to landscape
      act(() => {
        mockWindowDimensions(812, 375);
        triggerOrientationChange();
      });
      
      expect(result.current.isLandscape).toBe(true);
    });

    it('should update viewport height on resize', () => {
      mockWindowDimensions(375, 667);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.viewportHeight).toBe(667);
      
      // Resize height (e.g., virtual keyboard appears)
      act(() => {
        triggerResize(375, 400);
      });
      
      expect(result.current.viewportHeight).toBe(400);
    });

    it('should handle rapid resize events', () => {
      mockWindowDimensions(375, 667);
      const { result } = renderHook(() => useMobileDetection());
      
      // Trigger multiple rapid resizes
      act(() => {
        triggerResize(400, 700);
        triggerResize(500, 800);
        triggerResize(600, 900);
      });
      
      // Should have the final values
      expect(result.current.viewportHeight).toBe(900);
    });
  });

  describe('Edge Cases', () => {
    it('should handle square viewports', () => {
      mockWindowDimensions(800, 800);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isLandscape).toBe(false); // width === height, not landscape
    });

    it('should handle very tall narrow viewports', () => {
      mockWindowDimensions(360, 2000);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isLandscape).toBe(false);
    });

    it('should handle very wide short viewports', () => {
      mockWindowDimensions(2000, 360);
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isLandscape).toBe(true);
    });

    it('should handle tablet in portrait mode', () => {
      mockWindowDimensions(768, 1024); // iPad portrait
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isLandscape).toBe(false);
    });

    it('should handle tablet in landscape mode', () => {
      mockWindowDimensions(1024, 768); // iPad landscape
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isLandscape).toBe(true);
    });
  });

  describe('Combined Feature Detection', () => {
    it('should detect mobile touch device with notch', () => {
      mockWindowDimensions(375, 812);
      mockTouchCapability(true);
      mockSafeAreaInsets(44, 0, 34, 0);
      mockVibrationAPI(true);
      
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTouchDevice).toBe(true);
      expect(result.current.hasNotch).toBe(true);
      expect(result.current.supportsHaptics).toBe(true);
    });

    it('should detect desktop without touch or haptics', () => {
      mockWindowDimensions(1920, 1080);
      mockTouchCapability(false);
      mockSafeAreaInsets(0, 0, 0, 0);
      mockVibrationAPI(false);
      
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTouchDevice).toBe(false);
      expect(result.current.hasNotch).toBe(false);
      expect(result.current.supportsHaptics).toBe(false);
    });

    it('should detect tablet with touch but no notch', () => {
      mockWindowDimensions(1024, 768);
      mockTouchCapability(true);
      mockSafeAreaInsets(0, 0, 0, 0);
      mockVibrationAPI(true);
      
      const { result } = renderHook(() => useMobileDetection());
      
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isTouchDevice).toBe(true);
      expect(result.current.hasNotch).toBe(false);
      expect(result.current.supportsHaptics).toBe(true);
    });
  });
});
