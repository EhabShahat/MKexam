import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

// GET /api/admin/extra-scores/fields
export async function extraScoresFieldsGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    const { data, error } = await svc
      .from("extra_score_fields")
      .select(
        "id,key,label,type,order_index,hidden,include_in_pass,pass_weight,max_points,bool_true_points,bool_false_points,text_score_map,updated_at"
      )
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("label", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}


// POST /api/admin/extra-scores/fields
export async function extraScoresFieldsPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const payload = await req.json().catch(() => ({}));
    const updates = Array.isArray(payload?.updates) ? payload.updates : [];
    if (updates.length === 0) {
      return NextResponse.json({ error: "no_updates" }, { status: 400 });
    }

    const toUpsert = updates.map((u: any) => ({
      id: u.id ?? undefined,
      key: u.key,
      label: u.label,
      type: u.type,
      order_index: u.order_index,
      hidden: u.hidden,
      include_in_pass: u.include_in_pass,
      pass_weight: u.pass_weight,
      max_points: u.max_points,
      bool_true_points: sanitizeNumber(u.bool_true_points, 0, 100, 100),
      bool_false_points: sanitizeNumber(u.bool_false_points, 0, 100, 0),
      text_score_map: sanitizeTextScoreMap(u.text_score_map),
      updated_at: new Date().toISOString(),
    }));

    const svc = supabaseServer();
    const { data, error } = await svc
      .from("extra_score_fields")
      .upsert(toUpsert, { onConflict: "key", ignoreDuplicates: false })
      .select(
        "id,key,label,type,order_index,hidden,include_in_pass,pass_weight,max_points,bool_true_points,bool_false_points,text_score_map,updated_at"
      );
    if (error) throw error;

    return NextResponse.json({ ok: true, items: data || [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

function clamp(n: any, min: number, max: number) {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}
function sanitizeNumber(n: any, min: number, max: number, fallback: number) {
  if (n == null) return fallback;
  const x = Number(n);
  if (Number.isNaN(x)) return fallback;
  return clamp(x, min, max);
}
function sanitizeTextScoreMap(input: any) {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input)) {
    const key = String(k);
    const val = Number(v);
    if (!Number.isNaN(val)) out[key] = clamp(val, 0, 100);
  }
  return out;
}

// DELETE /api/admin/extra-scores/fields?key=:key
export async function extraScoresFieldsDELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const key = url.searchParams.get("key")?.trim();
    if (!key) return NextResponse.json({ error: "key_required" }, { status: 400 });
    const svc = supabaseServer();
    // Remove key from all students' extra_scores.data in chunks to satisfy PostgREST filter requirements
    const pageSize = 500;
    let from = 0;
    let totalUpdated = 0;
    while (true) {
      const { data: rows, error: selErr } = await svc
        .from("extra_scores")
        .select("student_id,data")
        .range(from, from + pageSize - 1);
      if (selErr) throw selErr;
      const arr = rows || [];
      if (arr.length === 0) break;

      const payload: Array<{ student_id: string; data: any; updated_at: string }> = [];
      for (const r of arr) {
        const sid = (r as any)?.student_id as string;
        const dataObj = ((r as any)?.data || {}) as Record<string, any>;
        if (Object.prototype.hasOwnProperty.call(dataObj, key)) {
          const clone: Record<string, any> = { ...dataObj };
          delete clone[key];
          payload.push({ student_id: sid, data: clone, updated_at: new Date().toISOString() });
        }
      }
      if (payload.length > 0) {
        const { error: upErr } = await svc
          .from("extra_scores")
          .upsert(payload, { onConflict: "student_id", ignoreDuplicates: false });
        if (upErr) throw upErr;
        totalUpdated += payload.length;
      }
      if (arr.length < pageSize) break;
      from += pageSize;
    }

    // Delete the field definition itself
    const { error: delErr } = await svc
      .from("extra_score_fields")
      .delete()
      .eq("key", key);
    if (delErr) throw delErr;

    return NextResponse.json({ ok: true, updated_count: totalUpdated });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// GET /api/admin/extra-scores/fields/values?key=:key
export async function extraScoresFieldsValuesGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const key = url.searchParams.get("key")?.trim();
    if (!key) return NextResponse.json({ error: "key_required" }, { status: 400 });
    const svc = supabaseServer();
    // Ensure the field exists and is text
    const { data: field, error: fErr } = await svc
      .from("extra_score_fields")
      .select("key,type")
      .eq("key", key)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!field) return NextResponse.json({ error: "field_not_found" }, { status: 404 });
    // Gather distinct values from extra_scores.data
    const values = new Set<string>();
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: rows, error } = await svc
        .from("extra_scores")
        .select("data")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const arr = rows || [];
      for (const r of arr) {
        const v = (r as any)?.data?.[key];
        if (v == null) continue;
        const s = String(v).trim();
        if (s !== "") values.add(s);
      }
      if (arr.length < pageSize) break;
      from += pageSize;
    }
    return NextResponse.json({ key, values: Array.from(values).sort((a, b) => a.localeCompare(b)) });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// GET /api/admin/extra-scores/exams
