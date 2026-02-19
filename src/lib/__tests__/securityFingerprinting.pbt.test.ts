/**
 * Property-Based Tests for Security Detection and Fingerprinting
 * Feature: enhanced-device-tracking
 * 
 * Tests the security detection and fingerprinting functionality with:
 * - Property 16: Security Indicators and Risk Assessment
 * - Property 17: Canvas Fingerprint Generation
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2
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
    RTCPeerConnection: undefined, // WebRTC disabled for these tests
    screen: {
      isExtended: false
    }
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
          width: 300,
          height: 150,
          getContext: vi.fn((type: string) => {
            if (type === '2d') {
              return {
                textBaseline: 'top',
                font: '14px "Arial"',
                fillStyle: '#069',
                fillRect: vi.fn(),
                fillText: vi.fn(),
                toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
              };
            }
            if (type === 'webgl' || type === 'experimental-webgl') {
              return {
                getParameter: vi.fn(),
                getExtension: vi.fn(() => null)
              };
            }
            return null;
          }),
          toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
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

describe('Security Detection and Fingerprinting - Property-Based Tests', () => {
  const mockNavigator = global.navigator as any;
  const mockWindow = global.window as any;
  const mockScreen = global.screen as any;
  const mockDocument = global.document as any;
  
  // Store original createElement for fallback
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    // Reset mock state
    mockNavigator.userAgent = USER_AGENTS.CHROME_WINDOWS;
    mockNavigator.userAgentData = undefined;
    mockNavigator.webdriver = false;
    mockNavigator.plugins = [1, 2, 3];
    mockNavigator.cookieEnabled = true;
    mockNavigator.doNotTrack = '0';
    mockNavigator.pdfViewerEnabled = true;
    mockNavigator.maxTouchPoints = 0;
    mockWindow.screen.isExtended = false;
    
    // Reset document.createElement spy to default canvas mock
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const mockCanvas = {
          width: 300,
          height: 150,
          getContext: vi.fn((type: string) => {
            if (type === '2d') {
              return {
                textBaseline: 'top',
                font: '14px "Arial"',
                fillStyle: '#069',
                fillRect: vi.fn(),
                fillText: vi.fn(),
                toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
              };
            }
            if (type === 'webgl' || type === 'experimental-webgl') {
              return {
                getParameter: vi.fn(),
                getExtension: vi.fn(() => null)
              };
            }
            return null;
          }),
          toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
        } as any;
        return mockCanvas;
      }
      return originalCreateElement(tag);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 16: Security Indicators and Risk Assessment', () => {
    it('should always include all required security indicator fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo.security).toBeDefined();
              
              // All required security fields must be present
              expect(deviceInfo.security).toHaveProperty('webdriver');
              expect(deviceInfo.security).toHaveProperty('pdfViewer');
              expect(deviceInfo.security).toHaveProperty('doNotTrack');
              expect(deviceInfo.security).toHaveProperty('pluginsCount');
              expect(deviceInfo.security).toHaveProperty('cookiesEnabled');
              expect(deviceInfo.security).toHaveProperty('isExtended');
              expect(deviceInfo.security).toHaveProperty('maxTouchPoints');
              expect(deviceInfo.security).toHaveProperty('automationRisk');

              // Verify types
              expect(typeof deviceInfo.security.webdriver).toBe('boolean');
              expect(typeof deviceInfo.security.pdfViewer).toBe('boolean');
              expect(typeof deviceInfo.security.doNotTrack).toBe('boolean');
              expect(typeof deviceInfo.security.pluginsCount).toBe('number');
              expect(['boolean', 'object']).toContain(typeof deviceInfo.security.cookiesEnabled); // Can be null
              expect(['boolean', 'object']).toContain(typeof deviceInfo.security.isExtended); // Can be null
              expect(typeof deviceInfo.security.maxTouchPoints).toBe('number');
              expect(typeof deviceInfo.security.automationRisk).toBe('boolean');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect webdriver automation correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (isWebdriver) => {
            mockNavigator.webdriver = isWebdriver;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo.security.webdriver).toBe(isWebdriver);
              
              // If webdriver is true, automation risk should be true
              if (isWebdriver) {
                expect(deviceInfo.security.automationRisk).toBe(true);
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should calculate automation risk based on multiple indicators', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            webdriver: fc.boolean(),
            pluginsCount: fc.integer({ min: 0, max: 10 }),
            browserName: fc.constantFrom('Chrome', 'Firefox', 'Safari', 'Edge', null)
          }),
          async ({ webdriver, pluginsCount, browserName }) => {
            mockNavigator.webdriver = webdriver;
            mockNavigator.plugins = Array(pluginsCount).fill({});
            
            // Set UA based on browser name
            if (browserName === 'Chrome') {
              mockNavigator.userAgent = USER_AGENTS.CHROME_WINDOWS;
            } else if (browserName === 'Firefox') {
              mockNavigator.userAgent = USER_AGENTS.FIREFOX_LINUX;
            } else if (browserName === 'Safari') {
              mockNavigator.userAgent = USER_AGENTS.SAFARI_MACOS;
            } else if (browserName === 'Edge') {
              mockNavigator.userAgent = USER_AGENTS.edgeWindows;
            } else {
              mockNavigator.userAgent = 'UnknownBrowser/1.0';
            }

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo.security.pluginsCount).toBe(pluginsCount);
              
              // Automation risk should be boolean
              expect(typeof deviceInfo.security.automationRisk).toBe('boolean');
              
              // If webdriver is true, automation risk must be true
              if (webdriver) {
                expect(deviceInfo.security.automationRisk).toBe(true);
              }
              
              // If plugins count is 0 and browser is not Firefox, automation risk should be true
              if (pluginsCount === 0 && browserName !== 'Firefox') {
                expect(deviceInfo.security.automationRisk).toBe(true);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect multiple monitor configurations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.option(fc.boolean(), { nil: null }),
          async (isExtended) => {
            if (isExtended !== null) {
              mockWindow.screen.isExtended = isExtended;
            } else {
              delete mockWindow.screen.isExtended;
            }

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              if (isExtended !== null) {
                expect(deviceInfo.security.isExtended).toBe(isExtended);
              } else {
                expect(deviceInfo.security.isExtended).toBeNull();
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should capture cookie and tracking preferences', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            cookiesEnabled: fc.boolean(),
            doNotTrack: fc.constantFrom('0', '1', 'yes', 'no', null)
          }),
          async ({ cookiesEnabled, doNotTrack }) => {
            mockNavigator.cookieEnabled = cookiesEnabled;
            mockNavigator.doNotTrack = doNotTrack;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo.security.cookiesEnabled).toBe(cookiesEnabled);
              
              // doNotTrack should be true only for '1' or 'yes'
              const expectedDNT = doNotTrack === '1' || doNotTrack === 'yes';
              expect(deviceInfo.security.doNotTrack).toBe(expectedDNT);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should capture touch capability indicators', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10 }),
          async (maxTouchPoints) => {
            mockNavigator.maxTouchPoints = maxTouchPoints;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo.security.maxTouchPoints).toBe(maxTouchPoints);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle missing or unavailable security APIs gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;
            
            // Remove some properties to simulate unavailable APIs
            delete mockNavigator.webdriver;
            delete mockNavigator.pdfViewerEnabled;
            delete mockNavigator.cookieEnabled;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // Should still have security object with default values
              expect(deviceInfo.security).toBeDefined();
              expect(typeof deviceInfo.security.webdriver).toBe('boolean');
              expect(typeof deviceInfo.security.automationRisk).toBe('boolean');
              
              // Missing properties should have sensible defaults
              expect(deviceInfo.security.webdriver).toBe(false); // Default to false
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 17: Canvas Fingerprint Generation', () => {
    it('should always generate a fingerprint when canvas is available', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              expect(deviceInfo).toHaveProperty('fingerprint');
              
              // Fingerprint should be a non-null hexadecimal string
              expect(deviceInfo.fingerprint).not.toBeNull();
              expect(typeof deviceInfo.fingerprint).toBe('string');
              expect(deviceInfo.fingerprint).toMatch(/^[0-9a-f]+$/);
              expect(deviceInfo.fingerprint!.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should generate consistent fingerprints for the same canvas data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            // Collect device info twice with same canvas mock
            const deviceInfo1 = await collectDetailedDeviceInfo();
            const deviceInfo2 = await collectDetailedDeviceInfo();

            expect(deviceInfo1).not.toBeNull();
            expect(deviceInfo2).not.toBeNull();
            
            if (deviceInfo1 && deviceInfo2) {
              // Fingerprints should be identical for same canvas data
              expect(deviceInfo1.fingerprint).toBe(deviceInfo2.fingerprint);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should generate different fingerprints for different canvas data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.string({ minLength: 10, maxLength: 100 }),
            fc.string({ minLength: 10, maxLength: 100 })
          ).filter(([a, b]) => a !== b),
          async ([canvasData1, canvasData2]) => {
            mockNavigator.userAgent = USER_AGENTS.CHROME_WINDOWS;

            // First collection with first canvas data
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
              if (tag === 'canvas') {
                const mockCanvas = {
                  width: 300,
                  height: 150,
                  getContext: vi.fn(() => ({
                    textBaseline: 'top',
                    font: '14px "Arial"',
                    fillStyle: '#069',
                    fillRect: vi.fn(),
                    fillText: vi.fn(),
                    toDataURL: vi.fn(() => `data:image/png;base64,${canvasData1}`)
                  })),
                  toDataURL: vi.fn(() => `data:image/png;base64,${canvasData1}`)
                } as any;
                return mockCanvas;
              }
              return originalCreateElement(tag);
            });

            const deviceInfo1 = await collectDetailedDeviceInfo();

            // Second collection with different canvas data
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
              if (tag === 'canvas') {
                const mockCanvas = {
                  width: 300,
                  height: 150,
                  getContext: vi.fn(() => ({
                    textBaseline: 'top',
                    font: '14px "Arial"',
                    fillStyle: '#069',
                    fillRect: vi.fn(),
                    fillText: vi.fn(),
                    toDataURL: vi.fn(() => `data:image/png;base64,${canvasData2}`)
                  })),
                  toDataURL: vi.fn(() => `data:image/png;base64,${canvasData2}`)
                } as any;
                return mockCanvas;
              }
              return originalCreateElement(tag);
            });

            const deviceInfo2 = await collectDetailedDeviceInfo();

            expect(deviceInfo1).not.toBeNull();
            expect(deviceInfo2).not.toBeNull();
            
            if (deviceInfo1 && deviceInfo2) {
              // Both should have fingerprints
              expect(deviceInfo1.fingerprint).not.toBeNull();
              expect(deviceInfo2.fingerprint).not.toBeNull();
              
              // Fingerprints should be different for different canvas data
              expect(deviceInfo1.fingerprint).not.toBe(deviceInfo2.fingerprint);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle canvas fingerprinting failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            // Mock canvas to throw error
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
              if (tag === 'canvas') {
                return {
                  getContext: vi.fn(() => {
                    throw new Error('Canvas not supported');
                  })
                } as any;
              }
              return originalCreateElement(tag);
            });

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // Should still return device info, but fingerprint should be null
              expect(deviceInfo).toHaveProperty('fingerprint');
              expect(deviceInfo.fingerprint).toBeNull();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should generate fingerprint as hexadecimal hash', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo && deviceInfo.fingerprint) {
              // Should be hexadecimal (only 0-9 and a-f)
              expect(deviceInfo.fingerprint).toMatch(/^[0-9a-f]+$/);
              
              // Should be a reasonable length (hash output)
              expect(deviceInfo.fingerprint.length).toBeGreaterThan(0);
              expect(deviceInfo.fingerprint.length).toBeLessThan(100);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle null canvas context gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(USER_AGENTS)),
          async (userAgent) => {
            mockNavigator.userAgent = userAgent;

            // Mock canvas to return null context
            vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
              if (tag === 'canvas') {
                return {
                  getContext: vi.fn(() => null)
                } as any;
              }
              return originalCreateElement(tag);
            });

            const deviceInfo = await collectDetailedDeviceInfo();

            expect(deviceInfo).not.toBeNull();
            if (deviceInfo) {
              // Should handle null context and return null fingerprint
              expect(deviceInfo.fingerprint).toBeNull();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
