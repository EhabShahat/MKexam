/**
 * Unit tests for user agent parsing
 * Tests common devices and edge cases
 */

import { describe, it, expect } from 'vitest';
import { parseUserAgent, formatDeviceInfo, getDeviceIdentifier } from '../userAgent';
import { USER_AGENTS } from '@/__tests__/utils/userAgent';

describe('User Agent Parsing - Unit Tests', () => {
  describe('iPhone devices', () => {
    it('should correctly parse iPhone 14 Pro', () => {
      const result = parseUserAgent(USER_AGENTS.iPhone14Pro);
      expect(result.type).toBe('mobile');
      expect(result.manufacturer).toBe('Apple');
      expect(result.model).toContain('iPhone');
      expect(result.raw).toBe(USER_AGENTS.iPhone14Pro);
    });

    it('should correctly parse iPhone 13', () => {
      const result = parseUserAgent(USER_AGENTS.iPhone13);
      expect(result.type).toBe('mobile');
      expect(result.manufacturer).toBe('Apple');
      expect(result.model).toContain('iPhone');
    });

    it('should correctly parse iPhone SE', () => {
      const result = parseUserAgent(USER_AGENTS.iPhoneSE);
      expect(result.type).toBe('mobile');
      expect(result.manufacturer).toBe('Apple');
      expect(result.model).toContain('iPhone');
    });
  });

  describe('Samsung devices', () => {
    it('should correctly parse Samsung Galaxy S23', () => {
      const result = parseUserAgent(USER_AGENTS.samsungGalaxyS23);
      expect(result.type).toBe('mobile');
      expect(result.manufacturer).toBe('Samsung');
      expect(result.model).toBe('SM-S911B');
    });

    it('should correctly parse Samsung Galaxy S22', () => {
      const result = parseUserAgent(USER_AGENTS.samsungGalaxyS22);
      expect(result.type).toBe('mobile');
      expect(result.manufacturer).toBe('Samsung');
      expect(result.model).toBe('SM-S901B');
    });

    it('should correctly parse Samsung Tablet', () => {
      const result = parseUserAgent(USER_AGENTS.samsungTab);
      expect(result.type).toBe('tablet');
      expect(result.manufacturer).toBe('Samsung');
      expect(result.model).toBe('SM-T870');
    });
  });

  describe('Google Pixel devices', () => {
    it('should correctly parse Google Pixel 7', () => {
      const result = parseUserAgent(USER_AGENTS.googlePixel7);
      expect(result.type).toBe('mobile');
      expect(result.manufacturer).toBe('Google');
      expect(result.model).toBe('Pixel 7');
    });

    it('should correctly parse Google Pixel 6', () => {
      const result = parseUserAgent(USER_AGENTS.googlePixel6);
      expect(result.type).toBe('mobile');
      expect(result.manufacturer).toBe('Google');
      expect(result.model).toBe('Pixel 6');
    });
  });

  describe('iPad devices', () => {
    it('should correctly parse iPad Pro', () => {
      const result = parseUserAgent(USER_AGENTS.iPadPro);
      expect(result.type).toBe('tablet');
      expect(result.manufacturer).toBe('Apple');
      expect(result.model).toContain('iPad');
    });

    it('should correctly parse iPad Air', () => {
      const result = parseUserAgent(USER_AGENTS.iPadAir);
      expect(result.type).toBe('tablet');
      expect(result.manufacturer).toBe('Apple');
      expect(result.model).toContain('iPad');
    });
  });

  describe('Other Android devices', () => {
    it('should correctly parse Xiaomi Redmi', () => {
      const result = parseUserAgent(USER_AGENTS.xiaomiRedmi);
      expect(result.type).toBe('mobile');
      expect(result.manufacturer).toBe('Xiaomi');
      expect(result.model).toContain('Redmi');
    });

    it('should correctly parse OnePlus 9', () => {
      const result = parseUserAgent(USER_AGENTS.onePlus9);
      expect(result.type).toBe('mobile');
      expect(result.manufacturer).toBe('OnePlus');
      expect(result.model).toBe('OnePlus 9');
    });
  });

  describe('Desktop browsers', () => {
    it('should correctly parse Chrome on Windows', () => {
      const result = parseUserAgent(USER_AGENTS.chromeWindows);
      expect(result.type).toBe('desktop');
      expect(result.manufacturer).toBe('Microsoft');
      expect(result.model).toBe('Chrome');
    });

    it('should correctly parse Chrome on Mac', () => {
      const result = parseUserAgent(USER_AGENTS.chromeMac);
      expect(result.type).toBe('desktop');
      expect(result.manufacturer).toBe('Apple');
      expect(result.model).toBe('Chrome');
    });

    it('should correctly parse Firefox on Windows', () => {
      const result = parseUserAgent(USER_AGENTS.firefoxWindows);
      expect(result.type).toBe('desktop');
      expect(result.manufacturer).toBe('Microsoft');
      expect(result.model).toBe('Firefox');
    });

    it('should correctly parse Firefox on Mac', () => {
      const result = parseUserAgent(USER_AGENTS.firefoxMac);
      expect(result.type).toBe('desktop');
      expect(result.manufacturer).toBe('Apple');
      expect(result.model).toBe('Firefox');
    });

    it('should correctly parse Safari on Mac', () => {
      const result = parseUserAgent(USER_AGENTS.safariMac);
      expect(result.type).toBe('desktop');
      expect(result.manufacturer).toBe('Apple');
      expect(result.model).toBe('Safari');
    });

    it('should correctly parse Edge on Windows', () => {
      const result = parseUserAgent(USER_AGENTS.edgeWindows);
      expect(result.type).toBe('desktop');
      expect(result.manufacturer).toBe('Microsoft');
      expect(result.model).toBe('Edge');
    });
  });

  describe('Edge cases and unknown devices', () => {
    it('should handle unknown user agent', () => {
      const result = parseUserAgent(USER_AGENTS.unknown);
      expect(result.type).toBe('unknown');
      expect(result.manufacturer).toBe('Unknown');
      expect(result.model).toBe('Unknown');
      expect(result.raw).toBe(USER_AGENTS.unknown);
    });

    it('should handle empty user agent', () => {
      const result = parseUserAgent(USER_AGENTS.empty);
      expect(result.type).toBe('unknown');
      expect(result.manufacturer).toBe('Unknown');
      expect(result.model).toBe('Unknown');
      expect(result.raw).toBe('');
    });

    it('should handle malformed user agent', () => {
      const result = parseUserAgent(USER_AGENTS.malformed);
      expect(result.type).toBe('unknown');
      expect(result.manufacturer).toBe('Unknown');
      expect(result.model).toBe('Unknown');
    });

    it('should handle old browser (IE6)', () => {
      const result = parseUserAgent(USER_AGENTS.oldBrowser);
      expect(result.type).toBe('desktop');
      expect(result.manufacturer).toBe('Microsoft');
      expect(result.model).toContain('MSIE');
    });

    it('should handle null user agent', () => {
      const result = parseUserAgent(null as any);
      expect(result.type).toBe('unknown');
      expect(result.manufacturer).toBe('Unknown');
      expect(result.model).toBe('Unknown');
    });

    it('should handle undefined user agent', () => {
      const result = parseUserAgent(undefined as any);
      expect(result.type).toBe('unknown');
      expect(result.manufacturer).toBe('Unknown');
      expect(result.model).toBe('Unknown');
    });

    it('should handle whitespace-only user agent', () => {
      const result = parseUserAgent('   ');
      expect(result.type).toBe('unknown');
      expect(result.manufacturer).toBe('Unknown');
      expect(result.model).toBe('Unknown');
    });
  });

  describe('formatDeviceInfo', () => {
    it('should format device info without usage count', () => {
      const deviceInfo = parseUserAgent(USER_AGENTS.samsungGalaxyS23);
      const formatted = formatDeviceInfo(deviceInfo);
      expect(formatted).toContain('Samsung');
      expect(formatted).toContain('SM-S911B');
      // Should not have usage count parentheses at the end
      expect(formatted).not.toMatch(/\(\d+\)$/);
    });

    it('should format device info with usage count of 1', () => {
      const deviceInfo = parseUserAgent(USER_AGENTS.iPhone14Pro);
      const formatted = formatDeviceInfo(deviceInfo, 1);
      expect(formatted).toContain('Apple');
      expect(formatted).toContain('iPhone');
      expect(formatted).not.toContain('(1)');
    });

    it('should format device info with usage count > 1', () => {
      const deviceInfo = parseUserAgent(USER_AGENTS.samsungGalaxyS23);
      const formatted = formatDeviceInfo(deviceInfo, 3);
      expect(formatted).toContain('Samsung');
      expect(formatted).toContain('SM-S911B');
      expect(formatted).toContain('(3)');
    });

    it('should format unknown device info', () => {
      const deviceInfo = parseUserAgent(USER_AGENTS.unknown);
      const formatted = formatDeviceInfo(deviceInfo);
      expect(formatted).toBe('Unknown');
    });

    it('should format unknown device with usage count', () => {
      const deviceInfo = parseUserAgent(USER_AGENTS.unknown);
      const formatted = formatDeviceInfo(deviceInfo, 5);
      expect(formatted).toBe('Unknown (5)');
    });
  });

  describe('getDeviceIdentifier', () => {
    it('should create unique identifier for iPhone', () => {
      const deviceInfo = parseUserAgent(USER_AGENTS.iPhone14Pro);
      const identifier = getDeviceIdentifier(deviceInfo);
      expect(identifier).toContain('Apple');
      expect(identifier).toContain('iPhone');
      expect(identifier).toContain(':');
    });

    it('should create unique identifier for Samsung', () => {
      const deviceInfo = parseUserAgent(USER_AGENTS.samsungGalaxyS23);
      const identifier = getDeviceIdentifier(deviceInfo);
      expect(identifier).toBe('Samsung:SM-S911B');
    });

    it('should create same identifier for same device', () => {
      const device1 = parseUserAgent(USER_AGENTS.googlePixel7);
      const device2 = parseUserAgent(USER_AGENTS.googlePixel7);
      expect(getDeviceIdentifier(device1)).toBe(getDeviceIdentifier(device2));
    });

    it('should create different identifiers for different devices', () => {
      const device1 = parseUserAgent(USER_AGENTS.googlePixel7);
      const device2 = parseUserAgent(USER_AGENTS.googlePixel6);
      expect(getDeviceIdentifier(device1)).not.toBe(getDeviceIdentifier(device2));
    });

    it('should handle unknown devices', () => {
      const deviceInfo = parseUserAgent(USER_AGENTS.unknown);
      const identifier = getDeviceIdentifier(deviceInfo);
      expect(identifier).toBe('Unknown:Unknown');
    });
  });

  describe('Device type detection', () => {
    it('should detect all mobile devices correctly', () => {
      const mobileAgents = [
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

      mobileAgents.forEach(ua => {
        const result = parseUserAgent(ua);
        expect(result.type).toBe('mobile');
      });
    });

    it('should detect all tablet devices correctly', () => {
      const tabletAgents = [
        USER_AGENTS.iPadPro,
        USER_AGENTS.iPadAir,
        USER_AGENTS.samsungTab,
      ];

      tabletAgents.forEach(ua => {
        const result = parseUserAgent(ua);
        expect(result.type).toBe('tablet');
      });
    });

    it('should detect all desktop devices correctly', () => {
      const desktopAgents = [
        USER_AGENTS.chromeWindows,
        USER_AGENTS.chromeMac,
        USER_AGENTS.firefoxWindows,
        USER_AGENTS.firefoxMac,
        USER_AGENTS.safariMac,
        USER_AGENTS.edgeWindows,
      ];

      desktopAgents.forEach(ua => {
        const result = parseUserAgent(ua);
        expect(result.type).toBe('desktop');
      });
    });
  });

  describe('Raw user agent preservation', () => {
    it('should preserve raw user agent string', () => {
      Object.values(USER_AGENTS).forEach(ua => {
        const result = parseUserAgent(ua);
        expect(result.raw).toBe(ua);
      });
    });
  });
});
