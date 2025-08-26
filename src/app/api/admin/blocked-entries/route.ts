import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { auditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const supabase = supabaseServer();

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
    const admin = await requireAdmin(request);
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

    const supabase = supabaseServer();

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
        created_by: admin.email || admin.user_id,
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
    await auditLog(admin.user_id, "block_entry", {
      resource_type: "blocked_entry",
      resource_id: data.id,
      type,
      value: value.trim(),
      reason: reason?.trim(),
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