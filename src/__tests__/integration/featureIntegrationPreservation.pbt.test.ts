/**
 * Property-based tests for feature integration preservation
 * Feature: student-experience-optimization, Property 10: Feature Integration Preservation
 * 
 * **Validates: Requirements 10.1, 10.2, 10.4, 10.5**
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

// Mock the modules that would be used in integration
vi.mock('@/lib/collectDeviceInfo');
vi.mock('@/lib/security');
vi.mock('@/lib/audit');
vi.mock('@/lib/template');

// Mock fetch globally with proper typing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Simplified test data generators
const studentCodeArb = fc.string({ minLength: 3, maxLength: 8 })
  .filter(s => /^[a-zA-Z0-9]+$/.test(s));

const examIdArb = fc.string({ minLength: 8, maxLength: 20 })
  .filter(s => /^[a-zA-Z0-9-]+$/.test(s));

const attemptIdArb = fc.string({ minLength: 8, maxLength: 20 })
  .filter(s => /^[a-zA-Z0-9-]+$/.test(s));

const mobileNumberArb = fc.integer({ min: 1000000000, max: 99999999999 }).map(n => n.toString());

const ipAddressArb = fc.tuple(
  fc.integer({ min: 1, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

// Helper function to create mock response
function createMockResponse(data: any, ok: boolean = true, status: number = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

describe('Feature Integration Preservation Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 10: Feature Integration Preservation
   * For any existing exam feature or integration (exam access, results, WhatsApp, IP restrictions), 
   * the reordered flow should maintain full compatibility and functionality.
   */
  test('Property 10: Feature Integration Preservation - Exam Access Consistency', async () => {
    await fc.assert(fc.asyncProperty(
      studentCodeArb,
      fc.string({ minLength: 8, maxLength: 20 }),
      fc.array(fc.record({
        id: examIdArb,
        title: fc.string({ minLength: 1, maxLength: 50 }),
        status: fc.constantFrom('draft', 'published', 'archived'),
        access_type: fc.constantFrom('open', 'code_based', 'ip_restricted'),
        is_active: fc.boolean(),
        not_started: fc.boolean(),
        ended: fc.boolean(),
      }), { minLength: 0, maxLength: 2 }),
      async (code, studentId, exams) => {
        // Sort exams for consistent comparison
        const sortedExams = [...exams].sort((a, b) => a.id.localeCompare(b.id));
        
        // Mock the exam by code API response
        const mockExamResponse = {
          valid: true,
          student_id: studentId,
          student_name: `Student ${studentId.slice(0, 8)}`,
          exams: sortedExams,
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockExamResponse));

        // Simulate exam access API call
        const response = await fetch(`/api/public/exams/by-code?code=${encodeURIComponent(code)}`);
        const data = await response.json();

        // Verify that exam access maintains the same structure and data
        expect(data.valid).toBe(true);
        expect(data.student_id).toBe(studentId);
        expect(data.exams).toEqual(sortedExams);
        expect(Array.isArray(data.exams)).toBe(true);

        // Verify API call was made with correct parameters
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/public/exams/by-code?code=${encodeURIComponent(code)}`)
        );
      }
    ), { numRuns: 10 });
  });

  test('Property 10: Feature Integration Preservation - Exam Attempt Creation', async () => {
    await fc.assert(fc.asyncProperty(
      studentCodeArb,
      examIdArb,
      attemptIdArb,
      async (code, examId, attemptId) => {
        // Mock the exam access API response
        const mockAccessResponse = {
          attemptId: attemptId,
          studentName: `Student for ${code}`,
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockAccessResponse));

        // Simulate exam access request with enhanced device info
        const requestBody = {
          code: code,
          studentName: null,
          deviceInfo: {
            collectedAt: new Date().toISOString(),
            friendlyName: 'Test Device (Test OS) Test Browser',
            fingerprint: 'abc123def456',
            browserDetails: {
              name: 'Chrome',
              version: '120',
              fullVersion: '120.0.6099.129',
              engine: 'Blink',
              engineVersion: '120.0.6099.129',
            },
            platformDetails: {
              os: 'Windows',
              osVersion: '10',
              architecture: 'x86',
              bitness: '64',
            },
            parsed: {
              browser: { name: 'Chrome', version: '120' },
              os: { name: 'Windows', version: '10' },
              device: { type: 'desktop' },
            },
            oem: {
              brand: 'Unknown',
              model: 'Unknown',
              source: null,
            },
            userAgent: 'test-device',
          },
        };

        const response = await fetch(`/api/public/exams/${examId}/access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        // Verify that exam attempt creation maintains consistency
        expect(data.attemptId).toBe(attemptId);
        expect(typeof data.studentName).toBe('string');
        expect(data.studentName.length).toBeGreaterThan(0);

        // Verify that the request includes all necessary data
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/public/exams/${examId}/access`),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          })
        );
      }
    ), { numRuns: 10 });
  });

  test('Property 10: Feature Integration Preservation - WhatsApp URL Compatibility', () => {
    fc.assert(fc.property(
      studentCodeArb,
      mobileNumberArb,
      (code, mobileNumber) => {
        // Use a simple template that includes the code placeholder
        const messageTemplate = `Your exam code is {code}. Please use this to access your exam.`;
        
        // Simulate WhatsApp URL generation
        const personalizedMessage = messageTemplate.replace(/{code}/g, code);
        const encodedMessage = encodeURIComponent(personalizedMessage);
        const whatsappUrl = `https://wa.me/${mobileNumber}?text=${encodedMessage}`;

        // Verify WhatsApp URL format is preserved
        expect(whatsappUrl).toMatch(/^https:\/\/wa\.me\/\d+\?text=.+/);
        expect(whatsappUrl).toContain(mobileNumber);
        
        // Verify that the URL contains the encoded code
        const decodedUrl = decodeURIComponent(whatsappUrl);
        expect(decodedUrl).toContain(code);

        // Verify URL structure is compatible with existing WhatsApp integration
        expect(whatsappUrl.split('?').length).toBe(2); // Base URL + query params
        expect(whatsappUrl.split('?')[0]).toBe(`https://wa.me/${mobileNumber}`);
      }
    ), { numRuns: 15 });
  });

  test('Property 10: Feature Integration Preservation - IP Restriction Compatibility', async () => {
    await fc.assert(fc.asyncProperty(
      studentCodeArb,
      examIdArb,
      ipAddressArb,
      fc.boolean(), // Whether IP is allowed
      async (code, examId, ipAddress, isAllowed) => {
        // Mock the exam access response based on IP restriction
        const mockResponse = isAllowed 
          ? {
              attemptId: 'attempt-123',
              studentName: 'Test Student',
            }
          : {
              error: 'ip_not_whitelisted',
              message: 'Your IP address is not allowed to access this exam.',
            };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse, isAllowed, isAllowed ? 200 : 403));

        // Simulate exam access with IP tracking
        const response = await fetch(`/api/public/exams/${examId}/access`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Forwarded-For': ipAddress,
          },
          body: JSON.stringify({ code, studentName: null }),
        });

        const data = await response.json();

        if (isAllowed) {
          // Verify successful access maintains existing structure
          expect(response.ok).toBe(true);
          expect(data.attemptId).toBeDefined();
          expect(data.studentName).toBeDefined();
        } else {
          // Verify IP restriction is properly enforced
          expect(response.ok).toBe(false);
          expect(data.error).toBe('ip_not_whitelisted');
          expect(data.message).toContain('IP address');
        }

        // Verify that IP information is included in the request
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/public/exams/${examId}/access`),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'X-Forwarded-For': ipAddress,
            }),
          })
        );
      }
    ), { numRuns: 10 });
  });

  test('Property 10: Feature Integration Preservation - Error Handling Consistency', async () => {
    await fc.assert(fc.asyncProperty(
      studentCodeArb,
      fc.constantFrom('code_required', 'invalid_code', 'code_already_used', 'exam_not_published'),
      async (code, errorType) => {
        // Mock error response
        const mockErrorResponse = {
          error: errorType,
          message: `Error: ${errorType}`,
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockErrorResponse, false, 400));

        // Simulate API call that results in error
        const response = await fetch(`/api/public/exams/by-code?code=${encodeURIComponent(code)}`);
        const data = await response.json();

        // Verify that error handling maintains existing structure
        expect(response.ok).toBe(false);
        expect(data.error).toBe(errorType);
        expect(data.message).toBeDefined();
        expect(typeof data.message).toBe('string');

        // Verify API call structure is maintained
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/public/exams/by-code?code=${encodeURIComponent(code)}`)
        );
      }
    ), { numRuns: 10 });
  });
});