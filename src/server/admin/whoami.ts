import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function whoamiGET(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
