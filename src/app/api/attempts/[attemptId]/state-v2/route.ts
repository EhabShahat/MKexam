/**
 * Enhanced attempt state API with compression support
 * Uses get_attempt_state_v2 RPC with field selection and compression
 * 
 * Supports cache bypass with ?nocache=true (admin only)
 * 
 * Requirements: 1.1, 1.2, 14.1, 14.5, 10.3
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { AttemptState } from "@/lib/types";
import { compressResponse } from "@/lib/compression-middleware";
import { shouldBypassCache, addCacheStatusHeaders } from "@/lib/cache-bypass";
import { caches, CacheKeys } from "@/lib/cache";

export const runtime = 'edge';
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const supabase = supabaseServer();
    const { attemptId } = await ctx.params;
    
    // Check if cache bypass is requested and allowed
    const bypassCache = await shouldBypassCache(req);
    
    // Parse field selection from query parameters
    const { searchParams } = new URL(req.url);
    const fieldsParam = searchParams.get('fields');
    let fields = null;
    
    if (fieldsParam) {
      try {
        // Parse fields as comma-separated list or JSON
        if (fieldsParam.startsWith('[') || fieldsParam.startsWith('{')) {
          fields = JSON.parse(fieldsParam);
        } else {
          // Convert comma-separated list to include array
          const fieldList = fieldsParam.split(',').map(f => f.trim());
          fields = { include: fieldList };
        }
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid fields parameter' },
          { status: 400 }
        );
      }
    }
    
    let data, error;
    let fromCache = false;
    
    // Try cache first if not bypassing
    if (!bypassCache && !fields) {
      // Only cache full responses (no field selection)
      const cacheKey = CacheKeys.attemptState(attemptId);
      const cached = caches.general.get(cacheKey);
      
      if (cached) {
        data = cached;
        fromCache = true;
      }
    }
    
    // Fetch from database if not in cache or bypassing
    if (!fromCache) {
      // Call enhanced RPC with field selection
      const result = await supabase.rpc("get_attempt_state_v2", {
        p_attempt_id: attemptId,
        p_fields: fields,
      });
      
      data = result.data;
      error = result.error;
      
      // Cache the result if no field selection and no error
      if (!error && !fields && !bypassCache) {
        const cacheKey = CacheKeys.attemptState(attemptId);
        caches.general.set(cacheKey, data, 30000); // 30 seconds TTL
      }
    }
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Add server timestamp
    const attemptState = {
      ...data,
      server_now: new Date().toISOString(),
    } as AttemptState;
    
    // Get Accept-Encoding header for compression detection
    const acceptEncoding = req.headers.get('accept-encoding');
    
    // Compress response if size > 1KB and client supports compression
    const response = await compressResponse(attemptState, acceptEncoding);
    
    // Add cache status headers
    addCacheStatusHeaders(response.headers, fromCache, bypassCache);
    
    return response;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}
