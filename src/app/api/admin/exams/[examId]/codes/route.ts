import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

// GET: Retrieve all students for a specific exam
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
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

  // Get all students with their exam attempt status for this exam
  const { data: students, error } = await supabase
    .from("student_exam_summary")
    .select("*")
    .eq("exam_id", examId);

  if (error) {
    console.error("Error fetching students for exam:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }

  return NextResponse.json({ students });
}

// POST: Add students to an exam
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
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
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid request format. Expected 'items' array." },
        { status: 400 }
      );
    }

    // First, ensure all students exist in the global students table
    // We'll use the bulk API for this
    const studentsRes = await fetch(new URL("/api/admin/students/bulk", request.url).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward authorization headers
        ...Object.fromEntries(
          [...request.headers.entries()].filter(([key]) => 
            key.toLowerCase() === "authorization" || key.toLowerCase() === "cookie"
          )
        )
      },
      body: JSON.stringify({ items })
    });

    if (!studentsRes.ok) {
      const errorData = await studentsRes.json();
      return NextResponse.json(
        { error: errorData.error || "Failed to add students" },
        { status: studentsRes.status }
      );
    }

    const studentsResult = await studentsRes.json();
    
    // Now, link these students to the exam in the exam_students table
    // First, get the student codes that were successfully added
    const { data: existingStudents } = await supabase
      .from("students")
      .select("id, code")
      .in("code", items.map(item => item.code || "").filter(Boolean));

    // For items without codes, we need to query by name and mobile
    const studentsWithoutCodes = items.filter(item => !item.code);
    let additionalStudents = [];
    
    if (studentsWithoutCodes.length > 0) {
      // This is a simplification - in a real app, you'd need more robust matching
      for (const item of studentsWithoutCodes) {
        const { data } = await supabase
          .from("students")
          .select("id, code")
          .eq("student_name", item.student_name)
          .eq("mobile_number", item.mobile_number || "")
          .limit(1);
          
        if (data && data.length > 0) {
          additionalStudents.push(data[0]);
        }
      }
    }

    const allStudents = [...(existingStudents || []), ...additionalStudents];
    
    // Insert into exam_students table, ignoring duplicates
    const { error: linkError } = await supabase
      .from("exam_students")
      .upsert(
        allStudents.map(student => ({
          exam_id: examId,
          student_id: student.id
        })),
        { onConflict: "exam_id,student_id" }
      );

    if (linkError) {
      console.error("Error linking students to exam:", linkError);
      return NextResponse.json(
        { error: "Failed to link students to exam" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: studentsResult.success,
      errors: studentsResult.errors,
      message: `Successfully linked ${allStudents.length} students to exam`
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}