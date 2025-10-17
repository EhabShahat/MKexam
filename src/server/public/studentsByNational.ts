import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// GET /api/public/students/by-national?national_id=XXXXXXXXXXXXXX
// Returns minimal student summary used by the public ID page
export async function studentsByNationalGET(req: NextRequest) {
  try {
    const nationalIdRaw = req.nextUrl.searchParams.get("national_id") || "";
    const nationalId = nationalIdRaw.replace(/[^0-9]/g, "").trim();
    if (!nationalId) {
      return NextResponse.json({ error: "national_id_required" }, { status: 400 });
    }

    // Use service/server client to bypass RLS restrictions for this controlled endpoint
    const svc = supabaseServer();
    const { data, error } = await svc
      .from("students")
      .select("id, code, student_name, photo_url")
      .eq("national_id", nationalId)
      .limit(1)
      .maybeSingle();

    if (error) {
      // If table/column missing, return 404 to avoid leaking errors
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const student = {
      student_id: (data as any).id as string,
      code: (data as any).code as string,
      student_name: (data as any).student_name as string | null,
      photo_url: (data as any).photo_url as string | null,
    };

    return NextResponse.json({ student }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
