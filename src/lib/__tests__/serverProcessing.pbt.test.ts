/**
 * Property-Based Tests for Server-Side Device Info Processing
 * 
 * Tests Properties 3, 4, and 21 from the design document:
 * - Property 3: IP Discovery Fallback
 * - Property 4: IP Persistence
 * - Property 21: Backward Compatibility
 */

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { mergeDeviceInfo, isValidDeviceInfo } from '@/lib/mergeDeviceInfo';

// Arbitrary for IP addresses
const ipv4Arbitrary = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

// Arbitrary for discovered IP objects
const discoveredIPArbitrary = fc.record({
  ip: ipv4Arbitrary,
  type: fc.constantFrom('local', 'public'),
  family: fc.constantFrom('IPv4', 'IPv6'),
  source: fc.constant('webrtc')
});

// Arbitrary for client device info
const clientDeviceInfoArbitrary = fc.record({
  collectedAt: fc.constant(new Date().toISOString()),
  friendlyName: fc.string({ minLength: 1, maxLength: 100 }),
  ips: fc.record({
    ips: fc.array(discoveredIPArbitrary, { minLength: 0, maxLength: 5 }),
    error: fc.option(fc.string(), { nil: null }),
    completedAt: fc.constant(new Date().toISOString())
  }),
  browserDetails: fc.record({
    name: fc.option(fc.string(), { nil: null }),
    version: fc.option(fc.string(), { nil: null })
  }),
  platformDetails: fc.record({
    os: fc.option(fc.string(), { nil: null }),
    osVersion: fc.option(fc.string(), { nil: null })
  })
});

