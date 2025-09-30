import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function examInfoGET(examId: string) {
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("exams")
      .select("id, title, description, access_type, start_time, end_time, duration_minutes, status")
      .eq("id", examId)
      .eq("status", "done")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}
