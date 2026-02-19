/**
 * Property-Based Tests for Device Info Fixes
 * Tests correctness properties across many generated inputs
 * 
 * Requirements: 1.1, 1.3, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { mergeDeviceInfo, isValidDeviceInfo } from '../mergeDeviceInfo';
import { validateDeviceInfo } from '../deviceInfoDiagnostics';

describe('Device Info Fixes - Property-Based Tests', () => {
  beforeEach(() => {
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  /**
   * Property 2: Device Info Storage Consistency
   * For any device info received from the client, if the server merge operation succeeds,
   * then the database should contain the merged device info with allIPs structure.
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3**
   */
  describe('Property 2: Device Info Storage Consistency', () => {
    it('should always create allIPs structure regardless of input', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.record({
              friendlyName: fc.option(fc.string(), { nil: null }),
              oem: fc.option(fc.record({
                brand: fc.option(fc.string(), { nil: null }),
                model: fc.option(fc.string(), { nil: null }),
                source: fc.option(fc.constantFrom('ua', 'ua-ch'), { nil: null })
              }), { nil: null }),
              ips: fc.option(fc.record({
                ips: fc.array(
                  fc.oneof(
                    fc.constant(null),
                    fc.record({
                      ip: fc.ipV4(),
                      type: fc.constantFrom('local', 'public'),
                      family: fc.constantFrom('IPv4', 'IPv6')
                    })
                  )
                )
              }), { nil: null })
            })
          ),
          fc.ipV4(),
          (clientInfo, serverIP) => {
            const result = mergeDeviceInfo(clientInfo, serverIP);
            
            // Property: allIPs structure must always exist
            expect(result.allIPs).toBeDefined();
            expect(Array.isArray(result.allIPs.local)).toBe(true);
            expect(Array.isArray(result.allIPs.public)).toBe(true);
            expect(result.allIPs.server).toBeDefined();
            
            // Property: serverDetectedIP must always exist
            expect(result.serverDetectedIP).toBeDefined();
            
            // Property: result must be valid
            expect(isValidDeviceInfo(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly filter local and public IPs', () => {
      fc.assert(
        fc.property(
          fc.record({
            friendlyName: fc.string(),
            ips: fc.record({
              ips: fc.array(
                fc.record({
                  ip: fc.ipV4(),
                  type: fc.constantFrom('local', 'public', 'other'),
                  family: fc.constantFrom('IPv4', 'IPv6')
                }),
                { minLength: 0, maxLength: 10 }
              )
            })
          }),
          fc.ipV4(),
          (clientInfo, serverIP) => {
            const result = mergeDeviceInfo(clientInfo, serverIP);
            
            // Property: local IPs should only contain 'local' type
            result.allIPs.local.forEach((ip: any) => {
              expect(ip.type).toBe('local');
            });
            
            // Property: public IPs should only contain 'public' type
            result.allIPs.public.forEach((ip: any) => {
              expect(ip.type).toBe('public');
            });
            
            // Property: server IP should match input
            expect(result.allIPs.server).toBe(serverIP);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add default values for missing enhanced fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            friendlyName: fc.option(fc.string(), { nil: undefined })
            // Intentionally missing oem, browserDetails, platformDetails, security
          }),
          fc.ipV4(),
          (clientInfo, serverIP) => {
            const result = mergeDeviceInfo(clientInfo, serverIP);
            
            // Property: default structures must be added
            expect(result.oem).toBeDefined();
            expect(result.browserDetails).toBeDefined();
            expect(result.platformDetails).toBeDefined();
            expect(result.security).toBeDefined();
            
            // Property: structures should have correct shape
            expect(typeof result.oem).toBe('object');
            expect(typeof result.browserDetails).toBe('object');
            expect(typeof result.platformDetails).toBe('object');
            expect(typeof result.security).toBe('object');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Display Fallback Correctness
   * For any device info format (enhanced, legacy, null, or invalid), the DeviceInfoCell
   * component should display either meaningful device information or a graceful fallback
   * without throwing errors.
   * 
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
   */
  describe('Property 4: Display Fallback Correctness', () => {
    it('should validate any device info without throwing', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.object(),
            fc.record({
              friendlyName: fc.option(fc.string(), { nil: null }),
              oem: fc.option(fc.record({
                brand: fc.option(fc.string(), { nil: null }),
                model: fc.option(fc.string(), { nil: null })
              }), { nil: null }),
              browserDetails: fc.option(fc.record({
                name: fc.option(fc.string(), { nil: null }),
                version: fc.option(fc.string(), { nil: null })
              }), { nil: null }),
              platformDetails: fc.option(fc.record({
                os: fc.option(fc.string(), { nil: null }),
                osVersion: fc.option(fc.string(), { nil: null })
              }), { nil: null }),
              allIPs: fc.option(fc.record({
                local: fc.array(fc.object()),
                public: fc.array(fc.object()),
                server: fc.string()
              }), { nil: null })
            }),
            fc.record({
              type: fc.string(),
              manufacturer: fc.string(),
              model: fc.string(),
              userAgent: fc.option(fc.string(), { nil: null })
            })
          ),
          (deviceInfo) => {
            // Property: validation should never throw
            expect(() => validateDeviceInfo(deviceInfo)).not.toThrow();
            
            const validation = validateDeviceInfo(deviceInfo);
            
            // Property: validation result should have required fields
            expect(validation).toHaveProperty('isValid');
            expect(validation).toHaveProperty('format');
            expect(validation).toHaveProperty('missingFields');
            
            // Property: format should be one of the expected values
            expect(['enhanced', 'legacy', 'null', 'invalid']).toContain(validation.format);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify enhanced format', () => {
      fc.assert(
        fc.property(
          fc.record({
            friendlyName: fc.string({ minLength: 1 }),
            oem: fc.record({
              brand: fc.string({ minLength: 1 }),
              model: fc.string({ minLength: 1 }),
              source: fc.constantFrom('ua', 'ua-ch')
            }),
            browserDetails: fc.record({
              name: fc.string({ minLength: 1 }),
              version: fc.string({ minLength: 1 })
            }),
            platformDetails: fc.record({
              os: fc.string({ minLength: 1 }),
              osVersion: fc.string({ minLength: 1 })
            }),
            allIPs: fc.record({
              local: fc.array(fc.object()),
              public: fc.array(fc.object()),
              server: fc.ipV4()
            })
          }),
          (deviceInfo) => {
            const validation = validateDeviceInfo(deviceInfo);
            
            // Property: complete enhanced format should be valid
            expect(validation.isValid).toBe(true);
            expect(validation.format).toBe('enhanced');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify legacy format', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom('mobile', 'tablet', 'desktop'),
            manufacturer: fc.string({ minLength: 1 }),
            model: fc.string({ minLength: 1 }),
            userAgent: fc.option(fc.string(), { nil: null })
          }),
          (deviceInfo) => {
            const validation = validateDeviceInfo(deviceInfo);
            
            // Property: complete legacy format should be valid
            expect(validation.isValid).toBe(true);
            expect(validation.format).toBe('legacy');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Format Compatibility
   * For any device info stored in the database (legacy or enhanced format), the DeviceInfoCell
   * component should correctly identify the format and extract display information accordingly.
   * 
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   */
  describe('Property 6: Format Compatibility', () => {
    it('should handle mixed format fields gracefully', () => {
      fc.assert(
        fc.property(
          fc.record({
            // Enhanced fields
            friendlyName: fc.option(fc.string(), { nil: undefined }),
            oem: fc.option(fc.record({
              brand: fc.option(fc.string(), { nil: null }),
              model: fc.option(fc.string(), { nil: null })
            }), { nil: undefined }),
            // Legacy fields
            type: fc.option(fc.constantFrom('mobile', 'tablet', 'desktop'), { nil: undefined }),
            manufacturer: fc.option(fc.string(), { nil: undefined }),
            model: fc.option(fc.string(), { nil: undefined })
          }),
          (deviceInfo) => {
            const validation = validateDeviceInfo(deviceInfo);
            
            // Property: validation should succeed
            expect(validation).toBeDefined();
            expect(validation.format).toBeDefined();
            
            // Property: format should be deterministic based on fields present
            const hasEnhanced = !!(deviceInfo.friendlyName || deviceInfo.oem);
            const hasLegacy = !!(deviceInfo.type || deviceInfo.manufacturer);
            
            if (hasEnhanced) {
              expect(validation.format).toBe('enhanced');
            } else if (hasLegacy) {
              expect(validation.format).toBe('legacy');
            } else {
              expect(['null', 'invalid']).toContain(validation.format);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all fields during merge', () => {
      fc.assert(
        fc.property(
          fc.record({
            friendlyName: fc.string(),
            customField: fc.string(),
            nestedObject: fc.record({
              key: fc.string()
            })
          }),
          fc.ipV4(),
          (clientInfo, serverIP) => {
            const result = mergeDeviceInfo(clientInfo, serverIP);
            
            // Property: original fields should be preserved
            expect(result.friendlyName).toBe(clientInfo.friendlyName);
            expect(result.customField).toBe(clientInfo.customField);
            expect(result.nestedObject).toEqual(clientInfo.nestedObject);
            
            // Property: server fields should be added
            expect(result.serverDetectedIP).toBe(serverIP);
            expect(result.allIPs).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Validation Consistency
   * For any device info object, validation should consistently identify whether it's enhanced
   * format, legacy format, or invalid, and report missing fields.
   * 
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
   */
  describe('Property 7: Validation Consistency', () => {
    it('should consistently validate the same input', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.record({
              friendlyName: fc.string(),
              oem: fc.record({
                brand: fc.string(),
                model: fc.string()
              })
            }),
            fc.record({
              type: fc.string(),
              manufacturer: fc.string(),
              model: fc.string()
            }),
            fc.constant(null),
            fc.object()
          ),
          (deviceInfo) => {
            // Property: multiple validations should return same result
            const validation1 = validateDeviceInfo(deviceInfo);
            const validation2 = validateDeviceInfo(deviceInfo);
            
            expect(validation1.isValid).toBe(validation2.isValid);
            expect(validation1.format).toBe(validation2.format);
            expect(validation1.missingFields).toEqual(validation2.missingFields);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should report missing fields accurately', () => {
      fc.assert(
        fc.property(
          fc.record({
            friendlyName: fc.option(fc.string(), { nil: undefined }),
            oem: fc.option(fc.record({
              brand: fc.option(fc.string(), { nil: null }),
              model: fc.option(fc.string(), { nil: null })
            }), { nil: undefined }),
            allIPs: fc.option(fc.record({
              local: fc.array(fc.object()),
              public: fc.array(fc.object()),
              server: fc.string()
            }), { nil: undefined })
          }),
          (deviceInfo) => {
            const validation = validateDeviceInfo(deviceInfo);
            
            // Property: if format is enhanced, missing fields should be accurate
            if (validation.format === 'enhanced') {
              const hasFriendlyNameOrOem = !!(deviceInfo.friendlyName || deviceInfo.oem);
              const hasAllIPs = !!deviceInfo.allIPs;
              
              if (!hasFriendlyNameOrOem) {
                expect(validation.missingFields).toContain('friendlyName or oem');
              }
              
              if (!hasAllIPs) {
                expect(validation.missingFields).toContain('allIPs');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate merged device info structure', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.record({
              friendlyName: fc.string()
            })
          ),
          fc.ipV4(),
          (clientInfo, serverIP) => {
            const merged = mergeDeviceInfo(clientInfo, serverIP);
            
            // Property: merged result must always be valid
            expect(isValidDeviceInfo(merged)).toBe(true);
            
            // Property: merged result must have required structure
            expect(merged.serverDetectedIP).toBeDefined();
            expect(merged.allIPs).toBeDefined();
            expect(Array.isArray(merged.allIPs.local)).toBe(true);
            expect(Array.isArray(merged.allIPs.public)).toBe(true);
            expect(merged.allIPs.server).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional Property: Null Safety
   * For any input with null or undefined nested properties, the system should handle
   * gracefully without throwing errors.
   */
  describe('Additional Property: Null Safety', () => {
    it('should handle deeply nested null values', () => {
      fc.assert(
        fc.property(
          fc.record({
            friendlyName: fc.option(fc.string(), { nil: null }),
            oem: fc.option(
              fc.record({
                brand: fc.option(fc.string(), { nil: null }),
                model: fc.option(fc.string(), { nil: null }),
                source: fc.option(fc.string(), { nil: null })
              }),
              { nil: null }
            ),
            ips: fc.option(
              fc.record({
                ips: fc.option(
                  fc.array(
                    fc.option(
                      fc.record({
                        ip: fc.option(fc.ipV4(), { nil: null }),
                        type: fc.option(fc.string(), { nil: null }),
                        family: fc.option(fc.string(), { nil: null })
                      }),
                      { nil: null }
                    )
                  ),
                  { nil: null }
                )
              }),
              { nil: null }
            )
          }),
          fc.ipV4(),
          (clientInfo, serverIP) => {
            // Property: should not throw on null values
            expect(() => mergeDeviceInfo(clientInfo, serverIP)).not.toThrow();
            
            const result = mergeDeviceInfo(clientInfo, serverIP);
            
            // Property: result should always be valid
            expect(isValidDeviceInfo(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty or invalid serverIP', () => {
      fc.assert(
        fc.property(
          fc.record({
            friendlyName: fc.string()
          }),
          fc.oneof(
            fc.constant(''),
            fc.constant(null as any),
            fc.constant(undefined as any)
          ),
          (clientInfo, serverIP) => {
            // Property: should not throw on invalid serverIP
            expect(() => mergeDeviceInfo(clientInfo, serverIP)).not.toThrow();
            
            const result = mergeDeviceInfo(clientInfo, serverIP);
            
            // Property: should use 'unknown' as fallback
            expect(result.serverDetectedIP).toBe('unknown');
            expect(result.allIPs.server).toBe('unknown');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
