import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

interface ValidateCodeRequest {
  code: string;
}

interface ValidateCodeResponse {
  valid: boolean;
  studentId?: string;
  studentName?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ValidateCodeResponse>> {
  try {
    const body = await request.json() as ValidateCodeRequest;
    const code = body.code?.trim();

    // Validate code format
    if (!code) {
      return NextResponse.json({ valid: false });
    }

    const svc = supabaseServer();

    // Query Supabase to find student by code
    const { data: students, error } = await svc
      .from("students")
      .select("id, student_name")
      .eq("code", code)
      .limit(1);

    if (error) {
      console.error("validate-code error:", error);
      return NextResponse.json({ valid: false }, { status: 500 });
    }

    // If no student found, return invalid
    if (!students || students.length === 0) {
      return NextResponse.json({ valid: false });
    }

    const student = students[0];

    // Return valid with student information
    return NextResponse.json({
      valid: true,
      studentId: student.id,
      studentName: student.student_name,
    });
  } catch (e) {
    console.error("Unexpected error in validate-code:", e);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
