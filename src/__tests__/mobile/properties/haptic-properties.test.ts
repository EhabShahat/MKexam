/**
 * Property-based tests for haptic feedback system
 * Feature: mobile-touch-optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { HapticsController, HapticPattern } from '@/lib/mobile/HapticsController';
import { mockVibrationAPI, resetMobileMocks } from '../setup';

describe('Haptic Feedback Properties', () => {
  beforeEach(() => {
    resetMobileMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetMobileMocks();
  });

  // Feature: mobile-touch-optimization, Property 17: Haptic Feedback Patterns
  // Validates: Requirements 5.5, 9.1, 9.2, 9.3, 9.4
  describe('Property 17: Haptic Feedback Patterns', () => {
    const hapticPatterns: HapticPattern[] = ['light', 'medium', 'heavy', 'success', 'error', 'warning'];

    it('should trigger all haptic patterns when supported and enabled', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...hapticPatterns),
          (pattern) => {
            // Setup: Mock vibration API as supported
            const vibrateMock = vi.fn(() => true);
            Object.defineProperty(navigator, 'vibrate', {
              writable: true,
              configurable: true,
              value: vibrateMock,
            });

            // Execute: Create controller and trigger pattern
            const controller = new HapticsController({ enabled: true });
            const result = controller.trigger(pattern);

            // Verify: Pattern was triggered successfully
            expect(result).toBe(true);
            expect(vibrateMock).toHaveBeenCalled();
            expect(controller.isHapticsSupported()).toBe(true);
            expect(controller.isEnabled()).toBe(true);

            return result === true && vibrateMock.mock.calls.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply intensity scaling to all patterns', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...hapticPatterns),
          fc.double({ min: 0, max: 1, noNaN: true }),
          (pattern, intensity) => {
            // Setup: Mock vibration API
            const vibrateMock = vi.fn(() => true);
            Object.defineProperty(navigator, 'vibrate', {
              writable: true,
              configurable: true,
              value: vibrateMock,
            });

            // Execute: Create controller with intensity and trigger pattern
            const controller = new HapticsController({ enabled: true, intensity });
            controller.trigger(pattern);

            // Verify: Vibrate was called with scaled pattern
            expect(vibrateMock).toHaveBeenCalled();
            const calledPattern = vibrateMock.mock.calls[0][0];
            
            // All durations should be arrays of numbers
            expect(Array.isArray(calledPattern)).toBe(true);
            calledPattern.forEach((duration: number) => {
              expect(typeof duration).toBe('number');
              expect(duration).toBeGreaterThanOrEqual(0);
            });

            return vibrateMock.mock.calls.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect different vibration durations for different patterns', () => {
      // Setup: Mock vibration API
      const vibrateMock = vi.fn(() => true);
      Object.defineProperty(navigator, 'vibrate', {
        writable: true,
        configurable: true,
        value: vibrateMock,
      });

      const controller = new HapticsController({ enabled: true, intensity: 1.0 });

      // Execute: Trigger different patterns
      const patterns: HapticPattern[] = ['light', 'medium', 'heavy'];
      const calledPatterns: number[][] = [];

      patterns.forEach(pattern => {
        vibrateMock.mockClear();
        controller.trigger(pattern);
        if (vibrateMock.mock.calls.length > 0) {
          calledPatterns.push(vibrateMock.mock.calls[0][0]);
        }
      });

      // Verify: Light should have shortest duration, heavy should have longest
      expect(calledPatterns.length).toBe(3);
      const [lightPattern, mediumPattern, heavyPattern] = calledPatterns;
      
      // Compare total durations
      const lightDuration = lightPattern.reduce((sum, val) => sum + val, 0);
      const mediumDuration = mediumPattern.reduce((sum, val) => sum + val, 0);
      const heavyDuration = heavyPattern.reduce((sum, val) => sum + val, 0);

      expect(lightDuration).toBeLessThan(mediumDuration);
      expect(mediumDuration).toBeLessThan(heavyDuration);
    });

    it('should trigger complex patterns for success, error, and warning', () => {
      // Setup: Mock vibration API
      const vibrateMock = vi.fn(() => true);
      Object.defineProperty(navigator, 'vibrate', {
        writable: true,
        configurable: true,
        value: vibrateMock,
      });

      const controller = new HapticsController({ enabled: true, intensity: 1.0 });

      // Execute: Trigger complex patterns
      const complexPatterns: HapticPattern[] = ['success', 'error', 'warning'];
      
      complexPatterns.forEach(pattern => {
        vibrateMock.mockClear();
        controller.trigger(pattern);

        // Verify: Complex patterns should have multiple vibrations (array length > 1)
        expect(vibrateMock).toHaveBeenCalled();
        const calledPattern = vibrateMock.mock.calls[0][0];
        expect(Array.isArray(calledPattern)).toBe(true);
        expect(calledPattern.length).toBeGreaterThan(1);
      });
    });
  });

  // Feature: mobile-touch-optimization, Property 27: Haptic Feedback Graceful Degradation
  // Validates: Requirements 9.6
  describe('Property 27: Haptic Feedback Graceful Degradation', () => {
    it('should gracefully degrade when vibration API is not supported', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...['light', 'medium', 'heavy', 'success', 'error', 'warning'] as HapticPattern[]),
          (pattern) => {
            // Setup: Remove vibration API support
            // @ts-ignore - deleting property for test
            delete navigator.vibrate;

            // Execute: Create controller and trigger pattern
            const controller = new HapticsController({ enabled: true });
            const result = controller.trigger(pattern);

            // Verify: Should return false but not throw error
            expect(result).toBe(false);
            expect(controller.isHapticsSupported()).toBe(false);
            
            // Controller should still be functional
            expect(controller.isEnabled()).toBe(true);
            expect(() => controller.trigger(pattern)).not.toThrow();

            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not trigger haptics when disabled, regardless of support', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...['light', 'medium', 'heavy', 'success', 'error', 'warning'] as HapticPattern[]),
          fc.boolean(),
          (pattern, isSupported) => {
            // Setup: Mock vibration API based on support flag
            if (isSupported) {
              const vibrateMock = vi.fn(() => true);
              Object.defineProperty(navigator, 'vibrate', {
                writable: true,
                configurable: true,
                value: vibrateMock,
              });
            } else {
              // @ts-ignore - deleting property for test
              delete navigator.vibrate;
            }

            // Execute: Create controller with disabled haptics
            const controller = new HapticsController({ enabled: false });
            const result = controller.trigger(pattern);

            // Verify: Should return false and not trigger vibration
            expect(result).toBe(false);
            expect(controller.isEnabled()).toBe(false);

            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle enable/disable state changes gracefully', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...['light', 'medium', 'heavy', 'success', 'error', 'warning'] as HapticPattern[]),
          (pattern) => {
            // Setup: Mock vibration API
            const vibrateMock = vi.fn(() => true);
            Object.defineProperty(navigator, 'vibrate', {
              writable: true,
              configurable: true,
              value: vibrateMock,
            });

            // Execute: Create controller and toggle enabled state
            const controller = new HapticsController({ enabled: true });
            
            // Trigger when enabled
            vibrateMock.mockClear();
            const resultEnabled = controller.trigger(pattern);
            const callsWhenEnabled = vibrateMock.mock.calls.length;

            // Disable and trigger
            controller.disable();
            vibrateMock.mockClear();
            const resultDisabled = controller.trigger(pattern);
            const callsWhenDisabled = vibrateMock.mock.calls.length;

            // Re-enable and trigger
            controller.enable();
            vibrateMock.mockClear();
            const resultReEnabled = controller.trigger(pattern);
            const callsWhenReEnabled = vibrateMock.mock.calls.length;

            // Verify: State changes are respected
            expect(resultEnabled).toBe(true);
            expect(callsWhenEnabled).toBeGreaterThan(0);
            
            expect(resultDisabled).toBe(false);
            expect(callsWhenDisabled).toBe(0);
            
            expect(resultReEnabled).toBe(true);
            expect(callsWhenReEnabled).toBeGreaterThan(0);

            return resultEnabled && !resultDisabled && resultReEnabled;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle vibration API errors gracefully', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...['light', 'medium', 'heavy', 'success', 'error', 'warning'] as HapticPattern[]),
          (pattern) => {
            // Setup: Mock vibration API that throws error
            Object.defineProperty(navigator, 'vibrate', {
              writable: true,
              configurable: true,
              value: vi.fn(() => {
                throw new Error('Vibration API error');
              }),
            });

            // Execute: Create controller and trigger pattern
            const controller = new HapticsController({ enabled: true });
            
            // Verify: Should not throw error, should return false
            let result: boolean = false;
            expect(() => {
              result = controller.trigger(pattern);
            }).not.toThrow();
            
            expect(result).toBe(false);

            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clamp intensity values to valid range [0, 1]', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -10, max: 10, noNaN: true }),
          (intensity) => {
            // Setup: Mock vibration API
            mockVibrationAPI(true);

            // Execute: Create controller with any intensity value
            const controller = new HapticsController({ intensity });

            // Verify: Intensity should be clamped to [0, 1]
            const actualIntensity = controller.getIntensity();
            expect(actualIntensity).toBeGreaterThanOrEqual(0);
            expect(actualIntensity).toBeLessThanOrEqual(1);

            // Test setIntensity as well
            controller.setIntensity(intensity);
            const newIntensity = controller.getIntensity();
            expect(newIntensity).toBeGreaterThanOrEqual(0);
            expect(newIntensity).toBeLessThanOrEqual(1);

            return actualIntensity >= 0 && actualIntensity <= 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain configuration state across operations', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.double({ min: 0, max: 1, noNaN: true }),
          (enabled, intensity) => {
            // Setup: Mock vibration API
            mockVibrationAPI(true);

            // Execute: Create controller with config
            const controller = new HapticsController({ enabled, intensity });

            // Verify: Configuration is maintained
            const config = controller.getConfig();
            expect(config.enabled).toBe(enabled);
            expect(config.intensity).toBeCloseTo(intensity, 5);

            // Update config
            const newEnabled = !enabled;
            const newIntensity = 1 - intensity;
            controller.updateConfig({ enabled: newEnabled, intensity: newIntensity });

            // Verify: Configuration is updated
            const updatedConfig = controller.getConfig();
            expect(updatedConfig.enabled).toBe(newEnabled);
            expect(updatedConfig.intensity).toBeCloseTo(newIntensity, 5);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support cancel operation without errors', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (isSupported) => {
            // Setup: Mock vibration API based on support
            if (isSupported) {
              const vibrateMock = vi.fn(() => true);
              Object.defineProperty(navigator, 'vibrate', {
                writable: true,
                configurable: true,
                value: vibrateMock,
              });
            } else {
              // @ts-ignore - deleting property for test
              delete navigator.vibrate;
            }

            // Execute: Create controller and cancel
            const controller = new HapticsController({ enabled: true });
            
            // Verify: Cancel should not throw error
            expect(() => controller.cancel()).not.toThrow();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Configuration Management', () => {
    it('should preserve configuration immutability', () => {
      // Setup: Mock vibration API
      mockVibrationAPI(true);

      // Execute: Create controller
      const controller = new HapticsController({ enabled: true, intensity: 0.8 });
      const config1 = controller.getConfig();
      
      // Mutate returned config
      config1.enabled = false;
      config1.intensity = 0.2;

      // Verify: Original config should not be affected
      const config2 = controller.getConfig();
      expect(config2.enabled).toBe(true);
      expect(config2.intensity).toBeCloseTo(0.8, 5);
    });

    it('should support test method for quick verification', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (isSupported) => {
            // Setup: Mock vibration API
            if (isSupported) {
              const vibrateMock = vi.fn(() => true);
              Object.defineProperty(navigator, 'vibrate', {
                writable: true,
                configurable: true,
                value: vibrateMock,
              });
            } else {
              // @ts-ignore - deleting property for test
              delete navigator.vibrate;
            }

            // Execute: Create controller and test
            const controller = new HapticsController({ enabled: true });
            const result = controller.test();

            // Verify: Test result matches support status
            expect(result).toBe(isSupported);

            return result === isSupported;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
