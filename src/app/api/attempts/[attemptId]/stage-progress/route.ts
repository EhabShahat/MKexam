import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { StageProgress } from "@/lib/types";
export const runtime = 'edge';

export const dynamic = "force-dynamic";

interface UpdateStageProgressRequest {
  stage_id: string;
  progress_data: Record<string, unknown>;
  completed?: boolean;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> }
) {
  try {
    const supabase = supabaseServer();
    const { attemptId } = await ctx.params;
    
    // Parse request body
    const body = await req.json() as UpdateStageProgressRequest;
    
    // Validate required fields
    if (!body.stage_id) {
      return NextResponse.json(
        { error: "stage_id is required" },
        { status: 400 }
      );
    }
    
    if (!body.progress_data) {
      return NextResponse.json(
        { error: "progress_data is required" },
        { status: 400 }
      );
    }
    
    // Call update_stage_progress RPC
    const { data, error } = await supabase.rpc("update_stage_progress", {
      p_attempt_id: attemptId,
      p_stage_id: body.stage_id,
      p_progress_data: body.progress_data,
      p_completed: body.completed || false,
    });
    
    if (error) {
      // Handle specific error cases
      if (error.message.includes("invalid_attempt_id")) {
        return NextResponse.json(
          { error: "Invalid attempt ID" },
          { status: 404 }
        );
      }
      
      if (error.message.includes("invalid_stage_id")) {
        return NextResponse.json(
          { error: "Invalid stage ID" },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    // Return updated progress
    const updatedProgress = data as StageProgress;
    return NextResponse.json(updatedProgress);
    
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}
