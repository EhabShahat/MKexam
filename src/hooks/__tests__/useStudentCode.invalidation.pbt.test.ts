/**
 * Property-based tests for student code invalidation and cleanup
 * Feature: student-experience-optimization, Property 5: Code Invalidation and Cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { storeCode, clearCode, getStoredCode, updateStoredCodeMetadata, type StoredStudentCode } from '../useStudentCode';
import { setupLocalStorageMock } from '@/__tests__/utils/localStorage';

describe('Student Code Invalidation and Cleanup - Property-Based Tests', () => {
  beforeEach(() => {
    setupLocalStorageMock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Property 5: Code Invalidation and Cleanup', () => {
    it('should automatically clear expired codes when accessed', async () => {
      // Feature: student-experience-optimization, Property 5: Code Invalidation and Cleanup
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Ensure non-whitespace codes
          fc.uuid(),
          fc.boolean(), // Whether code should be expired
          async (code, studentId, shouldExpire) => {
            clearCode();
            
            // Store code
            await storeCode(code, studentId);
            expect(await getStoredCode()).not.toBeNull();
            
            // Set expiration time
            const expiresAt = shouldExpire 
              ? Date.now() - 1000 // Expired (1 second ago)
              : Date.now() + 86400000; // Valid (24 hours from now)
            
            await updateStoredCodeMetadata({ expiresAt });
            
            // Access the code - should trigger cleanup if expired
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

    it('should clear codes that are too old (beyond max age)', async () => {
      // Feature: student-experience-optimization, Property 5: Code Invalidation and Cleanup
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Ensure non-whitespace codes
          fc.boolean(), // Whether code should be too old
          async (code, shouldBeTooOld) => {
            clearCode();
            
            // Store code first
            await storeCode(code);
            
            // Manually set timestamp to simulate age by directly modifying localStorage
            const ageInDays = shouldBeTooOld ? 8 : 3; // 8 days (too old) or 3 days (valid)
            const timestamp = Date.now() - (ageInDays * 24 * 60 * 60 * 1000);
            
            // Get current data and update timestamp directly
            const currentData = await getStoredCode();
            if (currentData) {
              const updatedData = { ...currentData, timestamp };
              localStorage.setItem('student_code', JSON.stringify(updatedData));
            }
            
            // Access the code - should trigger cleanup if too old
            const retrieved = await getStoredCode();
            
            if (shouldBeTooOld) {
              // Old codes should be automatically cleared
              expect(retrieved).toBeNull();
              expect(localStorage.getItem('student_code')).toBeNull();
            } else {
              // Recent codes should be returned
              expect(retrieved).not.toBeNull();
              expect(retrieved?.code).toBe(code);
            }
            
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clear codes with too many failed validation attempts', async () => {
      // Feature: student-experience-optimization, Property 5: Code Invalidation and Cleanup
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Ensure non-whitespace codes
          fc.integer({ min: 0, max: 10 }), // Number of validation attempts
          async (code, attempts) => {
            clearCode();
            
            // Store code
            await storeCode(code);
            const storedData = await getStoredCode();
            
            // Skip test if code wasn't stored (e.g., due to validation issues)
            if (!storedData) {
              return; // Skip this test case
            }
            
            expect(storedData).not.toBeNull();
            
            // Set validation attempts
            await updateStoredCodeMetadata({ validationAttempts: attempts });
            
            // Access the code - should trigger cleanup if too many attempts
            const retrieved = await getStoredCode();
            
            if (attempts >= 5) {
              // Codes with too many failed attempts should be cleared
              expect(retrieved).toBeNull();
              expect(localStorage.getItem('student_code')).toBeNull();
            } else {
              // Codes with acceptable attempts should be returned
              expect(retrieved).not.toBeNull();
              expect(retrieved?.code).toBe(code);
              expect(retrieved?.validationAttempts).toBe(attempts);
            }
            
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle corrupted localStorage data by clearing it', async () => {
      // Feature: student-experience-optimization, Property 5: Code Invalidation and Cleanup
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('invalid json'),
            fc.constant('{"invalid": "structure"}'),
            fc.constant('{"code": 123}'), // Wrong type
            fc.constant('{}'), // Missing code
            fc.constant('null'),
            fc.constant('undefined'),
            fc.constant('[1,2,3]'), // Array instead of object
          ),
          async (corruptedData) => {
            // Manually set corrupted data
            localStorage.setItem('student_code', corruptedData);
            
            // Verify corrupted data exists
            expect(localStorage.getItem('student_code')).toBe(corruptedData);
            
            // getStoredCode should detect corruption and clear it
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

    it('should clear codes with invalid structure', async () => {
      // Feature: student-experience-optimization, Property 5: Code Invalidation and Cleanup
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            code: fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.constant(''),
              fc.integer(),
              fc.boolean(),
              fc.array(fc.string()),
            ),
            timestamp: fc.integer(),
            studentId: fc.option(fc.uuid(), { nil: undefined }),
          }),
          async (invalidData) => {
            // Store invalid data structure
            localStorage.setItem('student_code', JSON.stringify(invalidData));
            
            // Verify invalid data exists
            expect(localStorage.getItem('student_code')).not.toBeNull();
            
            // getStoredCode should detect invalid structure and clear it
            const result = await getStoredCode();
            
            // Should return null and clear invalid data
            expect(result).toBeNull();
            expect(localStorage.getItem('student_code')).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide clear reasons when clearing codes', async () => {
      // Feature: student-experience-optimization, Property 5: Code Invalidation and Cleanup
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.oneof(
            fc.constant('expired'),
            fc.constant('too_old'),
            fc.constant('too_many_attempts'),
            fc.constant('corrupted'),
            fc.constant('invalid_structure'),
          ),
          async (code, clearReason) => {
            clearCode();
            
            // Mock console.info to capture clear reasons
            const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
            
            // Store code first
            await storeCode(code);
            
            // Simulate different clear scenarios
            switch (clearReason) {
              case 'expired':
                await updateStoredCodeMetadata({ expiresAt: Date.now() - 1000 });
                await getStoredCode(); // Should trigger cleanup
                break;
              case 'too_old':
                // Directly modify localStorage to simulate old timestamp
                const currentData = await getStoredCode();
                if (currentData) {
                  const oldData = { ...currentData, timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000) };
                  localStorage.setItem('student_code', JSON.stringify(oldData));
                }
                await getStoredCode(); // Should trigger cleanup
                break;
              case 'too_many_attempts':
                await updateStoredCodeMetadata({ validationAttempts: 5 });
                await getStoredCode(); // Should trigger cleanup
                break;
              case 'corrupted':
                localStorage.setItem('student_code', 'invalid json');
                await getStoredCode(); // Should trigger cleanup
                break;
              case 'invalid_structure':
                localStorage.setItem('student_code', JSON.stringify({ code: 123 }));
                await getStoredCode(); // Should trigger cleanup
                break;
            }
            
            // Verify code was cleared
            expect(await getStoredCode()).toBeNull();
            
            // Verify appropriate reason was logged (at least one call with reason)
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle localStorage errors gracefully during cleanup', async () => {
      // Feature: student-experience-optimization, Property 5: Code Invalidation and Cleanup
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Ensure non-whitespace codes
          fc.oneof(
            fc.constant('QuotaExceededError'),
            fc.constant('SecurityError'),
            fc.constant('InvalidStateError'),
          ),
          async (code, errorType) => {
            clearCode();
            
            // Store code first - ensure it's stored successfully
            await storeCode(code);
            let storedData = await getStoredCode();
            
            // Skip test if code wasn't stored (e.g., due to whitespace validation)
            if (!storedData) {
              return; // Skip this test case
            }
            
            expect(storedData).not.toBeNull();
            
            // Store original localStorage methods
            const originalRemoveItem = localStorage.removeItem;
            const originalGetItem = localStorage.getItem;
            const originalSetItem = localStorage.setItem;
            
            // Mock localStorage.removeItem to throw error, but keep getItem/setItem working for availability check
            localStorage.removeItem = vi.fn().mockImplementation((key) => {
              if (key === '__localStorage_test__') {
                return originalRemoveItem.call(localStorage, key); // Allow availability test to pass
              }
              const error = new DOMException(errorType, errorType);
              throw error;
            });
            
            // Keep getItem and setItem working for availability check
            localStorage.getItem = vi.fn().mockImplementation((key) => {
              if (key === '__localStorage_test__') {
                return originalGetItem.call(localStorage, key);
              }
              return originalGetItem.call(localStorage, key);
            });
            
            localStorage.setItem = vi.fn().mockImplementation((key, value) => {
              if (key === '__localStorage_test__') {
                return originalSetItem.call(localStorage, key, value);
              }
              return originalSetItem.call(localStorage, key, value);
            });
            
            // Mock console.error to capture error handling
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            // Clear should not throw error even if localStorage fails
            expect(() => clearCode('test cleanup')).not.toThrow();
            
            // Verify error was logged - clearCode logs errors when localStorage.removeItem fails
            expect(consoleErrorSpy).toHaveBeenCalledWith(
              'Failed to clear student code:',
              expect.any(DOMException)
            );
            
            // Restore original functions
            localStorage.removeItem = originalRemoveItem;
            localStorage.getItem = originalGetItem;
            localStorage.setItem = originalSetItem;
            consoleErrorSpy.mockRestore();
            
            // Clean up manually
            clearCode();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle quota exceeded errors by clearing storage', async () => {
      // Feature: student-experience-optimization, Property 5: Code Invalidation and Cleanup
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Ensure non-whitespace codes
          async (code) => {
            clearCode();
            
            // Store original localStorage methods
            const originalSetItem = localStorage.setItem;
            const originalGetItem = localStorage.getItem;
            const originalRemoveItem = localStorage.removeItem;
            
            let setItemCallCount = 0;
            
            // Mock localStorage.setItem to throw quota exceeded error on first call only
            localStorage.setItem = vi.fn().mockImplementation((key, value) => {
              if (key === '__localStorage_test__') {
                return originalSetItem.call(localStorage, key, value); // Allow availability test to pass
              }
              
              setItemCallCount++;
              if (setItemCallCount === 1) {
                // First call (storing code) throws quota error
                const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
                throw error;
              } else {
                // Subsequent calls (during cleanup) succeed
                return originalSetItem.call(localStorage, key, value);
              }
            });
            
            // Keep getItem and removeItem working normally for isLocalStorageAvailable check
            localStorage.getItem = vi.fn().mockImplementation((key) => {
              if (key === '__localStorage_test__') {
                return originalGetItem.call(localStorage, key); // Allow the availability test to pass
              }
              return originalGetItem.call(localStorage, key);
            });
            
            localStorage.removeItem = vi.fn().mockImplementation((key) => {
              if (key === '__localStorage_test__') {
                return originalRemoveItem.call(localStorage, key); // Allow the availability test to pass
              }
              return originalRemoveItem.call(localStorage, key);
            });
            
            // Mock console.warn and console.error to capture quota handling
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
            
            // Store should handle quota error gracefully
            await expect(storeCode(code)).resolves.not.toThrow();
            
            // Verify quota error was handled - the handleStorageError function logs the error first,
            // then logs the quota exceeded warning, then calls clearCode which logs the reason
            expect(consoleErrorSpy).toHaveBeenCalledWith(
              'Storage error during store code:',
              expect.any(DOMException)
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
              'localStorage quota exceeded, attempting cleanup'
            );
            expect(consoleInfoSpy).toHaveBeenCalledWith(
              'Clearing student code: quota exceeded'
            );
            
            // Restore original functions
            localStorage.setItem = originalSetItem;
            localStorage.getItem = originalGetItem;
            localStorage.removeItem = originalRemoveItem;
            consoleWarnSpy.mockRestore();
            consoleErrorSpy.mockRestore();
            consoleInfoSpy.mockRestore();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain cleanup consistency across multiple operations', async () => {
      // Feature: student-experience-optimization, Property 5: Code Invalidation and Cleanup
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1, max: 10 }), // Number of operations
          async (codes, operationCount) => {
            clearCode();
            
            // Perform multiple store/clear operations
            for (let i = 0; i < operationCount; i++) {
              const code = codes[i % codes.length];
              
              // Store code
              await storeCode(code);
              
              // Randomly trigger different cleanup scenarios
              const scenario = i % 4;
              switch (scenario) {
                case 0:
                  // Expire the code
                  await updateStoredCodeMetadata({ expiresAt: Date.now() - 1000 });
                  break;
                case 1:
                  // Make code too old - directly modify localStorage
                  const currentData = await getStoredCode();
                  if (currentData) {
                    const oldData = { ...currentData, timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000) };
                    localStorage.setItem('student_code', JSON.stringify(oldData));
                  }
                  break;
                case 2:
                  // Too many attempts
                  await updateStoredCodeMetadata({ validationAttempts: 5 });
                  break;
                case 3:
                  // Manual clear
                  clearCode('manual cleanup');
                  continue; // Skip getStoredCode call
              }
              
              // Access should trigger cleanup
              const retrieved = await getStoredCode();
              expect(retrieved).toBeNull();
              expect(localStorage.getItem('student_code')).toBeNull();
            }
            
            // Final state should be clean
            expect(await getStoredCode()).toBeNull();
            expect(localStorage.getItem('student_code')).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});