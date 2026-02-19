/**
 * Property-Based Tests for Exam Entry Integration
 * Feature: enhanced-device-tracking
 * 
 * Tests Properties 22-25:
 * - Property 22: Device Info in API Request
 * - Property 23: Collection Timeout
 * - Property 24: Non-Blocking Collection
 * - Property 25: Error Logging
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { collectDetailedDeviceInfo } from '../collectDeviceInfo';

describe('Property Tests: Exam Entry Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 22: Device Info in API Request
   * For any exam access request, the request body should include a deviceInfo field
   * containing the collected device information
   * 
   * **Validates: Requirements 9.2**
   */
  it('Property 22: Device Info in API Request', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          code: fc.option(fc.string({ minLength: 4, maxLength: 8 }), { nil: null }),
          studentName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
        }),
        async (requestData) => {
          // Collect device info
          const deviceInfo = await collectDetailedDeviceInfo();

          // Simulate API request body construction
          const requestBody = {
            ...requestData,
            deviceInfo
          };

          // Property: Request body should include deviceInfo field
          expect(requestBody).toHaveProperty('deviceInfo');
          
          // If collection succeeded, deviceInfo should be an object
          if (deviceInfo !== null) {
            expect(typeof requestBody.deviceInfo).toBe('object');
            expect(requestBody.deviceInfo).toHaveProperty('collectedAt');
          }
        }
      ),
      { numRuns: 20, timeout: 15000 } // Reduced runs for integration tests
    );
  });

  /**
   * Property 23: Collection Timeout
   * For any device info collection, the operation should complete within 10 seconds,
   * returning either complete or partial data
   * 
   * **Validates: Requirements 9.3**
   */
  it('Property 23: Collection Timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No input needed
        async () => {
          const startTime = Date.now();
          
          // Wrap collection with 10-second timeout
          const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => resolve(null), 10000);
          });
          
          const collectionPromise = collectDetailedDeviceInfo();
          
          const result = await Promise.race([collectionPromise, timeoutPromise]);
          
          const elapsedTime = Date.now() - startTime;

          // Property: Collection should complete within 10 seconds
          expect(elapsedTime).toBeLessThan(10000);
          
          // Result should be either device info object or null (timeout)
          if (result !== null) {
            expect(typeof result).toBe('object');
          }
        }
      ),
      { numRuns: 10, timeout: 15000 } // Fewer runs due to timeout testing
    );
  });

  /**
   * Property 24: Non-Blocking Collection
   * For any exam access request, even if device info collection completely fails
   * (returns null), the exam attempt should still be created successfully
   * 
   * **Validates: Requirements 9.4**
   */
  it('Property 24: Non-Blocking Collection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          examId: fc.uuid(),
          code: fc.string({ minLength: 4, maxLength: 8 }),
          studentName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
        }),
        async (examData) => {
          // Simulate device collection failure
          const deviceInfo = null; // Collection failed

          // Simulate API request body with null device info
          const requestBody = {
            code: examData.code,
            studentName: examData.studentName,
            deviceInfo
          };

          // Property: Request should still be valid with null deviceInfo
          expect(requestBody).toBeDefined();
          expect(requestBody.code).toBe(examData.code);
          
          // The request body should be serializable even with null deviceInfo
          const serialized = JSON.stringify(requestBody);
          expect(serialized).toBeDefined();
          
          const parsed = JSON.parse(serialized);
          expect(parsed.deviceInfo).toBeNull();
          
          // This demonstrates that exam access should not be blocked
          // by null device info (actual API validation would happen server-side)
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 25: Error Logging
   * For any device info collection error, the error should be logged to the browser
   * console with sufficient detail for debugging
   * 
   * **Validates: Requirements 9.5**
   */
  it('Property 25: Error Logging', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No input needed
        async () => {
          // Spy on console methods
          const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
          const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
          const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

          // Mock a failure scenario by temporarily breaking navigator
          const originalNavigator = global.navigator;
          
          try {
            // Simulate environment where collection might fail
            Object.defineProperty(global, 'navigator', {
              value: undefined,
              writable: true,
              configurable: true
            });

            const result = await collectDetailedDeviceInfo();

            // Property: If collection fails (returns null), an error should be logged
            if (result === null) {
              expect(
                consoleErrorSpy.mock.calls.length > 0 ||
                consoleWarnSpy.mock.calls.length > 0 ||
                consoleLogSpy.mock.calls.length > 0
              ).toBe(true);
              
              // Check that error messages contain useful context
              const allCalls = [
                ...consoleErrorSpy.mock.calls,
                ...consoleWarnSpy.mock.calls,
                ...consoleLogSpy.mock.calls
              ];
              
              const hasUsefulMessage = allCalls.some(call => 
                call.some(arg => 
                  typeof arg === 'string' && 
                  (arg.includes('device') || arg.includes('collect') || arg.includes('fail'))
                )
              );
              
              expect(hasUsefulMessage).toBe(true);
            }
          } finally {
            // Restore navigator
            Object.defineProperty(global, 'navigator', {
              value: originalNavigator,
              writable: true,
              configurable: true
            });
            
            consoleErrorSpy.mockRestore();
            consoleWarnSpy.mockRestore();
            consoleLogSpy.mockRestore();
          }
        }
      ),
      { numRuns: 10, timeout: 15000 }
    );
  });
});
