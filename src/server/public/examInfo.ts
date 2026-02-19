import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCachedExamMetadata } from "@/lib/cachedQueries";

export async function examInfoGET(examId: string) {
  try {
    const supabase = supabaseServer();
    
    // Use cached exam metadata (5 minute TTL)
    const data = await getCachedExamMetadata(examId, supabase);

    if (!data || data.status !== "done" || data.is_archived) {
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
