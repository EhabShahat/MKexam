import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function activeExamGET(_req: NextRequest) {
  try {
    const svc = supabaseServer();
    const { data, error } = await svc
      .from("exams")
      .select("id, title, status, start_time, end_time, access_type, created_at")
      .eq("status", "published")
      .order("start_time", { ascending: true, nullsFirst: true });

    if (error) {
      return NextResponse.json({
        error: {
          message: (error as any).message,
          code: (error as any).code,
          details: (error as any).details,
        },
      }, { status: 400 });
    }

    const now = new Date();
    const list = (data || []).map((e: any) => {
      const start = e.start_time ? new Date(e.start_time as any) : null;
      const end = e.end_time ? new Date(e.end_time as any) : null;
      const notStarted = !!(start && now < start);
      const ended = !!(end && now > end);
      const isActive = !notStarted && !ended;
      return { ...e, is_active: isActive, not_started: notStarted, ended };
    });

    const firstActive = list.find((e: any) => e.is_active) || list[0] || null;
    const activeExam = firstActive
      ? {
          id: firstActive.id,
          title: firstActive.title,
          status: firstActive.status,
          start_time: firstActive.start_time,
          end_time: firstActive.end_time,
          access_type: firstActive.access_type,
          created_at: (firstActive as any).created_at,
        }
      : null;

    const startTime = (firstActive?.start_time ? new Date(firstActive.start_time as any) : null) as Date | null;
    const endTime = (firstActive?.end_time ? new Date(firstActive.end_time as any) : null) as Date | null;
    const isNotStarted = !!(startTime && now < startTime);
    const isEnded = !!(endTime && now > endTime);
    const isActive = !!firstActive && !isNotStarted && !isEnded;

    return NextResponse.json({
      activeExam,
      activeExams: list,
      isActive,
      timeCheck: activeExam
        ? {
            now: now.toISOString(),
            startTime: startTime ? startTime.toISOString() : null,
            endTime: endTime ? endTime.toISOString() : null,
            isNotStarted,
            isEnded,
          }
        : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
