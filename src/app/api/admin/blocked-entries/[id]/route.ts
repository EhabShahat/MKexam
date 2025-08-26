import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Entry ID is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get entry details for logging
    const { data: entry, error: fetchError } = await supabase
      .from("blocked_entries")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !entry) {
      return NextResponse.json(
        { error: "Blocked entry not found" },
        { status: 404 }
      );
    }

    // Delete the entry
    const { error: deleteError } = await supabase
      .from("blocked_entries")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete blocked entry error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete blocked entry" },
        { status: 500 }
      );
    }

    // Log the admin action
    await logAdminAction({
      admin_id: admin.id,
      action: "unblock_entry",
      resource_type: "blocked_entry",
      resource_id: id,
      details: {
        type: entry.type,
        value: entry.value,
        reason: entry.reason,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete blocked entry error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}