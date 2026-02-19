/**
 * Property-Based Tests for Data Storage Structure
 * Feature: enhanced-device-tracking
 * 
 * Tests the device info data structure with:
 * - Property 9: Structured Data Format
 * - Property 20: Complete Data Storage Structure
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 2.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { USER_AGENTS } from '@/__tests__/utils/userAgent';

// Hoist the mocks to ensure they're set up before any module imports
vi.hoisted(() => {
  const mockNavigator: any = {
    userAgent: '',
    platform: 'Linux x86_64',
    language: 'en-US',
    languages: ['en-US', 'en'],
    vendor: 'Google Inc.',
    deviceMemory: 8,
    hardwareConcurrency: 8,
    maxTouchPoints: 0,
    cookieEnabled: true,
    webdriver: false,
    pdfViewerEnabled: true,
    doNotTrack: '0',
    plugins: [1, 2, 3],
    geolocation: {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: 30.0444,
            longitude: 31.2357,
            accuracy: 20
          },
          timestamp: Date.now()
        });
      })
    }
  };

  const mockWindow: any = {
    devicePixelRatio: 2,
    innerWidth: 1920,
    innerHeight: 1080,
    RTCPeerConnection: undefined // WebRTC disabled for these tests
  };

  const mockScreen: any = {
    width: 1920,
    height: 1080,
    colorDepth: 24,
    pixelDepth: 24
  };

  const mockDocument: any = {
    createElement: vi.fn((tag: string) => {
      if (tag === 'canvas') {
        return {
          getContext: vi.fn(() => ({
            textBaseline: '',
            font: '',
            fillStyle: '',
            fillRect: vi.fn(),
            fillText: vi.fn(),
            toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
          }))
        };
      }
      return {};
    })
  };

  // Mock globals
  global.navigator = mockNavigator as any;
  global.window = mockWindow as any;
  global.screen = mockScreen as any;
  global.document = mockDocument as any;

  return { mockNavigator, mockWindow, mockScreen, mockDocument };
});

// Import after mocks are hoisted
import { collectDetailedDeviceInfo } from '../collectDeviceInfo';

describe('Data Storage Structure - Property-Based Tests', () => {
  const mockNavigator = global.navigator as any;
  const mockWindow = global.window as any;
  const mockScreen = global.screen as any;
  const mockDocument = global.document as any;

  beforeEach(() => {
    // Reset mock state
    mockNavigator.userAgent = USER_AGENTS.CHROME_WINDOWS;
    mockNavigator.userAgentData = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 9: Structured Data Format', () => {
    it('should contain all required top-level fields with proper nesting', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // Required top-level fields
              expect(deviceInfo).toHaveProperty('collectedAt');
              expect(deviceInfo).toHaveProperty('browserDetails');
              expect(deviceInfo).toHaveProperty('platformDetails');
              expect(deviceInfo).toHaveProperty('security');
              
              // Verify collectedAt is a valid ISO timestamp
              expect(typeof deviceInfo.collectedAt).toBe('string');
              expect(() => new Date(deviceInfo.collectedAt)).not.toThrow();
              expect(new Date(deviceInfo.collectedAt).toISOString()).toBe(deviceInfo.collectedAt);

              // Verify nested structure for browserDetails
              expect(deviceInfo.browserDetails).toHaveProperty('name');
              expect(deviceInfo.browserDetails).toHaveProperty('version');
              expect(deviceInfo.browserDetails).toHaveProperty('fullVersion');
              expect(deviceInfo.browserDetails).toHaveProperty('engine');
              expect(deviceInfo.browserDetails).toHaveProperty('engineVersion');

              // Verify nested structure for platformDetails
              expect(deviceInfo.platformDetails).toHaveProperty('os');
              expect(deviceInfo.platformDetails).toHaveProperty('osVersion');
              expect(deviceInfo.platformDetails).toHaveProperty('architecture');
              expect(deviceInfo.platformDetails).toHaveProperty('bitness');

              // Verify nested structure for security
              expect(deviceInfo.security).toHaveProperty('webdriver');
              expect(deviceInfo.security).toHaveProperty('pdfViewer');
              expect(deviceInfo.security).toHaveProperty('doNotTrack');
              expect(deviceInfo.security).toHaveProperty('pluginsCount');
              expect(deviceInfo.security).toHaveProperty('cookiesEnabled');
              expect(deviceInfo.security).toHaveProperty('isExtended');
              expect(deviceInfo.security).toHaveProperty('maxTouchPoints');
              expect(deviceInfo.security).toHaveProperty('automationRisk');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have proper data types for all fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // String fields
              expect(typeof deviceInfo.collectedAt).toBe('string');
              expect(typeof deviceInfo.friendlyName).toBe('string');
              
              // Object fields
              expect(typeof deviceInfo.browserDetails).toBe('object');
              expect(typeof deviceInfo.platformDetails).toBe('object');
              expect(typeof deviceInfo.security).toBe('object');
              expect(typeof deviceInfo.parsed).toBe('object');
              expect(typeof deviceInfo.oem).toBe('object');
              expect(typeof deviceInfo.screen).toBe('object');
              expect(typeof deviceInfo.viewport).toBe('object');
              expect(typeof deviceInfo.location).toBe('object');
              expect(typeof deviceInfo.ips).toBe('object');

              // Boolean fields in security
              expect(typeof deviceInfo.security.webdriver).toBe('boolean');
              expect(typeof deviceInfo.security.pdfViewer).toBe('boolean');
              expect(typeof deviceInfo.security.doNotTrack).toBe('boolean');
              expect(typeof deviceInfo.security.automationRisk).toBe('boolean');

              // Number fields in security
              expect(typeof deviceInfo.security.pluginsCount).toBe('number');
              expect(typeof deviceInfo.security.maxTouchPoints).toBe('number');
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 20: Complete Data Storage Structure', () => {
    it('should have organized sections: hardware, network, security, location, locale', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // Hardware section (organized fields)
              expect(deviceInfo).toHaveProperty('screen');
              expect(deviceInfo).toHaveProperty('viewport');
              expect(deviceInfo).toHaveProperty('deviceMemory');
              expect(deviceInfo).toHaveProperty('hardwareConcurrency');
              expect(deviceInfo).toHaveProperty('pixelRatio');
              expect(deviceInfo).toHaveProperty('touch');
              expect(deviceInfo).toHaveProperty('gpu');

              // Network section
              expect(deviceInfo).toHaveProperty('network');

              // Security section
              expect(deviceInfo).toHaveProperty('security');
              expect(deviceInfo.security).toBeDefined();

              // Location section
              expect(deviceInfo).toHaveProperty('location');
              expect(deviceInfo.location).toBeDefined();

              // Locale section (organized fields)
              expect(deviceInfo).toHaveProperty('timezone');
              expect(deviceInfo).toHaveProperty('timezoneOffset');
              expect(deviceInfo).toHaveProperty('language');
              expect(deviceInfo).toHaveProperty('languages');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should use null values for unavailable data, not undefined', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;
            
            // Simulate unavailable APIs
            mockNavigator.deviceMemory = undefined;
            mockNavigator.connection = undefined;
            mockNavigator.getBattery = undefined;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // Check that unavailable data is null, not undefined
              const checkNoUndefined = (obj: any, path: string = 'root') => {
                for (const key in obj) {
                  const value = obj[key];
                  const currentPath = `${path}.${key}`;
                  
                  // Skip entrySubmit as it's intentionally null in tests
                  if (key === 'entrySubmit') continue;
                  
                  if (value === undefined) {
                    throw new Error(`Found undefined at ${currentPath}`);
                  }
                  
                  // Recursively check nested objects (but not arrays)
                  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    checkNoUndefined(value, currentPath);
                  }
                }
              };

              expect(() => checkNoUndefined(deviceInfo)).not.toThrow();

              // Specifically check fields that might be unavailable
              if (deviceInfo.deviceMemory === undefined) {
                expect(deviceInfo.deviceMemory).toBeNull();
              }
              if (deviceInfo.network === undefined) {
                expect(deviceInfo.network).toBeNull();
              }
              if (deviceInfo.battery === undefined) {
                expect(deviceInfo.battery).toBeNull();
              }
              if (deviceInfo.gpu === undefined) {
                expect(deviceInfo.gpu).toBeNull();
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should include collectedAt timestamp in ISO format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const beforeCollection = new Date();
            const deviceInfo = await collectDetailedDeviceInfo();
            const afterCollection = new Date();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo.collectedAt).toBeDefined();
              expect(typeof deviceInfo.collectedAt).toBe('string');

              // Should be valid ISO 8601 format
              const collectedDate = new Date(deviceInfo.collectedAt);
              expect(collectedDate.toISOString()).toBe(deviceInfo.collectedAt);

              // Should be within the collection time window
              expect(collectedDate.getTime()).toBeGreaterThanOrEqual(beforeCollection.getTime() - 1000);
              expect(collectedDate.getTime()).toBeLessThanOrEqual(afterCollection.getTime() + 1000);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should have proper structure for screen and viewport objects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // Screen structure
              expect(deviceInfo.screen).toBeDefined();
              expect(deviceInfo.screen).toHaveProperty('width');
              expect(deviceInfo.screen).toHaveProperty('height');
              expect(deviceInfo.screen).toHaveProperty('colorDepth');
              expect(deviceInfo.screen).toHaveProperty('pixelDepth');

              // Viewport structure
              expect(deviceInfo.viewport).toBeDefined();
              expect(deviceInfo.viewport).toHaveProperty('width');
              expect(deviceInfo.viewport).toHaveProperty('height');

              // Values should be numbers or null
              if (deviceInfo.screen.width !== null) {
                expect(typeof deviceInfo.screen.width).toBe('number');
              }
              if (deviceInfo.viewport.width !== null) {
                expect(typeof deviceInfo.viewport.width).toBe('number');
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should have proper structure for location object with error handling', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // Location structure
              expect(deviceInfo.location).toBeDefined();
              expect(deviceInfo.location).toHaveProperty('latitude');
              expect(deviceInfo.location).toHaveProperty('longitude');
              expect(deviceInfo.location).toHaveProperty('accuracy');
              expect(deviceInfo.location).toHaveProperty('timestamp');

              // Should have error field (may be undefined or string)
              if ('error' in deviceInfo.location) {
                const errorValue = deviceInfo.location.error;
                expect([null, undefined, 'string']).toContain(typeof errorValue);
              }

              // If coordinates are present, they should be numbers
              if (deviceInfo.location.latitude !== null) {
                expect(typeof deviceInfo.location.latitude).toBe('number');
              }
              if (deviceInfo.location.longitude !== null) {
                expect(typeof deviceInfo.location.longitude).toBe('number');
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should have proper structure for ips object with completedAt timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // IPs structure
              expect(deviceInfo.ips).toBeDefined();
              expect(deviceInfo.ips).toHaveProperty('ips');
              expect(deviceInfo.ips).toHaveProperty('error');
              expect(deviceInfo.ips).toHaveProperty('completedAt');

              // completedAt should be ISO timestamp
              expect(typeof deviceInfo.ips.completedAt).toBe('string');
              const completedDate = new Date(deviceInfo.ips.completedAt);
              expect(completedDate.toISOString()).toBe(deviceInfo.ips.completedAt);

              // ips should be an array
              expect(Array.isArray(deviceInfo.ips.ips)).toBe(true);

              // error should be string or null
              expect([null, 'string']).toContain(typeof deviceInfo.ips.error);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should have proper structure for oem object with source indicator', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // OEM structure
              expect(deviceInfo.oem).toBeDefined();
              expect(deviceInfo.oem).toHaveProperty('brand');
              expect(deviceInfo.oem).toHaveProperty('model');
              expect(deviceInfo.oem).toHaveProperty('source');

              // Source should be one of: 'ua-ch', 'ua', or null
              const validSources = ['ua-ch', 'ua', null];
              expect(validSources).toContain(deviceInfo.oem.source);

              // If source is present, at least one of brand or model should be present
              if (deviceInfo.oem.source !== null) {
                const hasData = deviceInfo.oem.brand !== null || deviceInfo.oem.model !== null;
                expect(hasData).toBe(true);
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should be serializable to JSON without data loss', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // Should be serializable to JSON
              const jsonString = JSON.stringify(deviceInfo);
              expect(jsonString).toBeDefined();
              expect(jsonString.length).toBeGreaterThan(0);

              // Should be deserializable
              const parsed = JSON.parse(jsonString);
              expect(parsed).toBeDefined();

              // Key fields should survive serialization
              expect(parsed.collectedAt).toBe(deviceInfo.collectedAt);
              expect(parsed.friendlyName).toBe(deviceInfo.friendlyName);
              expect(parsed.fingerprint).toBe(deviceInfo.fingerprint);
              
              // Nested objects should survive
              expect(parsed.browserDetails).toBeDefined();
              expect(parsed.platformDetails).toBeDefined();
              expect(parsed.security).toBeDefined();
              expect(parsed.location).toBeDefined();
              expect(parsed.ips).toBeDefined();
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should have consistent structure across different user agents', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.constantFrom(...Object.values(USER_AGENTS)),
            fc.constantFrom(...Object.values(USER_AGENTS))
          ),
          async ([ua1, ua2]) => {
            // Collect with first UA
            mockNavigator.userAgent = ua1;
            const deviceInfo1 = await collectDetailedDeviceInfo();

            // Collect with second UA
            mockNavigator.userAgent = ua2;
            const deviceInfo2 = await collectDetailedDeviceInfo();

            expect(deviceInfo1).not.toBeNull();
            expect(deviceInfo2).not.toBeNull();

            if (deviceInfo1 && deviceInfo2) {
              // Both should have the same top-level keys
              const keys1 = Object.keys(deviceInfo1).sort();
              const keys2 = Object.keys(deviceInfo2).sort();
              expect(keys1).toEqual(keys2);

              // Both should have the same nested structure for key objects
              expect(Object.keys(deviceInfo1.browserDetails).sort()).toEqual(
                Object.keys(deviceInfo2.browserDetails).sort()
              );
              expect(Object.keys(deviceInfo1.platformDetails).sort()).toEqual(
                Object.keys(deviceInfo2.platformDetails).sort()
              );
              expect(Object.keys(deviceInfo1.security).sort()).toEqual(
                Object.keys(deviceInfo2.security).sort()
              );
              expect(Object.keys(deviceInfo1.location).sort()).toEqual(
                Object.keys(deviceInfo2.location).sort()
              );
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
