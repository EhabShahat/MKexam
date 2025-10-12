import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCodeFormatSettings, validateCodeFormat } from "@/lib/codeGenerator";

export async function resultsGET(request: NextRequest) {
  try {
    const svc = supabaseServer();

    let examScoreSource: 'final' | 'raw' = 'final';
    try {
      const { data: s } = await svc
        .from('app_settings')
        .select('result_exam_score_source')
        .limit(1)
        .maybeSingle();
      const src = (s as any)?.result_exam_score_source as string | undefined;
      if (src === 'raw' || src === 'final') examScoreSource = src;
    } catch {}

    const searchTerm = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (!searchTerm) {
      return NextResponse.json({ items: [] });
    }

    let mode: "name" | "code" = "name";
    try {
      const { data: settings, error: settingsError } = await svc
        .from("app_settings")
        .select("enable_name_search, enable_code_search")
        .limit(1)
        .maybeSingle();
      if (!settingsError) {
        const enableName = (settings as any)?.enable_name_search !== false;
        const enableCode = (settings as any)?.enable_code_search !== false;
        mode = enableCode && !enableName ? "code" : "name";
      }
    } catch {}

    if (mode === "code") {
      const trimmed = searchTerm.trim();
      const codeSettings = await getCodeFormatSettings();
      if (!validateCodeFormat(trimmed, codeSettings)) {
        return NextResponse.json({ items: [] });
      }
    }

    let query: any;
    if (mode === "name") {
      query = svc
        .from("exam_attempts")
        .select(
          `id, exam_id, completion_status, submitted_at,
           exams(title, settings),
           students(student_name, code),
           exam_results!inner(score_percentage, final_score_percentage)`
        )
        .order("submitted_at", { ascending: false })
        .ilike("students.student_name", `%${searchTerm}%`);
    } else {
      const code = searchTerm.trim();
      query = svc
        .from("exam_attempts")
        .select(
          `id, exam_id, completion_status, submitted_at,
           exams(title, settings),
           exam_results!inner(score_percentage, final_score_percentage),
           student_exam_attempts!inner(
             students!inner(student_name, code)
           )`
        )
        .order("submitted_at", { ascending: false })
        .eq("student_exam_attempts.students.code", code);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ items: [], message: "No results available" });
      } else if (error.code === "42703") {
        return NextResponse.json({ items: [], message: "Search is temporarily unavailable" });
      }
      return NextResponse.json({ error: "Failed to fetch exam results" }, { status: 500 });
    }

    // When searching by code (unique student), include all published exams and add zero rows for missed exams
    let items: any[] = [];
    if (mode === 'code') {
      // Load all published exams (id, title, settings)
      const { data: allExams, error: exErr } = await svc
        .from('exams')
        .select('id, title, settings')
        .eq('status', 'done');
      if (exErr && (exErr as any).code !== 'PGRST116') {
        return NextResponse.json({ error: exErr.message }, { status: 500 });
      }
      const examsList = (allExams || []) as any[];

      // Build config for all published exams
      const configMap = new Map<string, { hidden?: boolean; include_in_pass?: boolean; order_index?: number | null }>();
      if (examsList.length > 0) {
        const { data: cfg, error: cfgErr } = await svc
          .from('exam_public_config')
          .select('exam_id, hidden, include_in_pass, order_index')
          .in('exam_id', examsList.map((e) => e.id));
        if (!cfgErr) {
          (cfg || []).forEach((c: any) => configMap.set(c.exam_id, {
            hidden: c.hidden === true,
            include_in_pass: c.include_in_pass !== false,
            order_index: c.order_index ?? null,
          }));
        }
      }

      // latest attempt per exam
      const latestByExam = new Map<string, any>();
      for (const row of (data || [])) {
        if (!latestByExam.has(row.exam_id)) latestByExam.set(row.exam_id, row);
      }

      // Build items for all exams (hidden=false)
      for (const ex of examsList) {
        const cfg = configMap.get(ex.id) || {} as any;
        if (cfg.hidden === true) continue;
        const row = latestByExam.get(ex.id);
        let student_name = 'Anonymous';
        let student_code = '';
        let submitted_at: string | null = null;
        let completion_status: string | null = null;
        let n: number | null = null;
        if (row) {
          // extract student info if available
          if (mode === 'code') {
            const sea = row.student_exam_attempts;
            const seaObj = Array.isArray(sea) ? sea[0] : sea;
            const stu = seaObj?.students;
            const stuObj = Array.isArray(stu) ? stu[0] : stu;
            student_name = stuObj?.student_name || student_name;
            student_code = stuObj?.code || student_code;
          }
          const er = Array.isArray(row.exam_results) ? row.exam_results[0] : row.exam_results;
          if (examScoreSource === 'final') {
            const f = er?.final_score_percentage;
            if (f != null && !Number.isNaN(Number(f))) n = Number(f);
            else if (er?.score_percentage != null && !Number.isNaN(Number(er.score_percentage))) n = Number(er.score_percentage);
          } else if (er?.score_percentage != null && !Number.isNaN(Number(er.score_percentage))) {
            n = Number(er.score_percentage);
          }
          submitted_at = row.submitted_at ?? null;
          completion_status = row.completion_status ?? null;
        } else {
          // no attempt => treat as 0
          n = 0;
        }
        const passThresholdRaw = ex?.settings?.pass_percentage;
        const pass_threshold = passThresholdRaw === null || passThresholdRaw === undefined ? null : Number(passThresholdRaw);
        const score_percentage = n;
        const is_pass = (typeof score_percentage === 'number' && !Number.isNaN(score_percentage) && typeof pass_threshold === 'number' && !Number.isNaN(pass_threshold))
          ? score_percentage >= pass_threshold
          : null;
        items.push({
          id: row?.id ?? `${ex.id}-na`,
          exam_id: ex.id,
          exam_title: ex.title || 'Unknown Exam',
          student_name,
          student_code,
          completion_status,
          submitted_at,
          score_percentage,
          pass_threshold,
          is_pass,
          _order_index: (cfg as any).order_index ?? null,
        });
      }
    } else {
      // Name mode: keep existing behavior (do not invent rows across exams because name may match many students)
      const examIds = Array.from(new Set((data || []).map((r: any) => r.exam_id))).filter(Boolean);
      const configMap = new Map<string, { hidden?: boolean; include_in_pass?: boolean; order_index?: number | null }>();
      if (examIds.length > 0) {
        const { data: cfg, error: cfgErr } = await svc
          .from('exam_public_config')
          .select('exam_id, hidden, include_in_pass, order_index')
          .in('exam_id', examIds);
        if (!cfgErr) {
          (cfg || []).forEach((c: any) => configMap.set(c.exam_id, {
            hidden: c.hidden === true,
            include_in_pass: c.include_in_pass !== false,
            order_index: c.order_index ?? null,
          }));
        }
      }
      items = (data || [])
        .filter((row: any) => {
          const cfg = configMap.get(row.exam_id);
          return cfg?.hidden === true ? false : true;
        })
        .map((row: any) => {
          let student_name = 'Anonymous';
          let student_code = '';
          const stu = row.students;
          const stuObj = Array.isArray(stu) ? stu[0] : stu;
          student_name = stuObj?.student_name || student_name;
          student_code = stuObj?.code || student_code;
          const er = Array.isArray(row.exam_results) ? row.exam_results[0] : row.exam_results;
          let chosen: any = null;
          if (examScoreSource === 'final') chosen = er?.final_score_percentage ?? er?.score_percentage;
          else chosen = er?.score_percentage;
          const score_percentage = chosen == null ? null : Number(chosen);
          const passThresholdRaw = row.exams?.settings?.pass_percentage;
          const pass_threshold = passThresholdRaw == null ? null : Number(passThresholdRaw);
          const is_pass = (typeof score_percentage === 'number' && !Number.isNaN(score_percentage) && typeof pass_threshold === 'number' && !Number.isNaN(pass_threshold))
            ? score_percentage >= pass_threshold
            : null;
          const cfg = configMap.get(row.exam_id) || {} as any;
          return {
            id: row.id,
            exam_id: row.exam_id,
            exam_title: row.exams?.title || 'Unknown Exam',
            student_name,
            student_code,
            completion_status: row.completion_status,
            submitted_at: row.submitted_at,
            score_percentage,
            pass_threshold,
            is_pass,
            _order_index: (cfg as any).order_index ?? null,
          };
        });
    }

    items = items.sort((a: any, b: any) => {
      const ao = a._order_index ?? 999999;
      const bo = b._order_index ?? 999999;
      if (ao !== bo) return ao - bo;
      const as = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bs = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return bs - as; // recent first within the same order bucket
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Unexpected error in results API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
