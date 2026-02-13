/**
 * Unit tests for student code persistence edge cases
 * Feature: student-experience-and-admin-enhancements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storeCode, clearCode, getStoredCode } from '../useStudentCode';
import { setupLocalStorageMock } from '@/__tests__/utils/localStorage';

describe('Student Code Persistence - Unit Tests (Edge Cases)', () => {
  beforeEach(() => {
    setupLocalStorageMock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Empty Code Handling', () => {
    it('should not store empty string codes', async () => {
      await storeCode('');
      const retrieved = await getStoredCode();
      
      // Empty codes should be stored but validation will fail
      expect(retrieved).toBeNull();
    });

    it('should not store whitespace-only codes', async () => {
      await storeCode('   ');
      const retrieved = await getStoredCode();
      
      // Whitespace codes should be rejected as invalid
      expect(retrieved).toBeNull();
    });

    it('should handle null code gracefully', async () => {
      // @ts-expect-error Testing invalid input
      await storeCode(null);
      const retrieved = await getStoredCode();
      
      // Should handle gracefully
      expect(retrieved).toBeDefined();
    });

    it('should handle undefined code gracefully', async () => {
      // @ts-expect-error Testing invalid input
      await storeCode(undefined);
      const retrieved = await getStoredCode();
      
      // Should handle gracefully
      expect(retrieved).toBeDefined();
    });
  });

  describe('Special Characters in Codes', () => {
    it('should handle codes with special characters', async () => {
      const specialCodes = [
        'code!@#$%',
        'code<>?',
        'code&*()[]',
        'code{}|\\',
        'code`~',
      ];

      for (const code of specialCodes) {
        clearCode();
        await storeCode(code);
        const retrieved = await getStoredCode();
        
        expect(retrieved).not.toBeNull();
        expect(retrieved?.code).toBe(code);
      }
    });

    it('should handle codes with quotes', async () => {
      const quoteCodes = [
        'code"with"quotes',
        "code'with'quotes",
        'code`with`backticks',
      ];

      for (const code of quoteCodes) {
        clearCode();
        await storeCode(code);
        const retrieved = await getStoredCode();
        
        expect(retrieved).not.toBeNull();
        expect(retrieved?.code).toBe(code);
      }
    });

    it('should handle codes with newlines and tabs', async () => {
      const codes = [
        'code\nwith\nnewlines',
        'code\twith\ttabs',
        'code\r\nwith\r\nCRLF',
      ];

      for (const code of codes) {
        clearCode();
        await storeCode(code);
        const retrieved = await getStoredCode();
        
        expect(retrieved).not.toBeNull();
        expect(retrieved?.code).toBe(code);
      }
    });

    it('should handle codes with emoji', async () => {
      const emojiCodes = [
        'code😀',
        '🎉code🎉',
        'code✨test✨',
      ];

      for (const code of emojiCodes) {
        clearCode();
        await storeCode(code);
        const retrieved = await getStoredCode();
        
        expect(retrieved).not.toBeNull();
        expect(retrieved?.code).toBe(code);
      }
    });

    it('should handle codes with Arabic characters', async () => {
      const arabicCodes = [
        'كود123',
        'code-كود',
        'الكود-الطالب',
      ];

      for (const code of arabicCodes) {
        clearCode();
        await storeCode(code);
        const retrieved = await getStoredCode();
        
        expect(retrieved).not.toBeNull();
        expect(retrieved?.code).toBe(code);
      }
    });
  });

  describe('Very Long Codes', () => {
    it('should handle codes at boundary length (100 chars)', async () => {
      const code = 'a'.repeat(100);
      await storeCode(code);
      const retrieved = await getStoredCode();
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.code).toBe(code);
      expect(retrieved?.code.length).toBe(100);
    });

    it('should handle very long codes (1000 chars)', async () => {
      const code = 'a'.repeat(1000);
      await storeCode(code);
      const retrieved = await getStoredCode();
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.code).toBe(code);
      expect(retrieved?.code.length).toBe(1000);
    });

    it('should handle extremely long codes (10000 chars)', async () => {
      const code = 'a'.repeat(10000);
      await storeCode(code);
      const retrieved = await getStoredCode();
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.code).toBe(code);
      expect(retrieved?.code.length).toBe(10000);
    });

    it('should handle long codes with mixed content', async () => {
      const code = 'ABC123!@#'.repeat(100);
      await storeCode(code);
      const retrieved = await getStoredCode();
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.code).toBe(code);
    });
  });

  describe('Concurrent Storage Operations', () => {
    it('should handle rapid successive stores', async () => {
      const codes = ['code1', 'code2', 'code3', 'code4', 'code5'];
      
      for (const code of codes) {
        await storeCode(code);
      }
      
      // Last code should win
      const retrieved = await getStoredCode();
      expect(retrieved?.code).toBe('code5');
    });

    it('should handle store-clear-store sequence', async () => {
      await storeCode('code1');
      expect((await getStoredCode())?.code).toBe('code1');
      
      clearCode();
      expect(await getStoredCode()).toBeNull();
      
      await storeCode('code2');
      expect((await getStoredCode())?.code).toBe('code2');
    });

    it('should handle multiple clears in sequence', async () => {
      await storeCode('code');
      expect(await getStoredCode()).not.toBeNull();
      
      clearCode();
      clearCode();
      clearCode();
      
      expect(await getStoredCode()).toBeNull();
    });

    it('should handle interleaved store and retrieve operations', async () => {
      await storeCode('code1');
      const retrieved1 = await getStoredCode();
      
      await storeCode('code2');
      const retrieved2 = await getStoredCode();
      
      await storeCode('code3');
      const retrieved3 = await getStoredCode();
      
      expect(retrieved1?.code).toBe('code1');
      expect(retrieved2?.code).toBe('code2');
      expect(retrieved3?.code).toBe('code3');
    });
  });

  describe('LocalStorage Edge Cases', () => {
    it('should handle localStorage quota exceeded', async () => {
      // Mock localStorage.setItem to throw quota exceeded error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      
      // Should not throw, just log error
      expect(() => storeCode('code')).not.toThrow();
      
      // Restore original
      localStorage.setItem = originalSetItem;
    });

    it('should handle localStorage disabled/unavailable', async () => {
      // Mock localStorage to be unavailable
      const originalLocalStorage = global.localStorage;
      // @ts-expect-error Testing unavailable localStorage
      delete global.localStorage;
      
      // Should not throw
      expect(() => storeCode('code')).not.toThrow();
      expect(() => clearCode()).not.toThrow();
      expect(() => getStoredCode()).not.toThrow();
      
      // Restore
      global.localStorage = originalLocalStorage;
    });

    it('should handle corrupted JSON in localStorage', async () => {
      localStorage.setItem('student_code', '{invalid json}');
      
      const retrieved = await getStoredCode();
      
      // Should return null and clear corrupted data
      expect(retrieved).toBeNull();
      expect(localStorage.getItem('student_code')).toBeNull();
    });

    it('should handle non-JSON string in localStorage', async () => {
      localStorage.setItem('student_code', 'not a json string');
      
      const retrieved = await getStoredCode();
      
      // Should return null and clear invalid data
      expect(retrieved).toBeNull();
      expect(localStorage.getItem('student_code')).toBeNull();
    });

    it('should handle null value in localStorage', async () => {
      localStorage.setItem('student_code', 'null');
      
      const retrieved = await getStoredCode();
      
      // Should return null and clear
      expect(retrieved).toBeNull();
    });
  });

  describe('Timestamp Validation', () => {
    it('should store current timestamp', async () => {
      const before = Date.now();
      await storeCode('code');
      const after = Date.now();
      
      const retrieved = await getStoredCode();
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.timestamp).toBeGreaterThanOrEqual(before);
      expect(retrieved!.timestamp).toBeLessThanOrEqual(after);
    });

    it('should update timestamp on re-store', async () => {
      await storeCode('code');
      const first = await getStoredCode();
      
      // Wait a bit
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      
      await storeCode('code');
      const second = await getStoredCode();
      
      expect(second!.timestamp).toBeGreaterThan(first!.timestamp);
      
      vi.useRealTimers();
    });

    it('should handle old timestamps gracefully', async () => {
      const oldTimestamp = Date.now() - 86400000; // 24 hours ago
      const data = {
        code: 'oldcode',
        timestamp: oldTimestamp,
      };
      
      localStorage.setItem('student_code', JSON.stringify(data));
      
      const retrieved = await getStoredCode();
      
      // Should still retrieve old codes
      expect(retrieved).not.toBeNull();
      expect(retrieved?.code).toBe('oldcode');
      expect(retrieved?.timestamp).toBe(oldTimestamp);
    });
  });

  describe('Student ID Handling', () => {
    it('should store code without student ID', async () => {
      await storeCode('code');
      const retrieved = await getStoredCode();
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.code).toBe('code');
      expect(retrieved?.studentId).toBeUndefined();
    });

    it('should store code with student ID', async () => {
      const studentId = '123e4567-e89b-12d3-a456-426614174000';
      await storeCode('code', studentId);
      const retrieved = await getStoredCode();
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.code).toBe('code');
      expect(retrieved?.studentId).toBe(studentId);
    });

    it('should update student ID on re-store', async () => {
      await storeCode('code', 'id1');
      expect((await getStoredCode())?.studentId).toBe('id1');
      
      await storeCode('code', 'id2');
      expect((await getStoredCode())?.studentId).toBe('id2');
    });

    it('should handle empty student ID', async () => {
      await storeCode('code', '');
      const retrieved = await getStoredCode();
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.studentId).toBe('');
    });
  });

  describe('Data Structure Validation', () => {
    it('should reject data without code field', async () => {
      localStorage.setItem('student_code', JSON.stringify({
        timestamp: Date.now(),
      }));
      
      const retrieved = await getStoredCode();
      expect(retrieved).toBeNull();
    });

    it('should reject data with non-string code', async () => {
      localStorage.setItem('student_code', JSON.stringify({
        code: 123,
        timestamp: Date.now(),
      }));
      
      const retrieved = await getStoredCode();
      expect(retrieved).toBeNull();
    });

    it('should handle data with extra fields', async () => {
      localStorage.setItem('student_code', JSON.stringify({
        code: 'test',
        timestamp: Date.now(),
        extraField: 'extra',
        anotherField: 123,
      }));
      
      const retrieved = await getStoredCode();
      
      // Should still work with extra fields
      expect(retrieved).not.toBeNull();
      expect(retrieved?.code).toBe('test');
    });

    it('should handle missing timestamp field', async () => {
      localStorage.setItem('student_code', JSON.stringify({
        code: 'test',
      }));
      
      const retrieved = await getStoredCode();
      
      // Should still retrieve code even without timestamp
      expect(retrieved).not.toBeNull();
      expect(retrieved?.code).toBe('test');
    });
  });
});
