import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCodeFormatSettings, validateCodeFormat } from "@/lib/codeGenerator";
import { getCachedStudentCodeValidation } from "@/lib/cachedQueries";

export async function validateCodeGET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code")?.trim() || "";
    const examId = request.nextUrl.searchParams.get("examId")?.trim() || null;

    const codeSettings = await getCodeFormatSettings();
    if (!validateCodeFormat(code, codeSettings)) {
      return NextResponse.json({ valid: false, reason: "format" });
    }

    const svc = supabaseServer();

    if (examId) {
      // Use cached student code validation (10 minute TTL)
      const validation = await getCachedStudentCodeValidation(code, svc);
      
      if (!validation.isValid) {
        return NextResponse.json({ valid: false, reason: "not_found" });
      }

      const studentId = validation.studentId!;

      const { count: attCount, error: attErr } = await svc
        .from("student_exam_attempts")
        .select("id", { count: "exact", head: true })
        .eq("exam_id", examId)
        .eq("student_id", studentId);

      if (attErr) {
        if ((attErr as any).code === "42P01" || (attErr as any).code === "42703") {
          return NextResponse.json({ valid: false });
        }
        console.error("validate-code attempts error:", attErr);
        return NextResponse.json({ valid: false }, { status: 500 });
      }

      if ((attCount ?? 0) > 0) {
        return NextResponse.json({ valid: false, reason: "used" });
      }
      return NextResponse.json({ valid: true });
    }

    // Use cached student code validation for existence check
    const validation = await getCachedStudentCodeValidation(code, svc);
    return NextResponse.json({ valid: validation.isValid });
  } catch (e) {
    console.error("Unexpected error in validate-code:", e);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