export async function extraScoresExamsGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();

    const { data: exams, error: examsErr } = await svc
      .from("exams")
      .select("id, title, status, exam_type")
      .eq("status", "done")
      .eq("exam_type", "exam") // Only show actual "exam" type assessments
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (examsErr) throw examsErr;

    const ids = (exams || []).map((e: any) => e.id);
    let configMap = new Map<string, any>();
    if (ids.length > 0) {
      const { data: cfg, error: cfgErr } = await svc
        .from("exam_public_config")
        .select("exam_id, order_index, hidden, include_in_pass")
        .in("exam_id", ids);
      if ((cfgErr as any) && (cfgErr as any).code !== "PGRST116") throw cfgErr;
      (cfg || []).forEach((c: any) => configMap.set(c.exam_id, c));
    }

    const items = (exams || [])
      .map((e: any) => {
        const c = configMap.get(e.id) || {};
        return {
          id: e.id,
          title: e.title,
          status: e.status,
          order_index: c.order_index ?? null,
          hidden: c.hidden === true,
          include_in_pass: c.include_in_pass !== false,
        };
      })
      .sort(
        (a, b) => (a.order_index ?? 9999) - (b.order_index ?? 9999) || a.title.localeCompare(b.title)
      );

    return NextResponse.json({ items });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// POST /api/admin/extra-scores/exams
