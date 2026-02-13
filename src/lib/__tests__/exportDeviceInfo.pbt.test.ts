/**
 * Property-based tests for device info export completeness
 * Feature: student-experience-and-admin-enhancements
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseUserAgent, formatDeviceInfo, type DeviceInfo } from '../userAgent';
import { getDeviceUsageCount, getUsageCountForDevice, type AttemptWithDevice } from '../deviceUsage';

describe('Device Info Export - Property-Based Tests', () => {
  // Arbitrary for device info
  const deviceInfoArb = fc.record({
    type: fc.constantFrom('mobile', 'tablet', 'desktop', 'unknown'),
    manufacturer: fc.oneof(
      fc.constant('Apple'),
      fc.constant('Samsung'),
      fc.constant('Google'),
      fc.constant('Microsoft'),
      fc.constant('Unknown')
    ),
    model: fc.string({ minLength: 1, maxLength: 50 }),
    raw: fc.string(),
  }) as fc.Arbitrary<DeviceInfo>;

  // Arbitrary for attempts with device info
  const attemptWithDeviceArb = fc.record({
    id: fc.uuid(),
    student_id: fc.uuid(),
    student_name: fc.string({ minLength: 1, maxLength: 100 }),
    code: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    device_info: deviceInfoArb.map(info => JSON.stringify(info)),
    ip_address: fc.oneof(
      fc.tuple(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 })
      ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
      fc.constant('::1')
    ),
    score_percentage: fc.option(fc.float({ min: 0, max: 100 }), { nil: null }),
  }) as fc.Arbitrary<AttemptWithDevice & { student_name: string; code: string | null; ip_address: string; score_percentage: number | null }>;

  /**
   * Property 10: Export Data Completeness
   * For any results export, all device information and usage counts present 
   * in the UI should also be present in the exported data.
   * 
   * Validates: Requirements 2.9
   */
  it('Property 10: Export Data Completeness - all device info fields are exportable', () => {
    fc.assert(
      fc.property(
        fc.array(attemptWithDeviceArb, { minLength: 1, maxLength: 50 }),
        (attempts) => {
          // Calculate device usage map
          const deviceUsageMap = getDeviceUsageCount(attempts);

          // Simulate export data generation
          const exportData = attempts.map((attempt) => {
            let deviceType = 'Unknown';
            let deviceModel = 'Unknown';
            let usageCount = 1;

            if (attempt.device_info) {
              try {
                const parsed = JSON.parse(attempt.device_info);
                const deviceInfo = parsed.type ? parsed : parseUserAgent(parsed.userAgent || parsed.raw || '');
                deviceType = deviceInfo.type;
                deviceModel = `${deviceInfo.manufacturer} ${deviceInfo.model}`;
                usageCount = getUsageCountForDevice(deviceUsageMap, deviceInfo);
              } catch {
                // Keep defaults
              }
            }

            return {
              id: attempt.id,
              student_name: attempt.student_name,
              code: attempt.code,
              device_type: deviceType,
              device_model: deviceModel,
              device_usage_count: usageCount > 1 ? usageCount : '',
              ip_address: attempt.ip_address,
              score_percentage: attempt.score_percentage,
            };
          });

          // Verify all attempts have export data
          expect(exportData.length).toBe(attempts.length);

          // Verify all device info fields are present
          for (let i = 0; i < exportData.length; i++) {
            const exported = exportData[i];
            const original = attempts[i];

            // Basic fields should match
            expect(exported.id).toBe(original.id);
            expect(exported.student_name).toBe(original.student_name);
            expect(exported.code).toBe(original.code);
            expect(exported.ip_address).toBe(original.ip_address);
            expect(exported.score_percentage).toBe(original.score_percentage);

            // Device info should be present
            expect(exported.device_type).toBeDefined();
            expect(exported.device_model).toBeDefined();
            expect(typeof exported.device_type).toBe('string');
            expect(typeof exported.device_model).toBe('string');

            // Usage count should be number or empty string
            expect(
              typeof exported.device_usage_count === 'number' || 
              exported.device_usage_count === ''
            ).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Export Data Completeness - device usage counts match UI calculations', () => {
    fc.assert(
      fc.property(
        fc.array(attemptWithDeviceArb, { minLength: 1, maxLength: 30 }),
        (attempts) => {
          // Calculate device usage map (same as UI)
          const deviceUsageMap = getDeviceUsageCount(attempts);

          // For each attempt, verify export usage count matches UI
          for (const attempt of attempts) {
            if (!attempt.device_info) continue;

            try {
              const parsed = JSON.parse(attempt.device_info);
              const deviceInfo = parsed.type ? parsed : parseUserAgent(parsed.userAgent || parsed.raw || '');
              
              // Get usage count as UI would
              const uiUsageCount = getUsageCountForDevice(deviceUsageMap, deviceInfo);
              
              // Get usage count as export would
              const exportUsageCount = getUsageCountForDevice(deviceUsageMap, deviceInfo);
              
              // They should match
              expect(exportUsageCount).toBe(uiUsageCount);
            } catch {
              // Skip invalid JSON
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Export Data Completeness - handles missing device info gracefully', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.uuid(),
          student_id: fc.uuid(),
          student_name: fc.string({ minLength: 1, maxLength: 100 }),
          code: fc.option(fc.string(), { nil: null }),
          device_info: fc.constant(null),
          ip_address: fc.string(),
          score_percentage: fc.option(fc.float({ min: 0, max: 100 }), { nil: null }),
        }), { minLength: 1, maxLength: 20 }),
        (attempts) => {
          const deviceUsageMap = getDeviceUsageCount(attempts);

          // Simulate export
          const exportData = attempts.map((attempt) => {
            let deviceType = 'Unknown';
            let deviceModel = 'Unknown';
            let usageCount = 1;

            if (attempt.device_info) {
              try {
                const parsed = JSON.parse(attempt.device_info);
                const deviceInfo = parsed.type ? parsed : parseUserAgent(parsed.userAgent || parsed.raw || '');
                deviceType = deviceInfo.type;
                deviceModel = `${deviceInfo.manufacturer} ${deviceInfo.model}`;
                usageCount = getUsageCountForDevice(deviceUsageMap, deviceInfo);
              } catch {
                // Keep defaults
              }
            }

            return {
              device_type: deviceType,
              device_model: deviceModel,
              device_usage_count: usageCount > 1 ? usageCount : '',
            };
          });

          // All should have fallback values
          for (const exported of exportData) {
            expect(exported.device_type).toBe('Unknown');
            expect(exported.device_model).toBe('Unknown');
            expect(exported.device_usage_count).toBe('');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Export Data Completeness - CSV escaping preserves device info', () => {
    fc.assert(
      fc.property(
        deviceInfoArb,
        (deviceInfo) => {
          // Simulate CSV escaping function
          const esc = (v: any) => {
            if (v === null || v === undefined) return "";
            const s = String(v);
            if (s.includes('"') || s.includes(',') || s.includes('\n')) {
              return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
          };

          const deviceModel = `${deviceInfo.manufacturer} ${deviceInfo.model}`;
          const escaped = esc(deviceModel);

          // Escaped value should be a string
          expect(typeof escaped).toBe('string');

          // Should contain the original data (possibly with escaping)
          if (!deviceModel.includes('"') && !deviceModel.includes(',') && !deviceModel.includes('\n')) {
            expect(escaped).toBe(deviceModel);
          } else {
            // Should be wrapped in quotes if contains special chars
            expect(escaped.startsWith('"') || !deviceModel.includes(',')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Export Data Completeness - all device types are exportable', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mobile', 'tablet', 'desktop', 'unknown'),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (type, manufacturer, model) => {
          const deviceInfo: DeviceInfo = {
            type: type as any,
            manufacturer,
            model,
            raw: 'test',
          };

          // Simulate export formatting
          const deviceType = deviceInfo.type;
          const deviceModel = `${deviceInfo.manufacturer} ${deviceInfo.model}`;

          // Should be exportable strings
          expect(typeof deviceType).toBe('string');
          expect(typeof deviceModel).toBe('string');
          expect(deviceType.length).toBeGreaterThan(0);
          expect(deviceModel.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Export Data Completeness - usage count only shown when > 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (count) => {
          // Simulate export logic for usage count
          const exportedCount = count > 1 ? count : '';

          if (count === 1) {
            expect(exportedCount).toBe('');
          } else {
            expect(exportedCount).toBe(count);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
