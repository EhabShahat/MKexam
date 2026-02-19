/**
 * Response Caching Middleware
 * 
 * Provides middleware for caching API responses with automatic cache key generation
 * and invalidation logic. Integrates with the existing cache layer.
 * 
 * Requirements: 3.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { caches, CacheKeys, getOrSet } from './cache';
import { 
  cachedJsonResponse, 
  handleConditionalRequest, 
  shouldBypassCache,
  createCacheKey,
  CacheConfigType 
} from './cacheHeaders';

/**
 * Options for response caching
 */
export interface ResponseCacheOptions {
  /**
   * Cache configuration type (SHORT, MEDIUM, LONG, IMMUTABLE, NO_CACHE)
   */
  cacheConfig: CacheConfigType;
  
  /**
   * Custom cache key generator
   * If not provided, will use default key generation from request URL
   */
  keyGenerator?: (req: NextRequest) => string;
  
  /**
   * User role for cache isolation (optional)
   */
  userRole?: string;
  
  /**
   * Whether to use ETag for conditional requests
   */
  useETag?: boolean;
  
  /**
   * Custom TTL in milliseconds (overrides cacheConfig default)
   */
  ttl?: number;
  
  /**
   * Cache instance to use (defaults to general cache)
   */
  cacheInstance?: 'exam' | 'questions' | 'student' | 'config' | 'general';
}

/**
 * Default cache key generator from request
 */
function defaultKeyGenerator(req: NextRequest): string {
  const url = new URL(req.url);
  const params: Record<string, any> = {};
  
  // Extract query parameters
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  // Extract path parameters from pathname
  const pathname = url.pathname;
  
  return createCacheKey(pathname, params);
}

/**
 * Middleware wrapper for caching API responses
 * 
 * Usage:
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   return withResponseCache(req, { cacheConfig: 'SHORT' }, async () => {
 *     const data = await fetchData();
 *     return data;
 *   });
 * }
 * ```
 */
export async function withResponseCache<T>(
  req: NextRequest,
  options: ResponseCacheOptions,
  handler: () => Promise<T>
): Promise<NextResponse> {
  try {
    // Check if cache should be bypassed
    if (options.cacheConfig === 'NO_CACHE' || shouldBypassCache(req)) {
      const data = await handler();
      return cachedJsonResponse(data, 'NO_CACHE');
    }
    
    // Generate cache key
    const keyGenerator = options.keyGenerator || defaultKeyGenerator;
    let cacheKey = keyGenerator(req);
    
    // Add role isolation if provided
    if (options.userRole) {
      cacheKey = CacheKeys.withRole(cacheKey, options.userRole);
    }
    
    // Select cache instance
    const cacheInstance = caches[options.cacheInstance || 'general'];
    
    // Try to get from cache
    const cachedData = cacheInstance.get(cacheKey);
    
    if (cachedData !== null) {
      // Return cached response with conditional request support
      if (options.useETag !== false) {
        return handleConditionalRequest(req, cachedData, options.cacheConfig);
      }
      return cachedJsonResponse(cachedData, options.cacheConfig);
    }
    
    // Cache miss - execute handler
    const data = await handler();
    
    // Store in cache
    cacheInstance.set(cacheKey, data, options.ttl);
    
    // Return response with cache headers
    if (options.useETag !== false) {
      return handleConditionalRequest(req, data, options.cacheConfig);
    }
    return cachedJsonResponse(data, options.cacheConfig);
    
  } catch (error: any) {
    // On error, return error response without caching
    return NextResponse.json(
      { error: error?.message || 'unexpected_error' },
      { status: 500 }
    );
  }
}

/**
 * Invalidate cache entries by pattern
 * 
 * Usage:
 * ```typescript
 * // Invalidate all exam-related caches
 * invalidateCache('exam:.*');
 * 
 * // Invalidate specific exam
 * invalidateCache(`exam:meta:${examId}`);
 * ```
 */
export function invalidateCache(pattern: string, cacheInstance?: keyof typeof caches): number {
  if (cacheInstance) {
    return caches[cacheInstance].clear(pattern);
  }
  
  // Clear from all cache instances
  let totalCleared = 0;
  for (const cache of Object.values(caches)) {
    totalCleared += cache.clear(pattern);
  }
  
  return totalCleared;
}

/**
 * Invalidate cache for specific exam
 */
export function invalidateExamCache(examId: string): number {
  let cleared = 0;
  
  // Clear exam metadata
  cleared += caches.exam.clear(CacheKeys.examMetadata(examId));
  
  // Clear exam questions
  cleared += caches.questions.clear(CacheKeys.examQuestions(examId));
  
  // Clear IP rules
  cleared += caches.general.clear(CacheKeys.ipRules(examId));
  
  // Clear any other exam-related caches
  cleared += invalidateCache(`exam:.*:${examId}`);
  
  return cleared;
}

/**
 * Invalidate cache for specific student
 */
export function invalidateStudentCache(studentCode: string): number {
  return caches.student.clear(CacheKeys.studentCode(studentCode));
}

/**
 * Invalidate app config cache
 */
export function invalidateConfigCache(configKey?: string): number {
  if (configKey) {
    return caches.config.clear(CacheKeys.appConfig(configKey));
  }
  
  // Clear all config cache
  return caches.config.clear('config:.*');
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStatistics() {
  return {
    exam: caches.exam.getStats(),
    questions: caches.questions.getStats(),
    student: caches.student.getStats(),
    config: caches.config.getStats(),
    general: caches.general.getStats(),
  };
}

/**
 * Middleware for automatic cache invalidation on mutations
 * 
 * Usage in API routes that modify data:
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   const result = await updateExam(examId, data);
 *   
 *   // Invalidate related caches
 *   await invalidateOnMutation('exam', examId);
 *   
 *   return NextResponse.json(result);
 * }
 * ```
 */
export async function invalidateOnMutation(
  resourceType: 'exam' | 'student' | 'config' | 'attempt',
  resourceId: string
): Promise<number> {
  switch (resourceType) {
    case 'exam':
      return invalidateExamCache(resourceId);
    
    case 'student':
      return invalidateStudentCache(resourceId);
    
    case 'config':
      return invalidateConfigCache(resourceId);
    
    case 'attempt':
      // Clear attempt-specific cache
      return caches.general.clear(CacheKeys.attemptState(resourceId));
    
    default:
      return 0;
  }
}

/**
 * Helper to create a cached API route handler
 * 
 * Usage:
 * ```typescript
 * export const GET = createCachedHandler(
 *   { cacheConfig: 'SHORT', userRole: 'admin' },
 *   async (req) => {
 *     const data = await fetchData();
 *     return data;
 *   }
 * );
 * ```
 */
export function createCachedHandler<T>(
  options: ResponseCacheOptions,
  handler: (req: NextRequest) => Promise<T>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    return withResponseCache(req, options, () => handler(req));
  };
}
