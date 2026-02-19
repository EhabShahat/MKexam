/**
 * Tests for Cache Security Features
 * 
 * Validates namespace isolation, encryption integration, and TTL enforcement
 * Requirements: 11.1, 11.2, 11.7
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheLayer } from '../cache';

describe('Cache Security Features', () => {
  describe('Namespace Isolation (Requirement 11.2)', () => {
    let adminCache: CacheLayer<string>;
    let studentCache: CacheLayer<string>;

    beforeEach(() => {
      adminCache = new CacheLayer({ namespace: 'admin', defaultTTL: 60000 });
      studentCache = new CacheLayer({ namespace: 'student', defaultTTL: 60000 });
    });

    afterEach(() => {
      adminCache.destroy();
      studentCache.destroy();
    });

    it('should isolate admin cache from student cache', () => {
      // Set same key in both caches with different values
      adminCache.set('data:123', 'admin-value');
      studentCache.set('data:123', 'student-value');

      // Each cache should return its own value
      expect(adminCache.get('data:123')).toBe('admin-value');
      expect(studentCache.get('data:123')).toBe('student-value');
    });

    it('should not allow cross-namespace access', () => {
      adminCache.set('secret', 'admin-secret');

      // Student cache should not have access to admin data
      expect(studentCache.get('secret')).toBeNull();
      expect(studentCache.has('secret')).toBe(false);
    });

    it('should clear only within namespace', () => {
      adminCache.set('key1', 'admin1');
      adminCache.set('key2', 'admin2');
      studentCache.set('key1', 'student1');
      studentCache.set('key2', 'student2');

      // Clear admin cache
      const cleared = adminCache.clear();
      expect(cleared).toBe(2);

      // Admin cache should be empty
      expect(adminCache.get('key1')).toBeNull();
      expect(adminCache.get('key2')).toBeNull();

      // Student cache should still have data
      expect(studentCache.get('key1')).toBe('student1');
      expect(studentCache.get('key2')).toBe('student2');
    });

    it('should clear pattern only within namespace', () => {
      adminCache.set('user:1', 'admin-user1');
      adminCache.set('user:2', 'admin-user2');
      adminCache.set('config:1', 'admin-config');
      studentCache.set('user:1', 'student-user1');
      studentCache.set('user:2', 'student-user2');

      // Clear user pattern in admin cache
      const cleared = adminCache.clear('user:');
      expect(cleared).toBe(2);

      // Admin user keys should be cleared
      expect(adminCache.get('user:1')).toBeNull();
      expect(adminCache.get('user:2')).toBeNull();
      // Admin config should remain
      expect(adminCache.get('config:1')).toBe('admin-config');

      // Student cache should be unaffected
      expect(studentCache.get('user:1')).toBe('student-user1');
      expect(studentCache.get('user:2')).toBe('student-user2');
    });

    it('should return correct namespace', () => {
      expect(adminCache.getNamespace()).toBe('admin');
      expect(studentCache.getNamespace()).toBe('student');
    });

    it('should maintain separate statistics per namespace', () => {
      adminCache.set('key1', 'value1');
      adminCache.get('key1'); // hit
      adminCache.get('key2'); // miss

      studentCache.set('key1', 'value1');
      studentCache.get('key1'); // hit
      studentCache.get('key1'); // hit

      const adminStats = adminCache.getStats();
      const studentStats = studentCache.getStats();

      expect(adminStats.hits).toBe(1);
      expect(adminStats.misses).toBe(1);
      expect(studentStats.hits).toBe(2);
      expect(studentStats.misses).toBe(0);
    });
  });

  describe('Audit Log TTL Enforcement (Requirement 11.7)', () => {
    let cache: CacheLayer<any>;

    beforeEach(() => {
      cache = new CacheLayer({ namespace: 'test', defaultTTL: 300000 }); // 5 minutes default
    });

    afterEach(() => {
      cache.destroy();
    });

    it('should limit audit log cache to 1 minute max', () => {
      const auditData = { action: 'login', user: 'admin' };

      // Try to set with 5 minute TTL
      cache.set('audit:login:123', auditData, 300000);

      // Should be limited to 1 minute (60000ms)
      const entry = (cache as any).cache.get('test:audit:login:123');
      expect(entry).toBeDefined();

      const actualTTL = entry.expiresAt - Date.now();
      expect(actualTTL).toBeLessThanOrEqual(60000);
      expect(actualTTL).toBeGreaterThan(59000); // Allow small timing variance
    });

    it('should enforce TTL limit for audit-log pattern', () => {
      cache.set('audit-log:action:456', { data: 'test' }, 600000); // 10 minutes

      const entry = (cache as any).cache.get('test:audit-log:action:456');
      const actualTTL = entry.expiresAt - Date.now();
      expect(actualTTL).toBeLessThanOrEqual(60000);
    });

    it('should enforce TTL limit for auditlog pattern', () => {
      cache.set('auditlog:event:789', { data: 'test' }, 180000); // 3 minutes

      const entry = (cache as any).cache.get('test:auditlog:event:789');
      const actualTTL = entry.expiresAt - Date.now();
      expect(actualTTL).toBeLessThanOrEqual(60000);
    });

    it('should not limit non-audit log keys', () => {
      cache.set('exam:meta:123', { title: 'Test' }, 300000); // 5 minutes

      const entry = (cache as any).cache.get('test:exam:meta:123');
      const actualTTL = entry.expiresAt - Date.now();
      expect(actualTTL).toBeGreaterThan(60000); // Should be close to 5 minutes
      expect(actualTTL).toBeLessThanOrEqual(300000);
    });

    it('should use default TTL for audit logs if not specified', () => {
      const auditCache = new CacheLayer({ namespace: 'audit', defaultTTL: 60000 });
      
      auditCache.set('audit:action:123', { data: 'test' });

      const entry = (auditCache as any).cache.get('audit:audit:action:123');
      const actualTTL = entry.expiresAt - Date.now();
      expect(actualTTL).toBeLessThanOrEqual(60000);

      auditCache.destroy();
    });

    it('should prevent infinite TTL for audit logs', () => {
      cache.set('audit:permanent:123', { data: 'test' }, -1); // Try infinite TTL

      const entry = (cache as any).cache.get('test:audit:permanent:123');
      const actualTTL = entry.expiresAt - Date.now();
      expect(actualTTL).toBeLessThanOrEqual(60000);
      expect(actualTTL).not.toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Encryption Integration (Requirement 11.1)', () => {
    let cache: CacheLayer<any>;

    beforeEach(() => {
      cache = new CacheLayer({ namespace: 'test', defaultTTL: 60000 });
    });

    afterEach(() => {
      cache.destroy();
    });

    it('should encrypt sensitive data (attempt state)', () => {
      const sensitiveData = {
        studentId: '123',
        answers: { q1: 'answer1', q2: 'answer2' },
      };

      cache.set('attempt:state:123', sensitiveData);

      // Check internal storage - should be encrypted
      const entry = (cache as any).cache.get('test:attempt:state:123');
      expect(entry.encrypted).toBe(true);
      expect(entry.value).toHaveProperty('encrypted');
      expect(entry.value).toHaveProperty('iv');
      expect(entry.value).toHaveProperty('authTag');
    });

    it('should decrypt on retrieval', () => {
      const sensitiveData = {
        studentId: '123',
        answers: { q1: 'answer1', q2: 'answer2' },
      };

      cache.set('attempt:state:123', sensitiveData);
      const retrieved = cache.get('attempt:state:123');

      expect(retrieved).toEqual(sensitiveData);
    });

    it('should not encrypt non-sensitive data', () => {
      const publicData = { title: 'Exam Title', duration: 60 };

      cache.set('exam:meta:123', publicData);

      // Check internal storage - should not be encrypted
      const entry = (cache as any).cache.get('test:exam:meta:123');
      expect(entry.encrypted).toBe(false);
      expect(entry.value).not.toHaveProperty('encrypted');
      expect(entry.value).toEqual(publicData);
    });

    it('should handle encryption failure gracefully', () => {
      // Create circular reference that can't be JSON stringified
      const circularData: any = { a: 1 };
      circularData.self = circularData;

      // Should not throw, but log error and store unencrypted
      expect(() => {
        cache.set('attempt:state:circular', circularData);
      }).not.toThrow();
    });

    it('should handle decryption failure gracefully', () => {
      // Manually insert corrupted encrypted data
      const corruptedEntry = {
        value: {
          encrypted: 'corrupted',
          iv: 'corrupted',
          authTag: 'corrupted',
          salt: 'corrupted',
        },
        expiresAt: Date.now() + 60000,
        size: 100,
        accessCount: 0,
        lastAccessed: Date.now(),
        encrypted: true,
      };

      (cache as any).cache.set('test:attempt:state:corrupted', corruptedEntry);

      // Should return null on decryption failure
      const result = cache.get('attempt:state:corrupted');
      expect(result).toBeNull();

      // Corrupted entry should be removed
      expect(cache.has('attempt:state:corrupted')).toBe(false);
    });
  });

  describe('Combined Security Features', () => {
    let adminCache: CacheLayer<any>;
    let studentCache: CacheLayer<any>;

    beforeEach(() => {
      adminCache = new CacheLayer({ namespace: 'admin', defaultTTL: 300000 });
      studentCache = new CacheLayer({ namespace: 'student', defaultTTL: 300000 });
    });

    afterEach(() => {
      adminCache.destroy();
      studentCache.destroy();
    });

    it('should encrypt and isolate sensitive data across namespaces', () => {
      const adminData = { userId: 'admin1', permissions: ['all'] };
      const studentData = { studentId: 'student1', answers: { q1: 'a' } };

      adminCache.set('attempt:state:123', adminData);
      studentCache.set('attempt:state:123', studentData);

      // Both should be encrypted
      const adminEntry = (adminCache as any).cache.get('admin:attempt:state:123');
      const studentEntry = (studentCache as any).cache.get('student:attempt:state:123');

      expect(adminEntry.encrypted).toBe(true);
      expect(studentEntry.encrypted).toBe(true);

      // Both should decrypt to correct values
      expect(adminCache.get('attempt:state:123')).toEqual(adminData);
      expect(studentCache.get('attempt:state:123')).toEqual(studentData);

      // Should not cross-contaminate
      expect(adminCache.get('attempt:state:123')).not.toEqual(studentData);
      expect(studentCache.get('attempt:state:123')).not.toEqual(adminData);
    });

    it('should enforce audit log TTL in both namespaces', () => {
      adminCache.set('audit:action:1', { action: 'delete' }, 600000);
      studentCache.set('audit:action:2', { action: 'submit' }, 600000);

      const adminEntry = (adminCache as any).cache.get('admin:audit:action:1');
      const studentEntry = (studentCache as any).cache.get('student:audit:action:2');

      const adminTTL = adminEntry.expiresAt - Date.now();
      const studentTTL = studentEntry.expiresAt - Date.now();

      expect(adminTTL).toBeLessThanOrEqual(60000);
      expect(studentTTL).toBeLessThanOrEqual(60000);
    });
  });
});
