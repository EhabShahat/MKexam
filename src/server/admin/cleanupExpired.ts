import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function cleanupExpiredPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = supabaseServer();

    const { data, error } = await supabase.rpc("cleanup_expired_attempts");
    if (error) {
      console.error("Cleanup expired attempts error:", error);
      return NextResponse.json({ error: (error as any).message }, { status: 500 });
    }

    const autoSubmittedCount = Array.isArray(data)
      ? (data as any[])[0]?.auto_submitted_count || 0
      : (data as any)?.auto_submitted_count || 0;

    // Also mark ended exams as 'done'
    const { data: doneData, error: doneErr } = await supabase.rpc("mark_done_exams");
    if (doneErr) {
      console.error("Mark done exams error:", doneErr);
    }
    const doneCount = Array.isArray(doneData)
      ? (doneData as any[])[0]?.updated_count || 0
      : (doneData as any)?.updated_count || 0;

    return NextResponse.json({
      success: true,
      auto_submitted_count: autoSubmittedCount,
      done_updated_count: doneCount,
      message: `Auto-submitted ${autoSubmittedCount} expired attempts; marked ${doneCount} exams as done`,
    });
  } catch (error: any) {
    console.error("Cleanup expired attempts error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
