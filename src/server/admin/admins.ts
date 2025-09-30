import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

export async function adminsGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const res = await svc.rpc("admin_list_admins");
    if ((res as any).error) {
      const err = (res as any).error;
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ items: (res as any).data || [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function adminsPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const username = String(body?.username || "").trim() || null;
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "").trim();
    
    if (!email) return NextResponse.json({ error: "missing_email" }, { status: 400 });
    if (!password) return NextResponse.json({ error: "missing_password" }, { status: 400 });
    
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const res = await svc.rpc("admin_create_user", { 
      p_username: username,
      p_email: email,
      p_password: password,
      p_is_admin: true
    });
    if ((res as any).error) {
      const err = (res as any).error;
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("user_not_found")) return NextResponse.json({ error: "user_not_found" }, { status: 400 });
      if (msg.includes("duplicate_username")) return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      if (msg.includes("duplicate_email")) return NextResponse.json({ error: "Email already exists" }, { status: 400 });
      if (msg.includes("weak_password")) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      if (msg.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ item: ((res as any).data && (res as any).data[0]) || null });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
