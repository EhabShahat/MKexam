/**
 * Cache Headers Utility
 * 
 * Provides utilities for adding cache headers to API responses
 * including Cache-Control, ETag, and conditional request support.
 * 
 * Requirements: 3.2
 */

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

/**
 * Cache configuration for different resource types
 */
export const CacheConfig = {
  // No caching - always fetch fresh
  NO_CACHE: {
    ttl: 0,
    cacheControl: 'no-cache, no-store, must-revalidate',
    pragma: 'no-cache',
    expires: '0',
  },
  // Short-lived cache (5 minutes) - exam metadata
  SHORT: {
    ttl: 300,
    cacheControl: 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
  },
  // Medium cache (15 minutes) - IP rules, student codes
  MEDIUM: {
    ttl: 900,
    cacheControl: 'public, max-age=900, s-maxage=900, stale-while-revalidate=120',
  },
  // Long cache (30 minutes) - app config
  LONG: {
    ttl: 1800,
    cacheControl: 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=300',
  },
  // Immutable cache (1 hour) - published exam questions
  IMMUTABLE: {
    ttl: 3600,
    cacheControl: 'public, max-age=3600, s-maxage=3600, immutable',
  },
} as const;

export type CacheConfigType = keyof typeof CacheConfig;

/**
 * Generate ETag from response data
 */
export function generateETag(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = createHash('md5').update(content).digest('hex');
  return `"${hash}"`;
}

/**
 * Check if request has matching ETag (for 304 Not Modified)
 */
export function checkETag(requestHeaders: Headers, etag: string): boolean {
  const ifNoneMatch = requestHeaders.get('if-none-match');
  return ifNoneMatch === etag;
}

/**
 * Add cache headers to a NextResponse
 */
export function addCacheHeaders(
  response: NextResponse,
  config: CacheConfigType,
  etag?: string
): NextResponse {
  const cacheConfig = CacheConfig[config];
  
  // Add Cache-Control header
  response.headers.set('Cache-Control', cacheConfig.cacheControl);
  
  // Add additional headers for NO_CACHE
  if (config === 'NO_CACHE' && 'pragma' in cacheConfig && 'expires' in cacheConfig) {
    response.headers.set('Pragma', cacheConfig.pragma);
    response.headers.set('Expires', cacheConfig.expires);
  }
  
  // Add ETag if provided
  if (etag) {
    response.headers.set('ETag', etag);
  }
  
  // Add Vary header to ensure proper caching by user role
  response.headers.set('Vary', 'Authorization, Accept-Encoding');
  
  return response;
}

/**
 * Create a cached JSON response with appropriate headers
 */
export function cachedJsonResponse(
  data: any,
  config: CacheConfigType,
  options?: {
    status?: number;
    generateETag?: boolean;
  }
): NextResponse {
  const status = options?.status ?? 200;
  const shouldGenerateETag = options?.generateETag ?? true;
  
  // Generate ETag if requested
  const etag = shouldGenerateETag ? generateETag(data) : undefined;
  
  // Create response
  const response = NextResponse.json(data, { status });
  
  // Add cache headers
  return addCacheHeaders(response, config, etag);
}

/**
 * Handle conditional GET request with ETag
 * Returns 304 Not Modified if ETag matches, otherwise returns cached response
 */
export function handleConditionalRequest(
  request: Request,
  data: any,
  config: CacheConfigType,
  options?: {
    status?: number;
  }
): NextResponse {
  const etag = generateETag(data);
  
  // Check if client has matching ETag
  if (checkETag(request.headers, etag)) {
    // Return 304 Not Modified
    const response = new NextResponse(null, { status: 304 });
    return addCacheHeaders(response, config, etag);
  }
  
  // Return full response with ETag
  return cachedJsonResponse(data, config, {
    ...options,
    generateETag: false, // We already generated it
  });
}

/**
 * Create cache key from request parameters
 */
export function createCacheKey(
  endpoint: string,
  params: Record<string, any>,
  userRole?: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const rolePrefix = userRole ? `${userRole}:` : '';
  return `${rolePrefix}${endpoint}?${sortedParams}`;
}

/**
 * Parse Cache-Control header to check if cache bypass is requested
 */
export function shouldBypassCache(request: Request): boolean {
  const cacheControl = request.headers.get('cache-control');
  const url = new URL(request.url);
  
  // Check for nocache query parameter (admin-only, should be validated separately)
  if (url.searchParams.has('nocache')) {
    return true;
  }
  
  // Check for no-cache or no-store in Cache-Control header
  if (cacheControl) {
    return cacheControl.includes('no-cache') || cacheControl.includes('no-store');
  }
  
  return false;
}
