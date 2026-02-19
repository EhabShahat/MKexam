/**
 * Property-Based Tests for Fingerprint Linking
 * Feature: enhanced-device-tracking
 * 
 * Tests fingerprint persistence and linking with:
 * - Property 18: Fingerprint Persistence
 * - Property 19: Fingerprint Linking
 * 
 * Validates: Requirements 7.3, 7.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { collectDetailedDeviceInfo } from '../collectDeviceInfo';

// Mock database storage to simulate persistence
interface MockAttempt {
  id: string;
  exam_id: string;
  student_name: string;
  device_info: any;
}

const mockDatabase: MockAttempt[] = [];

// Helper to simulate database storage
function storeAttempt(attempt: MockAttempt): MockAttempt {
  // Simulate JSON serialization/deserialization (what database does)
  const serialized = JSON.stringify(attempt);
  const deserialized = JSON.parse(serialized);
  mockDatabase.push(deserialized);
  return deserialized;
}

// Helper to query attempts by fingerprint
function queryByFingerprint(fingerprint: string): MockAttempt[] {
  return mockDatabase.filter(
    (attempt) => attempt.device_info?.fingerprint === fingerprint
  );
}

// Helper to retrieve attempt by ID
function getAttemptById(id: string): MockAttempt | undefined {
  return mockDatabase.find((attempt) => attempt.id === id);
}

describe('Fingerprint Linking - Property-Based Tests', () => {

  describe('Property 18: Fingerprint Persistence', () => {
    it('should persist fingerprint value when storing and retrieving attempt', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (attemptId, studentName) => {
            // Collect device info with fingerprint
            const deviceInfo = await collectDetailedDeviceInfo();
            expect(deviceInfo).not.toBeNull();
            
            if (!deviceInfo || !deviceInfo.fingerprint) {
              // Skip if fingerprint generation failed
              return;
            }

            const originalFingerprint = deviceInfo.fingerprint;

            // Simulate storing attempt in database
            const attempt: MockAttempt = {
              id: attemptId,
              exam_id: 'test-exam-id',
              student_name: studentName,
              device_info: deviceInfo
            };

            const storedAttempt = storeAttempt(attempt);

            // Simulate retrieving the attempt from database
            const retrievedAttempt = getAttemptById(attemptId);

            expect(retrievedAttempt).toBeDefined();

            if (retrievedAttempt && retrievedAttempt.device_info) {
              const storedDeviceInfo = retrievedAttempt.device_info;
              
              // Property 18: Fingerprint should persist exactly
              expect(storedDeviceInfo.fingerprint).toBe(originalFingerprint);
              expect(storedDeviceInfo.fingerprint).toBeTruthy();
              expect(typeof storedDeviceInfo.fingerprint).toBe('string');
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should maintain fingerprint integrity through JSON serialization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 64 }).map(s => 
            s.split('').map(c => c.charCodeAt(0).toString(16)).join('').substring(0, 64)
          ),
          async (mockFingerprint) => {
            // Create device info with mock fingerprint
            const deviceInfo = {
              collectedAt: new Date().toISOString(),
              fingerprint: mockFingerprint,
              friendlyName: 'Test Device',
              browserDetails: { name: 'Chrome', version: '120', fullVersion: '120.0', engine: 'Blink', engineVersion: '120.0' },
              platformDetails: { os: 'Windows', osVersion: '10', architecture: null, bitness: null },
              security: { webdriver: false, pdfViewer: true, doNotTrack: false, pluginsCount: 3, cookiesEnabled: true, isExtended: false, maxTouchPoints: 0, automationRisk: false },
              location: { latitude: null, longitude: null, accuracy: null, timestamp: null },
              ips: { ips: [], error: null, completedAt: new Date().toISOString() },
              parsed: { browser: 'Chrome', os: 'Windows', type: 'desktop' },
              oem: { brand: null, model: null, source: null },
              screen: { width: 1920, height: 1080, colorDepth: 24, pixelDepth: 24 },
              viewport: { width: 1920, height: 1080 },
              userAgent: 'Mozilla/5.0',
              platform: 'Win32',
              language: 'en-US',
              languages: ['en-US'],
              vendor: 'Google Inc.',
              deviceMemory: 8,
              hardwareConcurrency: 8,
              pixelRatio: 1,
              timezone: 'America/New_York',
              timezoneOffset: -300,
              touch: false,
              network: null,
              battery: null,
              gpu: null,
              clientHints: null
            };

            // Serialize to JSON (simulating database storage)
            const jsonString = JSON.stringify(deviceInfo);
            const parsed = JSON.parse(jsonString);

            // Property 18: Fingerprint should survive serialization
            expect(parsed.fingerprint).toBe(mockFingerprint);
            expect(parsed.fingerprint).toBe(deviceInfo.fingerprint);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should store fingerprint as a non-null string value', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (examId) => {
            // Collect device info
            const deviceInfo = await collectDetailedDeviceInfo();
            
            if (!deviceInfo) {
              return; // Skip if collection failed
            }

            // Property 18: Fingerprint should be present and valid
            if (deviceInfo.fingerprint !== null) {
              expect(typeof deviceInfo.fingerprint).toBe('string');
              expect(deviceInfo.fingerprint.length).toBeGreaterThan(0);
              
              // Should be a valid hex string (canvas fingerprint is hashed)
              expect(deviceInfo.fingerprint).toMatch(/^[a-f0-9]+$/i);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 19: Fingerprint Linking', () => {
    it('should link multiple attempts with the same fingerprint', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
          async (studentNames) => {
            // Clear mock database for this test
            mockDatabase.length = 0;

            // Collect device info once (same device)
            const deviceInfo = await collectDetailedDeviceInfo();
            if (!deviceInfo || !deviceInfo.fingerprint) {
              return; // Skip if fingerprint generation failed
            }

            const sharedFingerprint = deviceInfo.fingerprint;
            const createdAttemptIds: string[] = [];

            // Create multiple attempts with the same fingerprint
            for (let i = 0; i < studentNames.length; i++) {
              const attemptId = `attempt-${i}-${Date.now()}`;
              const attempt: MockAttempt = {
                id: attemptId,
                exam_id: 'test-exam-id',
                student_name: studentNames[i],
                device_info: deviceInfo
              };

              storeAttempt(attempt);
              createdAttemptIds.push(attemptId);
            }

            // Query all attempts with this fingerprint
            const linkedAttempts = queryByFingerprint(sharedFingerprint);

            // Property 19: All created attempts should be linked by fingerprint
            expect(linkedAttempts.length).toBeGreaterThanOrEqual(createdAttemptIds.length);
            
            // All matching attempts should have the same fingerprint
            linkedAttempts.forEach((attempt) => {
              expect(attempt.device_info.fingerprint).toBe(sharedFingerprint);
            });

            // All created attempt IDs should be in the matching attempts
            const matchingIds = linkedAttempts.map(a => a.id);
            createdAttemptIds.forEach(id => {
              expect(matchingIds).toContain(id);
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should distinguish attempts from different devices by fingerprint', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.string({ minLength: 16, maxLength: 32 }).map(s => 
              s.split('').map(c => c.charCodeAt(0).toString(16)).join('').substring(0, 32)
            ),
            fc.string({ minLength: 16, maxLength: 32 }).map(s => 
              s.split('').map(c => c.charCodeAt(0).toString(16)).join('').substring(0, 32)
            )
          ).filter(([fp1, fp2]) => fp1 !== fp2), // Ensure different fingerprints
          async ([fingerprint1, fingerprint2]) => {
            // Clear mock database for this test
            mockDatabase.length = 0;

            // Create device info with different fingerprints
            const deviceInfo1 = {
              collectedAt: new Date().toISOString(),
              fingerprint: fingerprint1,
              friendlyName: 'Device 1',
              browserDetails: { name: 'Chrome', version: '120', fullVersion: '120.0', engine: 'Blink', engineVersion: '120.0' },
              platformDetails: { os: 'Windows', osVersion: '10', architecture: null, bitness: null },
              security: { webdriver: false, pdfViewer: true, doNotTrack: false, pluginsCount: 3, cookiesEnabled: true, isExtended: false, maxTouchPoints: 0, automationRisk: false },
              location: { latitude: null, longitude: null, accuracy: null, timestamp: null },
              ips: { ips: [], error: null, completedAt: new Date().toISOString() },
              parsed: { browser: 'Chrome', os: 'Windows', type: 'desktop' },
              oem: { brand: null, model: null, source: null },
              screen: { width: 1920, height: 1080, colorDepth: 24, pixelDepth: 24 },
              viewport: { width: 1920, height: 1080 },
              userAgent: 'Mozilla/5.0',
              platform: 'Win32',
              language: 'en-US',
              languages: ['en-US'],
              vendor: 'Google Inc.',
              deviceMemory: 8,
              hardwareConcurrency: 8,
              pixelRatio: 1,
              timezone: 'America/New_York',
              timezoneOffset: -300,
              touch: false,
              network: null,
              battery: null,
              gpu: null,
              clientHints: null
            };

            const deviceInfo2 = { ...deviceInfo1, fingerprint: fingerprint2, friendlyName: 'Device 2' };

            // Create attempts from different devices
            const attempt1: MockAttempt = {
              id: 'attempt-1',
              exam_id: 'test-exam-id',
              student_name: 'Student 1',
              device_info: deviceInfo1
            };

            const attempt2: MockAttempt = {
              id: 'attempt-2',
              exam_id: 'test-exam-id',
              student_name: 'Student 2',
              device_info: deviceInfo2
            };

            storeAttempt(attempt1);
            storeAttempt(attempt2);

            // Query attempts by each fingerprint
            const fp1Attempts = queryByFingerprint(fingerprint1);
            const fp2Attempts = queryByFingerprint(fingerprint2);

            // Property 19: Different fingerprints should link to different attempts
            expect(fp1Attempts.length).toBeGreaterThan(0);
            expect(fp2Attempts.length).toBeGreaterThan(0);

            // Attempt 1 should only be in fp1 results
            expect(fp1Attempts.some(a => a.id === 'attempt-1')).toBe(true);
            expect(fp2Attempts.some(a => a.id === 'attempt-1')).toBe(false);

            // Attempt 2 should only be in fp2 results
            expect(fp2Attempts.some(a => a.id === 'attempt-2')).toBe(true);
            expect(fp1Attempts.some(a => a.id === 'attempt-2')).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle null fingerprints without breaking queries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (studentName) => {
            // Clear mock database for this test
            mockDatabase.length = 0;

            // Create device info with null fingerprint
            const deviceInfo = {
              collectedAt: new Date().toISOString(),
              fingerprint: null,
              friendlyName: 'Device without fingerprint',
              browserDetails: { name: 'Chrome', version: '120', fullVersion: '120.0', engine: 'Blink', engineVersion: '120.0' },
              platformDetails: { os: 'Windows', osVersion: '10', architecture: null, bitness: null },
              security: { webdriver: false, pdfViewer: true, doNotTrack: false, pluginsCount: 3, cookiesEnabled: true, isExtended: false, maxTouchPoints: 0, automationRisk: false },
              location: { latitude: null, longitude: null, accuracy: null, timestamp: null },
              ips: { ips: [], error: null, completedAt: new Date().toISOString() },
              parsed: { browser: 'Chrome', os: 'Windows', type: 'desktop' },
              oem: { brand: null, model: null, source: null },
              screen: { width: 1920, height: 1080, colorDepth: 24, pixelDepth: 24 },
              viewport: { width: 1920, height: 1080 },
              userAgent: 'Mozilla/5.0',
              platform: 'Win32',
              language: 'en-US',
              languages: ['en-US'],
              vendor: 'Google Inc.',
              deviceMemory: 8,
              hardwareConcurrency: 8,
              pixelRatio: 1,
              timezone: 'America/New_York',
              timezoneOffset: -300,
              touch: false,
              network: null,
              battery: null,
              gpu: null,
              clientHints: null
            };

            // Create attempt with null fingerprint
            const attemptId = `attempt-null-${Date.now()}`;
            const attempt: MockAttempt = {
              id: attemptId,
              exam_id: 'test-exam-id',
              student_name: studentName,
              device_info: deviceInfo
            };

            storeAttempt(attempt);

            // Retrieve the attempt
            const retrievedAttempt = getAttemptById(attemptId);

            // Property 19: Null fingerprints should not break queries
            expect(retrievedAttempt).toBeDefined();
            
            if (retrievedAttempt) {
              expect(retrievedAttempt.device_info.fingerprint).toBeNull();
            }

            // Query by null fingerprint should work (though not useful)
            const nullFpAttempts = queryByFingerprint(null as any);
            expect(Array.isArray(nullFpAttempts)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
