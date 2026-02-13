/**
 * Property-based tests for device usage counting
 * Feature: student-experience-and-admin-enhancements
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getDeviceUsageCount, getUsageCountForDevice, type AttemptWithDevice } from '../deviceUsage';
import { parseUserAgent, getDeviceIdentifier, type DeviceInfo } from '../userAgent';

describe('Device Usage Counting - Property-Based Tests', () => {
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
    device_info: deviceInfoArb.map(info => JSON.stringify(info)),
  }) as fc.Arbitrary<AttemptWithDevice>;

  /**
   * Property 9: Device Usage Counting Accuracy
   * For any set of exam attempts within the same exam, the device usage count 
   * for a specific device should equal the number of unique student IDs 
   * associated with that device's identifier.
   * 
   * Validates: Requirements 2.7, 2.8
   */
  it('Property 9: Device Usage Counting Accuracy - counts unique students per device correctly', () => {
    fc.assert(
      fc.property(
        fc.array(attemptWithDeviceArb, { minLength: 1, maxLength: 50 }),
        (attempts) => {
          // Get usage map
          const usageMap = getDeviceUsageCount(attempts);

          // Manually calculate expected counts
          const expectedCounts = new Map<string, Set<string>>();
          
          for (const attempt of attempts) {
            if (!attempt.device_info || !attempt.student_id) continue;

            try {
              const deviceInfo = JSON.parse(attempt.device_info) as DeviceInfo;
              const identifier = getDeviceIdentifier(deviceInfo);

              if (!expectedCounts.has(identifier)) {
                expectedCounts.set(identifier, new Set());
              }
              expectedCounts.get(identifier)!.add(attempt.student_id);
            } catch {
              // Skip invalid JSON
            }
          }

          // Verify each device in usage map matches expected count
          for (const [identifier, usage] of usageMap.entries()) {
            const expectedSet = expectedCounts.get(identifier);
            expect(expectedSet).toBeDefined();
            expect(usage.studentCount).toBe(expectedSet!.size);
            expect(usage.studentIds.length).toBe(expectedSet!.size);
            
            // Verify all student IDs are present
            for (const studentId of expectedSet!) {
              expect(usage.studentIds).toContain(studentId);
            }
          }

          // Verify all expected devices are in usage map
          expect(usageMap.size).toBe(expectedCounts.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Device Usage Counting Accuracy - handles duplicate student attempts on same device', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // student_id
        deviceInfoArb,
        fc.integer({ min: 1, max: 10 }), // number of attempts
        (studentId, deviceInfo, numAttempts) => {
          // Create multiple attempts from same student on same device
          const attempts: AttemptWithDevice[] = Array.from({ length: numAttempts }, (_, i) => ({
            id: `attempt-${i}`,
            student_id: studentId,
            device_info: JSON.stringify(deviceInfo),
          }));

          const usageMap = getDeviceUsageCount(attempts);
          const identifier = getDeviceIdentifier(deviceInfo);
          const usage = usageMap.get(identifier);

          // Should count student only once
          expect(usage).toBeDefined();
          expect(usage!.studentCount).toBe(1);
          expect(usage!.studentIds).toEqual([studentId]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Device Usage Counting Accuracy - handles multiple students on same device', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 20 }), // student IDs
        deviceInfoArb,
        (studentIds, deviceInfo) => {
          // Create one attempt per student on the same device
          const attempts: AttemptWithDevice[] = studentIds.map((studentId, i) => ({
            id: `attempt-${i}`,
            student_id: studentId,
            device_info: JSON.stringify(deviceInfo),
          }));

          const usageMap = getDeviceUsageCount(attempts);
          const identifier = getDeviceIdentifier(deviceInfo);
          const usage = usageMap.get(identifier);

          // Should count all unique students
          expect(usage).toBeDefined();
          expect(usage!.studentCount).toBe(studentIds.length);
          expect(usage!.studentIds.length).toBe(studentIds.length);
          
          // All student IDs should be present
          for (const studentId of studentIds) {
            expect(usage!.studentIds).toContain(studentId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Device Usage Counting Accuracy - handles attempts without device info', () => {
    fc.assert(
      fc.property(
        fc.array(attemptWithDeviceArb, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 10 }), // number of attempts without device info
        (validAttempts, numInvalid) => {
          // Add attempts without device info
          const invalidAttempts: AttemptWithDevice[] = Array.from({ length: numInvalid }, (_, i) => ({
            id: `invalid-${i}`,
            student_id: `student-${i}`,
            device_info: null,
          }));

          const allAttempts = [...validAttempts, ...invalidAttempts];
          const usageMap = getDeviceUsageCount(allAttempts);

          // Should only count valid attempts
          let totalExpectedStudents = 0;
          const expectedCounts = new Map<string, Set<string>>();
          
          for (const attempt of validAttempts) {
            if (!attempt.device_info || !attempt.student_id) continue;

            try {
              const deviceInfo = JSON.parse(attempt.device_info) as DeviceInfo;
              const identifier = getDeviceIdentifier(deviceInfo);

              if (!expectedCounts.has(identifier)) {
                expectedCounts.set(identifier, new Set());
              }
              expectedCounts.get(identifier)!.add(attempt.student_id);
            } catch {
              // Skip invalid JSON
            }
          }

          // Calculate total unique students across all devices
          for (const studentSet of expectedCounts.values()) {
            totalExpectedStudents += studentSet.size;
          }

          // Verify usage map matches expected
          let totalCountedStudents = 0;
          for (const usage of usageMap.values()) {
            totalCountedStudents += usage.studentCount;
          }

          expect(totalCountedStudents).toBe(totalExpectedStudents);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Device Usage Counting Accuracy - getUsageCountForDevice returns correct count', () => {
    fc.assert(
      fc.property(
        fc.array(attemptWithDeviceArb, { minLength: 1, maxLength: 30 }),
        (attempts) => {
          const usageMap = getDeviceUsageCount(attempts);

          // For each device in the map, verify getUsageCountForDevice returns correct count
          for (const [identifier, usage] of usageMap.entries()) {
            const count = getUsageCountForDevice(usageMap, usage.deviceInfo);
            expect(count).toBe(usage.studentCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Device Usage Counting Accuracy - handles malformed device_info JSON', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.uuid(),
          student_id: fc.uuid(),
          device_info: fc.oneof(
            fc.constant('invalid json'),
            fc.constant('{"incomplete":'),
            fc.constant('null'),
            fc.constant(''),
          ),
        }), { minLength: 1, maxLength: 10 }),
        (attempts) => {
          // Should not throw and should handle gracefully
          expect(() => {
            const usageMap = getDeviceUsageCount(attempts);
            
            // All entries should have Unknown device info
            for (const usage of usageMap.values()) {
              expect(usage.deviceInfo.manufacturer).toBe('Unknown');
              expect(usage.deviceInfo.model).toBe('Unknown');
            }
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
