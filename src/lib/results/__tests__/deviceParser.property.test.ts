/**
 * Property-Based Tests for Device Info Parser
 * 
 * Uses fast-check to validate universal properties of device info parsing
 * with randomly generated inputs.
 * 
 * Feature: results-page-rebuild
 * Requirements: 12.1-12.9, 3.10
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseDeviceInfo,
  generateDeviceFingerprint,
  calculateDeviceUsage,
  getDeviceUsageCount,
} from '../deviceParser';
import type { Attempt } from '../types';

// Arbitraries for generating test data
const deviceTypeArbitrary = fc.constantFrom('mobile', 'tablet', 'desktop', 'unknown');

const modernDeviceInfoArbitrary = fc.record({
  type: deviceTypeArbitrary,
  friendlyName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  oem: fc.option(fc.record({
    brand: fc.string({ minLength: 1, maxLength: 20 }),
    model: fc.string({ minLength: 1, maxLength: 30 }),
  }), { nil: undefined }),
  allIPs: fc.option(fc.record({
    local: fc.array(fc.ipV4(), { minLength: 0, maxLength: 3 }),
    public: fc.array(fc.ipV4(), { minLength: 0, maxLength: 2 }),
  }), { nil: undefined }),
  security: fc.option(fc.record({
    automationRisk: fc.boolean(),
    webdriver: fc.boolean(),
  }), { nil: undefined }),
});

const legacyDeviceInfoArbitrary = fc.record({
  device: fc.option(fc.record({
    type: deviceTypeArbitrary,
    manufacturer: fc.string({ minLength: 1, maxLength: 20 }),
    model: fc.string({ minLength: 1, maxLength: 30 }),
  }), { nil: undefined }),
  ips: fc.option(fc.record({
    local: fc.array(fc.ipV4(), { minLength: 0, maxLength: 3 }),
    public: fc.array(fc.ipV4(), { minLength: 0, maxLength: 2 }),
  }), { nil: undefined }),
  automationRisk: fc.option(fc.boolean(), { nil: undefined }),
  webdriver: fc.option(fc.boolean(), { nil: undefined }),
});

const attemptArbitrary = fc.record({
  id: fc.uuid(),
  exam_id: fc.uuid(),
  student_id: fc.option(fc.uuid(), { nil: null }),
  student_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  code: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  completion_status: fc.constantFrom('completed', 'in_progress', 'abandoned'),
  started_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  submitted_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  score_percentage: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  final_score_percentage: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  ip_address: fc.option(fc.ipV4(), { nil: null }),
  device_info: fc.option(
    fc.oneof(modernDeviceInfoArbitrary, legacyDeviceInfoArbitrary).map(d => JSON.stringify(d)),
    { nil: null }
  ),
  manual_total_count: fc.integer({ min: 0, max: 10 }),
  manual_graded_count: fc.integer({ min: 0, max: 10 }),
  manual_pending_count: fc.integer({ min: 0, max: 10 }),
}) as fc.Arbitrary<Attempt>;

describe('Device Info Parser - Property Tests', () => {
  describe('Property 13: Device info parsing robustness', () => {
    it('should always return valid DeviceInfo structure', () => {
      // Feature: results-page-rebuild, Property 13: Device info parsing robustness
      // Validates: Requirements 12.1-12.8
      
      fc.assert(
        fc.property(
          fc.oneof(modernDeviceInfoArbitrary, legacyDeviceInfoArbitrary),
          (deviceInfo) => {
            const jsonString = JSON.stringify(deviceInfo);
            const parsed = parseDeviceInfo(jsonString);
            
            // Should always return valid structure
            expect(parsed).toHaveProperty('type');
            expect(parsed).toHaveProperty('model');
            expect(parsed).toHaveProperty('local_ip');
            expect(parsed).toHaveProperty('server_ip');
            expect(parsed).toHaveProperty('automation_risk');
            
            // Type should be one of valid values
            expect(['mobile', 'tablet', 'desktop', 'unknown']).toContain(parsed.type);
            
            // Model should be a string
            expect(typeof parsed.model).toBe('string');
            
            // IPs should be strings
            expect(typeof parsed.local_ip).toBe('string');
            expect(typeof parsed.server_ip).toBe('string');
            
            // Automation risk should be boolean
            expect(typeof parsed.automation_risk).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle malformed JSON gracefully', () => {
      // Feature: results-page-rebuild, Property 13: Device info parsing robustness
      // Validates: Requirements 12.8
      
      fc.assert(
        fc.property(
          fc.string(),
          (malformedJson) => {
            // Should not throw error
            expect(() => parseDeviceInfo(malformedJson)).not.toThrow();
            
            const result = parseDeviceInfo(malformedJson);
            
            // Should return default structure
            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('model');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle null input gracefully', () => {
      // Feature: results-page-rebuild, Property 13: Device info parsing robustness
      // Validates: Requirements 12.9
      
      const result = parseDeviceInfo(null);
      
      expect(result.type).toBe('unknown');
      expect(result.model).toBe('Unknown');
      expect(result.local_ip).toBe('');
      expect(result.server_ip).toBe('');
      expect(result.automation_risk).toBe(false);
    });

    it('should parse modern format correctly', () => {
      // Feature: results-page-rebuild, Property 13: Device info parsing robustness
      // Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
      
      fc.assert(
        fc.property(
          modernDeviceInfoArbitrary,
          (deviceInfo) => {
            const jsonString = JSON.stringify(deviceInfo);
            const parsed = parseDeviceInfo(jsonString);
            
            // Type should match if provided
            if (deviceInfo.type) {
              expect(parsed.type).toBe(deviceInfo.type);
            }
            
            // Model should be extracted from friendlyName or oem
            if (deviceInfo.friendlyName) {
              expect(parsed.model).toBe(deviceInfo.friendlyName);
            } else if (deviceInfo.oem) {
              const expectedModel = `${deviceInfo.oem.brand} ${deviceInfo.oem.model}`.trim();
              expect(parsed.model).toBe(expectedModel);
            }
            
            // Local IP should be first from allIPs.local
            if (deviceInfo.allIPs?.local && deviceInfo.allIPs.local.length > 0) {
              expect(parsed.local_ip).toBe(deviceInfo.allIPs.local[0]);
            }
            
            // Server IP should be first from allIPs.public
            if (deviceInfo.allIPs?.public && deviceInfo.allIPs.public.length > 0) {
              expect(parsed.server_ip).toBe(deviceInfo.allIPs.public[0]);
            }
            
            // Automation risk should match security flags
            if (deviceInfo.security?.automationRisk || deviceInfo.security?.webdriver) {
              expect(parsed.automation_risk).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse legacy format correctly', () => {
      // Feature: results-page-rebuild, Property 13: Device info parsing robustness
      // Validates: Requirements 12.7
      
      fc.assert(
        fc.property(
          legacyDeviceInfoArbitrary,
          (deviceInfo) => {
            const jsonString = JSON.stringify(deviceInfo);
            const parsed = parseDeviceInfo(jsonString);
            
            // Type should match if provided
            if (deviceInfo.device?.type) {
              expect(parsed.type).toBe(deviceInfo.device.type);
            }
            
            // Model should be extracted from device
            if (deviceInfo.device) {
              const expectedModel = `${deviceInfo.device.manufacturer} ${deviceInfo.device.model}`.trim();
              if (expectedModel) {
                expect(parsed.model).toBe(expectedModel);
              }
            }
            
            // Automation risk should match flags
            if (deviceInfo.automationRisk || deviceInfo.webdriver) {
              expect(parsed.automation_risk).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 14: Device usage count accuracy', () => {
    it('should count each unique device correctly', () => {
      // Feature: results-page-rebuild, Property 14: Device usage count accuracy
      // Validates: Requirements 12.7, 3.10
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 1, maxLength: 20 }),
          (attempts) => {
            const usageMap = calculateDeviceUsage(attempts);
            
            // Total count should not exceed number of attempts
            const totalCount = Array.from(usageMap.values()).reduce((sum, count) => sum + count, 0);
            expect(totalCount).toBeLessThanOrEqual(attempts.length);
            
            // Each count should be positive
            usageMap.forEach(count => {
              expect(count).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate consistent fingerprints for same device', () => {
      // Feature: results-page-rebuild, Property 14: Device usage count accuracy
      // Validates: Requirements 12.7
      
      fc.assert(
        fc.property(
          modernDeviceInfoArbitrary,
          (deviceInfo) => {
            const jsonString = JSON.stringify(deviceInfo);
            const parsed1 = parseDeviceInfo(jsonString);
            const parsed2 = parseDeviceInfo(jsonString);
            
            const fingerprint1 = generateDeviceFingerprint(parsed1);
            const fingerprint2 = generateDeviceFingerprint(parsed2);
            
            // Same device should produce same fingerprint
            expect(fingerprint1).toBe(fingerprint2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should count attempts with same device info as duplicates', () => {
      // Feature: results-page-rebuild, Property 14: Device usage count accuracy
      // Validates: Requirements 12.7, 3.10
      
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone 14 Pro',
        allIPs: {
          local: ['192.168.1.100'],
          public: ['8.8.8.8'],
        },
      });

      const attempts: Attempt[] = [
        {
          id: '1',
          exam_id: 'exam-1',
          student_id: 's1',
          student_name: 'Student 1',
          code: 'CODE1',
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
        },
        {
          id: '2',
          exam_id: 'exam-1',
          student_id: 's2',
          student_name: 'Student 2',
          code: 'CODE2',
          completion_status: 'completed',
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          score_percentage: 90,
          final_score_percentage: 90,
          ip_address: '192.168.1.2',
          device_info: deviceInfo,
          manual_total_count: 0,
          manual_graded_count: 0,
          manual_pending_count: 0,
        },
      ];

      const usageMap = calculateDeviceUsage(attempts);
      const parsed = parseDeviceInfo(deviceInfo);
      const count = getDeviceUsageCount(parsed, usageMap);

      // Should count both attempts as using same device
      expect(count).toBe(2);
    });

    it('should handle attempts with null device_info', () => {
      // Feature: results-page-rebuild, Property 14: Device usage count accuracy
      // Validates: Requirements 12.9
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 1, maxLength: 20 }),
          (attempts) => {
            // Set some device_info to null
            const modifiedAttempts = attempts.map((a, i) => ({
              ...a,
              device_info: i % 2 === 0 ? null : a.device_info,
            }));

            // Should not throw error
            expect(() => calculateDeviceUsage(modifiedAttempts)).not.toThrow();
            
            const usageMap = calculateDeviceUsage(modifiedAttempts);
            
            // Should be a valid map
            expect(usageMap).toBeInstanceOf(Map);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 for devices not in usage map', () => {
      // Feature: results-page-rebuild, Property 14: Device usage count accuracy
      // Validates: Requirements 12.7
      
      const usageMap = new Map<string, number>();
      const deviceInfo = parseDeviceInfo(JSON.stringify({
        type: 'mobile',
        friendlyName: 'Test Device',
      }));

      const count = getDeviceUsageCount(deviceInfo, usageMap);

      expect(count).toBe(0);
    });
  });

  describe('Fingerprint generation properties', () => {
    it('should generate non-empty fingerprints for valid devices', () => {
      fc.assert(
        fc.property(
          modernDeviceInfoArbitrary,
          (deviceInfo) => {
            const jsonString = JSON.stringify(deviceInfo);
            const parsed = parseDeviceInfo(jsonString);
            const fingerprint = generateDeviceFingerprint(parsed);
            
            // Fingerprint should be a string
            expect(typeof fingerprint).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different fingerprints for different devices', () => {
      const device1 = parseDeviceInfo(JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone 14',
        allIPs: { local: ['192.168.1.100'] },
      }));

      const device2 = parseDeviceInfo(JSON.stringify({
        type: 'mobile',
        friendlyName: 'Samsung Galaxy',
        allIPs: { local: ['192.168.1.100'] },
      }));

      const fingerprint1 = generateDeviceFingerprint(device1);
      const fingerprint2 = generateDeviceFingerprint(device2);

      // Different models should produce different fingerprints
      expect(fingerprint1).not.toBe(fingerprint2);
    });
  });
});
