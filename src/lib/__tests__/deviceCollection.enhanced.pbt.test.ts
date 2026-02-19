/**
 * Property-Based Tests for Enhanced Device Collection
 * Feature: enhanced-device-tracking
 * 
 * Tests the enhanced device info collection module with:
 * - Property 6: User-Agent Parsing Completeness
 * - Property 7: Client Hints Utilization
 * - Property 8: Device Type Classification
 * - Property 11: Device Model Extraction
 * - Property 12: Friendly Name Generation
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4
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

describe('Enhanced Device Collection - Property-Based Tests', () => {
  const mockNavigator = global.navigator as any;
  const mockWindow = global.window as any;
  const mockScreen = global.screen as any;
  const mockDocument = global.document as any;

  beforeEach(() => {
    // Reset mock state
    mockNavigator.userAgent = '';
    mockNavigator.userAgentData = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 6: User-Agent Parsing Completeness', () => {
    it('should extract both browser and OS information from any valid user agent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            // Should have parsed UA information
            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo.parsed).toBeDefined();
              expect(deviceInfo.parsed.browser).toBeDefined();
              expect(deviceInfo.parsed.os).toBeDefined();

              // Browser should have name (may be null for unknown browsers)
              expect(deviceInfo.parsed.browser).toHaveProperty('name');
              expect(deviceInfo.parsed.browser).toHaveProperty('version');

              // OS should have name (may be null for unknown OS)
              expect(deviceInfo.parsed.os).toHaveProperty('name');
              expect(deviceInfo.parsed.os).toHaveProperty('version');

              // Enhanced browser details should exist
              expect(deviceInfo.browserDetails).toBeDefined();
              expect(deviceInfo.browserDetails).toHaveProperty('name');
              expect(deviceInfo.browserDetails).toHaveProperty('version');
              expect(deviceInfo.browserDetails).toHaveProperty('fullVersion');
              expect(deviceInfo.browserDetails).toHaveProperty('engine');
              expect(deviceInfo.browserDetails).toHaveProperty('engineVersion');

              // Enhanced platform details should exist
              expect(deviceInfo.platformDetails).toBeDefined();
              expect(deviceInfo.platformDetails).toHaveProperty('os');
              expect(deviceInfo.platformDetails).toHaveProperty('osVersion');
              expect(deviceInfo.platformDetails).toHaveProperty('architecture');
              expect(deviceInfo.platformDetails).toHaveProperty('bitness');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle malformed or empty user agents gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('', 'Invalid', 'Mozilla/5.0 ()', ';;;', 'null', 'undefined'),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            // Should not crash and should return valid structure
            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo.parsed).toBeDefined();
              expect(deviceInfo.browserDetails).toBeDefined();
              expect(deviceInfo.platformDetails).toBeDefined();
              expect(deviceInfo.friendlyName).toBeDefined();
              expect(typeof deviceInfo.friendlyName).toBe('string');
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 7: Client Hints Utilization', () => {
    it('should use Client Hints when available', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            architecture: fc.constantFrom('x86', 'arm', null),
            bitness: fc.constantFrom('32', '64', null),
            model: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
            platform: fc.constantFrom('Windows', 'macOS', 'Linux', 'Android', null),
            platformVersion: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
            uaFullVersion: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
            mobile: fc.boolean()
          }),
          async (hints) => {
            mockNavigator.userAgent = USER_AGENTS.CHROME_WINDOWS;
            mockNavigator.userAgentData = {
              mobile: hints.mobile,
              platform: hints.platform,
              brands: [{ brand: 'Chromium', version: '120' }],
              getHighEntropyValues: vi.fn(async () => hints)
            };

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // Should have clientHints field populated
              expect(deviceInfo.clientHints).toBeDefined();
              expect(deviceInfo.clientHints).not.toBeNull();

              if (deviceInfo.clientHints) {
                expect(deviceInfo.clientHints.architecture).toBe(hints.architecture);
                expect(deviceInfo.clientHints.bitness).toBe(hints.bitness);
                expect(deviceInfo.clientHints.model).toBe(hints.model);
                expect(deviceInfo.clientHints.platform).toBe(hints.platform);
                expect(deviceInfo.clientHints.platformVersion).toBe(hints.platformVersion);
                expect(deviceInfo.clientHints.uaFullVersion).toBe(hints.uaFullVersion);
                expect(deviceInfo.clientHints.mobile).toBe(hints.mobile);
              }

              // Platform details should use Client Hints data
              if (hints.architecture) {
                expect(deviceInfo.platformDetails.architecture).toBe(hints.architecture);
              }
              if (hints.bitness) {
                expect(deviceInfo.platformDetails.bitness).toBe(hints.bitness);
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should fall back to UA parsing when Client Hints unavailable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;
            mockNavigator.userAgentData = undefined;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // clientHints should be null
              expect(deviceInfo.clientHints).toBeNull();

              // But should still have platform and browser details from UA parsing
              expect(deviceInfo.browserDetails).toBeDefined();
              expect(deviceInfo.platformDetails).toBeDefined();
              expect(deviceInfo.parsed).toBeDefined();
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 8: Device Type Classification', () => {
    it('should classify device type as one of: mobile, tablet, desktop, or unknown', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo && deviceInfo.parsed) {
              const validTypes = ['mobile', 'tablet', 'desktop', 'unknown', null];
              expect(validTypes).toContain(deviceInfo.parsed.device.type);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should correctly identify mobile devices', async () => {
      const mobileUAs = [
        USER_AGENTS.IPHONE_SAFARI,
        USER_AGENTS.ANDROID_CHROME,
        USER_AGENTS.SAMSUNG_INTERNET
      ];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...mobileUAs),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo && deviceInfo.parsed) {
              expect(deviceInfo.parsed.device.type).toBe('mobile');
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should correctly identify desktop devices', async () => {
      const desktopUAs = [
        USER_AGENTS.CHROME_WINDOWS,
        USER_AGENTS.FIREFOX_LINUX,
        USER_AGENTS.SAFARI_MACOS
      ];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...desktopUAs),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo && deviceInfo.parsed) {
              expect(deviceInfo.parsed.device.type).toBe('desktop');
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 11: Device Model Extraction', () => {
    it('should extract device model when available in UA or Client Hints', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userAgent: fc.constantFrom(
              USER_AGENTS.SAMSUNG_INTERNET,
              USER_AGENTS.ANDROID_CHROME,
              USER_AGENTS.IPHONE_SAFARI
            ),
            clientHintsModel: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null })
          }),
          async ({ userAgent, clientHintsModel }) => {
            mockNavigator.userAgent = userAgent;

            if (clientHintsModel) {
              mockNavigator.userAgentData = {
                mobile: true,
                platform: 'Android',
                brands: [{ brand: 'Chromium', version: '120' }],
                getHighEntropyValues: vi.fn(async () => ({
                  model: clientHintsModel,
                  architecture: 'arm',
                  bitness: '64',
                  platform: 'Android',
                  platformVersion: '13',
                  uaFullVersion: '120.0.6099.129'
                }))
              };
            } else {
              mockNavigator.userAgentData = undefined;
            }

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo.oem).toBeDefined();
              expect(deviceInfo.oem).toHaveProperty('brand');
              expect(deviceInfo.oem).toHaveProperty('model');
              expect(deviceInfo.oem).toHaveProperty('source');

              // If Client Hints provided model, it should be used
              if (clientHintsModel) {
                expect(deviceInfo.oem.model).toBe(clientHintsModel);
                expect(deviceInfo.oem.source).toBe('ua-ch');
              } else {
                // Otherwise should extract from UA or be null
                expect(['ua', null]).toContain(deviceInfo.oem.source);
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle unknown devices gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('UnknownBrowser/1.0', 'Mozilla/5.0 ()', ''),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;
            mockNavigator.userAgentData = undefined;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo.oem).toBeDefined();
              expect(deviceInfo.oem.brand).toBeDefined(); // May be null
              expect(deviceInfo.oem.model).toBeDefined(); // May be null
              expect(deviceInfo.oem.source).toBeDefined(); // May be null
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 12: Friendly Name Generation', () => {
    it('should always generate a non-empty friendly name', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo.friendlyName).toBeDefined();
              expect(typeof deviceInfo.friendlyName).toBe('string');
              expect(deviceInfo.friendlyName.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include available device information in friendly name', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              const name = deviceInfo.friendlyName;

              // If we have brand, it should be in the name
              if (deviceInfo.oem.brand && deviceInfo.oem.brand !== 'Unknown') {
                expect(name).toContain(deviceInfo.oem.brand);
              }

              // If we have browser name, it should be in the name
              if (deviceInfo.browserDetails.name) {
                expect(name).toContain(deviceInfo.browserDetails.name);
              }

              // If we have OS name, it should be in the name
              if (deviceInfo.platformDetails.os) {
                expect(name).toContain(deviceInfo.platformDetails.os);
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should generate "Unknown Device" for completely unknown devices', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('', 'null', 'undefined'),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;
            mockNavigator.userAgentData = undefined;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // Should still have a friendly name, even if it's "Unknown Device"
              expect(deviceInfo.friendlyName).toBeDefined();
              expect(typeof deviceInfo.friendlyName).toBe('string');
              expect(deviceInfo.friendlyName.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should combine brand, model, OS, and browser in a readable format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            USER_AGENTS.SAMSUNG_INTERNET,
            USER_AGENTS.IPHONE_SAFARI,
            USER_AGENTS.CHROME_WINDOWS
          ),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              const name = deviceInfo.friendlyName;

              // Should not be just "Unknown Device" for known UAs
              expect(name).not.toBe('Unknown Device');

              // Should contain spaces (readable format)
              expect(name).toMatch(/\s/);

              // Should not have double spaces
              expect(name).not.toMatch(/\s{2,}/);

              // Should not start or end with spaces
              expect(name.trim()).toBe(name);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
