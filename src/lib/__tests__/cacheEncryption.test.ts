/**
 * Tests for Cache Encryption Module
 * 
 * Validates encryption/decryption functionality for sensitive cached data
 */

import { describe, it, expect } from 'vitest';
import {
  encryptCacheData,
  decryptCacheData,
  shouldEncryptCacheData,
  encryptIfNeeded,
  decryptIfNeeded,
  type EncryptedData,
} from '../cacheEncryption';

describe('Cache Encryption Module', () => {
  describe('encryptCacheData', () => {
    it('should encrypt data and return EncryptedData structure', () => {
      const data = { studentId: '123', answers: { q1: 'answer1', q2: 'answer2' } };
      const encrypted = encryptCacheData(data);

      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('salt');
      expect(typeof encrypted.encrypted).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.authTag).toBe('string');
      expect(typeof encrypted.salt).toBe('string');
    });

    it('should produce different encrypted values for same data', () => {
      const data = { test: 'value' };
      const encrypted1 = encryptCacheData(data);
      const encrypted2 = encryptCacheData(data);

      // Different IVs and salts should produce different encrypted values
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    it('should handle complex nested objects', () => {
      const data = {
        student: { id: '123', name: 'Test Student' },
        answers: {
          q1: { value: 'answer1', timestamp: Date.now() },
          q2: { value: 'answer2', timestamp: Date.now() },
        },
        metadata: { attempts: 1, duration: 3600 },
      };

      const encrypted = encryptCacheData(data);
      expect(encrypted).toHaveProperty('encrypted');
    });
  });

  describe('decryptCacheData', () => {
    it('should decrypt data back to original value', () => {
      const original = { studentId: '123', answers: { q1: 'answer1', q2: 'answer2' } };
      const encrypted = encryptCacheData(original);
      const decrypted = decryptCacheData<typeof original>(encrypted);

      expect(decrypted).toEqual(original);
    });

    it('should handle complex nested objects', () => {
      const original = {
        student: { id: '123', name: 'Test Student' },
        answers: {
          q1: { value: 'answer1', timestamp: 1234567890 },
          q2: { value: 'answer2', timestamp: 1234567891 },
        },
        metadata: { attempts: 1, duration: 3600 },
      };

      const encrypted = encryptCacheData(original);
      const decrypted = decryptCacheData<typeof original>(encrypted);

      expect(decrypted).toEqual(original);
    });

    it('should throw error for invalid encrypted data', () => {
      const invalidData: EncryptedData = {
        encrypted: 'invalid',
        iv: 'invalid',
        authTag: 'invalid',
        salt: 'invalid',
      };

      expect(() => decryptCacheData(invalidData)).toThrow();
    });

    it('should throw error for tampered data', () => {
      const original = { test: 'value' };
      const encrypted = encryptCacheData(original);

      // Tamper with encrypted data
      const tampered = {
        ...encrypted,
        encrypted: encrypted.encrypted.slice(0, -5) + 'XXXXX',
      };

      expect(() => decryptCacheData(tampered)).toThrow();
    });
  });

  describe('shouldEncryptCacheData', () => {
    it('should return true for attempt state keys', () => {
      expect(shouldEncryptCacheData('attempt:state:123')).toBe(true);
      expect(shouldEncryptCacheData('attempt:state:abc-def')).toBe(true);
    });

    it('should return true for student answer keys', () => {
      expect(shouldEncryptCacheData('student:answers:123')).toBe(true);
      expect(shouldEncryptCacheData('attempt:answers:456')).toBe(true);
    });

    it('should return false for non-sensitive keys', () => {
      expect(shouldEncryptCacheData('exam:meta:123')).toBe(false);
      expect(shouldEncryptCacheData('exam:questions:456')).toBe(false);
      expect(shouldEncryptCacheData('config:app')).toBe(false);
      expect(shouldEncryptCacheData('student:code:ABC123')).toBe(false);
    });
  });

  describe('encryptIfNeeded', () => {
    it('should encrypt sensitive data', () => {
      const data = { answers: { q1: 'answer1' } };
      const result = encryptIfNeeded('attempt:state:123', data);

      expect(result).not.toBe(data);
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
    });

    it('should not encrypt non-sensitive data', () => {
      const data = { title: 'Exam Title' };
      const result = encryptIfNeeded('exam:meta:123', data);

      expect(result).toBe(data);
      expect(result).not.toHaveProperty('encrypted');
    });
  });

  describe('decryptIfNeeded', () => {
    it('should decrypt encrypted data', () => {
      const original = { answers: { q1: 'answer1' } };
      const encrypted = encryptCacheData(original);
      const decrypted = decryptIfNeeded(encrypted);

      expect(decrypted).toEqual(original);
    });

    it('should return non-encrypted data as-is', () => {
      const data = { title: 'Exam Title' };
      const result = decryptIfNeeded(data);

      expect(result).toBe(data);
    });

    it('should handle plain objects without encryption properties', () => {
      const data = { some: 'data', nested: { value: 123 } };
      const result = decryptIfNeeded(data);

      expect(result).toBe(data);
    });
  });

  describe('Encryption round-trip', () => {
    it('should maintain data integrity through encrypt/decrypt cycle', () => {
      const testCases = [
        { simple: 'string' },
        { number: 42 },
        { boolean: true },
        { array: [1, 2, 3] },
        { nested: { deep: { value: 'test' } } },
        { mixed: { str: 'test', num: 123, arr: [1, 2], obj: { a: 1 } } },
      ];

      testCases.forEach((testCase) => {
        const encrypted = encryptCacheData(testCase);
        const decrypted = decryptCacheData(encrypted);
        expect(decrypted).toEqual(testCase);
      });
    });
  });
});
