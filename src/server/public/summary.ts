import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { calculateFinalScore } from "@/lib/scoreCalculator";
import type { CalculationInput, CalculationSettings, ExtraField, ExamAttempt } from "@/lib/scoreCalculator.types";

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

    // Fetch data using student_score_summary view for efficiency
    const { data: summaryData, error: summaryErr } = await svc
      .from("student_score_summary")
      .select("student_id, student_code, student_name, exam_attempts, extra_scores")
      .eq("student_code", code)
      .maybeSingle();
    
    if (summaryErr && (summaryErr as any).code !== "PGRST116") {
      return NextResponse.json({ error: (summaryErr as any).message }, { status: 400 });
    }

    // Load extra score fields
    const { data: fieldsData } = await svc
      .from("extra_score_fields")
      .select("key,label,type,hidden,include_in_pass,pass_weight,max_points,order_index,bool_true_points,bool_false_points,text_score_map")
      .order("order_index", { ascending: true })
      .order("label", { ascending: true });

    const fields = (fieldsData || []) as any[];
    const scoreData = (summaryData as any)?.extra_scores || {};

    // Build calculation settings
    const calculationSettings: CalculationSettings = {
      passCalcMode: passMode,
      overallPassThreshold: passThreshold,
      examWeight: examWeight,
      examScoreSource: examScoreSource,
      failOnAnyExam: failOnAnyExam,
    };

    // Build extra fields for calculator
    const extraFields: ExtraField[] = fields.map((f: any) => ({
      key: f.key,
      label: f.label,
      type: f.type as 'number' | 'text' | 'boolean',
      includeInPass: f.include_in_pass === true,
      passWeight: Number(f.pass_weight || 0),
      maxPoints: f.max_points != null ? Number(f.max_points) : null,
      boolTruePoints: f.bool_true_points != null ? Number(f.bool_true_points) : 100,
      boolFalsePoints: f.bool_false_points != null ? Number(f.bool_false_points) : 0,
      textScoreMap: f.text_score_map || {},
    }));

    // Fetch all published exams and their config
    const { data: publishedExams } = await svc
      .from("exams")
      .select("id, title, settings")
      .eq("status", "done")
      .eq("is_archived", false);

    const allExams = (publishedExams || []) as any[];

    // Build include map from exam_public_config
    const includeMap = new Map<string, boolean>();
    if (allExams.length > 0) {
      const examIds = allExams.map((e: any) => e.id);
      const { data: cfg } = await svc
        .from("exam_public_config")
        .select("exam_id, include_in_pass")
        .in("exam_id", examIds);
      
      (cfg || []).forEach((c: any) => includeMap.set(c.exam_id, c.include_in_pass !== false));
    }

    // Parse exam attempts from summary view
    const attemptsByExam = new Map<string, any>();
    const rawAttempts = (summaryData as any)?.exam_attempts || [];
    
    for (const attempt of rawAttempts) {
      if (!attempt || !attempt.exam_id) continue;
      
      // Keep only the latest attempt per exam (they should already be ordered)
      if (!attemptsByExam.has(attempt.exam_id)) {
        attemptsByExam.set(attempt.exam_id, attempt);
      }
    }

    // Build exam attempts for calculator
    const examAttempts: ExamAttempt[] = allExams.map((exam: any) => {
      const included = includeMap.has(exam.id) ? (includeMap.get(exam.id) === true) : true;
      const attempt = attemptsByExam.get(exam.id);
      
      let scorePercentage: number | null = null;
      let finalScorePercentage: number | null = null;
      
      if (attempt) {
        scorePercentage = attempt.score_percentage != null ? Number(attempt.score_percentage) : null;
        finalScorePercentage = attempt.final_score_percentage != null ? Number(attempt.final_score_percentage) : null;
      }
      
      const passThresholdRaw = exam?.settings?.pass_percentage;
      const passThreshold = passThresholdRaw != null ? Number(passThresholdRaw) : null;
      
      return {
        examId: exam.id,
        examTitle: exam.title || 'Untitled Exam',
        scorePercentage,
        finalScorePercentage,
        includeInPass: included,
        passThreshold,
      };
    });

    // Build calculation input
    const calculationInput: CalculationInput = {
      studentId: (student as any).id,
      studentCode: code,
      studentName: (student as any).student_name || '',
      examAttempts,
      extraScores: scoreData,
      extraFields,
      settings: calculationSettings,
    };

    // Calculate final score using centralized calculator
    const calculation = calculateFinalScore(calculationInput);

    // Build extras for display (respect hidden)
    const extras = fields
      .filter((f) => f.hidden !== true)
      .map((f) => {
        let value = scoreData?.[f.key];
        const mp = f?.max_points ?? null;
        const type = f?.type as "number" | "text" | "boolean" | undefined;
        return { key: f.key, label: f.label, value, max_points: mp, type };
      });

    // Build legacy pass_summary format for backward compatibility
    const summary = {
      overall_score: calculation.finalScore,
      passed: calculation.passed,
      threshold: passThreshold,
      message: calculation.passed == null ? null : calculation.passed ? msgPass : msgFail,
      hidden: msgHidden,
      exam_passed: calculation.examComponent.examsPassed,
      exam_total: calculation.examComponent.examsTotal,
    };

    return NextResponse.json({
      student,
      calculation,
      extras,
      pass_summary: summary,
    });
  } catch (error) {
    console.error("summary api error", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
