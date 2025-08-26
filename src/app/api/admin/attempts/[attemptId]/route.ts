import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { attemptId: string } }
) {
  try {
    const admin = await requireAdmin();
    const { attemptId } = params;

    if (!attemptId) {
      return NextResponse.json(
        { error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // First, get the attempt details for logging
    const { data: attempt, error: fetchError } = await supabase
      .from("attempts")
      .select(`
        id,
        student_name,
        student_email,
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
      .from("attempts")
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
    await logAdminAction({
      admin_id: admin.id,
      action: "delete_attempt",
      resource_type: "attempt",
      resource_id: attemptId,
      details: {
        student_name: attempt.student_name,
        student_email: attempt.student_email,
        exam_title: (attempt.exam as any)?.title,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete attempt error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}