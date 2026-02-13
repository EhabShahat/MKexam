import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { getCodeFormatSettings } from "@/lib/codeGenerator";
import { auditLog } from "@/lib/audit";

export async function examsIdPublishPOST(req: NextRequest, examId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const ex = await svc.from("exams").select("id,status").eq("id", examId).single();
    if (ex.error) return NextResponse.json({ error: ex.error.message }, { status: 404 });

    const q = await svc
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId);
    if (q.error) return NextResponse.json({ error: q.error.message }, { status: 400 });
    if ((q.count ?? 0) < 1) return NextResponse.json({ error: "no_questions" }, { status: 400 });

    const settings = await getCodeFormatSettings();
    if (!settings.enable_multi_exam) {
      const markDone = await svc
        .from("exams")
        .update({ status: "done" })
        .eq("status", "published")
        .neq("id", examId);
      if (markDone.error)
        return NextResponse.json({ error: markDone.error.message }, { status: 400 });
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

export async function examsIdDuplicatePOST(req: NextRequest, examId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const { data: src, error: srcErr } = await svc.from("exams").select("*").eq("id", examId).single();
    if (srcErr || !src) return NextResponse.json({ error: srcErr?.message || "not_found" }, { status: 404 });

    const insertExam = {
      title: `${src.title} (Copy)`,
      description: src.description,
      start_time: null,
      end_time: null,
      duration_minutes: src.duration_minutes,
      status: "draft",
      access_type: src.access_type,
      settings: src.settings || {},
    } as const;

    const { data: created, error: insErr } = await svc.from("exams").insert(insertExam).select("*").single();
    if (insErr || !created)
      return NextResponse.json({ error: insErr?.message || "insert_failed" }, { status: 400 });

    const { data: qs, error: qErr } = await svc
      .from("questions")
      .select(
        "id, question_text, question_type, options, correct_answers, points, required, order_index"
      )
      .eq("exam_id", examId)
      .order("order_index", { ascending: true, nullsFirst: true });
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 400 });

    let inserted = 0;
    if (qs && qs.length > 0) {
      const rows = qs.map((q: any) => ({
        exam_id: created.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options ?? null,
        correct_answers: q.correct_answers ?? null,
        points: q.points ?? 1,
        required: q.required ?? false,
        order_index: q.order_index,
      }));
      const { error: insQErr, count } = await svc.from("questions").insert(rows, { count: "exact" });
      if (insQErr) return NextResponse.json({ error: insQErr.message }, { status: 400 });
      inserted = count ?? rows.length;
    }

    return NextResponse.json({ item: created, questions_copied: inserted });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function examsIdArchivePOST(req: NextRequest, examId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const ex = await svc.from("exams").select("id,status").eq("id", examId).single();
    if (ex.error) return NextResponse.json({ error: ex.error.message }, { status: 404 });

    const upd = await svc
      .from("exams")
      .update({ status: "archived" })
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

export async function examsIdDonePOST(req: NextRequest, examId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const ex = await svc.from("exams").select("id,status").eq("id", examId).single();
    if (ex.error) return NextResponse.json({ error: ex.error.message }, { status: 404 });

    const upd = await svc
      .from("exams")
      .update({ status: "done" })
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

export async function examsIdRegradePOST(req: NextRequest, examId: string) {
  try {
    const admin = await requireAdmin(req);
    if (!examId) return NextResponse.json({ error: "missing_exam_id" }, { status: 400 });

    const svc = supabaseServer();
    const { data, error } = await svc.rpc("regrade_exam", { p_exam_id: examId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await auditLog(admin.user_id, "regrade_exam", { exam_id: examId });
    const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
    return NextResponse.json({ ok: true, result: row });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
