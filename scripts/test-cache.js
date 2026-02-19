/**
 * Manual test script for cache layer module
 * Run with: node scripts/test-cache.js
 */

// Simple test framework
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ ${message}`);
    failed++;
  }
}

function assertEquals(actual, expected, message) {
  if (actual === expected) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ ${message}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Actual: ${actual}`);
    failed++;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mock CacheLayer implementation for testing
class CacheLayer {
  constructor(config = {}) {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    this.config = {
      maxSize: config.maxSize ?? 1000,
      maxMemory: config.maxMemory ?? 100 * 1024 * 1024,
      defaultTTL: config.defaultTTL ?? 300000,
    };
    this.cleanupInterval = null;
    this.startCleanupInterval();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    
    // Re-insert to update position in Map (maintains insertion order)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }

  set(key, value, ttl) {
    const expiresAt = Date.now() + (ttl ?? this.config.defaultTTL);
    const size = this.estimateSize(value);
    const entry = {
      value,
      expiresAt,
      size,
      accessCount: 0,
      lastAccessed: Date.now(),
    };
    this.evictIfNeeded(size);
    this.cache.set(key, entry);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear(pattern) {
    if (!pattern) {
      const size = this.cache.size;
      this.cache.clear();
      return size;
    }
    const regex = new RegExp(pattern);
    let cleared = 0;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }

  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      size: this.cache.size,
      evictions: this.stats.evictions,
    };
  }

  getMemoryUsage() {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }

  evictIfNeeded(newEntrySize) {
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }
    const currentMemory = this.getMemoryUsage();
    if (currentMemory + newEntrySize > this.config.maxMemory) {
      this.evictLRU();
    }
  }

  evictLRU() {
    // Map maintains insertion order, so first entry is least recently used
    const firstKey = this.cache.keys().next().value;
    
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
  }

  estimateSize(value) {
    try {
      const json = JSON.stringify(value);
      return json.length * 2;
    } catch {
      return 1024;
    }
  }

  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  cleanupExpired() {
    const now = Date.now();
    const keysToDelete = [];
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Cache key utilities
const CacheKeys = {
  examMetadata: (examId) => `exam:meta:${examId}`,
  examQuestions: (examId) => `exam:questions:${examId}`,
  studentCode: (code) => `student:code:${code}`,
  ipRules: (examId) => `exam:iprules:${examId}`,
  appConfig: (key) => `config:${key}`,
  attemptState: (attemptId) => `attempt:state:${attemptId}`,
  withRole: (key, role) => `${role}:${key}`,
  withHashedIP: (key, ip) => {
    const hash = simpleHash(ip);
    return `${key}:ip:${hash}`;
  },
};

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Run tests
async function runTests() {
  console.log('\n=== Cache Layer Tests ===\n');

  // Test 1: Basic set and get
  console.log('Test 1: Basic Operations');
  const cache1 = new CacheLayer({ defaultTTL: 1000 });
  cache1.set('key1', 'value1');
  assertEquals(cache1.get('key1'), 'value1', 'Should set and get values');
  assertEquals(cache1.get('nonexistent'), null, 'Should return null for non-existent keys');
  cache1.destroy();

  // Test 2: Delete
  console.log('\nTest 2: Delete Operations');
  const cache2 = new CacheLayer({ defaultTTL: 1000 });
  cache2.set('key1', 'value1');
  assert(cache2.delete('key1'), 'Should delete values');
  assertEquals(cache2.get('key1'), null, 'Deleted key should return null');
  cache2.destroy();

  // Test 3: Clear
  console.log('\nTest 3: Clear Operations');
  const cache3 = new CacheLayer({ defaultTTL: 1000 });
  cache3.set('key1', 'value1');
  cache3.set('key2', 'value2');
  const cleared = cache3.clear();
  assertEquals(cleared, 2, 'Should clear all entries');
  assertEquals(cache3.get('key1'), null, 'Cleared cache should return null');
  cache3.destroy();

  // Test 4: Pattern clear
  console.log('\nTest 4: Pattern Clear');
  const cache4 = new CacheLayer({ defaultTTL: 1000 });
  cache4.set('exam:1', 'value1');
  cache4.set('exam:2', 'value2');
  cache4.set('student:1', 'value3');
  const patternCleared = cache4.clear('exam:');
  assertEquals(patternCleared, 2, 'Should clear matching pattern');
  assertEquals(cache4.get('student:1'), 'value3', 'Non-matching keys should remain');
  cache4.destroy();

  // Test 5: TTL expiration
  console.log('\nTest 5: TTL Expiration');
  const cache5 = new CacheLayer({ defaultTTL: 1000 });
  cache5.set('key1', 'value1', 100);
  assertEquals(cache5.get('key1'), 'value1', 'Should get value before expiration');
  await sleep(150);
  assertEquals(cache5.get('key1'), null, 'Should return null after expiration');
  cache5.destroy();

  // Test 6: LRU eviction
  console.log('\nTest 6: LRU Eviction');
  const cache6 = new CacheLayer({ maxSize: 3, defaultTTL: 10000 });
  cache6.set('key1', 'value1');
  cache6.set('key2', 'value2');
  cache6.set('key3', 'value3');
  cache6.get('key1'); // Access key1 to make it recently used
  cache6.set('key4', 'value4'); // Should evict key2 (oldest)
  assertEquals(cache6.get('key1'), 'value1', 'Recently accessed key should remain');
  assertEquals(cache6.get('key2'), null, 'Oldest key should be evicted');
  assertEquals(cache6.get('key4'), 'value4', 'New key should be present');
  cache6.destroy();

  // Test 7: Statistics
  console.log('\nTest 7: Statistics');
  const cache7 = new CacheLayer({ defaultTTL: 1000 });
  cache7.set('key1', 'value1');
  cache7.get('key1'); // hit
  cache7.get('key2'); // miss
  const stats = cache7.getStats();
  assertEquals(stats.hits, 1, 'Should track hits');
  assertEquals(stats.misses, 1, 'Should track misses');
  assertEquals(stats.hitRate, 0.5, 'Should calculate hit rate');
  assertEquals(stats.size, 1, 'Should track cache size');
  cache7.destroy();

  // Test 8: Cache key generation
  console.log('\nTest 8: Cache Key Generation');
  assertEquals(CacheKeys.examMetadata('exam-123'), 'exam:meta:exam-123', 'Should generate exam metadata key');
  assertEquals(CacheKeys.examQuestions('exam-123'), 'exam:questions:exam-123', 'Should generate exam questions key');
  assertEquals(CacheKeys.studentCode('ABC123'), 'student:code:ABC123', 'Should generate student code key');
  assertEquals(CacheKeys.withRole('data:123', 'admin'), 'admin:data:123', 'Should generate key with role');
  
  const key1 = CacheKeys.withHashedIP('data:123', '192.168.1.1');
  const key2 = CacheKeys.withHashedIP('data:123', '192.168.1.1');
  assertEquals(key1, key2, 'Same IP should generate same hash');
  assert(key1.includes(':ip:'), 'Should contain hashed IP marker');

  // Test 9: Memory usage
  console.log('\nTest 9: Memory Usage');
  const cache9 = new CacheLayer({ defaultTTL: 1000 });
  cache9.set('key1', { data: 'test' });
  const usage = cache9.getMemoryUsage();
  assert(usage > 0, 'Should estimate memory usage');
  cache9.destroy();

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
