import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Keep attempts mutation endpoints on Node runtime (upload, save, submit, activity)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Utility for activity: tolerant JSON body parsing
async function readBody(req: NextRequest): Promise<any> {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      return await req.json();
    }
    const text = await req.text();
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  } catch {
    return {};
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string; action: string }> }
) {
  const { attemptId, action } = await ctx.params;
  try {
    if (!attemptId) return NextResponse.json({ error: "missing_attempt_id" }, { status: 400 });

    switch (action) {
      case "activity": {
        const body = await readBody(req);
        const events: any[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.events)
            ? body.events
            : Array.isArray(body?.batch)
              ? body.batch
              : [];
        if (!Array.isArray(events) || events.length === 0) {
          return NextResponse.json({ inserted_count: 0 });
        }
        const supabase = supabaseServer();
        const { data, error } = await supabase.rpc("log_attempt_activity", {
          p_attempt_id: attemptId,
          p_events: events,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        const row = Array.isArray(data) ? data[0] : data;
        return NextResponse.json({ inserted_count: row?.inserted_count ?? 0 });
      }

      case "submit": {
        const supabase = supabaseServer();
        const { data, error } = await supabase.rpc("submit_attempt", { p_attempt_id: attemptId });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        // Best-effort: reflect completion in student_exam_attempts for UI listings
        try {
          const { error: updErr } = await supabase
            .from("student_exam_attempts")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("attempt_id", attemptId);
          if (updErr) {
            // eslint-disable-next-line no-console
            console.error("Failed to update student_exam_attempts status to completed:", updErr.message || updErr);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Failed to update student_exam_attempts status to completed:", e);
        }

        const row = Array.isArray(data) ? data[0] : data;
        return NextResponse.json({
          total_questions: row?.total_questions ?? 0,
          correct_count: row?.correct_count ?? 0,
          score_percentage: row?.score_percentage ?? 0,
        });
      }

      case "upload": {
        const formData = await req.formData();
        const file = formData.get("image") as File | null;
        if (!file) return NextResponse.json({ error: "no_file" }, { status: 400 });
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
          return NextResponse.json({ error: "invalid_type" }, { status: 400 });
        }
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

        const svc = supabaseServer();
        // Validate attempt exists and is not submitted
        const att = await svc
          .from("exam_attempts")
          .select("id, completion_status")
          .eq("id", attemptId)
          .maybeSingle();
        if (att.error) return NextResponse.json({ error: att.error.message }, { status: 400 });
        if (!att.data) return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
        if ((att.data as any).completion_status === "submitted") {
          return NextResponse.json({ error: "attempt_submitted" }, { status: 400 });
        }

        const ts = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        const ext = (file.name.split(".").pop() || "png").toLowerCase();
        const path = `attempts/${attemptId}/ans-${ts}-${rand}.${ext}`;

        const bytes = new Uint8Array(await file.arrayBuffer());
        const { error: uploadErr } = await svc.storage
          .from("answer-images")
          .upload(path, bytes, { contentType: file.type, upsert: false });
        if (uploadErr) return NextResponse.json({ error: uploadErr.message || "upload_failed" }, { status: 500 });

        const { data: urlData } = svc.storage.from("answer-images").getPublicUrl(path);
        const url = (urlData as any)?.publicUrl;
        if (!url) return NextResponse.json({ error: "url_error" }, { status: 500 });
        return NextResponse.json({ ok: true, url, path });
      }

      default:
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string; action: string }> }
) {
  const { attemptId, action } = await ctx.params;
  try {
    if (action !== "save") {
      return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
    }
    const body = await req.json().catch(() => ({}));
    const { answers, auto_save_data, expected_version } = body || {};

    const supabase = supabaseServer();
    const { data, error } = await supabase.rpc("save_attempt", {
      p_attempt_id: attemptId,
      p_answers: answers ?? {},
      p_auto_save_data: auto_save_data ?? {},
      p_expected_version: expected_version ?? 1,
    });

    if (error) {
      if (error.message && error.message.includes("version_mismatch")) {
        const latest = await supabase.rpc("get_attempt_state", { p_attempt_id: attemptId });
        return NextResponse.json({ error: "version_mismatch", latest: (latest as any).data }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ new_version: row?.new_version ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