export async function extraScoresExamsPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    const payload = await req.json().catch(() => ({}));
    const updates = Array.isArray(payload?.updates) ? payload.updates : [];
    if (updates.length === 0) {
      return NextResponse.json({ error: "no_updates" }, { status: 400 });
    }

    const toUpsert = updates.map((u: any) => ({
      exam_id: u.exam_id,
      hidden: u.hidden === true,
      include_in_pass: u.include_in_pass !== false,
      order_index: u.order_index ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await svc
      .from("exam_public_config")
      .upsert(toUpsert, { onConflict: "exam_id", ignoreDuplicates: false })
      .select("exam_id, hidden, include_in_pass, order_index");
    if (error) throw error;

    return NextResponse.json({ ok: true, items: data || [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// POST /api/admin/extra-scores/import
export async function extraScoresImportPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.rows) || !body.codeColumn) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const rows: Record<string, any>[] = body.rows;
    const codeColumn: string = String(body.codeColumn);

    if (rows.length === 0) {
      return NextResponse.json({ error: "no_rows" }, { status: 400 });
    }

    const headerSet = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (k === codeColumn) continue;
        if (k == null || k === "") continue;
        headerSet.add(k.trim());
      }
    }
    const fieldKeys = Array.from(headerSet);

    const { data: existingFields, error: fieldsErr } = await svc
      .from("extra_score_fields")
      .select("id,key,label,type,order_index")
      .in("key", fieldKeys);
    if ((fieldsErr as any) && (fieldsErr as any).code !== "PGRST116") throw fieldsErr;

    const existingMap = new Map<string, any>();
    (existingFields || []).forEach((f: any) => existingMap.set(f.key, f));

    const toCreate: any[] = [];
    let nextOrder = (existingFields || []).length;
    for (const key of fieldKeys) {
      if (existingMap.has(key)) continue;
      let totalCount = 0;
      let booleanCount = 0;
      let numericCount = 0;
      for (const r of rows) {
        const v = r[key];
        if (v === null || v === undefined || v === "") continue;
        totalCount++;
        let isBool = false;
        if (typeof v === 'boolean') {
          isBool = true;
        } else if (typeof v === 'number') {
          isBool = (v === 1 || v === 0);
        } else {
          const s = String(v).trim().toLowerCase();
          if (["true","false","1","0","yes","no","y","n","on","off"].includes(s)) isBool = true;
        }
        if (isBool) booleanCount++;
        const n = Number(v);
        if (!Number.isNaN(n)) numericCount++;
      }
      let type: "number" | "text" | "boolean" = "text";
      if (totalCount > 0 && booleanCount === totalCount) type = "boolean";
      else if (totalCount > 0 && numericCount === totalCount) type = "number";
      else type = "text";
      toCreate.push({ key, label: key, type, order_index: nextOrder++ });
    }
    if (toCreate.length > 0) {
      const { error: createErr } = await svc.from("extra_score_fields").upsert(toCreate, { onConflict: "key" });
      if (createErr) throw createErr;
    }

    const { data: fieldsAfter, error: fieldsAfterErr } = await svc
      .from("extra_score_fields")
      .select("key,type")
      .in("key", fieldKeys);
    if ((fieldsAfterErr as any) && (fieldsAfterErr as any).code !== "PGRST116") throw fieldsAfterErr;
    const typeMap = new Map<string, string>();
    (fieldsAfter || []).forEach((f: any) => typeMap.set(f.key, f.type));

    const truthy = new Set(["true","1","yes","y","on"]);
    const falsy = new Set(["false","0","no","n","off"]);
    const toBool = (v: any): boolean | null => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v === 1;
      if (v == null) return null;
      const s = String(v).trim().toLowerCase();
      if (truthy.has(s)) return true;
      if (falsy.has(s)) return false;
      return null;
    };
    const coerce = (t: string, v: any) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      switch (t) {
        case 'number': {
          if (typeof v === 'number') return v;
          const n = Number(v);
          return Number.isNaN(n) ? null : n;
        }
        case 'boolean': {
          return toBool(v);
        }
        default:
          return v;
      }
    };

    const codes = Array.from(new Set(rows.map(r => String(r[codeColumn] || "").trim()).filter(Boolean)));
    if (codes.length === 0) {
      return NextResponse.json({ error: "no_codes" }, { status: 400 });
    }

    const codeToId = new Map<string, string>();
    for (let i = 0; i < codes.length; i += 500) {
      const chunk = codes.slice(i, i + 500);
      const { data: students, error: stuErr } = await svc
        .from("students")
        .select("id,code")
        .in("code", chunk);
      if (stuErr) throw stuErr;
      (students || []).forEach((s: any) => codeToId.set(s.code, s.id));
    }

    const updates = new Map<string, Record<string, any>>();
    for (const r of rows) {
      const codeRaw = r[codeColumn];
      const code = (codeRaw == null ? "" : String(codeRaw)).trim();
      if (!code) continue;
      const sid = codeToId.get(code);
      if (!sid) continue;

      const current = updates.get(sid) || {};
      for (const key of fieldKeys) {
        const val = r[key];
        const t = typeMap.get(key) || 'text';
        const coerced = coerce(t, val);
        if (coerced !== undefined) current[key] = coerced;
      }
      updates.set(sid, current);
    }

    if (updates.size === 0) {
      return NextResponse.json({ error: "no_matching_students" }, { status: 400 });
    }

    const studentIds = Array.from(updates.keys());
    const existingScores = new Map<string, any>();
    for (let i = 0; i < studentIds.length; i += 500) {
      const chunk = studentIds.slice(i, i + 500);
      const { data: es, error: esErr } = await svc
        .from("extra_scores")
        .select("student_id,data")
        .in("student_id", chunk);
      if (esErr) throw esErr;
      (es || []).forEach((row: any) => existingScores.set(row.student_id, row.data || {}));
    }

    let upserted = 0;
    const payloads: any[] = [];
    for (const [sid, obj] of updates.entries()) {
      const base = existingScores.get(sid) || {};
      payloads.push({ student_id: sid, data: { ...base, ...obj }, updated_at: new Date().toISOString() });
    }

    for (let i = 0; i < payloads.length; i += 200) {
      const chunk = payloads.slice(i, i + 200);
      const { error: upErr } = await svc
        .from("extra_scores")
        .upsert(chunk, { onConflict: "student_id", ignoreDuplicates: false });
      if (upErr) throw upErr;
      upserted += chunk.length;
    }

    return NextResponse.json({ ok: true, upserted, fields_created: toCreate.length });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("extra-scores import error:", e);
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// GET /api/admin/extra-scores/attendance
export async function extraScoresAttendanceGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    
    // Get all students
    const { data: students, error: studentsErr } = await svc
      .from("students")
      .select("id, code, student_name, created_at")
      .order("code");
    
    if (studentsErr) {
      return NextResponse.json({ error: studentsErr.message }, { status: 400 });
    }

    // Get all attendance records (no date filtering)
    const { data: attendance, error: attendanceErr } = await svc
      .from("attendance_records")
      .select("student_id, session_date")
      .order("session_date");
      
    if (attendanceErr) {
      return NextResponse.json({ error: attendanceErr.message }, { status: 400 });
    }

    // Calculate total actual meeting sessions (days where any student was scanned)
    const allSessionDates = [...new Set((attendance || []).map(record => record.session_date))];
    const totalMeetings = allSessionDates.length;

    // Group attendance by student
    const attendanceByStudent: Record<string, string[]> = {};
    for (const record of attendance || []) {
      if (!attendanceByStudent[record.student_id]) {
        attendanceByStudent[record.student_id] = [];
      }
      attendanceByStudent[record.student_id].push(record.session_date);
    }

    // Calculate attendance statistics for each student
    const attendanceStats = (students || []).map(student => {
      const attendedDays = attendanceByStudent[student.id] || [];
      const uniqueAttendedDays = [...new Set(attendedDays)].length; // Remove duplicates
      const percentage = totalMeetings > 0 ? Math.round((uniqueAttendedDays / totalMeetings) * 100) : 0;
      
      return {
        student_id: student.id,
        code: student.code,
        student_name: student.student_name,
        attended_days: uniqueAttendedDays,
        total_meetings: totalMeetings,
        attendance_percentage: percentage
      };
    });

    // Get first and last session dates for display
    const firstSessionDate = allSessionDates.length > 0 ? allSessionDates.sort()[0] : null;
    const lastSessionDate = allSessionDates.length > 0 ? allSessionDates.sort().reverse()[0] : null;

    return NextResponse.json({
      items: attendanceStats,
      period: {
        start_date: firstSessionDate,
        end_date: lastSessionDate,
        total_meetings: totalMeetings,
        session_dates: allSessionDates.sort()
      }
    });
    
  } catch (error: any) {
    console.error("Attendance API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch attendance data" },
      { status: 500 }
    );
  }
}

