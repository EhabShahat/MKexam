/**
 * Cache Layer Module
 * 
 * Provides in-memory caching with LRU eviction, TTL support, and metrics tracking.
 * Used to reduce database queries and bandwidth consumption.
 * 
 * Supports encryption for sensitive data (student answers) using AES-256-GCM.
 */

import { encryptIfNeeded, decryptIfNeeded, type EncryptedData } from './cacheEncryption';

export interface CacheEntry<T> {
  value: T | EncryptedData;
  expiresAt: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
  encrypted: boolean; // Track if value is encrypted
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions: number;
}

export interface CacheConfig {
  maxSize?: number; // Maximum number of entries
  maxMemory?: number; // Maximum memory in bytes
  defaultTTL?: number; // Default TTL in milliseconds
  namespace?: string; // Cache namespace for isolation (e.g., 'admin', 'student')
}

/**
 * In-memory cache with LRU eviction and TTL support
 */
export class CacheLayer<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };
  private config: Required<CacheConfig>;
  private cleanupInterval: ReturnType<typeof setInterval> | null;
  private namespace: string;

  constructor(config: CacheConfig = {}) {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
    this.config = {
      maxSize: config.maxSize ?? 1000,
      maxMemory: config.maxMemory ?? 100 * 1024 * 1024, // 100MB default
      defaultTTL: config.defaultTTL ?? 300000, // 5 minutes default
      namespace: config.namespace ?? 'general',
    };
    this.namespace = this.config.namespace;
    this.cleanupInterval = null;
    this.startCleanupInterval();
  }

  /**
   * Get the namespace for this cache instance
   */
  getNamespace(): string {
    return this.namespace;
  }

  /**
   * Add namespace prefix to cache key for isolation
   */
  private namespacedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const nsKey = this.namespacedKey(key);
    const entry = this.cache.get(nsKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access metadata and move to end (most recently used)
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    
    // Re-insert to update position in Map (maintains insertion order)
    this.cache.delete(nsKey);
    this.cache.set(nsKey, entry);

    // Decrypt if needed
    try {
      return decryptIfNeeded(entry.value) as T;
    } catch (error) {
      // If decryption fails, remove corrupted entry and return null
      console.error(`Cache decryption failed for key ${key}:`, error);
      this.delete(key);
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  set(key: string, value: T, ttl?: number): void {
    const nsKey = this.namespacedKey(key);
    let ttlValue = ttl ?? this.config.defaultTTL;
    
    // Enforce strict TTL limits for audit logs (max 1 minute for compliance)
    if (this.isAuditLogKey(key)) {
      const MAX_AUDIT_LOG_TTL = 60000; // 1 minute in milliseconds
      if (ttlValue < 0 || ttlValue > MAX_AUDIT_LOG_TTL) {
        console.warn(`Audit log cache TTL limited to ${MAX_AUDIT_LOG_TTL}ms for compliance. Requested: ${ttlValue}ms`);
        ttlValue = MAX_AUDIT_LOG_TTL;
      }
    }
    
    // Handle infinite TTL: -1 means never expire (set to far future)
    const expiresAt = ttlValue < 0 
      ? Number.MAX_SAFE_INTEGER 
      : Date.now() + ttlValue;
    
    // Encrypt if needed based on cache key (use original key for pattern matching)
    let storedValue: T | EncryptedData;
    let encrypted = false;
    
    try {
      storedValue = encryptIfNeeded(key, value);
      encrypted = storedValue !== value;
    } catch (error) {
      // If encryption fails, log error and store unencrypted
      console.error(`Cache encryption failed for key ${key}:`, error);
      storedValue = value;
    }
    
    const size = this.estimateSize(storedValue);

    const entry: CacheEntry<T> = {
      value: storedValue,
      expiresAt,
      size,
      accessCount: 0,
      lastAccessed: Date.now(),
      encrypted,
    };

    // Check if we need to evict before adding
    this.evictIfNeeded(size);

    this.cache.set(nsKey, entry);
  }

  /**
   * Check if cache key is for audit log data
   */
  private isAuditLogKey(key: string): boolean {
    const auditLogPatterns = [
      /^audit:/,
      /^audit-log:/,
      /^auditlog:/,
      /:audit$/,
      /audit-logs/,
    ];
    
    return auditLogPatterns.some(pattern => pattern.test(key));
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    const nsKey = this.namespacedKey(key);
    return this.cache.delete(nsKey);
  }

  /**
   * Clear all cache entries
   */
  clear(pattern?: string): number {
    if (!pattern) {
      const size = this.cache.size;
      this.cache.clear();
      return size;
    }

    // Clear entries matching pattern (within this namespace)
    const regex = new RegExp(pattern);
    let cleared = 0;
    const namespacePrefix = `${this.namespace}:`;

    for (const key of this.cache.keys()) {
      // Remove namespace prefix before pattern matching
      if (key.startsWith(namespacePrefix)) {
        const originalKey = key.substring(namespacePrefix.length);
        if (regex.test(originalKey)) {
          this.cache.delete(key);
          cleared++;
        }
      }
    }

    return cleared;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
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

  /**
   * Check if cache has key
   */
  has(key: string): boolean {
    const nsKey = this.namespacedKey(key);
    const entry = this.cache.get(nsKey);
    if (!entry) return false;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get current memory usage estimate
   */
  getMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Evict entries if needed to make room for new entry
   */
  private evictIfNeeded(newEntrySize: number): void {
    // Check size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    // Check memory limit
    const currentMemory = this.getMemoryUsage();
    if (currentMemory + newEntrySize > this.config.maxMemory) {
      this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    // Map maintains insertion order, so first entry is least recently used
    const firstKey = this.cache.keys().next().value;
    
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: T | EncryptedData): number {
    try {
      const json = JSON.stringify(value);
      return json.length * 2; // Rough estimate: 2 bytes per character
    } catch {
      return 1024; // Default 1KB if can't stringify
    }
  }

  /**
   * Clean up expired entries periodically
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000); // Run every minute

    // Prevent interval from keeping process alive (Node.js only)
    if (typeof this.cleanupInterval === 'object' && 'unref' in this.cleanupInterval) {
      (this.cleanupInterval as any).unref();
    }
  }

  /**
   * Remove all expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Stop cleanup interval (for cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

/**
 * Cache key generation utilities
 */
export const CacheKeys = {
  /**
   * Generate cache key for exam metadata
   */
  examMetadata: (examId: string): string => `exam:meta:${examId}`,

  /**
   * Generate cache key for exam questions
   */
  examQuestions: (examId: string): string => `exam:questions:${examId}`,

  /**
   * Generate cache key for student code validation
   */
  studentCode: (code: string): string => `student:code:${code}`,

  /**
   * Generate cache key for IP rules
   */
  ipRules: (examId: string): string => `exam:iprules:${examId}`,

  /**
   * Generate cache key for app config
   */
  appConfig: (key: string): string => `config:${key}`,

  /**
   * Generate cache key for attempt state
   */
  attemptState: (attemptId: string): string => `attempt:state:${attemptId}`,

  /**
   * Generate cache key with role isolation
   */
  withRole: (key: string, role: string): string => `${role}:${key}`,

  /**
   * Generate cache key with hashed IP for privacy
   */
  withHashedIP: (key: string, ip: string): string => {
    const hash = simpleHash(ip);
    return `${key}:ip:${hash}`;
  },
};

/**
 * Simple hash function for IP addresses
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Global cache instances for different use cases with namespace isolation
 * Admin cache is isolated from student cache for security
 */
export const caches = {
  // Admin-specific cache (isolated namespace)
  admin: new CacheLayer({ maxSize: 500, defaultTTL: 300000, namespace: 'admin' }), // 5 minutes
  
  // Student-specific cache (isolated namespace)
  student: new CacheLayer({ maxSize: 1000, defaultTTL: 600000, namespace: 'student' }), // 10 minutes
  
  // Exam metadata cache (shared but isolated)
  exam: new CacheLayer({ maxSize: 500, defaultTTL: 300000, namespace: 'exam' }), // 5 minutes
  
  // Questions cache (shared but isolated)
  questions: new CacheLayer({ maxSize: 200, defaultTTL: -1, namespace: 'questions' }), // Infinite for published
  
  // Config cache (shared but isolated)
  config: new CacheLayer({ maxSize: 100, defaultTTL: 1800000, namespace: 'config' }), // 30 minutes
  
  // Audit log cache (strict 1-minute TTL for compliance)
  auditLog: new CacheLayer({ maxSize: 200, defaultTTL: 60000, namespace: 'audit' }), // 1 minute max
  
  // General purpose cache (isolated)
  general: new CacheLayer({ maxSize: 1000, defaultTTL: 300000, namespace: 'general' }), // 5 minutes
};

/**
 * Helper function to get or set cache value
 */
export async function getOrSet<T>(
  cache: CacheLayer<T>,
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = cache.get(key);
  if (cached !== null) {
    return cached;
  }

  const value = await fetcher();
  cache.set(key, value, ttl);
  return value;
}
