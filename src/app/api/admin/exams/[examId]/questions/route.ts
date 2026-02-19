import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(_req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(_req);
    const svc = supabaseServer(token || undefined);
    
    const { data, error } = await svc
      .from("questions")
      .select("*")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true });
    
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    
    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    
    const body = await req.json();
    
    // Get the current max order_index for this exam
    const { data: maxOrderData } = await svc
      .from("questions")
      .select("order_index")
      .eq("exam_id", examId)
      .order("order_index", { ascending: false })
      .limit(1)
      .single();
    
    const nextOrderIndex = (maxOrderData?.order_index ?? -1) + 1;
    
    // Create the question
    const { data, error } = await svc
      .from("questions")
      .insert({
        exam_id: examId,
        question_type: body.question_type,
        question_text: body.question_text,
        options: body.options || null,
        correct_answers: body.correct_answers || null,
        points: body.points || 1,
        required: body.required ?? true,
        order_index: nextOrderIndex,
        question_image_url: body.question_image_url || null,
        option_image_urls: body.option_image_urls || null
      })
      .select()
      .single();
    
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
