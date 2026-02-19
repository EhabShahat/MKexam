import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { caches, clearAllAppConfigCache } from "@/lib/cachedQueries";
import { 
  invalidateCache, 
  invalidateExamCache, 
  invalidateStudentCache, 
  invalidateConfigCache,
  getCacheStatistics 
} from "@/lib/responseCacheMiddleware";

/**
 * POST /api/admin/cache/clear
 * Clear all or specific cache types
 * Requirements: 6.7
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    
    const body = await req.json().catch(() => ({}));
    const { cacheType, resourceId } = body as { 
      cacheType?: string;
      resourceId?: string;
    };
    
    const results: Record<string, number> = {};
    
    // Handle specific resource invalidation
    if (resourceId) {
      if (cacheType === 'exam') {
        results.exam = invalidateExamCache(resourceId);
      } else if (cacheType === 'student') {
        results.student = invalidateStudentCache(resourceId);
      } else if (cacheType === 'config') {
        results.config = invalidateConfigCache(resourceId);
      } else {
        return NextResponse.json(
          { error: 'Invalid cache type for resource invalidation' },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        cleared: results,
        message: `Cache for ${cacheType} ${resourceId} cleared successfully`,
      });
    }
    
    if (!cacheType || cacheType === 'all') {
      // Clear all caches
      results.exam = caches.exam.clear();
      results.questions = caches.questions.clear();
      results.student = caches.student.clear();
      results.config = caches.config.clear();
      results.general = caches.general.clear();
    } else {
      // Clear specific cache type
      switch (cacheType) {
        case 'exam':
          results.exam = caches.exam.clear();
          break;
        case 'questions':
          results.questions = caches.questions.clear();
          break;
        case 'student':
          results.student = caches.student.clear();
          break;
        case 'config':
          results.config = clearAllAppConfigCache();
          break;
        case 'general':
          results.general = caches.general.clear();
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid cache type. Valid types: exam, questions, student, config, general, all' },
            { status: 400 }
          );
      }
    }
    
    return NextResponse.json({
      success: true,
      cleared: results,
      message: `Cache cleared successfully`,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { error: e?.message || 'unexpected_error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/cache/clear
 * Get cache statistics
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    
    // Use the new getCacheStatistics function
    return NextResponse.json(getCacheStatistics());
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { error: e?.message || 'unexpected_error' },
      { status: 500 }
    );
  }
}