// POST /api/admin/extra-scores/sync-attendance
// GET /api/admin/extra-scores/exam-tags - Calculate exam tag scores
export async function extraScoresExamTagsGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    
    // Get all exams with their assessment types and results
    const { data: exams, error: examsError } = await svc
      .from("exams")
      .select("id, title, exam_type, status")
      .in("status", ["done", "published"]);
      
    if (examsError) {
      return NextResponse.json({ error: examsError.message }, { status: 400 });
    }
    
    // Get all students
    const { data: students, error: studentsError } = await svc
      .from("students")
      .select("id, code, student_name");
      
    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 400 });
    }
    
    // Get all exam attempts with results
    const { data: attempts, error: attemptsError } = await svc
      .from("exam_attempts")
      .select(`
        id, student_id, exam_id, completion_status, submitted_at,
        exam_results(score_percentage, final_score_percentage)
      `)
      .eq("completion_status", "submitted");
      
    if (attemptsError) {
      return NextResponse.json({ error: attemptsError.message }, { status: 400 });
    }
    
    // Extract unique assessment types from all exams
    const allTypes = new Set<string>();
    const examsByType = new Map<string, any[]>();
    
    (exams || []).forEach(exam => {
      const examType = exam.exam_type || 'exam'; // Default to 'exam' if null
      
      if (examType) {
        allTypes.add(examType);
        if (!examsByType.has(examType)) {
          examsByType.set(examType, []);
        }
        examsByType.get(examType)!.push(exam);
      }
    });
    
    // Build attempt map by student and exam
    const attemptMap = new Map<string, Map<string, any>>();
    (attempts || []).forEach(attempt => {
      if (!attemptMap.has(attempt.student_id)) {
        attemptMap.set(attempt.student_id, new Map());
      }
      attemptMap.get(attempt.student_id)!.set(attempt.exam_id, attempt);
    });
    
    // Calculate assessment type scores for each student
    const typeStats = Array.from(allTypes).map(type => {
      const typeExams = examsByType.get(type) || [];
      const studentScores = (students || []).map(student => {
        let totalScore = 0;
        let examCount = 0;
        
        typeExams.forEach(exam => {
          const studentAttempts = attemptMap.get(student.id);
          const attempt = studentAttempts?.get(exam.id);
          
          if (attempt) {
            const results = Array.isArray(attempt.exam_results) ? 
                          attempt.exam_results[0] : attempt.exam_results;
            
            if (results) {
              // Use final score if available, otherwise regular score
              const scorePercentage = results.final_score_percentage ?? results.score_percentage;
              if (scorePercentage != null && !isNaN(Number(scorePercentage))) {
                totalScore += Number(scorePercentage);
                examCount += 1;
              }
            }
          }
        });
        
        const averagePercentage = examCount > 0 ? Math.round(totalScore / examCount) : 0;
        
        return {
          student_id: student.id,
          code: student.code,
          student_name: student.student_name,
          exams_attempted: examCount,
          total_exams: typeExams.length,
          average_percentage: averagePercentage
        };
      });
      
      return {
        tag: type, // Keep 'tag' for frontend compatibility
        exam_count: typeExams.length,
        exams: typeExams.map(e => ({ id: e.id, title: e.title })),
        students: studentScores
      };
    });
    
    return NextResponse.json({ tags: typeStats });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// POST /api/admin/extra-scores/sync-exam-tags - Sync exam tag scores to extra fields
export async function extraScoresSyncExamTagsPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    
    const body = await req.json().catch(() => ({}));
    const { selectedTags = [] } = body;
    
    if (!Array.isArray(selectedTags) || selectedTags.length === 0) {
      return NextResponse.json({ error: "No tags selected" }, { status: 400 });
    }
    
    // Get tag calculation data
    const tagData = await extraScoresExamTagsGET(req);
    const tagResponse = await tagData.json();
    const allTagStats = tagResponse.tags || [];
    
    let createdFields = 0;
    let updatedStudents = 0;
    
    // Process each selected tag
    for (const selectedTag of selectedTags) {
      const tagStats = allTagStats.find((t: any) => t.tag === selectedTag);
      if (!tagStats) continue;
      
      const fieldKey = `exam_type_${selectedTag.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      
      // 1. Create or update the tag field in extra_score_fields
      const { data: existingField } = await svc
        .from("extra_score_fields")
        .select("id, key")
        .eq("key", fieldKey)
        .maybeSingle();
      
      if (!existingField) {
        // Create new tag field
        const { error: fieldError } = await svc
          .from("extra_score_fields")
          .insert({
            key: fieldKey,
            label: `${selectedTag.charAt(0).toUpperCase() + selectedTag.slice(1)} Score`,
            type: "number",
            hidden: false,
            include_in_pass: true,
            pass_weight: 0.2, // Default weight
            max_points: 100,
            order_index: 500 + createdFields // Put after manual fields but before attendance
          });
          
        if (fieldError) {
          console.error(`Error creating field for tag ${selectedTag}:`, fieldError);
          continue;
        }
        createdFields++;
      } else {
        // Update existing field
        const { error: updateError } = await svc
          .from("extra_score_fields")
          .update({
            label: `${selectedTag.charAt(0).toUpperCase() + selectedTag.slice(1)} Score`,
            max_points: 100
          })
          .eq("key", fieldKey);
          
        if (updateError) {
          console.error(`Error updating field for tag ${selectedTag}:`, updateError);
        }
      }
      
      // 2. Update students with tag scores
      for (const studentScore of tagStats.students || []) {
        // Get current extra_scores
        const { data: currentStudent, error: fetchError } = await svc
          .from("students")
          .select("extra_scores")
          .eq("id", studentScore.student_id)
          .single();
          
        if (fetchError) continue;
        
        const currentExtraScores = currentStudent.extra_scores || {};
        const updatedExtraScores = {
          ...currentExtraScores,
          [fieldKey]: studentScore.average_percentage
        };
        
        // Update student with new tag score
        const { error: updateError } = await svc
          .from("students")
          .update({ extra_scores: updatedExtraScores })
          .eq("id", studentScore.student_id);
          
        if (!updateError) {
          updatedStudents++;
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      created_fields: createdFields,
      updated_students: updatedStudents,
      processed_tags: selectedTags
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function extraScoresSyncAttendancePOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    
    const body = await req.json().catch(() => ({}));
    const { weeks = 12, fieldKey = "attendance_percentage" } = body;
    
    // Get attendance data (call our local function instead of making HTTP request)
    const attendanceData = await extraScoresAttendanceGET(req);
    const attendanceResponse = await attendanceData.json();
    const attendanceItems = attendanceResponse.items || [];
    
    // 1. Create or update the attendance field in extra_score_fields
    const { data: existingField } = await svc
      .from("extra_score_fields")
      .select("id, key, label, type, order_index, hidden, include_in_pass, pass_weight, max_points")
      .eq("key", fieldKey)
      .maybeSingle();
    
    if (!existingField) {
      // Create new attendance field
      const { error: fieldError } = await svc
        .from("extra_score_fields")
        .insert({
          key: fieldKey,
          label: `Attendance Percentage`,
          type: "number",
          hidden: false,
          include_in_pass: true,
          pass_weight: 0.2, // Default weight of 0.2 for attendance
          max_points: 100,
          order_index: 999 // Put it at the end
        });
        
      if (fieldError) {
        return NextResponse.json({ error: fieldError.message }, { status: 400 });
      }
    } else {
      // Update existing field to ensure it has correct settings
      const { error: updateError } = await svc
        .from("extra_score_fields")
        .update({
          label: `Attendance Percentage`,
          max_points: 100
        })
        .eq("key", fieldKey);
        
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    }
    
    // 2. Get all students to sync attendance data
    const { data: students, error: studentsError } = await svc
      .from("students")
      .select("id, code");
      
    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 400 });
    }
    
    // 3. Prepare attendance data for students
    const attendanceMap = new Map();
    attendanceItems.forEach((item: any) => {
      attendanceMap.set(item.student_id, item.attendance_percentage);
    });
    
    let updatedCount = 0;
    
    // 4. Update each student's extra_scores with attendance percentage
    for (const student of students || []) {
      const attendancePercentage = attendanceMap.get(student.id) || 0;
      
      // Get current extra_scores
      const { data: currentStudent, error: fetchError } = await svc
        .from("students")
        .select("extra_scores")
        .eq("id", student.id)
        .single();
        
      if (fetchError) continue;
      
      const currentExtraScores = currentStudent.extra_scores || {};
      const updatedExtraScores = {
        ...currentExtraScores,
        [fieldKey]: attendancePercentage
      };
      
      // Update student with new attendance data
      const { error: updateError } = await svc
        .from("students")
        .update({ extra_scores: updatedExtraScores })
        .eq("id", student.id);
        
      if (!updateError) {
        updatedCount++;
      }
    }
    
    return NextResponse.json({
      success: true,
      field_key: fieldKey,
      updated_students: updatedCount,
      total_students: students?.length || 0,
      message: `Attendance data synced successfully for ${updatedCount} students`
    });
    
  } catch (error: any) {
    console.error("Sync attendance API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync attendance data" },
      { status: 500 }
    );
  }
}
