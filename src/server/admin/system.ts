import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

async function getSvc(req: NextRequest) {
  const token = await getBearerToken(req);
  // Old routes used supabaseServer(token || undefined)
  return supabaseServer(token || undefined);
}

export async function systemModePOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = await getSvc(req);

    const body = await req.json();
    const mode = body?.mode as 'exam' | 'results' | 'disabled' | undefined;
    const message = (body?.message as string | undefined)?.trim();

    if (!mode || !['exam', 'results', 'disabled'].includes(mode)) {
      return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
    }

    const upserts: Array<{ key: string; value: string; updated_at: string }> = [
      { key: 'system_mode', value: mode, updated_at: new Date().toISOString() },
      { key: 'system_disabled', value: mode === 'disabled' ? 'true' : 'false', updated_at: new Date().toISOString() },
    ];
    if (mode === 'disabled' && message) {
      upserts.push({ key: 'system_disabled_message', value: message, updated_at: new Date().toISOString() });
    }

    const { error } = await svc.from('app_config').upsert(upserts);
    if (error) return NextResponse.json({ error: (error as any).message }, { status: 400 });

    return NextResponse.json({ success: true, mode });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || 'unexpected_error' }, { status: 500 });
  }
}

export async function systemEnablePOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = await getSvc(req);

    const result = await svc
      .from('app_config')
      .upsert({ key: 'system_disabled', value: 'false', updated_at: new Date().toISOString() });

    if (result.error) return NextResponse.json({ error: (result.error as any).message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || 'unexpected_error' }, { status: 500 });
  }
}

export async function systemDisablePOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = await getSvc(req);
    const { message } = await req.json();

    const disableResult = await svc
      .from('app_config')
      .upsert({ key: 'system_disabled', value: 'true', updated_at: new Date().toISOString() });
    if (disableResult.error) return NextResponse.json({ error: (disableResult.error as any).message }, { status: 400 });

    const messageResult = await svc
      .from('app_config')
      .upsert({ key: 'system_disabled_message', value: message || 'No exams are currently available. Please check back later.', updated_at: new Date().toISOString() });
    if (messageResult.error) return NextResponse.json({ error: (messageResult.error as any).message }, { status: 400 });

    const archiveResult = await svc
      .from('exams')
      .update({ status: 'archived' })
      .eq('status', 'published');
    if (archiveResult.error) return NextResponse.json({ error: (archiveResult.error as any).message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || 'unexpected_error' }, { status: 500 });
  }
}

// Handle system routes that use query parameters (like the original /api/admin/system route)
export async function systemGET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  
  if (action === "home-buttons") {
    return getHomeButtons(req);
  }
  
  return NextResponse.json({ error: "Invalid action. Use: home-buttons" }, { status: 400 });
}

export async function systemPOST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  
  switch (action) {
    case "disable":
      return systemDisablePOST(req);
    case "enable":
      return systemEnablePOST(req);
    case "mode":
      return systemModePOST(req);
    default:
      return NextResponse.json({ error: "Invalid action. Use: disable, enable, mode" }, { status: 400 });
  }
}

export async function systemPATCH(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  
  if (action === "home-buttons") {
    return updateHomeButtons(req);
  }
  
  return NextResponse.json({ error: "Invalid action. Use: home-buttons" }, { status: 400 });
}

const HOME_BUTTON_KEYS = ["home_button_exams", "home_button_results", "home_button_register"] as const;
type HomeButtonKeys = typeof HOME_BUTTON_KEYS[number];

async function getHomeButtons(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = await getSvc(req);

    const { data, error } = await svc.from("app_config").select("key, value").in("key", HOME_BUTTON_KEYS as unknown as string[]);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const map = new Map<string, string | null>();
    for (const row of data || []) {
      map.set((row as any).key, (row as any).value);
    }

    return NextResponse.json({
      exams: map.get("home_button_exams") === "true" ? true : map.has("home_button_exams") ? false : null,
      results: map.get("home_button_results") === "true" ? true : map.has("home_button_results") ? false : null,
      register: map.get("home_button_register") === "true" ? true : map.has("home_button_register") ? false : null,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

async function updateHomeButtons(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = await getSvc(req);

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const toUpsert: Array<{ key: HomeButtonKeys; value: string; updated_at: string }> = [];

    // Handle explicit boolean values -> upsert
    if (typeof body.exams === "boolean") {
      toUpsert.push({ key: "home_button_exams", value: body.exams ? "true" : "false", updated_at: now });
    }
    if (typeof body.results === "boolean") {
      toUpsert.push({ key: "home_button_results", value: body.results ? "true" : "false", updated_at: now });
    }
    if (typeof body.register === "boolean") {
      toUpsert.push({ key: "home_button_register", value: body.register ? "true" : "false", updated_at: now });
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
    if (body.register === null) {
      const del = await svc.from("app_config").delete().eq("key", "home_button_register");
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
