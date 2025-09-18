import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function summaryGET(request: NextRequest) {
  try {
    const svc = supabaseServer();
    const code = request.nextUrl.searchParams.get("code")?.trim() || "";
    if (!code) return NextResponse.json({ error: "missing_code" }, { status: 400 });

    // Load app settings for pass/fail behaviour
    const { data: settings } = await svc
      .from("app_settings")
      .select(
        "result_message_hidden, result_pass_calc_mode, result_overall_pass_threshold, result_exam_weight, result_message_pass, result_message_fail, result_exam_score_source, result_fail_on_any_exam"
      )
      .limit(1)
      .maybeSingle();

    const passMode = (settings as any)?.result_pass_calc_mode || "best"; // 'best' | 'avg'
    const passThreshold = Number((settings as any)?.result_overall_pass_threshold ?? 60);
    const examWeight = Number((settings as any)?.result_exam_weight ?? 1);
    const msgHidden = (settings as any)?.result_message_hidden === true;
    const msgPass = ((settings as any)?.result_message_pass as string) || "Congratulations, you passed.";
    const msgFail = ((settings as any)?.result_message_fail as string) || "Unfortunately, you did not pass.";
    const examScoreSource = (((settings as any)?.result_exam_score_source as string) || 'final') as 'final' | 'raw';
    const failOnAnyExam = (settings as any)?.result_fail_on_any_exam === true;

    // Find student by code
    const { data: student, error: stuErr } = await svc
      .from("students")
      .select("id, code, student_name")
      .eq("code", code)
      .maybeSingle();
    if (stuErr) {
      return NextResponse.json({ error: (stuErr as any).message }, { status: 400 });
    }
    if (!student) return NextResponse.json({ error: "code_not_found" }, { status: 404 });

    // Load extra score fields and this student's extra scores
    const [fieldsRes, scoresRes] = await Promise.all([
      svc
        .from("extra_score_fields")
        .select("key,label,type,hidden,include_in_pass,pass_weight,max_points,order_index,bool_true_points,bool_false_points,text_score_map")
        .order("order_index", { ascending: true })
        .order("label", { ascending: true }),
      svc
        .from("extra_scores")
        .select("data")
        .eq("student_id", (student as any).id)
        .maybeSingle(),
    ]);

    const fields = (fieldsRes.data || []) as any[];
    const scoreData = (scoresRes.data as any)?.data || {};

    // Build extras for display (respect hidden)
    const extras = fields
      .filter((f) => f.hidden !== true)
      .map((f) => {
        let value = scoreData?.[f.key];
        return { key: f.key, label: f.label, value };
      });

    // Compute exam score for the student across published exams
    const { data: attempts, error: attemptsErr } = await svc
      .from("exam_attempts")
      .select(
        `id, exam_id, submitted_at,
         exam_results(score_percentage, final_score_percentage),
         exams!inner(status, settings)`
      )
      .eq("student_id", (student as any).id)
      .eq("exams.status", "published")
      .order("submitted_at", { ascending: false });
    if (attemptsErr && (attemptsErr as any).code !== "PGRST116") {
      // Ignore when no rows (PGRST116: Results contain 0 rows)
      return NextResponse.json({ error: (attemptsErr as any).message }, { status: 400 });
    }

    // Respect exam_public_config: include only exams where include_in_pass is true (default true if config missing)
    let examScores: number[] = [];
    let examPassCount = 0;
    let examTotalCount = 0;
    if ((attempts || []).length > 0) {
      const examIds = Array.from(new Set((attempts || []).map((r: any) => r.exam_id))).filter(Boolean);
      let includeMap = new Map<string, boolean>();
      if (examIds.length > 0) {
        const { data: cfg, error: cfgErr } = await svc
          .from("exam_public_config")
          .select("exam_id, include_in_pass")
          .in("exam_id", examIds);
        if (!cfgErr) {
          (cfg || []).forEach((c: any) => includeMap.set(c.exam_id, c.include_in_pass !== false));
        }
      }

      const included = (attempts || []).filter((row: any) => includeMap.has(row.exam_id) ? (includeMap.get(row.exam_id) === true) : true);
      const numericScores: number[] = [];
      for (const row of included) {
        const er = Array.isArray(row.exam_results) ? row.exam_results[0] : row.exam_results;
        const ex = Array.isArray(row.exams) ? row.exams[0] : row.exams;
        const pick = examScoreSource === 'final' ? er?.final_score_percentage : er?.score_percentage;
        const n = pick == null ? null : Number(pick);
        if (n != null && !Number.isNaN(n)) {
          numericScores.push(n);
        }
        // Compute pass/fail for this exam if threshold exists
        const thrRaw = ex?.settings?.pass_percentage;
        if (thrRaw != null) {
          examTotalCount += 1;
          const thr = Number(thrRaw);
          if (!Number.isNaN(thr) && n != null && !Number.isNaN(n) && n >= thr) {
            examPassCount += 1;
          }
        }
      }
      examScores = numericScores;
    }

    let examComponent: number | null = null;
    if (examScores.length > 0) {
      if (passMode === "avg") {
        examComponent = clamp(
          examScores.reduce((a, b) => a + b, 0) / examScores.length,
          0,
          100
        );
      } else {
        examComponent = clamp(Math.max(...examScores), 0, 100);
      }
    }

    // Compute extras component (weighted by field weights, normalized by max_points when provided)
    let acc = 0;
    let totalW = 0;
    for (const f of fields) {
      if (!f.include_in_pass) continue;
      const w = Number(f.pass_weight || 0);
      if (!(w > 0)) continue;
      const raw = scoreData?.[f.key];
      let n = 0;
      if (f.type === "boolean") {
        const tPts = Number((f as any).bool_true_points ?? 100);
        const fPts = Number((f as any).bool_false_points ?? 0);
        const truthy = raw === true || String(raw).toLowerCase() === "true";
        n = truthy ? tPts : fPts;
      } else if (f.type === "text") {
        const map = ((f as any).text_score_map || {}) as Record<string, number>;
        const key = raw == null ? "" : String(raw).trim();
        const v = map[key];
        if (v != null && !Number.isNaN(Number(v))) {
          n = Number(v);
        } else {
          n = 0;
        }
      } else {
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) n = parsed;
      }
      let normalized = n;
      const maxp = Number(f.max_points || 0);
      if (maxp > 0) {
        normalized = clamp((n / maxp) * 100, 0, 100);
      } else {
        normalized = clamp(n, 0, 100);
      }
      acc += normalized * w;
      totalW += w;
    }

    // Combine with exam component using examWeight
    if (examComponent != null && examWeight > 0) {
      acc += clamp(examComponent, 0, 100) * examWeight;
      totalW += examWeight;
    }

    let overall: number | null = null;
    if (totalW > 0) overall = acc / totalW;

    let passed = overall != null ? overall >= passThreshold : null;
    // If configured, failing any included exam forces overall fail
    if (failOnAnyExam && examTotalCount > 0) {
      if (examPassCount < examTotalCount) passed = false;
    }
    const summary = {
      overall_score: overall != null ? Math.round(overall * 100) / 100 : null,
      passed,
      threshold: passThreshold,
      message: passed == null ? null : passed ? msgPass : msgFail,
      hidden: msgHidden,
      exam_passed: examPassCount,
      exam_total: examTotalCount,
    };

    return NextResponse.json({
      student,
      extras,
      pass_summary: summary,
    });
  } catch (error) {
    console.error("summary api error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
