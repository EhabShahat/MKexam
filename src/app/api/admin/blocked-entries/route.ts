import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createClient();

    const { data, error } = await supabase
      .from("blocked_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch blocked entries error:", error);
      return NextResponse.json(
        { error: "Failed to fetch blocked entries" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Get blocked entries error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { type, value, reason } = await request.json();

    if (!type || !value) {
      return NextResponse.json(
        { error: "Type and value are required" },
        { status: 400 }
      );
    }

    if (!["name", "ip"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'name' or 'ip'" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Check if entry already exists
    const { data: existing } = await supabase
      .from("blocked_entries")
      .select("id")
      .eq("type", type)
      .eq("value", value.trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "This entry is already blocked" },
        { status: 409 }
      );
    }

    // Add new blocked entry
    const { data, error } = await supabase
      .from("blocked_entries")
      .insert({
        type,
        value: value.trim(),
        reason: reason?.trim() || null,
        created_by: admin.email || admin.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Add blocked entry error:", error);
      return NextResponse.json(
        { error: "Failed to add blocked entry" },
        { status: 500 }
      );
    }

    // Log the admin action
    await logAdminAction({
      admin_id: admin.id,
      action: "block_entry",
      resource_type: "blocked_entry",
      resource_id: data.id,
      details: {
        type,
        value: value.trim(),
        reason: reason?.trim(),
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Add blocked entry error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}