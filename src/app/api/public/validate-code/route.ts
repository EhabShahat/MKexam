import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code")?.trim() || "";

    // Enforce 4-digit numeric format
    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json({ valid: false, reason: "format" });
    }

    const svc = supabaseServer();

    // Head count query to avoid returning any sensitive data
    const { error, count } = await svc
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("code", code);

    if (error) {
      // Graceful fallbacks for missing table/column
      if (error.code === "42P01" /* undefined_table */ || error.code === "42703" /* undefined_column */) {
        return NextResponse.json({ valid: false });
      }
      console.error("validate-code error:", error);
      return NextResponse.json({ valid: false }, { status: 500 });
    }

    return NextResponse.json({ valid: (count ?? 0) > 0 });
  } catch (e) {
    console.error("Unexpected error in validate-code:", e);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
