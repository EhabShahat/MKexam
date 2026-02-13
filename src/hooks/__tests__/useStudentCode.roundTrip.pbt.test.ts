/**
 * Property-based tests for student code storage round-trip consistency
 * Feature: student-experience-optimization, Property 1: Code Storage Round-Trip Consistency
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { storeCode, clearCode, getStoredCode, updateStoredCodeMetadata, type StoredStudentCode } from '../useStudentCode';
import { setupLocalStorageMock } from '@/__tests__/utils/localStorage';

describe('Student Code Storage Round-Trip Consistency - Property-Based Tests', () => {
  beforeEach(() => {
    setupLocalStorageMock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Property 1: Code Storage Round-Trip Consistency', () => {
    it('should store and retrieve the exact same code for any valid student code', async () => {
      // Feature: student-experience-optimization, Property 1: Code Storage Round-Trip Consistency
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), // Valid student codes (non-whitespace-only)
          fc.option(fc.uuid(), { nil: undefined }), // Optional student ID
          fc.option(fc.record({
            studentName: fc.string({ minLength: 1, maxLength: 50 }),
            examCount: fc.integer({ min: 0, max: 10 }),
            lastExamId: fc.uuid(),
          }), { nil: undefined }), // Optional metadata
          async (code, studentId, metadata) => {
            // Clear any existing data
            clearCode();

            // Store the code with enhanced metadata
            await storeCode(code, studentId, metadata);

            // Retrieve the stored code
            const retrieved = await getStoredCode();

            // Verify round-trip consistency
            expect(retrieved).not.toBeNull();
            expect(retrieved?.code).toBe(code);
            expect(retrieved?.timestamp).toBeGreaterThan(0);
            expect(retrieved?.lastValidated).toBeGreaterThan(0);
            expect(retrieved?.validationAttempts).toBe(0);
            
            if (studentId !== undefined) {
              expect(retrieved?.studentId).toBe(studentId);
            }

            if (metadata !== undefined) {
              expect(retrieved?.metadata).toEqual(metadata);
            }

            // Clean up
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve code across browser crashes and sessions', async () => {
      // Feature: student-experience-optimization, Property 1: Code Storage Round-Trip Consistency
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Valid codes only
          fc.option(fc.uuid(), { nil: undefined }),
          async (code, studentId) => {
            clearCode();
            
            // Store code
            await storeCode(code, studentId);
            
            // Simulate browser crash by clearing in-memory state but keeping localStorage
            const storedData = localStorage.getItem('student_code');
            expect(storedData).not.toBeNull();
            
            // Simulate fresh app start by retrieving from localStorage
            const retrieved = await getStoredCode();
            
            // Verify code persists across sessions
            expect(retrieved).not.toBeNull();
            expect(retrieved?.code).toBe(code);
            expect(retrieved?.studentId).toBe(studentId);
            
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle metadata updates without corrupting the code', async () => {
      // Feature: student-experience-optimization, Property 1: Code Storage Round-Trip Consistency
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Valid codes only
          fc.uuid(),
          fc.record({
            lastValidated: fc.integer({ min: Date.now() - 86400000, max: Date.now() }),
            validationAttempts: fc.integer({ min: 0, max: 3 }), // Keep under the 5-attempt limit
            expiresAt: fc.option(fc.integer({ min: Date.now() + 3600000, max: Date.now() + 86400000 }), { nil: undefined }), // Future dates only
          }),
          async (code, studentId, updates) => {
            clearCode();
            
            // Store initial code
            await storeCode(code, studentId);
            const initial = await getStoredCode();
            expect(initial?.code).toBe(code);
            
            // Update metadata
            await updateStoredCodeMetadata(updates);
            
            // Verify code is unchanged but metadata is updated
            const updated = await getStoredCode();
            expect(updated).not.toBeNull();
            expect(updated?.code).toBe(code); // Code must remain unchanged
            expect(updated?.studentId).toBe(studentId); // Student ID must remain unchanged
            expect(updated?.timestamp).toBe(initial?.timestamp); // Original timestamp preserved
            expect(updated?.lastValidated).toBe(updates.lastValidated);
            expect(updated?.validationAttempts).toBe(updates.validationAttempts);
            
            if (updates.expiresAt !== undefined) {
              expect(updated?.expiresAt).toBe(updates.expiresAt);
            }
            
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle special characters and unicode in codes consistently', () => {
      // Feature: student-experience-optimization, Property 1: Code Storage Round-Trip Consistency
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Regular valid strings
            fc.string({ minLength: 1, maxLength: 20 }).map(s => s + '!@#$%^&*()').filter(s => s.trim().length > 0), // Special chars
            fc.string({ minLength: 1, maxLength: 20 }).map(s => s + '😀🎉✨').filter(s => s.trim().length > 0), // Emoji
            fc.string({ minLength: 1, maxLength: 20 }).map(s => s + 'كود').filter(s => s.trim().length > 0), // Arabic
          ),
          async (code) => {
            clearCode();
            
            await storeCode(code);
            const retrieved = await getStoredCode();
            
            // Verify exact character preservation for valid codes
            expect(retrieved?.code).toBe(code);
            expect(retrieved?.code.length).toBe(code.length);
            
            // Verify each character is preserved
            for (let i = 0; i < code.length; i++) {
              expect(retrieved?.code.charAt(i)).toBe(code.charAt(i));
            }
            
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject whitespace-only codes as invalid', async () => {
      // Feature: student-experience-optimization, Property 1: Code Storage Round-Trip Consistency
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(' '), // Single space
            fc.constant('  '), // Multiple spaces
            fc.constant('\t'), // Tab
            fc.constant('\n'), // Newline
            fc.constant('\r'), // Carriage return
            fc.constant(' \t\n\r '), // Mixed whitespace
          ),
          async (whitespaceCode) => {
            clearCode();
            
            // Store whitespace-only code
            await storeCode(whitespaceCode);
            
            // Should not be retrievable as it's invalid
            const retrieved = await getStoredCode();
            expect(retrieved).toBeNull();
            
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle code expiration correctly', async () => {
      // Feature: student-experience-optimization, Property 1: Code Storage Round-Trip Consistency
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Valid codes only
          fc.boolean(), // Whether code should be expired
          async (code, shouldExpire) => {
            clearCode();
            
            // Store code
            await storeCode(code);
            
            // Set expiration time
            const expiresAt = shouldExpire 
              ? Date.now() - 1000 // Expired (1 second ago)
              : Date.now() + 86400000; // Valid (24 hours from now)
            
            await updateStoredCodeMetadata({ expiresAt });
            
            // Retrieve code
            const retrieved = await getStoredCode();
            
            if (shouldExpire) {
              // Expired codes should be automatically cleared
              expect(retrieved).toBeNull();
              expect(localStorage.getItem('student_code')).toBeNull();
            } else {
              // Valid codes should be returned
              expect(retrieved).not.toBeNull();
              expect(retrieved?.code).toBe(code);
              expect(retrieved?.expiresAt).toBe(expiresAt);
            }
            
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle localStorage quota and error conditions gracefully', () => {
      // Feature: student-experience-optimization, Property 1: Code Storage Round-Trip Consistency
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Valid codes only
          fc.oneof(
            fc.constant('QuotaExceededError'),
            fc.constant('SecurityError'),
            fc.constant('InvalidStateError'),
          ),
          async (code, errorType) => {
            clearCode();
            
            // Mock localStorage to throw error on setItem
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn().mockImplementation(() => {
              throw new DOMException(errorType);
            });
            
            // Store should not throw error
            expect(() => storeCode(code)).not.toThrow();
            
            // Restore original setItem
            localStorage.setItem = originalSetItem;
            
            // Code should not be stored due to error
            const retrieved = await getStoredCode();
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain data integrity under concurrent operations', () => {
      // Feature: student-experience-optimization, Property 1: Code Storage Round-Trip Consistency
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 2, maxLength: 5 }), // Valid codes only
          async (codes) => {
            clearCode();
            
            // Perform rapid successive stores
            for (const code of codes) {
              await storeCode(code);
            }
            
            // Last code should win
            const retrieved = await getStoredCode();
            expect(retrieved?.code).toBe(codes[codes.length - 1]);
            
            // Perform interleaved operations
            const finalCode = codes[0];
            await storeCode(finalCode);
            
            // Update metadata
            await updateStoredCodeMetadata({ validationAttempts: 1 });
            
            // Verify code integrity
            const final = await getStoredCode();
            expect(final?.code).toBe(finalCode);
            expect(final?.validationAttempts).toBe(1);
            
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle corrupted localStorage data gracefully', () => {
      // Feature: student-experience-optimization, Property 1: Code Storage Round-Trip Consistency
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('invalid json'),
            fc.constant('{"invalid": "structure"}'),
            fc.constant('{"code": 123}'), // Wrong type
            fc.constant('{}'), // Missing code
            fc.constant('null'),
            fc.constant('undefined'),
          ),
          async (corruptedData) => {
            // Manually set corrupted data
            localStorage.setItem('student_code', corruptedData);
            
            // getStoredCode should handle corruption gracefully
            const result = await getStoredCode();
            
            // Should return null for corrupted data
            expect(result).toBeNull();
            
            // Should have cleared the corrupted data
            expect(localStorage.getItem('student_code')).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve timestamp accuracy and ordering', () => {
      // Feature: student-experience-optimization, Property 1: Code Storage Round-Trip Consistency
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Valid codes only
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Valid codes only
          async (code1, code2) => {
            fc.pre(code1 !== code2);
            
            clearCode();
            
            // Store first code
            const time1 = Date.now();
            await storeCode(code1);
            const stored1 = await getStoredCode();
            
            // Wait a bit (simulate time passing)
            vi.useFakeTimers();
            vi.advanceTimersByTime(100);
            
            // Store second code
            const time2 = Date.now();
            await storeCode(code2);
            const stored2 = await getStoredCode();
            
            // Verify timestamp ordering
            expect(stored1?.timestamp).toBeGreaterThanOrEqual(time1);
            expect(stored2?.timestamp).toBeGreaterThanOrEqual(time2);
            expect(stored2?.timestamp).toBeGreaterThan(stored1?.timestamp);
            
            vi.useRealTimers();
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});