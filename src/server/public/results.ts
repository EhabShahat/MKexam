import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCodeFormatSettings, validateCodeFormat } from "@/lib/codeGenerator";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function resultsGET(request: NextRequest) {
  try {
    const svc = supabaseServer();

    const searchTerm = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (!searchTerm) {
      return NextResponse.json({ items: [] });
    }

    // Load app settings for score calculation
    const { data: appSettings } = await svc
      .from("app_settings")
      .select("enable_name_search, enable_code_search, result_exam_score_source, result_pass_calc_mode, result_overall_pass_threshold, result_exam_weight, result_fail_on_any_exam, result_message_hidden")
      .limit(1)
      .maybeSingle();

    const enableName = (appSettings as any)?.enable_name_search !== false;
    const enableCode = (appSettings as any)?.enable_code_search !== false;
    const mode: "name" | "code" = enableCode && !enableName ? "code" : "name";
    const examScoreSource: "final" | "raw" = (appSettings as any)?.result_exam_score_source === "raw" ? "raw" : "final";
    const passMode = (appSettings as any)?.result_pass_calc_mode || "best";
    const passThreshold = Number((appSettings as any)?.result_overall_pass_threshold ?? 60);
    const examWeight = Number((appSettings as any)?.result_exam_weight ?? 1);
    const failOnAnyExam = (appSettings as any)?.result_fail_on_any_exam === true;
    const hidePassFailMessages = (appSettings as any)?.result_message_hidden === true;

    // Validate code format if in code mode
    if (mode === "code") {
      const codeSettings = await getCodeFormatSettings();
      if (!validateCodeFormat(searchTerm, codeSettings)) {
        return NextResponse.json({ items: [] });
      }
    }

    // Load extra score fields configuration
    const { data: fieldsRes } = await svc
      .from("extra_score_fields")
      .select("key, label, type, hidden, include_in_pass, pass_weight, max_points, order_index, bool_true_points, bool_false_points, text_score_map")
      .order("order_index", { ascending: true })
      .order("label", { ascending: true });
    const fields = (fieldsRes || []) as any[];

    // Find student by search term
    let student: any = null;
    let studentId: string | null = null;

    if (mode === "code") {
      const { data: studentRes } = await svc
        .from("students")
        .select("id, code, student_name")
        .eq("code", searchTerm)
        .maybeSingle();
      student = studentRes;
      studentId = studentRes?.id || null;
    } else {
      const { data: studentRes } = await svc
        .from("students")
        .select("id, code, student_name")
        .ilike("student_name", `%${searchTerm}%`)
        .limit(1)
        .maybeSingle();
      student = studentRes;
      studentId = studentRes?.id || null;
    }

    if (!student) {
      return NextResponse.json({ items: [], extras: [], pass_summary: null });
    }

    // Load student's extra scores
    let extraScoresData: Record<string, any> = {};
    if (studentId) {
      const { data: extraRes } = await svc
        .from("extra_scores")
        .select("data")
        .eq("student_id", studentId)
        .maybeSingle();
      extraScoresData = (extraRes?.data || {}) as Record<string, any>;
    }

    // Load all exams with their config (only actual exams, not quizzes/homework which are in extra fields)
    const { data: examsRes } = await svc
      .from("exams")
      .select("id, title, settings, exam_type")
      .or("exam_type.is.null,exam_type.eq.exam")
      .order("created_at", { ascending: true });
    const allExams = (examsRes || []) as any[];
    const examIds = allExams.map((e) => e.id);

    // Load exam config (hidden, include_in_pass, order_index)
    const configMap = new Map<string, { hidden?: boolean; include_in_pass?: boolean; order_index?: number | null }>();
    if (examIds.length > 0) {
      const { data: cfg } = await svc
        .from("exam_public_config")
        .select("exam_id, hidden, include_in_pass, order_index")
        .in("exam_id", examIds);
      (cfg || []).forEach((c: any) => 
        configMap.set(c.exam_id, {
          hidden: c.hidden === true,
          include_in_pass: c.include_in_pass !== false,
          order_index: c.order_index ?? null,
        })
      );
    }

    // Load student's attempts for these exams
    const attemptsByExam = new Map<string, any>();
    if (studentId && examIds.length > 0) {
      const { data: attempts } = await svc
        .from("exam_attempts")
        .select("id, exam_id, submitted_at, completion_status, exam_results(score_percentage, final_score_percentage)")
        .eq("student_id", studentId)
        .in("exam_id", examIds)
        .order("submitted_at", { ascending: false });
      
      for (const att of (attempts || [])) {
        if (!attemptsByExam.has(att.exam_id)) {
          attemptsByExam.set(att.exam_id, att);
        }
      }
    }

    // Build exam items for display (only non-hidden)
    const examItems: any[] = [];
    const examScoresForCalc: number[] = [];
    let examPassCount = 0;
    let examTotalCount = 0;

    for (const exam of allExams) {
      const cfg = configMap.get(exam.id) || {};
      if (cfg.hidden === true) continue; // Skip hidden exams

      const attempt = attemptsByExam.get(exam.id);
      let scoreValue: number | null = null;
      let submitted_at: string | null = null;
      let completion_status: string | null = null;

      if (attempt) {
        const er = Array.isArray(attempt.exam_results) ? attempt.exam_results[0] : attempt.exam_results;
        if (examScoreSource === "final") {
          const f = er?.final_score_percentage;
          if (f != null && !Number.isNaN(Number(f))) scoreValue = Number(f);
          else if (er?.score_percentage != null && !Number.isNaN(Number(er.score_percentage))) scoreValue = Number(er.score_percentage);
        } else {
          const raw = er?.score_percentage;
          if (raw != null && !Number.isNaN(Number(raw))) scoreValue = Number(raw);
        }
        submitted_at = attempt.submitted_at ?? null;
        completion_status = attempt.completion_status ?? null;
      }

      const passThresholdRaw = exam?.settings?.pass_percentage;
      const pass_threshold = passThresholdRaw == null ? null : Number(passThresholdRaw);
      const is_pass = (typeof scoreValue === "number" && !Number.isNaN(scoreValue) && typeof pass_threshold === "number" && !Number.isNaN(pass_threshold))
        ? scoreValue >= pass_threshold
        : null;

      examItems.push({
        id: attempt?.id ?? `${exam.id}-na`,
        exam_id: exam.id,
        exam_title: exam.title || "Unknown Exam",
        student_name: student.student_name || "Anonymous",
        student_code: student.code || "",
        completion_status,
        submitted_at,
        score_percentage: scoreValue,
        pass_threshold,
        is_pass,
        _order_index: cfg.order_index ?? null,
      });

      // Include in pass/fail calculation if flagged
      if (cfg.include_in_pass !== false && scoreValue != null) {
        examScoresForCalc.push(scoreValue);
        
        // Check per-exam pass
        if (pass_threshold != null) {
          examTotalCount += 1;
          if (scoreValue >= pass_threshold) examPassCount += 1;
        }
      }
    }

    // Calculate exam component for overall score
    let examComponent: number | null = null;
    if (examScoresForCalc.length > 0) {
      if (passMode === "avg") {
        examComponent = clamp(examScoresForCalc.reduce((a, b) => a + b, 0) / examScoresForCalc.length, 0, 100);
      } else {
        examComponent = clamp(Math.max(...examScoresForCalc), 0, 100);
      }
    }

    // Calculate extras component for overall score
    let acc = 0;
    let totalW = 0;

    for (const f of fields) {
      if (!f.include_in_pass) continue;
      const w = Number(f.pass_weight || 0);
      if (!(w > 0)) continue;

      const raw = extraScoresData[f.key];
      let n = 0;

      if (f.type === "boolean") {
        const tPts = Number(f.bool_true_points ?? 100);
        const fPts = Number(f.bool_false_points ?? 0);
        const truthy = raw === true || String(raw).toLowerCase() === "true" || raw === 1 || raw === "1" || String(raw).toLowerCase() === "yes";
        n = truthy ? tPts : fPts;
      } else if (f.type === "text") {
        const map = (f.text_score_map || {}) as Record<string, number>;
        const key = raw == null ? "" : String(raw).trim();
        const v = map[key];
        n = v != null && !Number.isNaN(Number(v)) ? Number(v) : 0;
      } else {
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) n = parsed;
      }

      const maxp = Number(f.max_points || 0);
      let normalized = n;
      if (maxp > 0) normalized = clamp((n / maxp) * 100, 0, 100);
      else normalized = clamp(n, 0, 100);

      acc += normalized * w;
      totalW += w;
    }

    // Add exam component to weighted sum
    if (examComponent != null && examWeight > 0) {
      acc += clamp(examComponent, 0, 100) * examWeight;
      totalW += examWeight;
    }

    // Calculate overall score
    let overallScore: number | null = null;
    if (totalW > 0) overallScore = acc / totalW;

    let passed: boolean | null = overallScore != null ? overallScore >= passThreshold : null;
    if (failOnAnyExam && examTotalCount > 0) {
      if (examPassCount < examTotalCount) passed = false;
    }

    // Build extras array for display (non-hidden only)
    const extras = fields
      .filter((f) => !f.hidden)
      .map((f) => ({
        key: f.key,
        label: f.label,
        value: extraScoresData[f.key],
        type: f.type,
        max_points: f.max_points,
      }));

    // Sort exam items by order_index, then by submitted_at
    examItems.sort((a, b) => {
      const ao = a._order_index ?? 999999;
      const bo = b._order_index ?? 999999;
      if (ao !== bo) return ao - bo;
      const as = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bs = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return bs - as;
    });

    return NextResponse.json({
      items: examItems,
      extras,
      pass_summary: {
        overall_score: overallScore != null ? Math.round(overallScore * 100) / 100 : null,
        passed,
        hidden: hidePassFailMessages,
      },
    });
  } catch (error) {
    console.error("Unexpected error in results API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
