import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function examsIdCodesGET(req: NextRequest, examId: string) {
  await requireAdmin(req);
  const token = await getBearerToken(req);
  const supabase = supabaseServer(token || undefined);

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .single();
  if (examError || !exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const { data: rows, error } = await supabase
    .from("student_exam_attempts")
    .select(`
      exam_id,
      student_id,
      status,
      attempt_id,
      started_at,
      completed_at,
      students ( id, code, student_name, mobile_number, created_at )
    `)
    .eq("exam_id", examId)
    .order("started_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });

  const students = (rows || []).map((r: any) => ({
    exam_id: r.exam_id,
    student_id: r.student_id,
    code: r.students?.code || null,
    student_name: r.students?.student_name || null,
    mobile_number: r.students?.mobile_number || null,
    student_created_at: r.students?.created_at || null,
    status: r.status,
    attempt_id: r.attempt_id,
    started_at: r.started_at,
    completed_at: r.completed_at,
  }));

  return NextResponse.json({ students });
}

export async function examsIdCodesPOST(req: NextRequest, examId: string) {
  await requireAdmin(req);
  const token = await getBearerToken(req);
  const supabase = supabaseServer(token || undefined);

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .single();
  if (examError || !exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  try {
    const body = await req.json();
    const { items } = body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid request format. Expected 'items' array." },
        { status: 400 }
      );
    }

    const studentsRes = await fetch(new URL("/api/admin/students/bulk", req.url).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          [...req.headers.entries()].filter(([key]) =>
            key.toLowerCase() === "authorization" || key.toLowerCase() === "cookie"
          )
        ),
      },
      body: JSON.stringify({ students: items }),
    });

    if (!studentsRes.ok) {
      const errorData = await studentsRes.json();
      return NextResponse.json(
        { error: errorData.error || "Failed to add students" },
        { status: studentsRes.status }
      );
    }

    const studentsResult = await studentsRes.json();
    return NextResponse.json({
      success: studentsResult.success,
      errors: studentsResult.errors,
      message: `Successfully ensured ${Array.isArray(items) ? items.length : 0} students exist in public.students`,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function examsIdCodesCodeIdGET(req: NextRequest, examId: string, codeId: string) {
  await requireAdmin(req);
  const token = await getBearerToken(req);
  const supabase = supabaseServer(token || undefined);

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .single();
  if (examError || !exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const { data: rows, error } = await supabase
    .from("student_exam_attempts")
    .select(`
      exam_id,
      student_id,
      status,
      attempt_id,
      started_at,
      completed_at,
      students!inner(id, code, student_name, mobile_number, created_at)
    `)
    .eq("exam_id", examId)
    .eq("students.code", codeId)
    .limit(1);
  if (error) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  let student: any;
  if (rows && rows.length > 0) {
    const r: any = rows[0];
    student = {
      exam_id: r.exam_id,
      student_id: r.student_id,
      code: r.students?.code || null,
      student_name: r.students?.student_name || null,
      mobile_number: r.students?.mobile_number || null,
      student_created_at: r.students?.created_at || null,
      status: r.status,
      attempt_id: r.attempt_id,
      started_at: r.started_at,
      completed_at: r.completed_at,
    };
  } else {
    const { data: s, error: sErr } = await supabase
      .from("students")
      .select("id, code, student_name, mobile_number, created_at")
      .eq("code", codeId)
      .single();
    if (sErr || !s) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    student = {
      exam_id: examId,
      student_id: s.id,
      code: s.code,
      student_name: s.student_name,
      mobile_number: s.mobile_number,
      student_created_at: s.created_at,
      status: null,
      attempt_id: null,
      started_at: null,
      completed_at: null,
    };
  }

  return NextResponse.json({ student });
}

export async function examsIdCodesCodeIdPATCH(req: NextRequest, _examId: string, codeId: string) {
  await requireAdmin(req);
  const studentUpdateRes = await fetch(new URL(`/api/admin/students/${codeId}`, req.url).toString(), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...Object.fromEntries(
        [...req.headers.entries()].filter(
          ([key]) => key.toLowerCase() === "authorization" || key.toLowerCase() === "cookie"
        )
      ),
    },
    body: await req.text(),
  });
  if (!studentUpdateRes.ok) {
    const errorData = await studentUpdateRes.json();
    return NextResponse.json({ error: errorData.error || "Failed to update student" }, { status: studentUpdateRes.status });
  }
  const result = await studentUpdateRes.json();
  return NextResponse.json({ student: result.student });
}

export async function examsIdCodesCodeIdDELETE(req: NextRequest, examId: string, codeId: string) {
  await requireAdmin(req);
  const token = await getBearerToken(req);
  const supabase = supabaseServer(token || undefined);

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .single();
  if (examError || !exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("code", codeId)
    .single();
  if (studentError || !student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const { error: unlinkError } = await supabase
    .from("student_exam_attempts")
    .delete()
    .eq("exam_id", examId)
    .eq("student_id", student.id);
  if (unlinkError) return NextResponse.json({ error: "Failed to remove student from exam" }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function examsIdCodesClearPOST(req: NextRequest, examId: string) {
  await requireAdmin(req);
  const token = await getBearerToken(req);
  const supabase = supabaseServer(token || undefined);

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .single();
  if (examError || !exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const { error: clearError } = await supabase
    .from("student_exam_attempts")
    .delete()
    .eq("exam_id", examId);
  if (clearError) return NextResponse.json({ error: "Failed to clear students from exam" }, { status: 500 });

  return NextResponse.json({ success: true });
}
