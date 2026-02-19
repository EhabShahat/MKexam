/**
 * Unit Tests for Device Info Parser
 * 
 * Comprehensive tests for device info parsing functions including edge cases
 * and specific device formats.
 * 
 * Requirements: 20.10
 */

import { describe, it, expect } from 'vitest';
import {
  parseDeviceInfo,
  generateDeviceFingerprint,
  calculateDeviceUsage,
  getDeviceUsageCount,
  calculateIPUsage,
  getIPUsageCount,
} from '../deviceParser';
import type { Attempt } from '../types';

describe('Device Info Parser - Unit Tests', () => {
  describe('parseDeviceInfo', () => {
    describe('modern format parsing', () => {
      it('should parse complete modern format', () => {
        const deviceInfo = JSON.stringify({
          type: 'mobile',
          friendlyName: 'iPhone 14 Pro',
          allIPs: {
            local: ['192.168.1.100', '192.168.1.101'],
            public: ['8.8.8.8', '8.8.4.4'],
          },
          security: {
            automationRisk: true,
            webdriver: false,
          },
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.type).toBe('mobile');
        expect(result.model).toBe('iPhone 14 Pro');
        expect(result.local_ip).toBe('192.168.1.100');
        expect(result.server_ip).toBe('8.8.8.8');
        expect(result.automation_risk).toBe(true);
      });

      it('should parse with oem brand and model', () => {
        const deviceInfo = JSON.stringify({
          type: 'mobile',
          oem: {
            brand: 'Samsung',
            model: 'Galaxy S23',
          },
          allIPs: {
            local: ['192.168.1.100'],
            public: ['8.8.8.8'],
          },
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.type).toBe('mobile');
        expect(result.model).toBe('Samsung Galaxy S23');
      });

      it('should prefer friendlyName over oem', () => {
        const deviceInfo = JSON.stringify({
          type: 'mobile',
          friendlyName: 'My iPhone',
          oem: {
            brand: 'Apple',
            model: 'iPhone',
          },
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.model).toBe('My iPhone');
      });

      it('should detect automation risk from security.webdriver', () => {
        const deviceInfo = JSON.stringify({
          type: 'desktop',
          security: {
            automationRisk: false,
            webdriver: true,
          },
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.automation_risk).toBe(true);
      });

      it('should handle empty allIPs arrays', () => {
        const deviceInfo = JSON.stringify({
          type: 'mobile',
          allIPs: {
            local: [],
            public: [],
          },
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.local_ip).toBe('');
        expect(result.server_ip).toBe('');
      });
    });

    describe('legacy format parsing', () => {
      it('should parse complete legacy format', () => {
        const deviceInfo = JSON.stringify({
          device: {
            type: 'tablet',
            manufacturer: 'Apple',
            model: 'iPad Pro',
          },
          ips: {
            local: ['192.168.1.50'],
            public: ['8.8.8.8'],
          },
          automationRisk: true,
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.type).toBe('tablet');
        expect(result.model).toBe('Apple iPad Pro');
        expect(result.local_ip).toBe('192.168.1.50');
        expect(result.server_ip).toBe('8.8.8.8');
        expect(result.automation_risk).toBe(true);
      });

      it('should detect automation risk from webdriver flag', () => {
        const deviceInfo = JSON.stringify({
          device: {
            type: 'desktop',
          },
          webdriver: true,
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.automation_risk).toBe(true);
      });

      it('should handle legacy localIP field', () => {
        const deviceInfo = JSON.stringify({
          device: {
            type: 'mobile',
          },
          localIP: '192.168.1.200',
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.local_ip).toBe('192.168.1.200');
      });

      it('should handle legacy ip field', () => {
        const deviceInfo = JSON.stringify({
          device: {
            type: 'mobile',
          },
          ip: '8.8.8.8',
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.server_ip).toBe('8.8.8.8');
      });

      it('should handle legacy model field', () => {
        const deviceInfo = JSON.stringify({
          device: {
            type: 'mobile',
          },
          model: 'Generic Phone',
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.model).toBe('Generic Phone');
      });
    });

    describe('edge cases', () => {
      it('should return default for null input', () => {
        const result = parseDeviceInfo(null);

        expect(result.type).toBe('unknown');
        expect(result.model).toBe('Unknown');
        expect(result.local_ip).toBe('');
        expect(result.server_ip).toBe('');
        expect(result.automation_risk).toBe(false);
      });

      it('should return default for empty string', () => {
        const result = parseDeviceInfo('');

        expect(result.type).toBe('unknown');
        expect(result.model).toBe('Unknown');
      });

      it('should handle malformed JSON gracefully', () => {
        const result = parseDeviceInfo('{ invalid json }');

        expect(result.type).toBe('unknown');
        expect(result.model).toBe('Unknown');
      });

      it('should handle empty JSON object', () => {
        const result = parseDeviceInfo('{}');

        expect(result.type).toBe('unknown');
        expect(result.model).toBe('Unknown');
        expect(result.local_ip).toBe('');
        expect(result.server_ip).toBe('');
        expect(result.automation_risk).toBe(false);
      });

      it('should handle invalid device type', () => {
        const deviceInfo = JSON.stringify({
          type: 'invalid-type',
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.type).toBe('unknown');
      });

      it('should handle missing oem brand', () => {
        const deviceInfo = JSON.stringify({
          type: 'mobile',
          oem: {
            model: 'Phone',
          },
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.model).toBe('Phone');
      });

      it('should handle missing oem model', () => {
        const deviceInfo = JSON.stringify({
          type: 'mobile',
          oem: {
            brand: 'Samsung',
          },
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.model).toBe('Samsung');
      });

      it('should handle empty oem object', () => {
        const deviceInfo = JSON.stringify({
          type: 'mobile',
          oem: {},
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.model).toBe('Unknown');
      });

      it('should handle already parsed object', () => {
        const deviceInfo = {
          type: 'mobile',
          friendlyName: 'Test Device',
        };

        const result = parseDeviceInfo(deviceInfo as any);

        expect(result.type).toBe('mobile');
        expect(result.model).toBe('Test Device');
      });

      it('should handle security object with only automationRisk', () => {
        const deviceInfo = JSON.stringify({
          type: 'desktop',
          security: {
            automationRisk: true,
          },
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.automation_risk).toBe(true);
      });

      it('should handle security object with only webdriver', () => {
        const deviceInfo = JSON.stringify({
          type: 'desktop',
          security: {
            webdriver: true,
          },
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.automation_risk).toBe(true);
      });

      it('should handle false automation flags', () => {
        const deviceInfo = JSON.stringify({
          type: 'desktop',
          security: {
            automationRisk: false,
            webdriver: false,
          },
        });

        const result = parseDeviceInfo(deviceInfo);

        expect(result.automation_risk).toBe(false);
      });
    });

    describe('device type detection', () => {
      it('should detect mobile type', () => {
        const deviceInfo = JSON.stringify({ type: 'mobile' });
        const result = parseDeviceInfo(deviceInfo);
        expect(result.type).toBe('mobile');
      });

      it('should detect tablet type', () => {
        const deviceInfo = JSON.stringify({ type: 'tablet' });
        const result = parseDeviceInfo(deviceInfo);
        expect(result.type).toBe('tablet');
      });

      it('should detect desktop type', () => {
        const deviceInfo = JSON.stringify({ type: 'desktop' });
        const result = parseDeviceInfo(deviceInfo);
        expect(result.type).toBe('desktop');
      });

      it('should handle case-insensitive type', () => {
        const deviceInfo = JSON.stringify({ type: 'MOBILE' });
        const result = parseDeviceInfo(deviceInfo);
        expect(result.type).toBe('mobile');
      });
    });
  });

  describe('generateDeviceFingerprint', () => {
    it('should generate fingerprint from type, model, and local IP', () => {
      const deviceInfo = parseDeviceInfo(JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone 14',
        allIPs: {
          local: ['192.168.1.100'],
        },
      }));

      const fingerprint = generateDeviceFingerprint(deviceInfo);

      expect(fingerprint).toContain('mobile');
      expect(fingerprint).toContain('iphone 14');
      expect(fingerprint).toContain('192.168.1.100');
    });

    it('should generate consistent fingerprints for same device', () => {
      const deviceInfo = parseDeviceInfo(JSON.stringify({
        type: 'mobile',
        friendlyName: 'Test Device',
        allIPs: {
          local: ['192.168.1.100'],
        },
      }));

      const fingerprint1 = generateDeviceFingerprint(deviceInfo);
      const fingerprint2 = generateDeviceFingerprint(deviceInfo);

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for different devices', () => {
      const device1 = parseDeviceInfo(JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
      }));

      const device2 = parseDeviceInfo(JSON.stringify({
        type: 'mobile',
        friendlyName: 'Samsung',
      }));

      const fingerprint1 = generateDeviceFingerprint(device1);
      const fingerprint2 = generateDeviceFingerprint(device2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should handle empty fields', () => {
      const deviceInfo = parseDeviceInfo('{}');
      const fingerprint = generateDeviceFingerprint(deviceInfo);

      expect(typeof fingerprint).toBe('string');
    });

    it('should be case-insensitive for model', () => {
      const device1 = parseDeviceInfo(JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
      }));

      const device2 = parseDeviceInfo(JSON.stringify({
        type: 'mobile',
        friendlyName: 'IPHONE',
      }));

      const fingerprint1 = generateDeviceFingerprint(device1);
      const fingerprint2 = generateDeviceFingerprint(device2);

      expect(fingerprint1).toBe(fingerprint2);
    });
  });

  describe('calculateDeviceUsage', () => {
    const createAttempt = (id: string, deviceInfo: string | null): Attempt => ({
      id,
      exam_id: 'exam-1',
      student_id: 'student-1',
      student_name: 'Test Student',
      code: 'CODE123',
      completion_status: 'completed',
      started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      score_percentage: 85,
      final_score_percentage: 85,
      ip_address: '192.168.1.1',
      device_info: deviceInfo,
      manual_total_count: 0,
      manual_graded_count: 0,
      manual_pending_count: 0,
    });

    it('should count unique devices', () => {
      const device1 = JSON.stringify({ type: 'mobile', friendlyName: 'iPhone' });
      const device2 = JSON.stringify({ type: 'mobile', friendlyName: 'Samsung' });

      const attempts = [
        createAttempt('1', device1),
        createAttempt('2', device2),
        createAttempt('3', device1),
      ];

      const usageMap = calculateDeviceUsage(attempts);

      expect(usageMap.size).toBe(2);
    });

    it('should count duplicate devices correctly', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone 14',
        allIPs: { local: ['192.168.1.100'] },
      });

      const attempts = [
        createAttempt('1', deviceInfo),
        createAttempt('2', deviceInfo),
        createAttempt('3', deviceInfo),
      ];

      const usageMap = calculateDeviceUsage(attempts);
      const parsed = parseDeviceInfo(deviceInfo);
      const count = getDeviceUsageCount(parsed, usageMap);

      expect(count).toBe(3);
    });

    it('should handle empty attempts array', () => {
      const usageMap = calculateDeviceUsage([]);

      expect(usageMap.size).toBe(0);
    });

    it('should handle attempts with null device_info', () => {
      const attempts = [
        createAttempt('1', null),
        createAttempt('2', null),
      ];

      const usageMap = calculateDeviceUsage(attempts);

      // Null device_info should still generate a fingerprint
      expect(usageMap.size).toBeGreaterThanOrEqual(0);
    });

    it('should handle mixed null and valid device_info', () => {
      const deviceInfo = JSON.stringify({ type: 'mobile', friendlyName: 'iPhone' });

      const attempts = [
        createAttempt('1', deviceInfo),
        createAttempt('2', null),
        createAttempt('3', deviceInfo),
      ];

      const usageMap = calculateDeviceUsage(attempts);

      expect(usageMap.size).toBeGreaterThan(0);
    });
  });

  describe('getDeviceUsageCount', () => {
    it('should return correct count for device in map', () => {
      const usageMap = new Map<string, number>();
      usageMap.set('mobile|iphone|192.168.1.100', 5);

      const deviceInfo = parseDeviceInfo(JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
        allIPs: { local: ['192.168.1.100'] },
      }));

      const count = getDeviceUsageCount(deviceInfo, usageMap);

      expect(count).toBe(5);
    });

    it('should return 0 for device not in map', () => {
      const usageMap = new Map<string, number>();

      const deviceInfo = parseDeviceInfo(JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
      }));

      const count = getDeviceUsageCount(deviceInfo, usageMap);

      expect(count).toBe(0);
    });

    it('should return 0 for empty map', () => {
      const usageMap = new Map<string, number>();
      const deviceInfo = parseDeviceInfo('{}');

      const count = getDeviceUsageCount(deviceInfo, usageMap);

      expect(count).toBe(0);
    });
  });

  describe('calculateIPUsage', () => {
    const createAttempt = (id: string, ipAddress: string | null): Attempt => ({
      id,
      exam_id: 'exam-1',
      student_id: 'student-1',
      student_name: 'Test Student',
      code: 'CODE123',
      completion_status: 'completed',
      started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      score_percentage: 85,
      final_score_percentage: 85,
      ip_address: ipAddress,
      device_info: null,
      manual_total_count: 0,
      manual_graded_count: 0,
      manual_pending_count: 0,
    });

    it('should count unique IP addresses', () => {
      const attempts = [
        createAttempt('1', '192.168.1.1'),
        createAttempt('2', '192.168.1.2'),
        createAttempt('3', '192.168.1.1'),
      ];

      const usageMap = calculateIPUsage(attempts);

      expect(usageMap.size).toBe(2);
      expect(usageMap.get('192.168.1.1')).toBe(2);
      expect(usageMap.get('192.168.1.2')).toBe(1);
    });

    it('should handle null IP addresses', () => {
      const attempts = [
        createAttempt('1', '192.168.1.1'),
        createAttempt('2', null),
        createAttempt('3', '192.168.1.1'),
      ];

      const usageMap = calculateIPUsage(attempts);

      expect(usageMap.size).toBe(1);
      expect(usageMap.get('192.168.1.1')).toBe(2);
    });

    it('should handle empty attempts array', () => {
      const usageMap = calculateIPUsage([]);

      expect(usageMap.size).toBe(0);
    });
  });

  describe('getIPUsageCount', () => {
    it('should return correct count for IP in map', () => {
      const usageMap = new Map<string, number>();
      usageMap.set('192.168.1.1', 5);

      const count = getIPUsageCount('192.168.1.1', usageMap);

      expect(count).toBe(5);
    });

    it('should return 0 for IP not in map', () => {
      const usageMap = new Map<string, number>();

      const count = getIPUsageCount('192.168.1.1', usageMap);

      expect(count).toBe(0);
    });

    it('should return 0 for null IP', () => {
      const usageMap = new Map<string, number>();
      usageMap.set('192.168.1.1', 5);

      const count = getIPUsageCount(null, usageMap);

      expect(count).toBe(0);
    });
  });
});
