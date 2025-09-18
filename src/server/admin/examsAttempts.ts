import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function examsIdAttemptsGET(req: NextRequest, examId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    // Try RPC first
    const rpc = await svc.rpc("admin_list_attempts", { p_exam_id: examId });
    if (!rpc.error && Array.isArray(rpc.data)) {
      return NextResponse.json({ items: rpc.data });
    }
    if (rpc.error) {
      // eslint-disable-next-line no-console
      console.warn("admin_list_attempts RPC failed, using fallback query:", rpc.error.message || rpc.error);
    }

    // Fallback query: exam_attempts joined with students and exam_results; compute manual counts separately
    const fb = await svc
      .from("exam_attempts")
      .select(
        "id, exam_id, ip_address, started_at, submitted_at, completion_status, students(student_name, code), exam_results(score_percentage, final_score_percentage)"
      )
      .eq("exam_id", examId)
      .order("started_at", { ascending: false, nullsFirst: true });
    if (fb.error) return NextResponse.json({ error: fb.error.message }, { status: 400 });

    const attempts = (fb.data ?? []) as any[];

    // Manual questions total for the exam
    const mq = await svc
      .from("questions")
      .select("id")
      .eq("exam_id", examId)
      .in("question_type", ["paragraph", "photo_upload"]);
    const manualTotal = mq.error ? 0 : (mq.data?.length ?? 0);

    // Manual graded counts per attempt
    const attemptIds = attempts.map((a) => a.id);
    let gradedByAttempt: Record<string, number> = {};
    if (attemptIds.length > 0) {
      const mg = await svc
        .from("manual_grades")
        .select("attempt_id, question_id")
        .in("attempt_id", attemptIds);
      if (!mg.error) {
        for (const row of (mg.data as any[]) ?? []) {
          gradedByAttempt[row.attempt_id] = (gradedByAttempt[row.attempt_id] || 0) + 1;
        }
      }
    }

    const items = attempts.map((a: any) => {
      const graded = gradedByAttempt[a.id] || 0;
      const pending = Math.max(manualTotal - graded, 0);
      return {
        id: a.id,
        exam_id: a.exam_id,
        started_at: a.started_at,
        submitted_at: a.submitted_at,
        completion_status: a.completion_status,
        ip_address: a.ip_address,
        student_name: a?.students?.student_name ?? a?.student_name ?? null,
        score_percentage: a?.exam_results?.score_percentage ?? null,
        final_score_percentage: a?.exam_results?.final_score_percentage ?? null,
        manual_total_count: manualTotal,
        manual_graded_count: graded,
        manual_pending_count: pending,
      };
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function examsIdAttemptsExportGET(req: NextRequest, examId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    let rows: any[] | null = null;
    const rpc = await svc.rpc("admin_list_attempts", { p_exam_id: examId });
    if (!rpc.error && Array.isArray(rpc.data)) rows = rpc.data as any[];
    if (rpc.error) {
      // eslint-disable-next-line no-console
      console.warn("admin_list_attempts RPC failed (export), using fallback query:", rpc.error.message || rpc.error);
    }

    if (!rows) {
      const fb = await svc
        .from("exam_attempts")
        .select(
          "id, exam_id, ip_address, started_at, submitted_at, completion_status, students(student_name, code), exam_results(score_percentage)"
        )
        .eq("exam_id", examId)
        .order("started_at", { ascending: false, nullsFirst: true });
      if (fb.error) return NextResponse.json({ error: fb.error.message }, { status: 400 });
      rows = (fb.data ?? []).map((a: any) => ({
        id: a.id,
        exam_id: a.exam_id,
        started_at: a.started_at,
        submitted_at: a.submitted_at,
        completion_status: a.completion_status,
        ip_address: a.ip_address,
        student_name: a?.students?.student_name ?? a?.student_name ?? null,
        score_percentage: a?.exam_results?.score_percentage ?? null,
      }));
    }

    const headers = [
      "id",
      "student_name",
      "completion_status",
      "started_at",
      "submitted_at",
      "ip_address",
      "score_percentage",
    ];

    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes("\"") || s.includes(",") || s.includes("\n")) {
        return '"' + s.replace(/\"/g, '""') + '"';
      }
      return s;
    };

    const lines: string[] = [];
    lines.push(headers.join(","));
    for (const r of rows) {
      lines.push([
        esc(r.id),
        esc(r.student_name),
        esc(r.completion_status),
        esc(r.started_at),
        esc(r.submitted_at),
        esc(r.ip_address),
        esc(r.score_percentage ?? ""),
      ].join(","));
    }

    const csv = "\ufeff" + lines.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=attempts_${examId}.csv`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
