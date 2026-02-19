/**
 * Cache Bypass Utilities
 * 
 * Provides cache bypass functionality for debugging purposes.
 * Only available for authenticated admin users.
 * 
 * Requirements: 10.3
 */

import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/token';

/**
 * Check if request has cache bypass parameter
 * 
 * @param req - Next.js request object
 * @returns True if ?nocache=true is present
 */
export function hasCacheBypassParam(req: NextRequest): boolean {
  const { searchParams } = new URL(req.url);
  return searchParams.get('nocache') === 'true' || searchParams.get('bypass-cache') === 'true';
}

/**
 * Check if user is authenticated admin
 * 
 * @param req - Next.js request object
 * @returns True if user is authenticated admin
 */
export async function isAuthenticatedAdmin(req: NextRequest): Promise<boolean> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    
    const token = authHeader.substring(7);
    
    // Verify token
    const payload = await verifyToken(token);
    
    // Check if user has admin role
    return payload?.role === 'admin' || payload?.role === 'service_role';
  } catch {
    return false;
  }
}

/**
 * Check if cache bypass is allowed for this request
 * 
 * Cache bypass is only allowed for:
 * 1. Authenticated admin users
 * 2. Requests with ?nocache=true parameter
 * 
 * @param req - Next.js request object
 * @returns True if cache bypass is allowed
 */
export async function shouldBypassCache(req: NextRequest): Promise<boolean> {
  // Check if cache bypass parameter is present
  if (!hasCacheBypassParam(req)) {
    return false;
  }
  
  // Check if user is authenticated admin
  const isAdmin = await isAuthenticatedAdmin(req);
  
  if (!isAdmin) {
    // Log unauthorized cache bypass attempt
    // eslint-disable-next-line no-console
    console.warn('[CACHE BYPASS] Unauthorized attempt from:', {
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
      url: req.url,
    });
  }
  
  return isAdmin;
}

/**
 * Add cache bypass headers to response
 * Indicates that cache was bypassed for this request
 * 
 * @param headers - Response headers
 * @returns Modified headers
 */
export function addCacheBypassHeaders(headers: Headers): Headers {
  headers.set('X-Cache-Bypass', 'true');
  headers.set('X-Cache-Status', 'bypassed');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return headers;
}

/**
 * Log cache bypass event for monitoring
 * 
 * @param endpoint - Endpoint that was accessed
 * @param userId - User ID who bypassed cache
 * @param reason - Reason for bypass (optional)
 */
export function logCacheBypass(
  endpoint: string,
  userId?: string,
  reason?: string
): void {
  // eslint-disable-next-line no-console
  console.log('[CACHE BYPASS]', {
    timestamp: new Date().toISOString(),
    endpoint,
    userId,
    reason,
  });
  
  // TODO: Optionally log to database for audit trail
  // This can be implemented later to track cache bypass usage
}

/**
 * Wrapper function to conditionally use cache
 * 
 * @param req - Next.js request object
 * @param cacheKey - Cache key to check
 * @param cacheGetter - Function to get value from cache
 * @param fetcher - Function to fetch fresh data
 * @returns Data from cache or fresh fetch
 */
export async function getWithCacheBypass<T>(
  req: NextRequest,
  cacheKey: string,
  cacheGetter: (key: string) => T | null,
  fetcher: () => Promise<T>
): Promise<{ data: T; fromCache: boolean; bypassed: boolean }> {
  const bypass = await shouldBypassCache(req);
  
  if (bypass) {
    // Log cache bypass
    logCacheBypass(req.url, 'admin'); // TODO: Get actual user ID
    
    // Fetch fresh data
    const data = await fetcher();
    return { data, fromCache: false, bypassed: true };
  }
  
  // Try to get from cache
  const cached = cacheGetter(cacheKey);
  
  if (cached !== null) {
    return { data: cached, fromCache: true, bypassed: false };
  }
  
  // Cache miss, fetch fresh data
  const data = await fetcher();
  return { data, fromCache: false, bypassed: false };
}

/**
 * Add cache status headers to response
 * 
 * @param headers - Response headers
 * @param fromCache - Whether data came from cache
 * @param bypassed - Whether cache was bypassed
 * @returns Modified headers
 */
export function addCacheStatusHeaders(
  headers: Headers,
  fromCache: boolean,
  bypassed: boolean
): Headers {
  if (bypassed) {
    return addCacheBypassHeaders(headers);
  }
  
  headers.set('X-Cache-Status', fromCache ? 'hit' : 'miss');
  
  if (fromCache) {
    headers.set('X-Cache', 'HIT');
  } else {
    headers.set('X-Cache', 'MISS');
  }
  
  return headers;
}
