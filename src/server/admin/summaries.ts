import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseCodes(url: URL): string[] {
  const out = new Set<string>();
  const add = (s?: string | null) => {
    if (!s) return;
    for (const part of s.split(",")) {
      const v = part.trim();
      if (v) out.add(v);
    }
  };
  add(url.searchParams.get("codes"));
  // Accept repeated codes[]= and code=
  url.searchParams.getAll("codes[]").forEach(add);
  url.searchParams.getAll("code").forEach(add);
  return Array.from(out);
}

export async function adminSummariesGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    const url = new URL(req.url);
    const codes = parseCodes(url);
    if (!codes.length) return NextResponse.json({ items: [] });

    // App settings
    const { data: settings } = await svc
      .from("app_settings")
      .select(
        "result_pass_calc_mode, result_overall_pass_threshold, result_exam_weight, result_exam_score_source, result_fail_on_any_exam"
      )
      .limit(1)
      .maybeSingle();
    const passMode = (settings as any)?.result_pass_calc_mode || "best"; // 'best' | 'avg'
    const passThreshold = Number((settings as any)?.result_overall_pass_threshold ?? 60);
    const examWeight = Number((settings as any)?.result_exam_weight ?? 1);
    const examScoreSource = (((settings as any)?.result_exam_score_source as string) || "final") as
      | "final"
      | "raw";
    const failOnAnyExam = (settings as any)?.result_fail_on_any_exam === true;

    // Field defs
    const { data: fieldsRes } = await svc
      .from("extra_score_fields")
      .select(
        "key,label,type,hidden,include_in_pass,pass_weight,max_points,order_index,bool_true_points,bool_false_points,text_score_map"
      )
      .order("order_index", { ascending: true })
      .order("label", { ascending: true });
    const fields = (fieldsRes || []) as any[];

    // Students by code
    const { data: studentsRes } = await svc
      .from("students")
      .select("id, code, student_name")
      .in("code", codes);
    const codeToStudent = new Map<string, { id: string; code: string; student_name: string | null }>();
    const studentIds: string[] = [];
    for (const s of (studentsRes || []) as any[]) {
      codeToStudent.set(s.code, { id: s.id, code: s.code, student_name: s.student_name ?? null });
      studentIds.push(s.id);
    }

    // Extras for all students
    const extrasByStudent = new Map<string, Record<string, any>>();
    if (studentIds.length > 0) {
      const { data: scoresRes } = await svc
        .from("extra_scores")
        .select("student_id, data")
        .in("student_id", studentIds);
      for (const row of (scoresRes || []) as any[]) {
        extrasByStudent.set(row.student_id, (row.data || {}) as Record<string, any>);
      }
    }

    // Exams done and include map
    const { data: examsRes } = await svc.from("exams").select("id, settings").eq("status", "done");
    const exams = (examsRes || []) as any[];
    const examIds = exams.map((e) => e.id);
    const includeMap = new Map<string, boolean>();
    if (examIds.length > 0) {
      const { data: cfg } = await svc
        .from("exam_public_config")
        .select("exam_id, include_in_pass")
        .in("exam_id", examIds);
      for (const c of (cfg || []) as any[]) includeMap.set(c.exam_id, c.include_in_pass !== false);
    }

    // Attempts for all requested students on done exams
    const attemptsByStudentExam = new Map<string, Map<string, any>>(); // sid -> (exam_id -> latest attempt)
    if (studentIds.length > 0) {
      const { data: attempts } = await svc
        .from("exam_attempts")
        .select(
          "student_id, exam_id, submitted_at, exam_results(score_percentage, final_score_percentage), exams!inner(status)"
        )
        .in("student_id", studentIds)
        .eq("exams.status", "done")
        .order("submitted_at", { ascending: false });
      for (const row of (attempts || []) as any[]) {
        const sid = row.student_id as string;
        const exid = row.exam_id as string;
        let inner = attemptsByStudentExam.get(sid);
        if (!inner) {
          inner = new Map<string, any>();
          attemptsByStudentExam.set(sid, inner);
        }
        if (!inner.has(exid)) inner.set(exid, row); // first is latest because of sort desc
      }
    }

    // Build results per code
    const items: Array<{ code: string; extras: Array<{ key: string; value: any }>; pass_summary: { overall_score: number | null; passed: boolean | null } }> = [];

    for (const code of codes) {
      const student = codeToStudent.get(code);
      const sid = student?.id || null;

      // Build extras (respect hidden)
      let extras: Array<{ key: string; value: any }> = [];
      if (sid) {
        const data = extrasByStudent.get(sid) || {};
        extras = fields
          .filter((f) => f.hidden !== true)
          .map((f) => ({ key: f.key as string, value: (data as any)[f.key] })) as Array<{ key: string; value: any }>;
      }

      // Compute exam component
      let examScores: number[] = [];
      let examPassCount = 0;
      let examTotalCount = 0;
      if (sid) {
        const latestByExam = attemptsByStudentExam.get(sid) || new Map<string, any>();
        const numeric: number[] = [];
        for (const ex of exams) {
          const included = includeMap.has(ex.id) ? includeMap.get(ex.id)! : true;
          if (!included) continue;
          const row = latestByExam.get(ex.id);
          let n = 0;
          if (row) {
            const er = Array.isArray(row.exam_results) ? row.exam_results[0] : row.exam_results;
            if (examScoreSource === "final") {
              const f = er?.final_score_percentage;
              if (f != null && !Number.isNaN(Number(f))) n = Number(f);
              else if (er?.score_percentage != null && !Number.isNaN(Number(er.score_percentage))) n = Number(er.score_percentage);
            } else {
              const raw = er?.score_percentage;
              if (raw != null && !Number.isNaN(Number(raw))) n = Number(raw);
            }
          }
          numeric.push(n);
          // per-exam pass
          const thrRaw = ex?.settings?.pass_percentage;
          if (thrRaw != null) {
            examTotalCount += 1;
            const thr = Number(thrRaw);
            if (!Number.isNaN(thr) && n >= thr) examPassCount += 1;
          }
        }
        examScores = numeric;
      }

      let examComponent: number | null = null;
      if (examScores.length > 0) {
        if (passMode === "avg") examComponent = clamp(examScores.reduce((a, b) => a + b, 0) / examScores.length, 0, 100);
        else examComponent = clamp(Math.max(...examScores), 0, 100);
      }

      // Extras weighted component
      let acc = 0;
      let totalW = 0;
      if (sid) {
        const data = extrasByStudent.get(sid) || {};
        for (const f of fields) {
          if (!f.include_in_pass) continue;
          const w = Number(f.pass_weight || 0);
          if (!(w > 0)) continue;
          const raw = (data as any)[f.key];
          let n = 0;
          if (f.type === "boolean") {
            const tPts = Number((f as any).bool_true_points ?? 100);
            const fPts = Number((f as any).bool_false_points ?? 0);
            const truthy = raw === true || String(raw).toLowerCase() === "true" || raw === 1 || raw === "1" || String(raw).toLowerCase() === "yes";
            n = truthy ? tPts : fPts;
          } else if (f.type === "text") {
            const map = ((f as any).text_score_map || {}) as Record<string, number>;
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
      }

      if (examComponent != null && examWeight > 0) {
        acc += clamp(examComponent, 0, 100) * examWeight;
        totalW += examWeight;
      }

      let overall: number | null = null;
      if (totalW > 0) overall = acc / totalW;
      let passed: boolean | null = overall != null ? overall >= passThreshold : null;
      if (failOnAnyExam && examTotalCount > 0) {
        if (examPassCount < examTotalCount) passed = false;
      }

      items.push({
        code,
        extras,
        pass_summary: {
          overall_score: overall != null ? Math.round(overall * 100) / 100 : null,
          passed,
        },
      });
    }

    return NextResponse.json({ items });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
