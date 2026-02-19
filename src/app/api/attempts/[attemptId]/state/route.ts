import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { AttemptState } from "@/lib/types";
import { compressResponse } from "@/lib/compression-middleware";

export const runtime = 'edge';
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const supabase = supabaseServer();
    const { attemptId } = await ctx.params;
    
    // Check if client requests v2 with field selection via query param
    const { searchParams } = new URL(req.url);
    const useV2 = searchParams.get('v2') === 'true' || searchParams.has('fields');
    const fieldsParam = searchParams.get('fields');
    
    let data, error;
    
    if (useV2) {
      // Use v2 RPC with field selection
      let fields = null;
      if (fieldsParam) {
        try {
          if (fieldsParam.startsWith('[') || fieldsParam.startsWith('{')) {
            fields = JSON.parse(fieldsParam);
          } else {
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
      
      const result = await supabase.rpc("get_attempt_state_v2", {
        p_attempt_id: attemptId,
        p_fields: fields,
      });
      data = result.data;
      error = result.error;
    } else {
      // Use original RPC (backward compatible)
      const result = await supabase.rpc("get_attempt_state", {
        p_attempt_id: attemptId,
      });
      data = result.data;
      error = result.error;
    }
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // The extended get_attempt_state RPC returns stages and stage_progress
    // For non-staged exams, these will be empty arrays (backward compatible)
    const attemptState = {
      ...data,
      server_now: new Date().toISOString(),
    } as AttemptState;
    
    // Get Accept-Encoding header for compression detection
    const acceptEncoding = req.headers.get('accept-encoding');
    
    // Compress response if size > 1KB and client supports compression
    return await compressResponse(attemptState, acceptEncoding);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}
