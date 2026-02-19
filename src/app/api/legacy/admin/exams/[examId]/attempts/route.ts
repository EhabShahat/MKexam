/**
 * LEGACY ENDPOINT - DEPRECATED
 * 
 * This endpoint is deprecated and will be removed after 30 days.
 * Please migrate to: /api/admin/exams/[examId]/attempts with ?v2=true
 * 
 * This wrapper maintains backward compatibility by calling the optimized
 * admin_list_attempts_v2 RPC function with default parameters.
 * 
 * Requirements: 10.1, 10.2
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { compressResponse } from "@/lib/compression-middleware";
import {
  legacyAdminListAttempts,
  addDeprecationHeaders,
  shouldBlockLegacyEndpoint,
  DEPRECATION_CONFIG,
} from "@/lib/legacy-wrapper";

export async function GET(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    // Check if deprecation period has expired
    if (shouldBlockLegacyEndpoint()) {
      return NextResponse.json(
        {
          error: 'endpoint_removed',
          message: `This legacy endpoint was removed on ${DEPRECATION_CONFIG.deprecationDate.toISOString().split('T')[0]}. Please use /api/admin/exams/[examId]/attempts with ?v2=true instead.`,
          migrationGuide: '/api/docs/migration',
        },
        { status: 410 } // 410 Gone
      );
    }
    
    await requireAdmin(req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    
    // Get client info for logging
    const userAgent = req.headers.get('user-agent') || undefined;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
    
    // Call legacy wrapper (logs deprecation warning)
    const { data, error } = await legacyAdminListAttempts(examId, token || undefined, {
      logWarning: true,
      clientInfo: { userAgent, ip },
    });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Get Accept-Encoding header for compression detection
    const acceptEncoding = req.headers.get('accept-encoding');
    
    // Compress response if size > 1KB and client supports compression
    const response = await compressResponse({ items: data || [] }, acceptEncoding);
    
    // Add deprecation headers
    addDeprecationHeaders(response.headers);
    
    return response;
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
