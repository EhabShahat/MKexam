/**
 * Tests for user agent test utilities
 */

import { describe, it, expect } from 'vitest';
import {
  USER_AGENTS,
  EXPECTED_DEVICE_INFO,
  generateUserAgentByType,
  getMobileUserAgents,
  getTabletUserAgents,
  getDesktopUserAgents,
  getEdgeCaseUserAgents,
  createMockRequest,
} from './userAgent';

describe('user agent test utilities', () => {
  describe('USER_AGENTS', () => {
    it('should contain common mobile user agents', () => {
      expect(USER_AGENTS.iPhone14Pro).toContain('iPhone');
      expect(USER_AGENTS.samsungGalaxyS23).toContain('SM-S911B');
      expect(USER_AGENTS.googlePixel7).toContain('Pixel 7');
    });

    it('should contain tablet user agents', () => {
      expect(USER_AGENTS.iPadPro).toContain('iPad');
      expect(USER_AGENTS.samsungTab).toContain('SM-T870');
    });

    it('should contain desktop user agents', () => {
      expect(USER_AGENTS.chromeWindows).toContain('Windows');
      expect(USER_AGENTS.firefoxMac).toContain('Macintosh');
      expect(USER_AGENTS.safariMac).toContain('Safari');
    });

    it('should contain edge case user agents', () => {
      expect(USER_AGENTS.unknown).toBe('UnknownBrowser/1.0');
      expect(USER_AGENTS.empty).toBe('');
      expect(USER_AGENTS.malformed).toBe('Mozilla/5.0 ()');
    });
  });

  describe('EXPECTED_DEVICE_INFO', () => {
    it('should have correct device types', () => {
      expect(EXPECTED_DEVICE_INFO.iPhone14Pro.type).toBe('mobile');
      expect(EXPECTED_DEVICE_INFO.iPadPro.type).toBe('tablet');
      expect(EXPECTED_DEVICE_INFO.chromeWindows.type).toBe('desktop');
      expect(EXPECTED_DEVICE_INFO.unknown.type).toBe('unknown');
    });

    it('should have manufacturer information', () => {
      expect(EXPECTED_DEVICE_INFO.iPhone14Pro.manufacturer).toBe('Apple');
      expect(EXPECTED_DEVICE_INFO.samsungGalaxyS23.manufacturer).toBe('Samsung');
      expect(EXPECTED_DEVICE_INFO.googlePixel7.manufacturer).toBe('Google');
    });
  });

  describe('generateUserAgentByType', () => {
    it('should generate mobile user agent', () => {
      const ua = generateUserAgentByType('mobile');
      const mobileAgents = getMobileUserAgents();
      expect(mobileAgents).toContain(ua);
    });

    it('should generate tablet user agent', () => {
      const ua = generateUserAgentByType('tablet');
      const tabletAgents = getTabletUserAgents();
      expect(tabletAgents).toContain(ua);
    });

    it('should generate desktop user agent', () => {
      const ua = generateUserAgentByType('desktop');
      const desktopAgents = getDesktopUserAgents();
      expect(desktopAgents).toContain(ua);
    });

    it('should generate unknown user agent', () => {
      const ua = generateUserAgentByType('unknown');
      const edgeCaseAgents = getEdgeCaseUserAgents();
      expect(edgeCaseAgents).toContain(ua);
    });
  });

  describe('getMobileUserAgents', () => {
    it('should return array of mobile user agents', () => {
      const agents = getMobileUserAgents();
      expect(agents.length).toBeGreaterThan(0);
      expect(agents).toContain(USER_AGENTS.iPhone14Pro);
      expect(agents).toContain(USER_AGENTS.samsungGalaxyS23);
    });
  });

  describe('getTabletUserAgents', () => {
    it('should return array of tablet user agents', () => {
      const agents = getTabletUserAgents();
      expect(agents.length).toBeGreaterThan(0);
      expect(agents).toContain(USER_AGENTS.iPadPro);
      expect(agents).toContain(USER_AGENTS.samsungTab);
    });
  });

  describe('getDesktopUserAgents', () => {
    it('should return array of desktop user agents', () => {
      const agents = getDesktopUserAgents();
      expect(agents.length).toBeGreaterThan(0);
      expect(agents).toContain(USER_AGENTS.chromeWindows);
      expect(agents).toContain(USER_AGENTS.safariMac);
    });
  });

  describe('getEdgeCaseUserAgents', () => {
    it('should return array of edge case user agents', () => {
      const agents = getEdgeCaseUserAgents();
      expect(agents.length).toBeGreaterThan(0);
      expect(agents).toContain(USER_AGENTS.unknown);
      expect(agents).toContain(USER_AGENTS.empty);
      expect(agents).toContain(USER_AGENTS.malformed);
    });
  });

  describe('createMockRequest', () => {
    it('should create request with user agent header', () => {
      const request = createMockRequest(USER_AGENTS.iPhone14Pro);
      expect(request.headers.get('user-agent')).toBe(USER_AGENTS.iPhone14Pro);
    });

    it('should support overrides', () => {
      const request = createMockRequest(USER_AGENTS.iPhone14Pro, {
        method: 'POST',
      } as any);
      expect(request.headers.get('user-agent')).toBe(USER_AGENTS.iPhone14Pro);
      expect(request.method).toBe('POST');
    });
  });
});
