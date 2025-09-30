import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

// Utility: start of day in UTC for a given Date
function startOfUTCDate(d: Date): Date {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return dt;
}

export async function attendanceScanPOST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const body = await req.json().catch(() => ({}));
    const { code, studentId, sessionDate, note } = body || {};

    if (!code && !studentId) {
      return NextResponse.json({ error: "code_or_studentId_required" }, { status: 400 });
    }

    // Resolve student by code or id
    let student: any | null = null;
    if (studentId) {
      const { data, error } = await svc
        .from("students")
        .select("id, code, student_name, mobile_number, mobile_number2, address, national_id, created_at")
        .eq("id", studentId)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (!data) return NextResponse.json({ error: "student_not_found" }, { status: 404 });
      student = data;
    } else if (code) {
      const { data, error } = await svc
        .from("students")
        .select("id, code, student_name, mobile_number, mobile_number2, address, national_id, created_at")
        .eq("code", String(code).trim())
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (!data) return NextResponse.json({ error: "invalid_code" }, { status: 404 });
      student = data;
    }

    const now = new Date();
    const todayUTC = startOfUTCDate(sessionDate ? new Date(sessionDate) : now);
    const todayISODate = todayUTC.toISOString().slice(0, 10); // YYYY-MM-DD

    // Check existing attendance for the day
    const { data: existing, error: existingErr } = await svc
      .from("attendance_records")
      .select("id, attended_at, session_date")
      .eq("student_id", student.id)
      .eq("session_date", todayISODate)
      .maybeSingle();
    if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 400 });

    let attendance: any = existing || null;
    let created = false;

    if (!existing) {
      const insertPayload = {
        student_id: student.id,
        session_date: todayISODate,
        source: "scan",
        note: note || null,
        created_by: admin.user_id,
      } as any;
      const { data: ins, error: insErr } = await svc
        .from("attendance_records")
        .insert(insertPayload)
        .select("id, attended_at, session_date")
        .single();
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      attendance = ins;
      created = true;
    }

    // Also return summary of student from view when available
    const { data: summary } = await svc
      .from("student_exam_summary")
      .select("student_id, code, student_name, mobile_number, mobile_number2, address, national_id, student_created_at")
      .eq("student_id", student.id)
      .maybeSingle();

    return NextResponse.json({
      student: summary || {
        student_id: student.id,
        code: student.code,
        student_name: student.student_name,
        mobile_number: student.mobile_number,
        mobile_number2: student.mobile_number2,
        address: student.address,
        national_id: student.national_id,
        student_created_at: student.created_at,
      },
      attendance,
      already_attended: !created,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// Return today's attendance count (UTC day)
export async function attendanceTodayCountGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const todayUTC = startOfUTCDate(new Date());
    const todayISODate = todayUTC.toISOString().slice(0, 10);

    const { count, error } = await svc
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("session_date", todayISODate);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ date: todayISODate, count: count || 0 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function attendanceRecentGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const url = new URL(req.url);
    const hours = Math.max(1, Math.min(24 * 7, Number(url.searchParams.get("hours") || 3)));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await svc
      .from("attendance_records")
      .select("id, attended_at, session_date, student_id, students(code, student_name, mobile_number)")
      .gte("attended_at", since)
      .order("attended_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const items = (data || []).map((r: any) => ({
      id: r.id,
      attended_at: r.attended_at,
      session_date: r.session_date,
      student_id: r.student_id,
      code: r.students?.code || null,
      student_name: r.students?.student_name || null,
      mobile_number: r.students?.mobile_number || null,
    }));

    return NextResponse.json({ items, hours, count: items.length });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

function getWeekStartUTC(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Make Monday the start of the week; JS getUTCDay(): 0=Sun..6=Sat
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return startOfUTCDate(d);
}

