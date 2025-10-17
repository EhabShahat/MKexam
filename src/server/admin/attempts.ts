import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { auditLog } from "@/lib/audit";

// GET /api/admin/attempts/:attemptId
export async function attemptsIdGET(req: NextRequest, attemptId: string) {
  try {
    await requireAdmin(req);
    if (!attemptId) return NextResponse.json({ error: "Attempt ID is required" }, { status: 400 });

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("exam_attempts")
      .select("id, student_name, ip_address, completion_status, started_at, submitted_at, device_info, students(student_name)")
      .eq("id", attemptId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

    const item = {
      id: (data as any).id,
      student_name: (data as any).students?.student_name ?? (data as any).student_name ?? null,
      completion_status: (data as any).completion_status ?? null,
      started_at: (data as any).started_at ?? null,
      submitted_at: (data as any).submitted_at ?? null,
      ip_address: (data as any).ip_address ?? null,
      device_info: (data as any).device_info ?? null,
      ips: [] as Array<{ created_at: string; ip_address: string }>,
    };

    return NextResponse.json({ item });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// DELETE /api/admin/attempts/:attemptId
export async function attemptsIdDELETE(req: NextRequest, attemptId: string) {
  try {
    const admin = await requireAdmin(req);
    if (!attemptId) return NextResponse.json({ error: "Attempt ID is required" }, { status: 400 });

    const supabase = supabaseServer();

    const { data: attempt, error: fetchError } = await supabase
      .from("exam_attempts")
      .select(`
        id,
        exam_id,
        student_id,
        student_name,
        exam:exams(title)
      `)
      .eq("id", attemptId)
      .single();

    if (fetchError || !attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

    {
      const { error: preDelGatingErr } = await supabase
        .from("student_exam_attempts")
        .delete()
        .eq("attempt_id", attemptId);
      if (preDelGatingErr) {
        console.error("Pre-delete gating removal failed:", preDelGatingErr);
      }
    }

    const { error: deleteError } = await supabase
      .from("exam_attempts")
      .delete()
      .eq("id", attemptId);
    if (deleteError) return NextResponse.json({ error: "Failed to delete attempt" }, { status: 500 });

    if ((attempt as any).student_id && (attempt as any).exam_id) {
      const studentId = (attempt as any).student_id as string;
      const examId = (attempt as any).exam_id as string;

      const { data: resetRows, error: resetError } = await supabase.rpc("admin_reset_student_attempts", {
        p_student_id: studentId,
        p_exam_id: examId,
      });

      const deletedCount = Array.isArray(resetRows)
        ? Number((resetRows[0] as any)?.deleted_count ?? 0)
        : 0;

      if (resetError || deletedCount === 0) {
        if (resetError) {
          console.warn("admin_reset_student_attempts error:", resetError);
        } else {
          console.log("admin_reset_student_attempts: no rows deleted (likely pre-delete removal handled it)");
        }
        const { error: directDelErr } = await supabase
          .from("student_exam_attempts")
          .delete()
          .match({ student_id: studentId, exam_id: examId });
        if (directDelErr) console.error("Direct gating reset failed:", directDelErr);
      }
    }

    await auditLog((admin as any).user_id, "delete_attempt", {
      resource_type: "attempt",
      resource_id: attemptId,
      student_name: (attempt as any).student_name,
      exam_title: (attempt as any).exam?.title,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("Delete attempt error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// GET /api/admin/attempts/:attemptId/activity
export async function attemptsIdActivityGET(req: NextRequest, attemptId: string) {
  try {
    await requireAdmin(req);
    if (!attemptId) return NextResponse.json({ error: "Attempt ID is required" }, { status: 400 });

    const sp = req.nextUrl.searchParams;
    const eventType = sp.get("event_type");
    const since = sp.get("since");
    const until = sp.get("until");
    const limitParam = Number(sp.get("limit") || "200");
    const limit = clamp(isFinite(limitParam) ? Math.trunc(limitParam) : 200, 1, 1000);

    const token = await getBearerToken(req);
    const supabase = supabaseServer(token || undefined);

    let q = supabase
      .from("attempt_activity_events")
      .select("attempt_id, event_type, event_time, payload, created_at")
      .eq("attempt_id", attemptId)
      .order("event_time", { ascending: false })
      .limit(limit);

    if (eventType && eventType !== "all") q = q.eq("event_type", eventType);
    if (since) q = q.gte("event_time", since);
    if (until) q = q.lte("event_time", until);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ items: Array.isArray(data) ? data : [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// GET /api/admin/attempts/:attemptId/state
export async function attemptsIdStateGET(req: NextRequest, attemptId: string) {
  try {
    await requireAdmin(req);

    const token = await getBearerToken(req);
    const supabase = supabaseServer(token || undefined);

    const { data: state, error } = await supabase.rpc("get_attempt_state", { p_attempt_id: attemptId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const examId: string | null = (state as any)?.exam?.id ?? null;
    let ensuredExamId = examId;
    if (!ensuredExamId) {
      const att = await supabase
        .from("exam_attempts")
        .select("exam_id")
        .eq("id", attemptId)
        .maybeSingle();
      if (att.error) return NextResponse.json({ error: att.error.message }, { status: 400 });
      ensuredExamId = (att.data as any)?.exam_id ?? null;
    }

    if (ensuredExamId) {
      const qRes = await supabase
        .from("questions")
        .select("id, question_text, question_type, options, points, required, order_index, correct_answers, created_at, auto_grade_on_answer")
        .eq("exam_id", ensuredExamId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (!qRes.error && Array.isArray(qRes.data)) {
        const adminQuestions = qRes.data.map((q) => ({
          id: (q as any).id,
          question_text: (q as any).question_text,
          question_type: (q as any).question_type,
          options: (q as any).options,
          points: (q as any).points,
          required: (q as any).required,
          order_index: (q as any).order_index,
          correct_answers: (q as any).correct_answers,
          auto_grade_on_answer: (q as any).auto_grade_on_answer,
        }));

        const mg = await supabase
          .from("manual_grades")
          .select("question_id, awarded_points, notes, graded_at")
          .eq("attempt_id", attemptId);
        const manual = Array.isArray(mg.data) ? mg.data : [];
        const manualMap = manual.reduce((acc: any, row: any) => {
          acc[row.question_id] = { awarded_points: row.awarded_points, notes: row.notes, graded_at: row.graded_at };
          return acc;
          }, {} as Record<string, { awarded_points: number; notes?: string | null; graded_at?: string }>);

        const enriched = { ...(state ?? {}), questions: adminQuestions, manual_grades: manual, manual_grades_map: manualMap } as any;
        return NextResponse.json(enriched);
      }
      if (qRes.error) {
        console.warn("Admin state questions fetch failed:", qRes.error.message);
      }
    }

    return NextResponse.json(state);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// POST /api/admin/attempts/:attemptId/manual-grades
export async function attemptsIdManualGradesPOST(req: NextRequest, attemptId: string) {
  try {
    const admin = await requireAdmin(req);
    if (!attemptId) return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const grades = Array.isArray((body as any)?.grades) ? (body as any).grades : [];
    if (!Array.isArray(grades) || grades.length === 0) {
      return NextResponse.json({ error: "grades_required" }, { status: 400 });
    }

    const rows = grades
      .map((g: any) => ({
        attempt_id: attemptId,
        question_id: g?.question_id,
        awarded_points: Number.isFinite(Number(g?.awarded_points)) ? Number(g.awarded_points) : 0,
        notes: typeof g?.notes === "string" ? g.notes : null,
      }))
      .filter((r: any) => typeof r.question_id === "string" && r.question_id.length > 0);

    if (rows.length === 0) return NextResponse.json({ error: "invalid_rows" }, { status: 400 });

    const svc = supabaseServer();
    const { error } = await svc.from("manual_grades").upsert(rows, { onConflict: "attempt_id,question_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data: calc, error: calcErr } = await svc.rpc("regrade_attempt", { p_attempt_id: attemptId });
    if (calcErr) return NextResponse.json({ error: calcErr.message }, { status: 400 });

    await auditLog((admin as any).user_id, "save_manual_grades", { attempt_id: attemptId, count: rows.length });
    const resultRow = Array.isArray(calc) ? (calc as any[])[0] : calc;
    return NextResponse.json({ ok: true, result: resultRow });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// POST /api/admin/attempts/:attemptId/regrade
export async function attemptsIdRegradePOST(req: NextRequest, attemptId: string) {
  try {
    const admin = await requireAdmin(req);
    if (!attemptId) return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });

    const svc = supabaseServer();
    const { data, error } = await svc.rpc("regrade_attempt", { p_attempt_id: attemptId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await auditLog((admin as any).user_id, "regrade_attempt", { attempt_id: attemptId });
    const row = Array.isArray(data) ? (data as any[])[0] : data;
    return NextResponse.json({ ok: true, result: row });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
