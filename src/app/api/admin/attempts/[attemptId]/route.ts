import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    await requireAdmin(req);
    const { attemptId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const att = await svc
      .from("exam_attempts")
      .select("id, exam_id, code_id, ip_address, started_at, submitted_at, completion_status, exam_codes(student_name)")
      .eq("id", attemptId)
      .maybeSingle();

    if (att.error) return NextResponse.json({ error: att.error.message }, { status: 400 });
    if (!att.data) return NextResponse.json({ error: "not_found" }, { status: 404 });

    let ips: { ip_address: string; created_at: string }[] = [];
    const ipq = await svc
      .from("exam_ips")
      .select("ip_address, created_at")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: true });
    if (!ipq.error && Array.isArray(ipq.data)) ips = ipq.data as any;

    const a: any = att.data;
    const item = {
      id: a.id,
      exam_id: a.exam_id,
      started_at: a.started_at,
      submitted_at: a.submitted_at,
      completion_status: a.completion_status,
      ip_address: a.ip_address,
      student_name: a?.exam_codes?.student_name ?? null,
      ips,
    };

    return NextResponse.json({ item });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
