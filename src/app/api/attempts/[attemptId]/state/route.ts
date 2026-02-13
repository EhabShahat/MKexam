import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { AttemptState } from "@/lib/types";
export const runtime = 'edge';

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const supabase = supabaseServer();
    const { attemptId } = await ctx.params;
    const { data, error } = await supabase.rpc("get_attempt_state", {
      p_attempt_id: attemptId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    
    // The extended get_attempt_state RPC returns stages and stage_progress
    // For non-staged exams, these will be empty arrays (backward compatible)
    const attemptState = data as AttemptState;
    
    return NextResponse.json({
      ...attemptState,
      server_now: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
