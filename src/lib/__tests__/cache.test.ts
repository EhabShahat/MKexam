/**
 * Tests for Cache Layer Module
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { CacheLayer, CacheKeys, getOrSet, caches } from '../cache';

describe('CacheLayer', () => {
  let cache: CacheLayer<any>;

  beforeEach(() => {
    cache = new CacheLayer({
      maxSize: 10,
      maxMemory: 1024 * 1024, // 1MB
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
      const cleared = cache.clear('exam:');
      expect(cleared).toBe(2);
      expect(cache.get('exam:1')).toBeNull();
      expect(cache.get('student:1')).toBe('value3');
    });
  });

  describe('TTL Support', () => {
    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.get('key1')).toBeNull();
    });

    it('should not return expired entries on has()', async () => {
      cache.set('key1', 'value1', 100);
      expect(cache.has('key1')).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entry when size limit reached', () => {
      // Fill cache to max size
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Access key5 to make it recently used
      cache.get('key5');

      // Add new entry, should evict key0 (oldest)
      cache.set('key10', 'value10');

      expect(cache.get('key0')).toBeNull();
      expect(cache.get('key5')).toBe('value5');
      expect(cache.get('key10')).toBe('value10');
    });

    it('should track eviction count', () => {
      for (let i = 0; i < 12; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
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
      cache.get('key2'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track cache size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Memory Management', () => {
    it('should estimate memory usage', () => {
      cache.set('key1', { data: 'test' });
      const usage = cache.getMemoryUsage();
      expect(usage).toBeGreaterThan(0);
    });

    it('should handle values that cannot be stringified', () => {
      const circular: any = {};
      circular.self = circular;
      
      // Should not throw
      expect(() => cache.set('key1', circular)).not.toThrow();
    });
  });

  describe('Access Tracking', () => {
    it('should increment access count on get', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      // Fill cache to max size (10 entries)
      for (let i = 2; i < 11; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Access key1 again to make it most recently used
      cache.get('key1');

      // Add new entry, should evict key2 (oldest unaccessed)
      cache.set('key11', 'value11');

      // key1 should still exist due to recent access
      expect(cache.get('key1')).toBe('value1');
      // key2 should be evicted
      expect(cache.get('key2')).toBeNull();
    });
  });
});

describe('CacheKeys', () => {
  it('should generate exam metadata key', () => {
    expect(CacheKeys.examMetadata('exam-123')).toBe('exam:meta:exam-123');
  });

  it('should generate exam questions key', () => {
    expect(CacheKeys.examQuestions('exam-123')).toBe('exam:questions:exam-123');
  });

  it('should generate student code key', () => {
    expect(CacheKeys.studentCode('ABC123')).toBe('student:code:ABC123');
  });

  it('should generate IP rules key', () => {
    expect(CacheKeys.ipRules('exam-123')).toBe('exam:iprules:exam-123');
  });

  it('should generate app config key', () => {
    expect(CacheKeys.appConfig('theme')).toBe('config:theme');
  });

  it('should generate attempt state key', () => {
    expect(CacheKeys.attemptState('attempt-123')).toBe('attempt:state:attempt-123');
  });

  it('should generate key with role isolation', () => {
    expect(CacheKeys.withRole('data:123', 'admin')).toBe('admin:data:123');
    expect(CacheKeys.withRole('data:123', 'student')).toBe('student:data:123');
  });

  it('should generate key with hashed IP', () => {
    const key1 = CacheKeys.withHashedIP('data:123', '192.168.1.1');
    const key2 = CacheKeys.withHashedIP('data:123', '192.168.1.1');
    const key3 = CacheKeys.withHashedIP('data:123', '192.168.1.2');

    // Same IP should generate same hash
    expect(key1).toBe(key2);
    // Different IP should generate different hash
    expect(key1).not.toBe(key3);
    // Should contain hashed IP
    expect(key1).toMatch(/^data:123:ip:[a-z0-9]+$/);
  });
});

describe('getOrSet', () => {
  let cache: CacheLayer<string>;

  beforeEach(() => {
    cache = new CacheLayer({ defaultTTL: 1000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  it('should fetch and cache value on miss', async () => {
    const fetcher = vi.fn(async () => 'fetched-value');
    
    const result = await getOrSet(cache, 'key1', fetcher);
    
    expect(result).toBe('fetched-value');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.get('key1')).toBe('fetched-value');
  });

  it('should return cached value on hit', async () => {
    const fetcher = vi.fn(async () => 'fetched-value');
    
    await getOrSet(cache, 'key1', fetcher);
    const result = await getOrSet(cache, 'key1', fetcher);
    
    expect(result).toBe('fetched-value');
    expect(fetcher).toHaveBeenCalledTimes(1); // Only called once
  });

  it('should use custom TTL when provided', async () => {
    const fetcher = async () => 'value';
    
    await getOrSet(cache, 'key1', fetcher, 100);
    expect(cache.get('key1')).toBe('value');
    
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(cache.get('key1')).toBeNull();
  });
});

describe('Global Cache Instances', () => {
  afterAll(() => {
    // Clean up global caches
    caches.exam.destroy();
    caches.questions.destroy();
    caches.student.destroy();
    caches.config.destroy();
    caches.general.destroy();
  });

  it('should have exam cache instance', () => {
    expect(caches.exam).toBeInstanceOf(CacheLayer);
  });

  it('should have questions cache instance', () => {
    expect(caches.questions).toBeInstanceOf(CacheLayer);
  });

  it('should have student cache instance', () => {
    expect(caches.student).toBeInstanceOf(CacheLayer);
  });

  it('should have config cache instance', () => {
    expect(caches.config).toBeInstanceOf(CacheLayer);
  });

  it('should have general cache instance', () => {
    expect(caches.general).toBeInstanceOf(CacheLayer);
  });
});
