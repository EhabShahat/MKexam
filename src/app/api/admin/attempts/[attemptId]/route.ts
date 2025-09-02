import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { auditLog } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    await requireAdmin(request);
    const { attemptId } = await params;

    if (!attemptId) {
      return NextResponse.json(
        { error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from("exam_attempts")
      .select(
        "id, student_name, ip_address, completion_status, started_at, submitted_at, students(student_name)"
      )
      .eq("id", attemptId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const item = {
      id: (data as any).id,
      student_name:
        (data as any).students?.student_name ?? (data as any).student_name ?? null,
      completion_status: (data as any).completion_status ?? null,
      started_at: (data as any).started_at ?? null,
      submitted_at: (data as any).submitted_at ?? null,
      ip_address: (data as any).ip_address ?? null,
      // Placeholder for IP history; UI will handle empty array gracefully
      ips: [] as Array<{ created_at: string; ip_address: string }>,
    };

    return NextResponse.json({ item });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { error: e?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { attemptId } = await params;

    if (!attemptId) {
      return NextResponse.json(
        { error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // First, get the attempt details for logging
    const { data: attempt, error: fetchError } = await supabase
      .from("exam_attempts")
      .select(`
        id,
        student_name,
        exam:exams(title)
      `)
      .eq("id", attemptId)
      .single();

    if (fetchError || !attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    // Delete the attempt (this will cascade to related records)
    const { error: deleteError } = await supabase
      .from("exam_attempts")
      .delete()
      .eq("id", attemptId);

    if (deleteError) {
      console.error("Delete attempt error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete attempt" },
        { status: 500 }
      );
    }

    // Log the admin action
    await auditLog(admin.user_id, "delete_attempt", {
      resource_type: "attempt",
      resource_id: attemptId,
      student_name: attempt.student_name,
      exam_title: (attempt.exam as any)?.title,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("Delete attempt error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal server error" },
      { status: 500 }
    );
  }
}