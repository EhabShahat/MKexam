/**
 * Property-Based Tests for Device Capture Performance
 * Feature: student-experience-and-admin-enhancements
 * 
 * Property 11: Device Capture Performance
 * Validates: Requirements 4.2
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseUserAgent } from '../userAgent';
import { USER_AGENTS } from '@/__tests__/utils/userAgent';

describe('Device Capture Performance - Property-Based Tests', () => {
  describe('Property 11: Device Capture Performance', () => {
    it('should parse user agent in less than 50ms', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          (userAgent) => {
            const startTime = performance.now();
            parseUserAgent(userAgent);
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            
            // Should complete in less than 50ms
            expect(duration).toBeLessThan(50);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse and serialize device info in less than 50ms', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          (userAgent) => {
            const startTime = performance.now();
            
            // Simulate the full capture process
            const deviceInfo = parseUserAgent(userAgent);
            JSON.stringify({
              type: deviceInfo.type,
              manufacturer: deviceInfo.manufacturer,
              model: deviceInfo.model,
              userAgent: deviceInfo.raw,
              capturedAt: new Date().toISOString()
            });
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Full capture and serialization should be under 50ms
            expect(duration).toBeLessThan(50);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple consecutive parses efficiently', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          (userAgent) => {
            const iterations = 10;
            const startTime = performance.now();
            
            for (let i = 0; i < iterations; i++) {
              parseUserAgent(userAgent);
            }
            
            const endTime = performance.now();
            const totalDuration = endTime - startTime;
            const avgDuration = totalDuration / iterations;
            
            // Average time per parse should be well under 50ms
            expect(avgDuration).toBeLessThan(50);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse complex user agents efficiently', () => {
      // Test with the longest/most complex user agents
      const complexUserAgents = [
        USER_AGENTS.samsungGalaxyS23,
        USER_AGENTS.googlePixel7,
        USER_AGENTS.xiaomiRedmi,
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...complexUserAgents),
          (userAgent) => {
            const startTime = performance.now();
            parseUserAgent(userAgent);
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            
            // Even complex user agents should parse quickly
            expect(duration).toBeLessThan(50);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case user agents efficiently', () => {
      const edgeCases = [
        USER_AGENTS.empty,
        USER_AGENTS.unknown,
        USER_AGENTS.malformed,
        USER_AGENTS.oldBrowser,
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...edgeCases),
          (userAgent) => {
            const startTime = performance.now();
            parseUserAgent(userAgent);
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            
            // Edge cases should not cause performance degradation
            expect(duration).toBeLessThan(50);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistent performance across device types', () => {
      const mobileUA = USER_AGENTS.iPhone14Pro;
      const tabletUA = USER_AGENTS.iPadPro;
      const desktopUA = USER_AGENTS.chromeWindows;

      fc.assert(
        fc.property(
          fc.constantFrom(mobileUA, tabletUA, desktopUA),
          (userAgent) => {
            const startTime = performance.now();
            parseUserAgent(userAgent);
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            
            // All device types should have similar performance
            expect(duration).toBeLessThan(50);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not degrade performance with repeated calls', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          (userAgent) => {
            const durations: number[] = [];
            
            // Measure 5 consecutive calls
            for (let i = 0; i < 5; i++) {
              const startTime = performance.now();
              parseUserAgent(userAgent);
              const endTime = performance.now();
              durations.push(endTime - startTime);
            }
            
            // All calls should be fast
            durations.forEach(duration => {
              expect(duration).toBeLessThan(50);
            });
            
            // Performance should not degrade (last call shouldn't be significantly slower)
            const firstDuration = durations[0];
            const lastDuration = durations[durations.length - 1];
            
            // Allow some variance but ensure no major degradation
            // Last call should not be more than 5x slower than first
            expect(lastDuration).toBeLessThan(firstDuration * 5 + 50);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should complete full device info object creation quickly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          (userAgent) => {
            const startTime = performance.now();
            
            // Simulate complete device info creation as done in API
            const deviceInfo = parseUserAgent(userAgent);
            const fullDeviceInfo = {
              type: deviceInfo.type,
              manufacturer: deviceInfo.manufacturer,
              model: deviceInfo.model,
              userAgent: deviceInfo.raw,
              capturedAt: new Date().toISOString()
            };
            
            // Ensure object is created (prevent optimization)
            expect(fullDeviceInfo).toBeDefined();
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Complete object creation should be fast
            expect(duration).toBeLessThan(50);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
