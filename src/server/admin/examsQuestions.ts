import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function examsIdQuestionsGET(req: NextRequest, examId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { data, error } = await svc
      .from("questions")
      .select("*")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true, nullsFirst: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: data });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function examsIdQuestionsPOST(req: NextRequest, examId: string) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    if (Array.isArray((body as any)?.items)) {
      const toInsert = (body as any).items.map((q: any) => ({ ...q, exam_id: examId }));
      const { data, error } = await svc.from("questions").insert(toInsert).select("*");
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ items: data });
    } else {
      const q = { ...(body as any), exam_id: examId };
      const { data, error } = await svc.from("questions").insert(q).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ item: data });
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function examsIdQuestionsReorderPATCH(req: NextRequest, examId: string) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const items: { id: string; order_index: number }[] = (body as any)?.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "no_items" }, { status: 400 });
    }
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const upserts = items.map((i) => ({ id: i.id, exam_id: examId, order_index: i.order_index }));
    const { error } = await svc.from("questions").upsert(upserts, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function examsIdQuestionsQuestionIdPATCH(req: NextRequest, examId: string, questionId: string) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { data, error } = await svc
      .from("questions")
      .update({ ...(body as any), exam_id: examId })
      .eq("id", questionId)
      .eq("exam_id", examId)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function examsIdQuestionsQuestionIdDELETE(req: NextRequest, examId: string, questionId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { error } = await svc.from("questions").delete().eq("id", questionId).eq("exam_id", examId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
