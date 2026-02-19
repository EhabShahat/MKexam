import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function examsIdAttemptsGET(req: NextRequest, examId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    // Use service role to bypass RLS for admin-only reporting joins
    const svc = supabaseServer();

    // Try RPC first
    const rpc = await svc.rpc("admin_list_attempts", { p_exam_id: examId });
    if (!rpc.error && Array.isArray(rpc.data)) {
      let rows: any[] = rpc.data as any[];
      // Enrich with student codes if missing using a robust two-step join
      const needCodes = rows.some((r) => typeof r.code === "undefined" || r.code === null);
      if (needCodes && rows.length > 0) {
        const attemptIds = rows.map((r) => r.id).filter(Boolean);
        const linkQ = await svc
          .from("exam_attempts")
          .select("id, student_id")
          .in("id", attemptIds);
        if (!linkQ.error) {
          const attemptToStudent = new Map<string, string | null>();
          const studentIds: string[] = [];
          for (const rec of (linkQ.data as any[]) ?? []) {
            const sid = rec?.student_id ?? null;
            attemptToStudent.set(rec.id, sid);
            if (sid) studentIds.push(sid);
          }
          let studMap = new Map<string, string | null>();
          if (studentIds.length > 0) {
            const stuQ = await svc
              .from("students")
              .select("id, code")
              .in("id", Array.from(new Set(studentIds)));
            if (!stuQ.error) {
              for (const s of (stuQ.data as any[]) ?? []) {
                studMap.set(s.id, s.code ?? null);
              }
            }
          }
          rows = rows.map((r) => {
            const existing = (r as any).code;
            if (typeof existing !== "undefined" && existing !== null) return r;
            const sid = attemptToStudent.get(r.id as string) ?? null;
            const code = sid ? (studMap.get(sid) ?? null) : null;
            return { ...r, code };
          });
        }
      }
      return NextResponse.json({ items: rows });
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
        code: a?.students?.code ?? null,
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
    // Use service role to bypass RLS for admin-only reporting joins
    const svc = supabaseServer();

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
        code: a?.students?.code ?? null,
        score_percentage: a?.exam_results?.score_percentage ?? null,
      }));
    }

    // If coming from RPC and code is missing, enrich with a secondary query
    if (rows && rows.length > 0 && rows.some((r: any) => typeof r.code === "undefined" || r.code === null)) {
      const attemptIds = rows.map((r: any) => r.id).filter(Boolean);
      const linkQ = await svc
        .from("exam_attempts")
        .select("id, student_id")
        .in("id", attemptIds);
      if (!linkQ.error) {
        const attemptToStudent = new Map<string, string | null>();
        const studentIds: string[] = [];
        for (const rec of (linkQ.data as any[]) ?? []) {
          const sid = rec?.student_id ?? null;
          attemptToStudent.set(rec.id, sid);
          if (sid) studentIds.push(sid);
        }
        let studMap = new Map<string, string | null>();
        if (studentIds.length > 0) {
          const stuQ = await svc
            .from("students")
            .select("id, code")
            .in("id", Array.from(new Set(studentIds)));
          if (!stuQ.error) {
            for (const s of (stuQ.data as any[]) ?? []) {
              studMap.set(s.id, s.code ?? null);
            }
          }
        }
        rows = rows.map((r: any) => {
          const existing = (r as any).code;
          if (typeof existing !== "undefined" && existing !== null) return r;
          const sid = attemptToStudent.get(r.id as string) ?? null;
          const code = sid ? (studMap.get(sid) ?? null) : null;
          return { ...r, code };
        });
      }
    }

    const headers = [
      "id",
      "student_name",
      "code",
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
    const getCode = (r: any) => (r?.code ?? r?.student_code ?? (r?.students ? r?.students?.code : undefined) ?? "");
    for (const r of rows) {
      lines.push([
        esc(r.id),
        esc(r.student_name),
        esc(getCode(r)),
        esc(r.completion_status),
        esc(r.started_at),
        esc(r.submitted_at),
        esc(r.ip_address),
        esc(r.score_percentage ?? ""),
      ].join(","));
    }

    // Try to fetch exam title for a better, Arabic-friendly filename
    let examTitle: string | null = null;
    try {
      const exq = await svc
        .from("exams")
        .select("title")
        .eq("id", examId)
        .maybeSingle();
      if (!exq.error) examTitle = (exq.data as any)?.title ?? null;
    } catch {}

    const baseName = examTitle ? `attempts_${examTitle}` : `attempts_${examId}`;
    const sanitized = baseName.replace(/[\\\/:*?"<>|]+/g, "_").trim();
    const encoded = encodeURIComponent(sanitized + ".csv");

    const csv = "\ufeff" + lines.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        // Include both filename (fallback ASCII) and filename* (UTF-8) for Arabic support
        "Content-Disposition": `attachment; filename="attempts.csv"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
