/**
 * API route for incremental question loading
 * 
 * Provides paginated question loading with compression support
 * Requirements: 13.1, 13.2, 13.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { compressResponse } from '@/lib/compression-middleware';
import { handleConditionalRequest, shouldBypassCache } from '@/lib/cacheHeaders';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ examId: string }> }
) {
  try {
    const supabase = supabaseServer();
    const { examId } = await ctx.params;
    const { searchParams } = new URL(req.url);
    
    // Parse pagination parameters
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const excludeCorrectAnswers = searchParams.get('exclude_correct_answers') !== 'false';
    
    // Validate parameters
    if (offset < 0 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }
    
    // Call RPC function for paginated questions
    const { data, error } = await supabase.rpc('get_exam_questions_paginated', {
      p_exam_id: examId,
      p_offset: offset,
      p_limit: limit,
      p_exclude_correct_answers: excludeCorrectAnswers,
    });
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    // Check if we should use conditional request with ETag
    // For published exams, questions are immutable and can be cached indefinitely
    // Use IMMUTABLE cache config (1 hour) for published exam questions
    const response = handleConditionalRequest(req, data, 'IMMUTABLE');
    
    // Get Accept-Encoding header for compression detection
    const acceptEncoding = req.headers.get('accept-encoding');
    
    // If response is 304 Not Modified, return as-is
    if (response.status === 304) {
      return response;
    }
    
    // Compress response if size > 1KB and client supports compression
    return await compressResponse(data, acceptEncoding);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'unexpected_error' },
      { status: 500 }
    );
  }
}
