import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function examsGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const url = new URL(req.url);
    const q = url.searchParams.get("q");

    let query = svc
      .from("exams")
      .select("*" as const)
      .order("created_at", { ascending: false }); // Show all exams, newest first
    if (q) query = query.ilike("title", `%${q}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: data });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function examsPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const {
      title,
      description = null,
      start_time,
      end_time,
      duration_minutes,
      status = "draft",
      access_type = "open",
      settings = {},
    } = body || {};

    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    // Determine scheduling mode: Auto if both times set, Manual otherwise
    const scheduling_mode = (start_time && end_time) ? 'Auto' : 'Manual';

    const { data, error } = await svc
      .from("exams")
      .insert({ 
        title, 
        description, 
        start_time, 
        end_time, 
        duration_minutes, 
        status, 
        access_type, 
        settings,
        scheduling_mode,
        is_manually_published: false,
        is_archived: false
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
