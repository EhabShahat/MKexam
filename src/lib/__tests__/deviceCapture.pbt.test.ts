/**
 * Property-Based Tests for Device Info Capture
 * Feature: student-experience-and-admin-enhancements
 * 
 * Property 6: Device Info Capture Round-Trip
 * Validates: Requirements 2.1, 2.2
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseUserAgent } from '../userAgent';
import { USER_AGENTS, generateRandomUserAgent } from '@/__tests__/utils/userAgent';

describe('Device Info Capture - Property-Based Tests', () => {
  describe('Property 6: Device Info Capture Round-Trip', () => {
    it('should preserve device info through JSON serialization', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          (userAgent) => {
            // Parse the user agent
            const deviceInfo = parseUserAgent(userAgent);
            
            // Simulate what happens in the API route - serialize to JSON
            const serialized = JSON.stringify({
              type: deviceInfo.type,
              manufacturer: deviceInfo.manufacturer,
              model: deviceInfo.model,
              userAgent: deviceInfo.raw,
              capturedAt: new Date().toISOString()
            });
            
            // Simulate retrieval from database - deserialize
            const deserialized = JSON.parse(serialized);
            
            // Verify all fields are preserved
            expect(deserialized.type).toBe(deviceInfo.type);
            expect(deserialized.manufacturer).toBe(deviceInfo.manufacturer);
            expect(deserialized.model).toBe(deviceInfo.model);
            expect(deserialized.userAgent).toBe(deviceInfo.raw);
            expect(deserialized.capturedAt).toBeDefined();
            expect(typeof deserialized.capturedAt).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle all device types in round-trip', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('mobile', 'tablet', 'desktop', 'unknown'),
          (expectedType) => {
            // Find a user agent that matches this type
            const userAgent = Object.values(USER_AGENTS).find(ua => {
              const info = parseUserAgent(ua);
              return info.type === expectedType;
            });
            
            if (!userAgent) return true; // Skip if no matching user agent
            
            const deviceInfo = parseUserAgent(userAgent);
            
            // Serialize and deserialize
            const serialized = JSON.stringify({
              type: deviceInfo.type,
              manufacturer: deviceInfo.manufacturer,
              model: deviceInfo.model,
              userAgent: deviceInfo.raw,
              capturedAt: new Date().toISOString()
            });
            
            const deserialized = JSON.parse(serialized);
            
            // Verify type is preserved
            expect(deserialized.type).toBe(expectedType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve manufacturer information', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          (userAgent) => {
            const deviceInfo = parseUserAgent(userAgent);
            
            const serialized = JSON.stringify({
              type: deviceInfo.type,
              manufacturer: deviceInfo.manufacturer,
              model: deviceInfo.model,
              userAgent: deviceInfo.raw,
              capturedAt: new Date().toISOString()
            });
            
            const deserialized = JSON.parse(serialized);
            
            // Manufacturer should be a non-empty string
            expect(deserialized.manufacturer).toBeDefined();
            expect(typeof deserialized.manufacturer).toBe('string');
            expect(deserialized.manufacturer.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve model information', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          (userAgent) => {
            const deviceInfo = parseUserAgent(userAgent);
            
            const serialized = JSON.stringify({
              type: deviceInfo.type,
              manufacturer: deviceInfo.manufacturer,
              model: deviceInfo.model,
              userAgent: deviceInfo.raw,
              capturedAt: new Date().toISOString()
            });
            
            const deserialized = JSON.parse(serialized);
            
            // Model should be a non-empty string
            expect(deserialized.model).toBeDefined();
            expect(typeof deserialized.model).toBe('string');
            expect(deserialized.model.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve raw user agent string exactly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          (userAgent) => {
            const deviceInfo = parseUserAgent(userAgent);
            
            const serialized = JSON.stringify({
              type: deviceInfo.type,
              manufacturer: deviceInfo.manufacturer,
              model: deviceInfo.model,
              userAgent: deviceInfo.raw,
              capturedAt: new Date().toISOString()
            });
            
            const deserialized = JSON.parse(serialized);
            
            // Raw user agent should match exactly
            expect(deserialized.userAgent).toBe(userAgent);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include valid ISO timestamp', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          (userAgent) => {
            const deviceInfo = parseUserAgent(userAgent);
            
            const capturedAt = new Date().toISOString();
            const serialized = JSON.stringify({
              type: deviceInfo.type,
              manufacturer: deviceInfo.manufacturer,
              model: deviceInfo.model,
              userAgent: deviceInfo.raw,
              capturedAt
            });
            
            const deserialized = JSON.parse(serialized);
            
            // Timestamp should be valid ISO string
            expect(deserialized.capturedAt).toBeDefined();
            const parsedDate = new Date(deserialized.capturedAt);
            expect(parsedDate.toISOString()).toBe(deserialized.capturedAt);
            expect(isNaN(parsedDate.getTime())).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty and unknown user agents', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', 'UnknownBrowser/1.0', 'Mozilla/5.0 ()'),
          (userAgent) => {
            const deviceInfo = parseUserAgent(userAgent);
            
            const serialized = JSON.stringify({
              type: deviceInfo.type,
              manufacturer: deviceInfo.manufacturer,
              model: deviceInfo.model,
              userAgent: deviceInfo.raw,
              capturedAt: new Date().toISOString()
            });
            
            const deserialized = JSON.parse(serialized);
            
            // Should have valid structure even for unknown devices
            expect(deserialized.type).toBeDefined();
            expect(deserialized.manufacturer).toBeDefined();
            expect(deserialized.model).toBeDefined();
            expect(deserialized.userAgent).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain data integrity across multiple serialization cycles', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          (userAgent) => {
            const deviceInfo = parseUserAgent(userAgent);
            
            // First serialization
            const serialized1 = JSON.stringify({
              type: deviceInfo.type,
              manufacturer: deviceInfo.manufacturer,
              model: deviceInfo.model,
              userAgent: deviceInfo.raw,
              capturedAt: new Date().toISOString()
            });
            
            const deserialized1 = JSON.parse(serialized1);
            
            // Second serialization (simulating re-saving)
            const serialized2 = JSON.stringify(deserialized1);
            const deserialized2 = JSON.parse(serialized2);
            
            // Data should be identical after multiple cycles
            expect(deserialized2.type).toBe(deviceInfo.type);
            expect(deserialized2.manufacturer).toBe(deviceInfo.manufacturer);
            expect(deserialized2.model).toBe(deviceInfo.model);
            expect(deserialized2.userAgent).toBe(deviceInfo.raw);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
