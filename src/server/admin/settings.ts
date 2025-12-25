import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

function getSvcForAdmin(req: NextRequest) {
  // Match original logic: prefer service role if present; otherwise pass through a bearer token (currently null)
  return getBearerToken(req).then((token) =>
    supabaseServer(process.env.SUPABASE_SERVICE_ROLE_KEY ? undefined : (token || undefined))
  );
}

export async function settingsGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = await getSvcForAdmin(req);

    const { data, error } = await svc.from("app_settings").select("*").limit(1).maybeSingle();
    if ((error as any)?.code === "42P01") {
      return NextResponse.json({ error: "not_configured" }, { status: 501 });
    }
    if (error) return NextResponse.json({ error: (error as any).message }, { status: 400 });
    return NextResponse.json({ item: data || null });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function settingsPATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = await getSvcForAdmin(req);
    const payload = await req.json();

    const { data: existing, error: selErr } = await svc
      .from("app_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if ((selErr as any)?.code === "42P01") {
      return NextResponse.json({ error: "not_configured" }, { status: 501 });
    }
    if (selErr) return NextResponse.json({ error: (selErr as any).message }, { status: 400 });

    if (!existing) {
      const { data, error } = await svc
        .from("app_settings")
        .insert([{ ...payload }])
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: (error as any).message }, { status: 400 });
      return NextResponse.json({ item: data });
    } else {
      const { data, error } = await svc
        .from("app_settings")
        .update({ ...payload })
        .eq("id", (existing as any).id)
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: (error as any).message }, { status: 400 });
      return NextResponse.json({ item: data });
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
