import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function dashboardGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    // Proactively mark any ended published exams as 'done'
    try {
      await svc.rpc("mark_done_exams");
    } catch (e) {
      // Non-fatal; dashboard should still load
      // eslint-disable-next-line no-console
      console.warn("mark_done_exams RPC failed:", (e as any)?.message || e);
    }

    const examsQuery = await svc
      .from("exams")
      .select(`
        *,
        questions(count),
        exam_attempts(count)
      `)
      .order("created_at", { ascending: false });
    if (examsQuery.error) {
      console.error("Exams query error:", examsQuery.error);
      return NextResponse.json({ error: examsQuery.error.message }, { status: 400 });
    }

    const exams = (examsQuery.data || []).map((exam: any) => ({
      ...exam,
      question_count: exam?.questions?.[0]?.count || 0,
      attempt_count: exam?.exam_attempts?.[0]?.count || 0,
    }));

    const activeExam = exams.find((exam: any) => exam.status === "published") || null;

    const configKeys = ["system_disabled", "system_disabled_message", "system_mode"] as const;
    const configQuery = await svc
      .from("app_config")
      .select("key, value")
      .in("key", configKeys as unknown as string[]);
    if (configQuery.error) {
      console.warn("Config query error:", configQuery.error);
    }

    const configMap = new Map<string, string>();
    for (const row of (configQuery.data || []) as any[]) {
      configMap.set(row.key, row.value);
    }

    const appSettingsQuery = await svc
      .from("app_settings")
      .select("enable_multi_exam")
      .limit(1)
      .maybeSingle();
    const appSettings = {
      enable_multi_exam: appSettingsQuery.data?.enable_multi_exam ?? true,
    };

    const legacyDisabled = configMap.get("system_disabled") === "true";
    const mode = (configMap.get("system_mode") as "exam" | "results" | "disabled" | undefined)
      || (legacyDisabled ? "disabled" : "exam");
    const systemStatus = {
      mode,
      isDisabled: mode === "disabled",
      disableMessage: configMap.get("system_disabled_message") || "No exams are currently available. Please check back later.",
    } as { mode: "exam" | "results" | "disabled"; isDisabled: boolean; disableMessage: string };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeAttemptsQuery = await svc
      .from("exam_attempts")
      .select("id", { count: "exact", head: true })
      .is("submitted_at", null);
    const completedTodayQuery = await svc
      .from("exam_attempts")
      .select("id", { count: "exact", head: true })
      .not("submitted_at", "is", null)
      .gte("submitted_at", today.toISOString());

    const stats = {
      totalExams: exams.length,
      activeAttempts: activeAttemptsQuery.count || 0,
      completedToday: completedTodayQuery.count || 0,
    };

    return new NextResponse(
      JSON.stringify({ exams, activeExam, stats, systemStatus, appSettings }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
