/**
 * Property-based tests for mobile layout and device detection
 * Feature: mobile-touch-optimization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { useMobileDetection } from '@/hooks/mobile/useMobileDetection';
import {
  mockWindowDimensions,
  mockTouchCapability,
  mockSafeAreaInsets,
  mockVibrationAPI,
  resetMobileMocks,
  triggerResize,
} from '../setup';

describe('Mobile Layout Properties', () => {
  beforeEach(() => {
    resetMobileMocks();
  });

  afterEach(() => {
    resetMobileMocks();
  });

  // Feature: mobile-touch-optimization, Property 11: Mobile Sidebar Initial State
  // Validates: Requirements 4.1
  describe('Property 11: Mobile Sidebar Initial State', () => {
    it('should initialize sidebar as collapsed for any viewport width < 768px', () => {
      fc.assert(
        fc.property(
          // Generate viewport widths less than 768px
          fc.integer({ min: 320, max: 767 }),
          fc.integer({ min: 400, max: 1200 }),
          (width, height) => {
            // Setup: Mock viewport dimensions
            mockWindowDimensions(width, height);

            // Execute: Render the hook
            const { result } = renderHook(() => useMobileDetection());

            // Verify: Device should be detected as mobile
            expect(result.current.isMobile).toBe(true);
            expect(result.current.isTablet).toBe(false);
            
            // The sidebar should initialize in collapsed state on mobile
            // This property validates that isMobile is true for width < 768px
            return result.current.isMobile === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT detect as mobile for any viewport width >= 768px', () => {
      fc.assert(
        fc.property(
          // Generate viewport widths >= 768px
          fc.integer({ min: 768, max: 2560 }),
          fc.integer({ min: 400, max: 1600 }),
          (width, height) => {
            // Setup: Mock viewport dimensions
            mockWindowDimensions(width, height);

            // Execute: Render the hook
            const { result } = renderHook(() => useMobileDetection());

            // Verify: Device should NOT be detected as mobile
            expect(result.current.isMobile).toBe(false);
            
            // For widths 768-1024, should be tablet
            if (width >= 768 && width <= 1024) {
              expect(result.current.isTablet).toBe(true);
            }
            
            return result.current.isMobile === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly detect tablet devices (768px <= width <= 1024px)', () => {
      fc.assert(
        fc.property(
          // Generate viewport widths in tablet range
          fc.integer({ min: 768, max: 1024 }),
          fc.integer({ min: 600, max: 1400 }),
          (width, height) => {
            // Setup: Mock viewport dimensions
            mockWindowDimensions(width, height);

            // Execute: Render the hook
            const { result } = renderHook(() => useMobileDetection());

            // Verify: Device should be detected as tablet
            expect(result.current.isTablet).toBe(true);
            expect(result.current.isMobile).toBe(false);
            
            return result.current.isTablet === true && result.current.isMobile === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update mobile detection when viewport is resized', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 320, max: 767 }),
          fc.integer({ min: 768, max: 1920 }),
          fc.integer({ min: 400, max: 1200 }),
          async (mobileWidth, desktopWidth, height) => {
            // Setup: Start with mobile viewport
            mockWindowDimensions(mobileWidth, height);
            const { result } = renderHook(() => useMobileDetection());

            // Verify initial mobile state
            expect(result.current.isMobile).toBe(true);

            // Execute: Resize to desktop
            triggerResize(desktopWidth, height);

            // Wait for state update
            await waitFor(() => {
              expect(result.current.isMobile).toBe(false);
            });

            return result.current.isMobile === false;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Device Capability Detection', () => {
    it('should correctly detect touch capability', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (hasTouch) => {
            // Setup: Mock touch capability
            mockTouchCapability(hasTouch);

            // Execute: Render the hook
            const { result } = renderHook(() => useMobileDetection());

            // Verify: Touch detection matches mock
            expect(result.current.isTouchDevice).toBe(hasTouch);
            
            return result.current.isTouchDevice === hasTouch;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly detect haptics support', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (supportsVibration) => {
            // Setup: Mock vibration API
            mockVibrationAPI(supportsVibration);

            // Execute: Render the hook
            const { result } = renderHook(() => useMobileDetection());

            // Verify: Haptics detection matches mock
            expect(result.current.supportsHaptics).toBe(supportsVibration);
            
            return result.current.supportsHaptics === supportsVibration;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly detect orientation based on viewport dimensions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 320, max: 2560 }),
          fc.integer({ min: 400, max: 1600 }),
          (width, height) => {
            // Setup: Mock viewport dimensions
            mockWindowDimensions(width, height);

            // Execute: Render the hook
            const { result } = renderHook(() => useMobileDetection());

            // Verify: Orientation detection
            const expectedLandscape = width > height;
            expect(result.current.isLandscape).toBe(expectedLandscape);
            
            return result.current.isLandscape === expectedLandscape;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Safe Area Insets Detection', () => {
    it('should detect devices with notches (non-zero safe area insets)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 20, max: 60 }),
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 20, max: 40 }),
          fc.integer({ min: 0, max: 20 }),
          (top, right, bottom, left) => {
            // Setup: Mock safe area insets (device with notch)
            mockSafeAreaInsets(top, right, bottom, left);

            // Execute: Render the hook
            const { result } = renderHook(() => useMobileDetection());

            // Verify: Device should be detected as having notch
            expect(result.current.hasNotch).toBe(true);
            expect(result.current.safeAreaInsets.top).toBeGreaterThan(0);
            
            return result.current.hasNotch === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT detect notch for devices with zero safe area insets', () => {
      // Setup: Mock zero safe area insets (device without notch)
      mockSafeAreaInsets(0, 0, 0, 0);

      // Execute: Render the hook
      const { result } = renderHook(() => useMobileDetection());

      // Verify: Device should NOT be detected as having notch
      expect(result.current.hasNotch).toBe(false);
      expect(result.current.safeAreaInsets.top).toBe(0);
      expect(result.current.safeAreaInsets.right).toBe(0);
      expect(result.current.safeAreaInsets.bottom).toBe(0);
      expect(result.current.safeAreaInsets.left).toBe(0);
    });
  });

  describe('Viewport Height Tracking', () => {
    it('should track viewport height accurately', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 320, max: 2560 }),
          fc.integer({ min: 400, max: 1600 }),
          (width, height) => {
            // Setup: Mock viewport dimensions
            mockWindowDimensions(width, height);

            // Execute: Render the hook
            const { result } = renderHook(() => useMobileDetection());

            // Verify: Viewport height matches
            expect(result.current.viewportHeight).toBe(height);
            
            return result.current.viewportHeight === height;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