export async function attendanceHistoryGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const url = new URL(req.url);
    const weeks = Math.max(4, Math.min(52, Number(url.searchParams.get("weeks") || 12)));

    // Build week periods from current week (inclusive) going back
    const now = new Date();
    const thisWeekStart = getWeekStartUTC(now);
    const weekStarts: Date[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(thisWeekStart);
      d.setUTCDate(d.getUTCDate() - i * 7);
      weekStarts.push(d);
    }

    const rangeStart = weekStarts[0];

    // Fetch students
    const { data: students, error: studentsErr } = await svc
      .from("students")
      .select("id, code, student_name, created_at")
      .order("created_at", { ascending: true });
    if (studentsErr) return NextResponse.json({ error: studentsErr.message }, { status: 400 });

    // Fetch attendance records since rangeStart
    const { data: records, error: recErr } = await svc
      .from("attendance_records")
      .select("student_id, session_date, attended_at")
      .gte("session_date", rangeStart.toISOString().slice(0, 10));
    if (recErr) return NextResponse.json({ error: recErr.message }, { status: 400 });

    // Index attendance by student and week index
    function weekIndexFor(dateStr: string): number | null {
      const d = new Date(dateStr + "T00:00:00Z");
      for (let i = 0; i < weekStarts.length; i++) {
        const start = weekStarts[i];
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 7);
        if (d >= start && d < end) return i;
      }
      return null;
    }

    const map: Record<string, { weeklyCounts: number[]; lastAttendedAt: string | null; total: number } > = {};
    for (const s of students || []) {
      map[s.id] = { weeklyCounts: new Array(weeks).fill(0), lastAttendedAt: null, total: 0 };
    }

    for (const r of records || []) {
      const idx = weekIndexFor(r.session_date);
      if (idx == null) continue;
      const m = map[r.student_id];
      if (!m) continue;
      m.weeklyCounts[idx] += 1; // count days in that week
      m.total += 1;
      if (!m.lastAttendedAt || r.attended_at > m.lastAttendedAt) m.lastAttendedAt = r.attended_at;
    }

    const weeksOut = weekStarts.map((w) => {
      const label = (() => {
        const month = w.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
        // Week number within month (1..5)
        const firstOfMonth = new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), 1));
        const firstWeekStart = getWeekStartUTC(firstOfMonth);
        const diffDays = Math.floor((w.getTime() - firstWeekStart.getTime()) / (7 * 24 * 3600 * 1000));
        const wn = diffDays + 1;
        return `W${wn}-${month}`;
      })();
      return { label, startDate: w.toISOString().slice(0, 10) };
    });

    const outStudents = (students || []).map((s: any) => ({
      student_id: s.id,
      code: s.code,
      student_name: s.student_name,
      weeklyCounts: map[s.id]?.weeklyCounts || new Array(weeks).fill(0),
      total: map[s.id]?.total || 0,
      lastAttendedAt: map[s.id]?.lastAttendedAt,
    }));

    // Non-attendees groups
    const nowISO = new Date().toISOString();
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const byStudentLast: Record<string, string | null> = {};
    for (const s of outStudents) byStudentLast[s.student_id] = s.lastAttendedAt ? s.lastAttendedAt.slice(0, 10) : null;

    const last2Weeks: any[] = [];
    const lastMonth: any[] = [];
    const threePlusMonths: any[] = [];

    for (const s of outStudents) {
      const last = byStudentLast[s.student_id];
      if (!last || last < threeMonthsAgo) { threePlusMonths.push({ id: s.student_id, code: s.code, student_name: s.student_name }); continue; }
      if (last < oneMonthAgo) { lastMonth.push({ id: s.student_id, code: s.code, student_name: s.student_name }); continue; }
      if (last < twoWeeksAgo) { last2Weeks.push({ id: s.student_id, code: s.code, student_name: s.student_name }); continue; }
    }

    return NextResponse.json({ weeks: weeksOut, students: outStudents, nonAttendees: { last2Weeks, lastMonth, threePlusMonths } });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function attendanceDeleteDELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const body = await req.json().catch(() => ({}));
    const { id } = body || {};

    if (!id) {
      return NextResponse.json({ error: "attendance_id_required" }, { status: 400 });
    }

    // Verify the attendance record exists and get student info for logging
    const { data: existingRecord, error: fetchErr } = await svc
      .from("attendance_records")
      .select("id, student_id, session_date, students(code, student_name)")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 });
    if (!existingRecord) return NextResponse.json({ error: "attendance_record_not_found" }, { status: 404 });

    // Delete the attendance record
    const { error: deleteErr } = await svc
      .from("attendance_records")
      .delete()
      .eq("id", id);

    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 400 });

    // Log the deletion for audit purposes
    const student = Array.isArray(existingRecord.students) ? existingRecord.students[0] : existingRecord.students;
    const auditData = {
      action: "delete_attendance",
      target_type: "attendance_record",
      target_id: id,
      changes: {
        student_id: existingRecord.student_id,
        student_name: student?.student_name,
        student_code: student?.code,
        session_date: existingRecord.session_date,
        deleted_by: admin.user_id,
        deleted_at: new Date().toISOString()
      }
    };

    // Optional: Insert audit log (if audit_logs table exists)
    try {
      await svc.from("audit_logs").insert(auditData);
    } catch (auditErr) {
      // Ignore audit errors to avoid blocking deletion
    }

    return NextResponse.json({ 
      success: true, 
      message: "Attendance record deleted successfully",
      deleted_record: {
        id: existingRecord.id,
        student_name: student?.student_name,
        student_code: student?.code,
        session_date: existingRecord.session_date
      }
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