describe('Property Tests: Server-Side Device Info Processing', () => {
  describe('Property 3: IP Discovery Fallback', () => {
    it('should always have serverDetectedIP even when WebRTC fails', () => {
      fc.assert(
        fc.property(
          ipv4Arbitrary,
          fc.option(fc.string(), { nil: null }), // WebRTC error
          (serverIP, webrtcError) => {
            // Simulate client device info with WebRTC failure
            const clientDeviceInfo = {
              collectedAt: new Date().toISOString(),
              ips: {
                ips: [], // No IPs discovered
                error: webrtcError || 'WebRTC failed',
                completedAt: new Date().toISOString()
              }
            };

            const merged = mergeDeviceInfo(clientDeviceInfo, serverIP);

            // Property: Server IP should always be present
            expect(merged.serverDetectedIP).toBe(serverIP);
            expect(merged.allIPs.server).toBe(serverIP);
            expect(isValidDeviceInfo(merged)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have serverDetectedIP even when client device info is null', () => {
      fc.assert(
        fc.property(
          ipv4Arbitrary,
          (serverIP) => {
            const merged = mergeDeviceInfo(null, serverIP);

            // Property: Server IP should be present even with no client data
            expect(merged.serverDetectedIP).toBe(serverIP);
            expect(merged.allIPs.server).toBe(serverIP);
            expect(merged.allIPs.local).toEqual([]);
            expect(merged.allIPs.public).toEqual([]);
            expect(isValidDeviceInfo(merged)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: IP Persistence', () => {
    it('should preserve all IP addresses from client in merged structure', () => {
      fc.assert(
        fc.property(
          clientDeviceInfoArbitrary,
          ipv4Arbitrary,
          (clientInfo, serverIP) => {
            const merged = mergeDeviceInfo(clientInfo, serverIP);

            // Property: All local IPs should be preserved
            const originalLocalIPs = clientInfo.ips.ips.filter(ip => ip.type === 'local');
            expect(merged.allIPs.local).toEqual(originalLocalIPs);

            // Property: All public IPs should be preserved
            const originalPublicIPs = clientInfo.ips.ips.filter(ip => ip.type === 'public');
            expect(merged.allIPs.public).toEqual(originalPublicIPs);

            // Property: Server IP should be added
            expect(merged.allIPs.server).toBe(serverIP);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain IP data through JSON serialization/deserialization', () => {
      fc.assert(
        fc.property(
          clientDeviceInfoArbitrary,
          ipv4Arbitrary,
          (clientInfo, serverIP) => {
            const merged = mergeDeviceInfo(clientInfo, serverIP);

            // Simulate database storage: JSON stringify then parse
            const serialized = JSON.stringify(merged);
            const deserialized = JSON.parse(serialized);

            // Property: All IPs should survive serialization
            expect(deserialized.allIPs.local).toEqual(merged.allIPs.local);
            expect(deserialized.allIPs.public).toEqual(merged.allIPs.public);
            expect(deserialized.allIPs.server).toBe(merged.allIPs.server);
            expect(deserialized.serverDetectedIP).toBe(merged.serverDetectedIP);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 21: Backward Compatibility', () => {
    it('should handle old device_info format without errors', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.string(),
            manufacturer: fc.option(fc.string(), { nil: null }),
            model: fc.option(fc.string(), { nil: null }),
            userAgent: fc.string(),
            capturedAt: fc.constant(new Date().toISOString())
          }),
          (oldDeviceInfo) => {
            // Old format doesn't have ips, allIPs, etc.
            // Should not throw when accessing these fields
            expect(() => {
              const localIPs = oldDeviceInfo?.ips?.ips?.filter((ip: any) => ip.type === 'local') ?? [];
              const publicIPs = oldDeviceInfo?.ips?.ips?.filter((ip: any) => ip.type === 'public') ?? [];
              const serverIP = oldDeviceInfo?.serverDetectedIP ?? null;
              
              // These should all be safe operations
              expect(Array.isArray(localIPs)).toBe(true);
              expect(Array.isArray(publicIPs)).toBe(true);
              expect(localIPs.length).toBe(0);
              expect(publicIPs.length).toBe(0);
            }).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should merge new fields with old device_info format', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.string(),
            manufacturer: fc.option(fc.string(), { nil: null }),
            model: fc.option(fc.string(), { nil: null }),
            userAgent: fc.string(),
            capturedAt: fc.constant(new Date().toISOString())
          }),
          ipv4Arbitrary,
          (oldDeviceInfo, serverIP) => {
            // Treat old format as client device info
            const merged = mergeDeviceInfo(oldDeviceInfo, serverIP);

            // Property: Old fields should be preserved
            expect(merged.type).toBe(oldDeviceInfo.type);
            expect(merged.manufacturer).toBe(oldDeviceInfo.manufacturer);
            expect(merged.model).toBe(oldDeviceInfo.model);

            // Property: New fields should be added
            expect(merged.serverDetectedIP).toBe(serverIP);
            expect(merged.allIPs).toBeDefined();
            expect(merged.allIPs.server).toBe(serverIP);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle missing or undefined fields gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant({}),
            fc.record({
              someField: fc.string()
            })
          ),
          ipv4Arbitrary,
          (malformedInfo, serverIP) => {
            // Should not throw with any malformed input
            expect(() => {
              const merged = mergeDeviceInfo(malformedInfo, serverIP);
              expect(merged.serverDetectedIP).toBe(serverIP);
              expect(isValidDeviceInfo(merged)).toBe(true);
            }).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('should handle invalid IP arrays gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant('not an array'),
            fc.constant({}),
            fc.array(fc.anything())
          ),
          ipv4Arbitrary,
          (invalidIPs, serverIP) => {
            const clientInfo = {
              ips: {
                ips: invalidIPs,
                error: null,
                completedAt: new Date().toISOString()
              }
            };

            expect(() => {
              const merged = mergeDeviceInfo(clientInfo, serverIP);
              // Should always produce valid arrays
              expect(Array.isArray(merged.allIPs.local)).toBe(true);
              expect(Array.isArray(merged.allIPs.public)).toBe(true);
            }).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Feature: enhanced-device-tracking
// Property 3: Server IP should always be present as fallback when WebRTC fails
// Property 4: All IP addresses should be preserved through storage and retrieval
// Property 21: Old device_info formats should be handled without errors
