import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function normArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).sort();
  return [];
}

function toPlain(v: any): any {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map((x) => toPlain(x));
  if (typeof v === "object") return v; // keep object/array as-is for client to render
  if (typeof v === "boolean") return v;
  return String(v);
}

export async function reviewGET(request: NextRequest, attemptIdParam?: string) {
  try {
    const svc = supabaseServer();

    const url = new URL(request.url);
    const attemptId = (attemptIdParam || url.searchParams.get("attemptId") || "").trim();
    const code = (url.searchParams.get("code") || "").trim();

    if (!attemptId || !isUuid(attemptId)) {
      return NextResponse.json({ error: "invalid_attempt_id" }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: "missing_code" }, { status: 400 });
    }

    // Check if admin has disabled viewing attempts from public results
    try {
      const { data: settings, error: sErr } = await svc
        .from("app_settings")
        .select("results_show_view_attempt")
        .limit(1)
        .maybeSingle();
      if (!sErr) {
        const flag = (settings as any)?.results_show_view_attempt;
        if (flag === false) {
          return NextResponse.json({ error: "review_disabled" }, { status: 403 });
        }
      }
      // If column/table missing (older DB), treat as enabled by default
    } catch {}

    // Find student by code
    const { data: student, error: stuErr } = await svc
      .from("students")
      .select("id, code, student_name")
      .eq("code", code)
      .maybeSingle();
    if (stuErr) return NextResponse.json({ error: (stuErr as any).message }, { status: 400 });
    if (!student) return NextResponse.json({ error: "code_not_found" }, { status: 404 });

    // Load attempt with exam info and possible join link
    const { data: attempt, error: attErr } = await svc
      .from("exam_attempts")
      .select(
        `id, exam_id, submitted_at, completion_status, student_id, answers,
         exams(id, title, status),
         student_exam_attempts(student_id)`
      )
      .eq("id", attemptId)
      .maybeSingle();

    if (attErr) return NextResponse.json({ error: (attErr as any).message }, { status: 400 });
    if (!attempt) return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });

    const examStatus = (attempt as any).exams?.status as string | undefined;
    if (examStatus !== "done") {
      // Do not reveal correct answers until exam results are finalized
      return NextResponse.json({ error: "review_not_available" }, { status: 403 });
    }

    // Validate ownership: either attempt.student_id matches, or a join row exists
    const studentId = (student as any).id;
    const aStudentId = (attempt as any).student_id as string | null;
    const joinStudentId = Array.isArray((attempt as any).student_exam_attempts)
      ? (attempt as any).student_exam_attempts[0]?.student_id
      : (attempt as any).student_exam_attempts?.student_id;

    if (aStudentId !== studentId && joinStudentId !== studentId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Fetch questions (include correct_answers for review)
    const { data: questions, error: qErr } = await svc
      .from("questions")
      .select(
        "id, question_text, question_type, options, correct_answers, points, order_index"
      )
      .eq("exam_id", (attempt as any).exam_id)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    if (qErr && (qErr as any).code !== "PGRST116") {
      return NextResponse.json({ error: (qErr as any).message }, { status: 400 });
    }

    // Manual grades (if any)
    const { data: grades } = await svc
      .from("manual_grades")
      .select("question_id, awarded_points")
      .eq("attempt_id", attemptId);
    const gradeMap = new Map<string, number>();
    (grades || []).forEach((g: any) => gradeMap.set(g.question_id, Number(g.awarded_points || 0)));

    const answersObj = ((attempt as any).answers || {}) as Record<string, any>;

    const items = (questions || []).map((q: any, idx: number) => {
      const qid = String(q.id);
      const student_answer = answersObj[qid] ?? null;
      const correct_answers = q.correct_answers ?? null;

      let is_correct: boolean | null = null;
      const type = String(q.question_type);
      if (student_answer == null) {
        is_correct = null;
      } else if (type === "true_false" || type === "single_choice") {
        if (Array.isArray(correct_answers) && correct_answers.length === 1) {
          is_correct = String(student_answer) === String(correct_answers[0]);
        } else {
          is_correct = String(student_answer) === String(correct_answers);
        }
      } else if (type === "multiple_choice" || type === "multi_select") {
        const sArr = normArray(student_answer);
        const cArr = normArray(correct_answers);
        is_correct = sArr.length > 0 || cArr.length > 0 ? (sArr.join("||") === cArr.join("||")) : null;
      } else {
        // paragraph, photo_upload, short_answer -> no auto correctness
        is_correct = null;
      }

      return {
        index: idx + 1,
        question_id: qid,
        question_text: q.question_text,
        question_type: type,
        options: q.options || null,
        student_answer: toPlain(student_answer),
        correct_answer: toPlain(correct_answers),
        is_correct,
        points: q.points ?? null,
        awarded_points: gradeMap.get(qid) ?? null,
      };
    });

    return NextResponse.json({
      attempt: {
        id: attemptId,
        exam_id: (attempt as any).exam_id,
        exam_title: (attempt as any).exams?.title || "",
        submitted_at: (attempt as any).submitted_at || null,
        completion_status: (attempt as any).completion_status || null,
        student_name: (student as any).student_name || null,
        student_code: (student as any).code || null,
      },
      items,
    });
  } catch (e: any) {
    console.error("review api error", e);
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
