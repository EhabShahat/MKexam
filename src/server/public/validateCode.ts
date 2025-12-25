import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCodeFormatSettings, validateCodeFormat } from "@/lib/codeGenerator";

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
      const { data: stuRows, error: stuErr } = await svc
        .from("students")
        .select("id")
        .eq("code", code)
        .limit(1);

      if (stuErr) {
        if ((stuErr as any).code === "42P01" || (stuErr as any).code === "42703") {
          return NextResponse.json({ valid: false });
        }
        console.error("validate-code students error:", stuErr);
        return NextResponse.json({ valid: false }, { status: 500 });
      }

      if (!stuRows || stuRows.length === 0) {
        return NextResponse.json({ valid: false, reason: "not_found" });
      }

      const studentId = (stuRows[0] as { id: string }).id;

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

    const { error: existsErr, count: existsCount } = await svc
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("code", code);

    if (existsErr) {
      if ((existsErr as any).code === "42P01" || (existsErr as any).code === "42703") {
        return NextResponse.json({ valid: false });
      }
      console.error("validate-code exists-check error:", existsErr);
      return NextResponse.json({ valid: false }, { status: 500 });
    }

    return NextResponse.json({ valid: (existsCount ?? 0) > 0 });
  } catch (e) {
    console.error("Unexpected error in validate-code:", e);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
