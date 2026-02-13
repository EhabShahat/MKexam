import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { parseUserAgent, formatDeviceInfo } from "@/lib/userAgent";
import { getDeviceUsageCount, getUsageCountForDevice } from "@/lib/deviceUsage";

export async function GET(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    // Try RPC first
    let rows: any[] | null = null;
    const rpc = await svc.rpc("admin_list_attempts", { p_exam_id: examId });
    if (!rpc.error && Array.isArray(rpc.data)) {
      rows = rpc.data as any[];
    }
    if (rpc.error) {
      // eslint-disable-next-line no-console
      console.warn("admin_list_attempts RPC failed (export), using fallback query:", rpc.error.message || rpc.error);
    }

    if (!rows) {
      // Fallback: join exam_attempts with students and exam_results to include score and device_info
      const fb = await svc
        .from("exam_attempts")
        .select("id, exam_id, student_id, ip_address, device_info, started_at, submitted_at, completion_status, students(student_name, code), exam_results(score_percentage)")
        .eq("exam_id", examId)
        .order("started_at", { ascending: false, nullsFirst: true });
      if (fb.error) return NextResponse.json({ error: fb.error.message }, { status: 400 });
      rows = (fb.data ?? []).map((a: any) => ({
        id: a.id,
        exam_id: a.exam_id,
        student_id: a.student_id,
        started_at: a.started_at,
        submitted_at: a.submitted_at,
        completion_status: a.completion_status,
        ip_address: a.ip_address,
        device_info: a.device_info,
        student_name: a?.students?.student_name ?? a?.student_name ?? null,
        score_percentage: a?.exam_results?.score_percentage ?? null,
      }));
    }

    // Calculate device usage counts
    const deviceUsageMap = getDeviceUsageCount(rows, examId);

    // Fetch stage progress for all attempts
    const stageProgressMap = new Map<string, any[]>();
    let maxStages = 0;
    
    // Check if exam has stages
    const stagesCheck = await svc.rpc('get_stage_analytics', { p_exam_id: examId });
    const hasStages = !stagesCheck.error && stagesCheck.data && stagesCheck.data.length > 0;
    
    if (hasStages) {
      // Fetch stage progress for each attempt
      for (const row of rows) {
        try {
          const progressRes = await svc.rpc('get_student_stage_progress', { p_attempt_id: row.id });
          if (!progressRes.error && progressRes.data) {
            stageProgressMap.set(row.id, progressRes.data);
            maxStages = Math.max(maxStages, progressRes.data.length);
          }
        } catch {
          // If fetch fails, continue without stage data
        }
      }
    }

    // Build headers dynamically based on max stages
    const baseHeaders = [
      "id",
      "student_name",
      "completion_status",
      "started_at",
      "submitted_at",
      "device_type",
      "device_model",
      "device_usage_count",
      "ip_address",
      "score_percentage",
    ];
    
    const stageHeaders: string[] = [];
    for (let i = 1; i <= maxStages; i++) {
      stageHeaders.push(
        `stage_${i}_type`,
        `stage_${i}_completed`,
        `stage_${i}_time_spent`,
        `stage_${i}_watch_pct`,
        `stage_${i}_avg_slide_time`,
        `stage_${i}_answered`
      );
    }
    
    const headers = [...baseHeaders, ...stageHeaders];

    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes("\"") || s.includes(",") || s.includes("\n")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const lines: string[] = [];
    lines.push(headers.join(","));
    for (const r of rows) {
      // Parse device info for export
      let deviceType = 'Unknown';
      let deviceModel = 'Unknown';
      let usageCount = '';
      
      if (r.device_info) {
        try {
          const parsed = JSON.parse(r.device_info);
          const deviceInfo = parsed.type ? parsed : parseUserAgent(parsed.userAgent || parsed.raw || '');
          deviceType = deviceInfo.type;
          deviceModel = `${deviceInfo.manufacturer} ${deviceInfo.model}`;
          const count = getUsageCountForDevice(deviceUsageMap, deviceInfo);
          usageCount = count > 1 ? String(count) : '';
        } catch {
          // Keep defaults
        }
      }
      
      const baseValues = [
        esc(r.id),
        esc(r.student_name),
        esc(r.completion_status),
        esc(r.started_at),
        esc(r.submitted_at),
        esc(deviceType),
        esc(deviceModel),
        esc(usageCount),
        esc(r.ip_address),
        esc(r.score_percentage ?? ""),
      ];
      
      // Add stage progress data
      const stageValues: string[] = [];
      const stageProgress = stageProgressMap.get(r.id) || [];
      
      for (let i = 0; i < maxStages; i++) {
        const stage = stageProgress[i];
        if (stage) {
          stageValues.push(
            esc(stage.stage_type || ''),
            esc(stage.completed_at ? 'Yes' : 'No'),
            esc(stage.time_spent_seconds ? `${Math.round(stage.time_spent_seconds)}s` : ''),
            esc(stage.stage_type === 'video' && stage.watch_percentage !== null ? `${Math.round(stage.watch_percentage)}%` : ''),
            esc(stage.stage_type === 'content' && stage.slide_times ? (() => {
              const slideTimes = Object.values(stage.slide_times);
              const avgSlideTime = slideTimes.length > 0
                ? slideTimes.reduce((sum: number, time: any) => sum + Number(time), 0) / slideTimes.length
                : 0;
              return avgSlideTime > 0 ? `${Math.round(avgSlideTime)}s` : '';
            })() : ''),
            esc(stage.stage_type === 'questions' && stage.answered_count !== null ? `${stage.answered_count}/${stage.total_count || 0}` : '')
          );
        } else {
          // Empty values for missing stages
          stageValues.push('', '', '', '', '', '');
        }
      }
      
      lines.push([...baseValues, ...stageValues].join(","));
    }
    const csv = lines.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=attempts_${examId}.csv`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
