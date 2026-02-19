import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/ip";
import { parseUserAgent } from "@/lib/userAgent";

export async function examAccessPOST(req: NextRequest, examId: string) {
  try {
    const body = await req.json().catch(() => ({}));
    const code: string | null = (body as any)?.code ?? null;
    const studentName: string | null = (body as any)?.studentName ?? null;
    const hdrs = await headers();
    const ip = getClientIp(hdrs);
    
    // Capture device information from user agent
    const userAgent = hdrs.get('user-agent') || '';
    const deviceInfo = parseUserAgent(userAgent);

    const supabase = supabaseServer();

    // Get student data if code is provided (for mobile number blocking check)
    let studentData: { student_name?: string | null; mobile_number?: string | null } | null = null;
    if (code) {
      const { data } = await supabase
        .from("students")
        .select("student_name, mobile_number")
        .eq("code", code)
        .single();
      studentData = (data as any) ?? null;
    }

    // Check if IP, student name, or mobile number is blocked (sequential, at most 3 small queries)
    if (ip) {
      const res = await supabase
        .from("blocked_entries")
        .select("value, reason")
        .eq("type", "ip")
        .eq("value", ip)
        .single();
      if ((res as any)?.data && !(res as any)?.error) {
        return NextResponse.json(
          { error: "access_denied", message: (res as any).data.reason || "Access has been restricted for this entry." },
          { status: 403 }
        );
      }
    }
    if (studentName) {
      const res = await supabase
        .from("blocked_entries")
        .select("value, reason")
        .eq("type", "name")
        .ilike("value", studentName.trim())
        .single();
      if ((res as any)?.data && !(res as any)?.error) {
        return NextResponse.json(
          { error: "access_denied", message: (res as any).data.reason || "Access has been restricted for this entry." },
          { status: 403 }
        );
      }
    }
    if (studentData?.mobile_number) {
      const res = await supabase
        .from("blocked_entries")
        .select("value, reason")
        .eq("type", "mobile")
        .eq("value", String(studentData.mobile_number).trim())
        .single();
      if ((res as any)?.data && !(res as any)?.error) {
        return NextResponse.json(
          { error: "access_denied", message: (res as any).data.reason || "Access has been restricted for this entry." },
          { status: 403 }
        );
      }
    }

    const { data, error } = await supabase.rpc("start_attempt_v2", {
      p_exam_id: examId,
      p_code: code,
      p_student_name: studentName,
      p_ip: ip,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
    const attemptId: string | undefined = row?.attempt_id;
    if (!attemptId) return NextResponse.json({ error: "no_attempt" }, { status: 400 });

    // Store device information in the attempt
    if (deviceInfo) {
      try {
        await supabase.from("exam_attempts").update({ 
          device_info: JSON.stringify({
            type: deviceInfo.type,
            manufacturer: deviceInfo.manufacturer,
            model: deviceInfo.model,
            userAgent: deviceInfo.raw,
            capturedAt: new Date().toISOString()
          })
        }).eq("id", attemptId);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("device_info update failed", e);
      }
    }

    // Determine final student name
    let finalStudentName = studentName;
    if (code && studentData?.student_name) {
      finalStudentName = studentData.student_name;
    } else if (code && !studentData) {
      const { data: fallback } = await supabase
        .from("students")
        .select("student_name")
        .eq("code", code)
        .single();
      if ((fallback as any)?.student_name) finalStudentName = (fallback as any).student_name;
    }

    const res = NextResponse.json({ attemptId, studentName: finalStudentName });
    res.cookies.set("attemptId", attemptId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 3, // 3 hours
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
