import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const stages = await req.json();

    // Delete all existing stages for this exam
    const { error: deleteError } = await svc
      .from("exam_stages")
      .delete()
      .eq("exam_id", examId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    // Insert new stages if any
    if (stages && stages.length > 0) {
      // Filter out temporary IDs and prepare stages for insertion
      const stagesToInsert = stages.map((stage: any, index: number) => {
        const { id, created_at, updated_at, ...stageData } = stage;
        return {
          ...stageData,
          exam_id: examId,
          stage_order: index,
        };
      });

      const { data, error: insertError } = await svc
        .from("exam_stages")
        .insert(stagesToInsert)
        .select();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }

      return NextResponse.json({ stages: data });
    }

    return NextResponse.json({ stages: [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
