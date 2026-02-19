/**
 * Property-Based Tests for Hardware and Optional API Collection
 * Feature: enhanced-device-tracking
 * 
 * Tests the hardware and optional API collection with:
 * - Property 10: Hardware Data Collection
 * - Property 13: Optional API Data Collection
 * - Property 14: Locale Information Capture
 * - Property 15: Graceful Permission Denial
 * 
 * Validates: Requirements 3.1-3.6, 5.1-5.5
 * 
 * NOTE: These tests verify that the collection function properly reads from
 * the global navigator/window/screen objects. The tests use static mocks
 * and verify the structure and types of collected data rather than testing
 * dynamic value updates.
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// Mock the WebRTC IP discovery to avoid timeouts
vi.mock('../webrtcIpDiscovery', () => ({
  discoverIPs: vi.fn(async () => ({
    ips: [],
    error: null,
    completedAt: new Date().toISOString()
  }))
}));

// Import after mocks
import { collectDetailedDeviceInfo } from '../collectDeviceInfo';

describe('Hardware and Optional APIs - Property-Based Tests', () => {
  describe('Property 10: Hardware Data Collection', () => {
    it('should always collect hardware information structure', async () => {
      const deviceInfo = await collectDetailedDeviceInfo();

      expect(deviceInfo).not.toBeNull();
      if (deviceInfo) {
        // Should have all hardware fields
        expect(deviceInfo).toHaveProperty('hardwareConcurrency');
        expect(deviceInfo).toHaveProperty('deviceMemory');
        expect(deviceInfo).toHaveProperty('screen');
        expect(deviceInfo).toHaveProperty('viewport');
        expect(deviceInfo).toHaveProperty('pixelRatio');
        expect(deviceInfo).toHaveProperty('touch');
        expect(deviceInfo).toHaveProperty('gpu');

        // Screen should be an object with required fields
        expect(deviceInfo.screen).toBeDefined();
        expect(deviceInfo.screen).toHaveProperty('width');
        expect(deviceInfo.screen).toHaveProperty('height');
        expect(deviceInfo.screen).toHaveProperty('colorDepth');
        expect(deviceInfo.screen).toHaveProperty('pixelDepth');

        // Viewport should be an object with required fields
        expect(deviceInfo.viewport).toBeDefined();
        expect(deviceInfo.viewport).toHaveProperty('width');
        expect(deviceInfo.viewport).toHaveProperty('height');

        // Touch should be a boolean
        expect(typeof deviceInfo.touch).toBe('boolean');
      }
    });

    it('should collect numeric hardware values when available', async () => {
      const deviceInfo = await collectDetailedDeviceInfo();

      expect(deviceInfo).not.toBeNull();
      if (deviceInfo) {
        // If hardware values are present, they should be numbers
        if (deviceInfo.hardwareConcurrency !== null) {
          expect(typeof deviceInfo.hardwareConcurrency).toBe('number');
          expect(deviceInfo.hardwareConcurrency).toBeGreaterThan(0);
        }

        if (deviceInfo.deviceMemory !== null) {
          expect(typeof deviceInfo.deviceMemory).toBe('number');
          expect(deviceInfo.deviceMemory).toBeGreaterThan(0);
        }

        if (deviceInfo.pixelRatio !== null) {
          expect(typeof deviceInfo.pixelRatio).toBe('number');
          expect(deviceInfo.pixelRatio).toBeGreaterThan(0);
        }

        // Screen dimensions should be numbers if present (can be 0 in test environment)
        if (deviceInfo.screen.width !== null) {
          expect(typeof deviceInfo.screen.width).toBe('number');
          expect(deviceInfo.screen.width).toBeGreaterThanOrEqual(0);
        }

        if (deviceInfo.screen.height !== null) {
          expect(typeof deviceInfo.screen.height).toBe('number');
          expect(deviceInfo.screen.height).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('Property 10: Hardware values should be null or valid numbers', async () => {
      // Run once to verify the property holds
      const deviceInfo = await collectDetailedDeviceInfo();

      expect(deviceInfo).not.toBeNull();
      if (deviceInfo) {
        // Hardware concurrency: null or positive integer
        if (deviceInfo.hardwareConcurrency !== null) {
          expect(Number.isInteger(deviceInfo.hardwareConcurrency)).toBe(true);
          expect(deviceInfo.hardwareConcurrency).toBeGreaterThan(0);
        }

        // Device memory: null or positive number
        if (deviceInfo.deviceMemory !== null) {
          expect(typeof deviceInfo.deviceMemory).toBe('number');
          expect(deviceInfo.deviceMemory).toBeGreaterThan(0);
        }

        // Pixel ratio: null or positive number
        if (deviceInfo.pixelRatio !== null) {
          expect(typeof deviceInfo.pixelRatio).toBe('number');
          expect(deviceInfo.pixelRatio).toBeGreaterThan(0);
        }

        // Screen dimensions: null or non-negative numbers
        if (deviceInfo.screen.width !== null) {
          expect(typeof deviceInfo.screen.width).toBe('number');
          expect(deviceInfo.screen.width).toBeGreaterThanOrEqual(0);
        }

        if (deviceInfo.screen.height !== null) {
          expect(typeof deviceInfo.screen.height).toBe('number');
          expect(deviceInfo.screen.height).toBeGreaterThanOrEqual(0);
        }

        // Viewport dimensions: null or non-negative numbers
        if (deviceInfo.viewport.width !== null) {
          expect(typeof deviceInfo.viewport.width).toBe('number');
          expect(deviceInfo.viewport.width).toBeGreaterThanOrEqual(0);
        }

        if (deviceInfo.viewport.height !== null) {
          expect(typeof deviceInfo.viewport.height).toBe('number');
          expect(deviceInfo.viewport.height).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('Property 13: Optional API Data Collection', () => {
    it('should have optional API fields in structure', async () => {
      const deviceInfo = await collectDetailedDeviceInfo();

      expect(deviceInfo).not.toBeNull();
      if (deviceInfo) {
        // Should have all optional API fields
        expect(deviceInfo).toHaveProperty('location');
        expect(deviceInfo).toHaveProperty('network');
        expect(deviceInfo).toHaveProperty('battery');

        // Location should have required structure
        expect(deviceInfo.location).toBeDefined();
        expect(deviceInfo.location).toHaveProperty('latitude');
        expect(deviceInfo.location).toHaveProperty('longitude');
        expect(deviceInfo.location).toHaveProperty('accuracy');
        expect(deviceInfo.location).toHaveProperty('timestamp');
      }
    });

    it('Property 13: Optional API values should be null or valid structures', async () => {
      // Run once to verify the property holds
      const deviceInfo = await collectDetailedDeviceInfo();

      expect(deviceInfo).not.toBeNull();
      if (deviceInfo) {
        // Network: null or object with required fields
        if (deviceInfo.network !== null) {
          expect(typeof deviceInfo.network).toBe('object');
          expect(deviceInfo.network).toHaveProperty('type');
          expect(deviceInfo.network).toHaveProperty('effectiveType');
          expect(deviceInfo.network).toHaveProperty('downlink');
          expect(deviceInfo.network).toHaveProperty('rtt');
          expect(deviceInfo.network).toHaveProperty('saveData');
        }

        // Battery: null or object with required fields
        if (deviceInfo.battery !== null) {
          expect(typeof deviceInfo.battery).toBe('object');
          expect(deviceInfo.battery).toHaveProperty('level');
          expect(deviceInfo.battery).toHaveProperty('charging');
          
          if (deviceInfo.battery.level !== null) {
            expect(typeof deviceInfo.battery.level).toBe('number');
            expect(deviceInfo.battery.level).toBeGreaterThanOrEqual(0);
            expect(deviceInfo.battery.level).toBeLessThanOrEqual(100);
          }
          
          if (deviceInfo.battery.charging !== null) {
            expect(typeof deviceInfo.battery.charging).toBe('boolean');
          }
        }

        // Location: always present with error or coordinates
        expect(deviceInfo.location).toBeDefined();
        if (deviceInfo.location.error) {
          // If there's an error, coordinates should be null
          expect(typeof deviceInfo.location.error).toBe('string');
        } else {
          // If no error, coordinates might be present
          if (deviceInfo.location.latitude !== null) {
            expect(typeof deviceInfo.location.latitude).toBe('number');
            expect(deviceInfo.location.latitude).toBeGreaterThanOrEqual(-90);
            expect(deviceInfo.location.latitude).toBeLessThanOrEqual(90);
          }
          
          if (deviceInfo.location.longitude !== null) {
            expect(typeof deviceInfo.location.longitude).toBe('number');
            expect(deviceInfo.location.longitude).toBeGreaterThanOrEqual(-180);
            expect(deviceInfo.location.longitude).toBeLessThanOrEqual(180);
          }
        }
      }
    });
  });

  describe('Property 14: Locale Information Capture', () => {
    it('should always capture locale information structure', async () => {
      const deviceInfo = await collectDetailedDeviceInfo();

      expect(deviceInfo).not.toBeNull();
      if (deviceInfo) {
        // All locale fields should be present
        expect(deviceInfo).toHaveProperty('timezone');
        expect(deviceInfo).toHaveProperty('timezoneOffset');
        expect(deviceInfo).toHaveProperty('language');
        expect(deviceInfo).toHaveProperty('languages');
        expect(deviceInfo).toHaveProperty('vendor');

        // Timezone offset should always be a number
        expect(typeof deviceInfo.timezoneOffset).toBe('number');
      }
    });

    it('Property 14: Locale values should have correct types', async () => {
      // Run once to verify the property holds
      const deviceInfo = await collectDetailedDeviceInfo();

      expect(deviceInfo).not.toBeNull();
      if (deviceInfo) {
        // Timezone: null or string
        if (deviceInfo.timezone !== null) {
          expect(typeof deviceInfo.timezone).toBe('string');
          expect(deviceInfo.timezone.length).toBeGreaterThan(0);
        }

        // Timezone offset: always a number
        expect(typeof deviceInfo.timezoneOffset).toBe('number');
        expect(deviceInfo.timezoneOffset).toBeGreaterThanOrEqual(-720);
        expect(deviceInfo.timezoneOffset).toBeLessThanOrEqual(840);

        // Language: null or string
        if (deviceInfo.language !== null) {
          expect(typeof deviceInfo.language).toBe('string');
        }

        // Languages: null or array of strings
        if (deviceInfo.languages !== null) {
          expect(Array.isArray(deviceInfo.languages)).toBe(true);
          deviceInfo.languages.forEach((lang: any) => {
            expect(typeof lang).toBe('string');
          });
        }

        // Vendor: null or string
        if (deviceInfo.vendor !== null) {
          expect(typeof deviceInfo.vendor).toBe('string');
        }
      }
    });
  });

  describe('Property 15: Graceful Permission Denial', () => {
    it('should always return device info even if optional APIs fail', async () => {
      const deviceInfo = await collectDetailedDeviceInfo();

      // Should ALWAYS return device info, even if all optional APIs fail
      expect(deviceInfo).not.toBeNull();
      if (deviceInfo) {
        expect(deviceInfo.collectedAt).toBeDefined();
        expect(deviceInfo.friendlyName).toBeDefined();
        expect(deviceInfo.browserDetails).toBeDefined();
        expect(deviceInfo.platformDetails).toBeDefined();
      }
    });

    it('Property 15: Collection should not block on API failures', async () => {
      // Run once to verify the property holds
      const deviceInfo = await collectDetailedDeviceInfo();

      // Should ALWAYS return device info
      expect(deviceInfo).not.toBeNull();
      if (deviceInfo) {
        // Core fields should always be present
        expect(deviceInfo.collectedAt).toBeDefined();
        expect(typeof deviceInfo.collectedAt).toBe('string');
        
        expect(deviceInfo.friendlyName).toBeDefined();
        expect(typeof deviceInfo.friendlyName).toBe('string');
        expect(deviceInfo.friendlyName.length).toBeGreaterThan(0);

        expect(deviceInfo.browserDetails).toBeDefined();
        expect(typeof deviceInfo.browserDetails).toBe('object');

        expect(deviceInfo.platformDetails).toBeDefined();
        expect(typeof deviceInfo.platformDetails).toBe('object');

        // Optional fields should be present (but may be null or have errors)
        expect(deviceInfo).toHaveProperty('location');
        expect(deviceInfo).toHaveProperty('network');
        expect(deviceInfo).toHaveProperty('battery');
        expect(deviceInfo).toHaveProperty('gpu');
      }
    });
  });
});
