import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/ip";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin";

// POST /api/admin/cleanup-attempts/by-ip { examId }
export async function attemptsCleanupByIpPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = supabaseServer();
    const hdrs = await headers();
    const clientIp = getClientIp(hdrs);

    const { examId } = await req.json().catch(() => ({}));
    if (!examId) {
      return NextResponse.json({ error: "examId required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("exam_attempts")
      .delete()
      .eq("exam_id", examId)
      .eq("ip_address", clientIp);

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to clear attempts",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cleared all attempts from IP ${clientIp} for exam ${examId}`,
      ip: clientIp,
    });
  } catch (e: any) {
    if (e instanceof Response) return e; // propagate 401/403 from requireAdmin
    return NextResponse.json(
      {
        error: "Clear attempts failed",
        message: e?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
