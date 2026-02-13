/**
 * Property-based tests for user agent parsing
 * Feature: student-experience-and-admin-enhancements
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseUserAgent, formatDeviceInfo, getDeviceIdentifier } from '../userAgent';
import { USER_AGENTS } from '@/__tests__/utils/userAgent';

describe('User Agent Parsing - Property-Based Tests', () => {
  describe('Property 7: User Agent Parsing Completeness', () => {
    it('should always return a DeviceInfo object with all required fields', () => {
      // Feature: student-experience-and-admin-enhancements, Property 7: User Agent Parsing Completeness
      fc.assert(
        fc.property(
          fc.string(),
          (userAgent) => {
            const result = parseUserAgent(userAgent);

            // All fields must be present
            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('manufacturer');
            expect(result).toHaveProperty('model');
            expect(result).toHaveProperty('raw');

            // Type must be one of the valid values
            expect(['mobile', 'tablet', 'desktop', 'unknown']).toContain(result.type);

            // All string fields must be non-null strings
            expect(typeof result.manufacturer).toBe('string');
            expect(typeof result.model).toBe('string');
            expect(typeof result.raw).toBe('string');

            // Manufacturer and model should never be empty strings
            expect(result.manufacturer.length).toBeGreaterThan(0);
            expect(result.model.length).toBeGreaterThan(0);

            // Raw should match the input
            expect(result.raw).toBe(userAgent);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty and whitespace-only user agents gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t\n'),
            fc.constant(null as any),
            fc.constant(undefined as any)
          ),
          (userAgent) => {
            const result = parseUserAgent(userAgent);

            expect(result.type).toBe('unknown');
            expect(result.manufacturer).toBe('Unknown');
            expect(result.model).toBe('Unknown');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve the raw user agent string', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          (userAgent) => {
            const result = parseUserAgent(userAgent);
            expect(result.raw).toBe(userAgent);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify known mobile devices', () => {
      const mobileUserAgents = [
        USER_AGENTS.iPhone14Pro,
        USER_AGENTS.iPhone13,
        USER_AGENTS.iPhoneSE,
        USER_AGENTS.samsungGalaxyS23,
        USER_AGENTS.samsungGalaxyS22,
        USER_AGENTS.googlePixel7,
        USER_AGENTS.googlePixel6,
        USER_AGENTS.xiaomiRedmi,
        USER_AGENTS.onePlus9,
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...mobileUserAgents),
          (userAgent) => {
            const result = parseUserAgent(userAgent);
            expect(result.type).toBe('mobile');
            expect(result.manufacturer).not.toBe('Unknown');
            expect(result.model).not.toBe('Unknown');
          }
        ),
        { numRuns: mobileUserAgents.length * 5 }
      );
    });

    it('should correctly identify known tablet devices', () => {
      const tabletUserAgents = [
        USER_AGENTS.iPadPro,
        USER_AGENTS.iPadAir,
        USER_AGENTS.samsungTab,
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...tabletUserAgents),
          (userAgent) => {
            const result = parseUserAgent(userAgent);
            expect(result.type).toBe('tablet');
            expect(result.manufacturer).not.toBe('Unknown');
            expect(result.model).not.toBe('Unknown');
          }
        ),
        { numRuns: tabletUserAgents.length * 10 }
      );
    });

    it('should correctly identify known desktop browsers', () => {
      const desktopUserAgents = [
        USER_AGENTS.chromeWindows,
        USER_AGENTS.chromeMac,
        USER_AGENTS.firefoxWindows,
        USER_AGENTS.firefoxMac,
        USER_AGENTS.safariMac,
        USER_AGENTS.edgeWindows,
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...desktopUserAgents),
          (userAgent) => {
            const result = parseUserAgent(userAgent);
            expect(result.type).toBe('desktop');
            expect(result.manufacturer).not.toBe('Unknown');
            expect(result.model).not.toBe('Unknown');
          }
        ),
        { numRuns: desktopUserAgents.length * 5 }
      );
    });

    it('should handle malformed user agents without throwing errors', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('Mozilla/5.0 ()'),
            fc.constant('Invalid'),
            fc.constant('123456'),
            fc.constant('!@#$%^&*()'),
            fc.string({ maxLength: 10 })
          ),
          (userAgent) => {
            expect(() => parseUserAgent(userAgent)).not.toThrow();
            const result = parseUserAgent(userAgent);
            expect(result).toBeDefined();
            expect(result.type).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Device Info Formatting', () => {
    it('should format device info consistently', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (userAgent) => {
            const deviceInfo = parseUserAgent(userAgent);
            const formatted = formatDeviceInfo(deviceInfo);

            expect(typeof formatted).toBe('string');
            expect(formatted.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include usage count when provided and greater than 1', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          fc.integer({ min: 2, max: 100 }),
          (userAgent, count) => {
            const deviceInfo = parseUserAgent(userAgent);
            const formatted = formatDeviceInfo(deviceInfo, count);

            expect(formatted).toContain(`(${count})`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include usage count when 1 or undefined', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          fc.oneof(fc.constant(1), fc.constant(undefined)),
          (userAgent, count) => {
            const deviceInfo = parseUserAgent(userAgent);
            const formatted = formatDeviceInfo(deviceInfo, count);

            expect(formatted).not.toMatch(/\(\d+\)/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Device Identifier Generation', () => {
    it('should generate consistent identifiers for the same device', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (userAgent) => {
            const deviceInfo1 = parseUserAgent(userAgent);
            const deviceInfo2 = parseUserAgent(userAgent);

            const id1 = getDeviceIdentifier(deviceInfo1);
            const id2 = getDeviceIdentifier(deviceInfo2);

            expect(id1).toBe(id2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique identifiers for different devices', () => {
      const uniqueDevices = [
        USER_AGENTS.iPhone14Pro,
        USER_AGENTS.samsungGalaxyS23,
        USER_AGENTS.googlePixel7,
        USER_AGENTS.iPadPro,
        USER_AGENTS.chromeWindows,
      ];

      const identifiers = uniqueDevices.map(ua => {
        const deviceInfo = parseUserAgent(ua);
        return getDeviceIdentifier(deviceInfo);
      });

      // All identifiers should be unique
      const uniqueIds = new Set(identifiers);
      expect(uniqueIds.size).toBe(identifiers.length);
    });

    it('should always return a non-empty string identifier', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (userAgent) => {
            const deviceInfo = parseUserAgent(userAgent);
            const identifier = getDeviceIdentifier(deviceInfo);

            expect(typeof identifier).toBe('string');
            expect(identifier.length).toBeGreaterThan(0);
            expect(identifier).toContain(':');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
