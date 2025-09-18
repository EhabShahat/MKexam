import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

export async function usersPOST(req: NextRequest) {
  try {
    console.log("[API] POST /api/admin/users - hit");
    const actor = await requireAdmin(req);
    const body = await req.json().catch(() => ({} as any));
    const usernameRaw = typeof body?.username === "string" ? body.username : "";
    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const is_admin = Boolean(body?.is_admin);

    const username = usernameRaw.trim();
    const email = emailRaw.trim();

    console.log("[API] /api/admin/users - payload", {
      username_present: Boolean(username),
      email_present: Boolean(email),
      password_len: password ? password.length : 0,
      is_admin,
      actor: (actor as any)?.user_id || null,
    });

    if (!username && !email) {
      return NextResponse.json({ error: "missing_identifier" }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "weak_password" }, { status: 400 });
    }

    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const res = await svc.rpc("admin_create_user", {
      p_username: username || null,
      p_email: email || null,
      p_password: password,
      p_is_admin: is_admin,
    });

    if ((res as any).error) {
      console.error("[API] /api/admin/users - RPC error", (res as any).error);
      const msg = (((res as any).error?.message) || "").toLowerCase();
      if (msg.includes("forbidden")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      if (msg.includes("weak_password")) return NextResponse.json({ error: "weak_password" }, { status: 400 });
      if (msg.includes("missing_identifier")) return NextResponse.json({ error: "missing_identifier" }, { status: 400 });
      if (msg.includes("duplicate_username")) return NextResponse.json({ error: "duplicate_username" }, { status: 400 });
      if (msg.includes("duplicate_email")) return NextResponse.json({ error: "duplicate_email" }, { status: 400 });
      return NextResponse.json({ error: (res as any).error.message }, { status: 500 });
    }

    const item = ((res as any).data && ((res as any).data as any[])[0]) || null;

    console.log("[API] /api/admin/users - success", { created_user_id: (item as any)?.user_id || null });

    // Ensure admin_users row exists when is_admin is requested
    if (is_admin && (item as any)?.user_id) {
      try {
        const { error: adminError } = await svc
          .from("admin_users")
          .upsert({ user_id: (item as any).user_id }, { onConflict: "user_id" });
        if (adminError) {
          console.error("[API] /api/admin/users - admin_users upsert failed:", adminError);
        }
      } catch (adminErr) {
        console.error("[API] /api/admin/users - admin_users upsert exception:", adminErr);
      }
    }

    try {
      await auditLog((actor as any).username || (actor as any).email || (actor as any).user_id, "admin_create_user", {
        username: username || null,
        email: email || null,
        is_admin,
        user_id: (item as any)?.user_id || null,
      });
    } catch {}

    return NextResponse.json({ item });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
