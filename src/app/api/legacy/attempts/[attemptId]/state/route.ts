/**
 * LEGACY ENDPOINT - DEPRECATED
 * 
 * This endpoint is deprecated and will be removed after 30 days.
 * Please migrate to: /api/attempts/[attemptId]/state-v2
 * 
 * This wrapper maintains backward compatibility by calling the optimized
 * get_attempt_state_v2 RPC function with default parameters.
 * 
 * Requirements: 10.1, 10.2
 */

import { NextRequest, NextResponse } from "next/server";
import { AttemptState } from "@/lib/types";
import { compressResponse } from "@/lib/compression-middleware";
import {
  legacyGetAttemptState,
  addDeprecationHeaders,
  shouldBlockLegacyEndpoint,
  DEPRECATION_CONFIG,
} from "@/lib/legacy-wrapper";

export const runtime = 'edge';
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    // Check if deprecation period has expired
    if (shouldBlockLegacyEndpoint()) {
      return NextResponse.json(
        {
          error: 'endpoint_removed',
          message: `This legacy endpoint was removed on ${DEPRECATION_CONFIG.deprecationDate.toISOString().split('T')[0]}. Please use /api/attempts/[attemptId]/state-v2 instead.`,
          migrationGuide: '/api/docs/migration',
        },
        { status: 410 } // 410 Gone
      );
    }
    
    const { attemptId } = await ctx.params;
    
    // Get client info for logging
    const userAgent = req.headers.get('user-agent') || undefined;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
    
    // Call legacy wrapper (logs deprecation warning)
    const { data, error } = await legacyGetAttemptState(attemptId, {
      logWarning: true,
      clientInfo: { userAgent, ip },
    });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Add server timestamp for backward compatibility
    const attemptState = {
      ...data,
      server_now: new Date().toISOString(),
    } as AttemptState;
    
    // Get Accept-Encoding header for compression detection
    const acceptEncoding = req.headers.get('accept-encoding');
    
    // Compress response if size > 1KB and client supports compression
    const response = await compressResponse(attemptState, acceptEncoding);
    
    // Add deprecation headers
    addDeprecationHeaders(response.headers);
    
    return response;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}
