/**
 * Example API Route with Response Caching
 * 
 * This file demonstrates how to use the response caching middleware
 * in different scenarios. This is an example file and not used in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  withResponseCache, 
  createCachedHandler,
  invalidateOnMutation 
} from '@/lib/responseCacheMiddleware';

/**
 * Example 1: Simple cached GET endpoint
 * Caches response for 5 minutes (SHORT config)
 */
export async function GET_Example1(req: NextRequest) {
  return withResponseCache(
    req,
    { 
      cacheConfig: 'SHORT',
      useETag: true 
    },
    async () => {
      // Your data fetching logic here
      const data = await fetchSomeData();
      return data;
    }
  );
}

/**
 * Example 2: Using createCachedHandler helper
 * More concise syntax for simple cases
 */
export const GET_Example2 = createCachedHandler(
  { 
    cacheConfig: 'MEDIUM',
    cacheInstance: 'exam' 
  },
  async (req) => {
    const data = await fetchExamData();
    return data;
  }
);

/**
 * Example 3: Custom cache key generation
 * Useful when you need specific cache key logic
 */
export async function GET_Example3(req: NextRequest) {
  return withResponseCache(
    req,
    {
      cacheConfig: 'LONG',
      keyGenerator: (req) => {
        const url = new URL(req.url);
        const examId = url.searchParams.get('examId');
        return `custom:exam:${examId}`;
      },
      cacheInstance: 'exam'
    },
    async () => {
      const data = await fetchCustomData();
      return data;
    }
  );
}

/**
 * Example 4: Role-based cache isolation
 * Different cache for admin vs student
 */
export async function GET_Example4(req: NextRequest) {
  // Extract user role from request (e.g., from JWT)
  const userRole = await getUserRole(req);
  
  return withResponseCache(
    req,
    {
      cacheConfig: 'SHORT',
      userRole: userRole, // Isolates cache by role
      cacheInstance: 'general'
    },
    async () => {
      const data = await fetchRoleSpecificData(userRole);
      return data;
    }
  );
}

/**
 * Example 5: Immutable cache for published content
 * Cache indefinitely for content that never changes
 */
export async function GET_Example5(req: NextRequest) {
  return withResponseCache(
    req,
    {
      cacheConfig: 'IMMUTABLE',
      cacheInstance: 'questions',
      useETag: true
    },
    async () => {
      const questions = await fetchPublishedQuestions();
      return questions;
    }
  );
}

/**
 * Example 6: POST endpoint with cache invalidation
 * Invalidate related caches after mutation
 */
export async function POST_Example(req: NextRequest) {
  try {
    const body = await req.json();
    const { examId, ...data } = body;
    
    // Perform mutation
    const result = await updateExam(examId, data);
    
    // Invalidate related caches
    await invalidateOnMutation('exam', examId);
    
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'unexpected_error' },
      { status: 500 }
    );
  }
}

/**
 * Example 7: No cache for dynamic/sensitive data
 */
export async function GET_Example7(req: NextRequest) {
  return withResponseCache(
    req,
    {
      cacheConfig: 'NO_CACHE' // Always fetch fresh
    },
    async () => {
      const sensitiveData = await fetchSensitiveData();
      return sensitiveData;
    }
  );
}

/**
 * Example 8: Custom TTL override
 * Override default TTL for specific use case
 */
export async function GET_Example8(req: NextRequest) {
  return withResponseCache(
    req,
    {
      cacheConfig: 'SHORT',
      ttl: 60000, // Override to 1 minute instead of 5
      cacheInstance: 'general'
    },
    async () => {
      const data = await fetchFrequentlyChangingData();
      return data;
    }
  );
}

// Mock functions for examples
async function fetchSomeData() { return { data: 'example' }; }
async function fetchExamData() { return { exam: 'data' }; }
async function fetchCustomData() { return { custom: 'data' }; }
async function getUserRole(req: NextRequest) { return 'admin'; }
async function fetchRoleSpecificData(role: string) { return { role, data: 'example' }; }
async function fetchPublishedQuestions() { return []; }
async function updateExam(id: string, data: any) { return { id, ...data }; }
async function fetchSensitiveData() { return { sensitive: true }; }
async function fetchFrequentlyChangingData() { return { timestamp: Date.now() }; }
