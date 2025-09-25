import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

function esc(v: any): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function answerKeysGET(req: NextRequest) {
  try {
    // Admin-only export
    await requireAdmin(req);

    // Service role client for server-side export
    const svc = supabaseServer();

    // Load all published/done exams
    const { data: exams, error: exErr } = await svc
      .from("exams")
      .select("id, title, status")
      .in("status", ["published", "done"])
      .order("title", { ascending: true });

    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 });

    const examList = (exams || []) as Array<{ id: string; title: string; status: string }>;

    if (examList.length === 0) {
      const html = `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Exam Answer Keys</title>
</head>
<body dir="rtl">
  <div>لا توجد امتحانات منشورة.</div>
</body>
</html>`;
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="answer_keys.doc"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Load all questions for those exams
    const examIds = examList.map((e) => e.id);
    const { data: questions, error: qErr } = await svc
      .from("questions")
      .select(
        "id, exam_id, question_text, question_type, options, correct_answers, order_index, created_at"
      )
      .in("exam_id", examIds)
      .order("order_index", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 400 });

    const byExam = new Map<string, any[]>();
    for (const q of (questions || []) as any[]) {
      if (!byExam.has(q.exam_id)) byExam.set(q.exam_id, []);
      byExam.get(q.exam_id)!.push(q);
    }

    let body = "";

    for (const ex of examList) {
      body += `<div class="exam"><h1>${esc(ex.title)}</h1>`;
      const qs = byExam.get(ex.id) || [];
      let qnum = 0;
      for (const q of qs) {
        qnum++;
        body += `<div class="question">`;
        body += `<div class="qtext"><span class="qnum">${qnum})</span> ${esc(q.question_text)}</div>`;

        const type = String(q.question_type || "");
        if (type === "true_false") {
          const isTrue = String(q?.correct_answers)?.toLowerCase() === "true";
          body += `<div class="options">` +
            (isTrue
              ? `<div class="opt"><u>A) True</u></div><div class="opt">B) False</div>`
              : `<div class="opt">A) True</div><div class="opt"><u>B) False</u></div>`) +
            `</div>`;
        } else if (type === "single_choice" || type === "multiple_choice" || type === "multi_select") {
          const options = Array.isArray(q.options) ? (q.options as any[]) : [];
          let ca: string[] = [];
          if (Array.isArray(q.correct_answers)) ca = (q.correct_answers as any[]).map(String);
          else if (q.correct_answers != null) ca = [String(q.correct_answers)];
          const caSet = new Set(ca.map(String));
          body += `<div class="options">`;
          for (let i = 0; i < options.length; i++) {
            const label = String.fromCharCode(65 + i);
            const optText = String(options[i] ?? "");
            const isCorrect = caSet.has(String(options[i]));
            body += isCorrect
              ? `<div class="opt"><u>${label}) ${esc(optText)}</u></div>`
              : `<div class="opt">${label}) ${esc(optText)}</div>`;
          }
          body += `</div>`;
        } else if (type === "paragraph" || type === "photo_upload") {
          body += `<div class="options"><em>Manual grading</em></div>`;
        } else {
          body += `<div class="options"></div>`;
        }

        body += `</div>`; // .question
      }
      body += `</div>`; // .exam
    }

    const html = `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Exam Answer Keys</title>
  <style>
    body{font-family:Segoe UI, Tahoma, Arial, sans-serif; color:#111; line-height:1.6; margin:24px;}
    h1{font-size:22pt; margin:0 0 12px; color:#222; border-bottom:1px solid #ccc; padding-bottom:6px;}
    .exam{page-break-after:always; margin-bottom:36px;}
    .question{margin:10px 0 14px;}
    .qtext{font-weight:600; margin-bottom:6px;}
    .qnum{display:inline-block; min-width:2.2em;}
    .options{margin-left:1.8em;}
    .opt{margin:2px 0;}
    u{ text-underline-offset: 3px; text-decoration-thickness: from-font; }
  </style>
</head>
<body dir="rtl">${body}</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="answer_keys.doc"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
