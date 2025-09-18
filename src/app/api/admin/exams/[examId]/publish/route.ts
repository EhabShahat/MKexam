import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { getCodeFormatSettings } from "@/lib/codeGenerator";

export async function POST(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    // Ensure exam exists
    const ex = await svc.from("exams").select("id,status").eq("id", examId).single();
    if (ex.error) return NextResponse.json({ error: ex.error.message }, { status: 404 });

    // Require at least one question before publishing
    const q = await svc.from("questions").select("id", { count: "exact", head: true }).eq("exam_id", examId);
    if (q.error) return NextResponse.json({ error: q.error.message }, { status: 400 });
    if ((q.count ?? 0) < 1) return NextResponse.json({ error: "no_questions" }, { status: 400 });

    // If multi-exam mode is disabled, mark any other published exams as 'done'
    const settings = await getCodeFormatSettings();
    if (!settings.enable_multi_exam) {
      const unpub = await svc
        .from("exams")
        .update({ status: "done" })
        .eq("status", "published")
        .neq("id", examId);
      if (unpub.error) return NextResponse.json({ error: unpub.error.message }, { status: 400 });
    }

    const upd = await svc
      .from("exams")
      .update({ status: "published" })
      .eq("id", examId)
      .select("*")
      .single();
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
    return NextResponse.json({ item: upd.data });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
