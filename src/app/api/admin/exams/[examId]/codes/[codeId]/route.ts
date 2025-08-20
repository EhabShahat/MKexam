import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

// GET: Retrieve a specific student for an exam
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ examId: string; codeId: string }> }
) {
  const { examId, codeId } = await ctx.params;
  await requireAdmin(request);
  const token = await getBearerToken(request);
  const supabase = supabaseServer(token || undefined);

  // Verify the exam exists
  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .single();

  if (examError || !exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  // Get the student with their exam attempt status
  const { data: student, error } = await supabase
    .from("student_exam_summary")
    .select("*")
    .eq("exam_id", examId)
    .eq("code", codeId)
    .single();

  if (error) {
    console.error("Error fetching student for exam:", error);
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({ student });
}

// DELETE: Remove a student from an exam
export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ examId: string; codeId: string }> }
) {
  const { examId, codeId } = await ctx.params;
  await requireAdmin(request);
  const token = await getBearerToken(request);
  const supabase = supabaseServer(token || undefined);

  // Verify the exam exists
  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .single();

  if (examError || !exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  // First, get the student ID from the code
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("code", codeId)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Remove the student from the exam_students table
  const { error: unlinkError } = await supabase
    .from("exam_students")
    .delete()
    .eq("exam_id", examId)
    .eq("student_id", student.id);

  if (unlinkError) {
    console.error("Error removing student from exam:", unlinkError);
    return NextResponse.json(
      { error: "Failed to remove student from exam" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

// PATCH: Update a student's details for an exam
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ examId: string; codeId: string }> }
) {
  const { examId, codeId } = await ctx.params;
  await requireAdmin(request);
  const token = await getBearerToken(request);
  const supabase = supabaseServer(token || undefined);

  // Verify the exam exists
  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .single();

  if (examError || !exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { student_name, mobile_number, code } = body;

    // First, update the student in the global students table
    // We'll use the global student API for this
    const studentUpdateRes = await fetch(
      new URL(`/api/admin/students/${codeId}`, request.url).toString(),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          // Forward authorization headers
          ...Object.fromEntries(
            [...request.headers.entries()].filter(
              ([key]) =>
                key.toLowerCase() === "authorization" ||
                key.toLowerCase() === "cookie"
            )
          ),
        },
        body: JSON.stringify({ student_name, mobile_number, code }),
      }
    );

    if (!studentUpdateRes.ok) {
      const errorData = await studentUpdateRes.json();
      return NextResponse.json(
        { error: errorData.error || "Failed to update student" },
        { status: studentUpdateRes.status }
      );
    }

    const result = await studentUpdateRes.json();
    return NextResponse.json({ student: result.student });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}