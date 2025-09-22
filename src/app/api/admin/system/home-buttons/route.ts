import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

const KEYS = ["home_button_exams", "home_button_results"] as const;

type Keys = typeof KEYS[number];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const { data, error } = await svc.from("app_config").select("key, value").in("key", KEYS as unknown as string[]);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const map = new Map<string, string | null>();
    for (const row of data || []) {
      map.set((row as any).key, (row as any).value);
    }

    return NextResponse.json({
      exams: map.get("home_button_exams") === "true" ? true : map.has("home_button_exams") ? false : null,
      results: map.get("home_button_results") === "true" ? true : map.has("home_button_results") ? false : null,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const toUpsert: Array<{ key: Keys; value: string; updated_at: string }> = [];

    // Handle explicit boolean values -> upsert
    if (typeof body.exams === "boolean") {
      toUpsert.push({ key: "home_button_exams", value: body.exams ? "true" : "false", updated_at: now });
    }
    if (typeof body.results === "boolean") {
      toUpsert.push({ key: "home_button_results", value: body.results ? "true" : "false", updated_at: now });
    }

    // Handle null -> delete key to fall back to Auto
    if (body.exams === null) {
      const del = await svc.from("app_config").delete().eq("key", "home_button_exams");
      if (del.error) return NextResponse.json({ error: del.error.message }, { status: 400 });
    }
    if (body.results === null) {
      const del = await svc.from("app_config").delete().eq("key", "home_button_results");
      if (del.error) return NextResponse.json({ error: del.error.message }, { status: 400 });
    }

    if (toUpsert.length > 0) {
      const { error } = await svc.from("app_config").upsert(toUpsert as any);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
