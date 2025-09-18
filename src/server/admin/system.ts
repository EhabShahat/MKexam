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
