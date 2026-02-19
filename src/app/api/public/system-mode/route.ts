import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getCachedAppConfigs } from "@/lib/cachedQueries";

// GET /api/public/system-mode
// Returns the current tri-state mode and disabled message for public consumption.
export async function GET() {
  try {
    const svc = supabaseServer();

    // Use cached app config values (30 minute TTL)
    const configs = await getCachedAppConfigs(
      ["system_mode", "system_disabled", "system_disabled_message"],
      svc
    );

    const legacyDisabled = configs.system_disabled === "true";
    const mode = (configs.system_mode as "exam" | "results" | "disabled" | undefined) || (legacyDisabled ? "disabled" : "exam");
    const message = configs.system_disabled_message || "No exams are currently available. Please check back later.";

    return NextResponse.json({ mode, message }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ mode: "exam", message: null, error: e?.message || "unexpected_error" }, { status: 200 });
  }
}
