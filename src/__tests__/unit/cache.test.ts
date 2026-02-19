/**
 * Unit tests for Cache Layer Module
 * Tests core caching functionality including LRU eviction, TTL, and statistics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheLayer, CacheKeys } from '@/lib/cache';

describe('CacheLayer', () => {
  let cache: CacheLayer<string>;

  beforeEach(() => {
    cache = new CacheLayer({
      maxSize: 5,
      defaultTTL: 1000, // 1 second for testing
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      const cleared = cache.clear();
      expect(cleared).toBe(2);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    it('should clear entries matching pattern', () => {
      cache.set('exam:1', 'value1');
      cache.set('exam:2', 'value2');
      cache.set('student:1', 'value3');
      
      const cleared = cache.clear('exam:.*');
      expect(cleared).toBe(2);
      expect(cache.get('exam:1')).toBeNull();
      expect(cache.get('exam:2')).toBeNull();
      expect(cache.get('student:1')).toBe('value3');
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeNull();
    });

    it('should not return expired entries', async () => {
      cache.set('key1', 'value1', 50); // 50ms TTL
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(cache.has('key1')).toBe(false);
      expect(cache.get('key1')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      cache.set('key1', 'value1'); // Uses default 1000ms
      expect(cache.get('key1')).toBe('value1');
      
      // Should still be valid after 500ms
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entry when cache is full', () => {
      // Fill cache to max size (5)
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');
      
      // Add one more - should evict key1 (least recently used)
      cache.set('key6', 'value6');
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key6')).toBe('value6');
    });

    it('should update LRU order on access', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');
      
      // Access key1 to make it most recently used
      cache.get('key1');
      
      // Add new entry - should evict key2 (now least recently used)
      cache.set('key6', 'value6');
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeNull();
    });

    it('should track eviction count', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');
      cache.set('key6', 'value6'); // Triggers eviction
      
      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should track cache hits', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it('should track cache misses', () => {
      cache.get('nonexistent1');
      cache.get('nonexistent2');
      
      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.666, 2); // 2 hits / 3 total
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should track cache size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });
  });

  describe('Memory Management', () => {
    it('should estimate memory usage', () => {
      cache.set('key1', 'small');
      const usage1 = cache.getMemoryUsage();
      expect(usage1).toBeGreaterThan(0);
      
      cache.set('key2', 'a'.repeat(1000));
      const usage2 = cache.getMemoryUsage();
      expect(usage2).toBeGreaterThan(usage1);
    });

    it('should evict when memory limit exceeded', () => {
      const smallCache = new CacheLayer({
        maxSize: 100,
        maxMemory: 1000, // 1KB limit
      });
      
      // Add large entry
      smallCache.set('key1', 'x'.repeat(500));
      smallCache.set('key2', 'y'.repeat(500));
      
      // Should trigger eviction due to memory
      const stats = smallCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
      
      smallCache.destroy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values', () => {
      cache.set('key1', '');
      expect(cache.get('key1')).toBe('');
    });

    it('should handle special characters in keys', () => {
      cache.set('key:with:colons', 'value1');
      cache.set('key.with.dots', 'value2');
      cache.set('key-with-dashes', 'value3');
      
      expect(cache.get('key:with:colons')).toBe('value1');
      expect(cache.get('key.with.dots')).toBe('value2');
      expect(cache.get('key-with-dashes')).toBe('value3');
    });

    it('should handle rapid successive operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Should have evicted many entries due to size limit
      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
      expect(stats.size).toBeLessThanOrEqual(5);
    });
  });
});

describe('CacheKeys', () => {
  describe('Key Generation', () => {
    it('should generate exam metadata key', () => {
      const key = CacheKeys.examMetadata('exam-123');
      expect(key).toBe('exam:meta:exam-123');
    });

    it('should generate exam questions key', () => {
      const key = CacheKeys.examQuestions('exam-456');
      expect(key).toBe('exam:questions:exam-456');
    });

    it('should generate student code key', () => {
      const key = CacheKeys.studentCode('ABC123');
      expect(key).toBe('student:code:ABC123');
    });

    it('should generate IP rules key', () => {
      const key = CacheKeys.ipRules('exam-789');
      expect(key).toBe('exam:iprules:exam-789');
    });

    it('should generate app config key', () => {
      const key = CacheKeys.appConfig('setting1');
      expect(key).toBe('config:setting1');
    });

    it('should generate attempt state key', () => {
      const key = CacheKeys.attemptState('attempt-123');
      expect(key).toBe('attempt:state:attempt-123');
    });
  });

  describe('Role Isolation', () => {
    it('should generate key with role prefix', () => {
      const key = CacheKeys.withRole('exam:meta:123', 'admin');
      expect(key).toBe('admin:exam:meta:123');
    });

    it('should isolate admin and student caches', () => {
      const adminKey = CacheKeys.withRole('data:123', 'admin');
      const studentKey = CacheKeys.withRole('data:123', 'student');
      
      expect(adminKey).not.toBe(studentKey);
      expect(adminKey).toBe('admin:data:123');
      expect(studentKey).toBe('student:data:123');
    });
  });

  describe('IP Hashing', () => {
    it('should generate key with hashed IP', () => {
      const key = CacheKeys.withHashedIP('data:123', '192.168.1.1');
      expect(key).toMatch(/^data:123:ip:[a-z0-9]+$/);
    });

    it('should generate consistent hash for same IP', () => {
      const key1 = CacheKeys.withHashedIP('data:123', '192.168.1.1');
      const key2 = CacheKeys.withHashedIP('data:123', '192.168.1.1');
      expect(key1).toBe(key2);
    });

    it('should generate different hash for different IPs', () => {
      const key1 = CacheKeys.withHashedIP('data:123', '192.168.1.1');
      const key2 = CacheKeys.withHashedIP('data:123', '192.168.1.2');
      expect(key1).not.toBe(key2);
    });

    it('should not expose original IP in key', () => {
      const ip = '192.168.1.100';
      const key = CacheKeys.withHashedIP('data:123', ip);
      expect(key).not.toContain(ip);
    });
  });
});
