import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { getCodeFormatSettings, generateRandomCode } from "@/lib/codeGenerator";

export async function studentsGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    const { data, error } = await svc
      .from("student_exam_summary")
      .select("*")
      .order("student_created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ students: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function studentsIdGET(req: NextRequest, studentId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { data, error } = await svc
      .from("student_exam_summary")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ student: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function studentsPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const body = await req.json().catch(() => ({}));

    const { student_name, mobile_number, mobile_number2, address, national_id, code } = body as any;

    let finalCode: string | null = code || null;
    if (!finalCode) {
      const codeSettings = await getCodeFormatSettings();
      let attempts = 0;
      while (true) {
        finalCode = generateRandomCode(codeSettings);
        attempts++;
        if (attempts > 100) throw new Error("Failed to generate unique code");
        const { data: existing } = await svc
          .from("students")
          .select("id")
          .eq("code", finalCode)
          .maybeSingle();
        if (!existing) break;
      }
    }

    const { data: existing } = await svc
      .from("students")
      .select("id")
      .eq("code", finalCode)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "Code already exists" }, { status: 400 });

    const { data, error } = await svc
      .from("students")
      .insert({
        code: finalCode,
        student_name: student_name || null,
        mobile_number: mobile_number || null,
        mobile_number2: mobile_number2 || null,
        address: address || null,
        national_id: national_id || null,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ student: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function studentsIdPATCH(req: NextRequest, studentId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const body = await req.json().catch(() => ({}));

    const { student_name, mobile_number, mobile_number2, address, national_id } = body as any;
    const update: any = {};
    if (student_name !== undefined) update.student_name = student_name || null;
    if (mobile_number !== undefined) update.mobile_number = mobile_number || null;
    if (mobile_number2 !== undefined) update.mobile_number2 = mobile_number2 || null;
    if (address !== undefined) update.address = address || null;
    if (national_id !== undefined) update.national_id = national_id || null;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    update.updated_at = new Date().toISOString();

    const { data, error } = await svc
      .from("students")
      .update(update)
      .eq("id", studentId)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ student: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function studentsIdDELETE(req: NextRequest, studentId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { data, error } = await svc.rpc("admin_delete_student_and_attempts", { p_student_id: studentId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    let deleted_attempts = 0;
    let deleted_student = false;
    if (Array.isArray(data) && data.length > 0) {
      const row = data[0] as any;
      deleted_attempts = Number(row?.deleted_attempts ?? 0);
      deleted_student = Boolean(row?.deleted_student);
    } else if (data && (data as any).deleted_attempts != null) {
      deleted_attempts = Number((data as any).deleted_attempts);
      deleted_student = Boolean((data as any).deleted_student);
    }
    return NextResponse.json({ success: true, deleted_attempts, deleted_student });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function studentsIdResetAttemptsPOST(req: NextRequest, studentId: string) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);

    let examId: string | undefined = undefined;
    try {
      const body = await req.json();
      if (body && typeof body.examId === "string" && body.examId.trim()) {
        examId = body.examId.trim();
      }
    } catch {}

    const { data, error } = await svc.rpc("admin_reset_student_attempts", {
      p_student_id: studentId,
      p_exam_id: examId ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const deleted_count = Array.isArray(data)
      ? ((data as any[])[0]?.deleted_count ?? 0)
      : (data as any)?.deleted_count ?? 0;

    return NextResponse.json({ deleted_count });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function studentsBulkPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const body = await req.json().catch(() => ({}));
    const { students } = body as any;
    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: "No students provided" }, { status: 400 });
    }

    const { data: existingCodes } = await svc.from("students").select("code");
    const existingCodeSet = new Set((existingCodes || []).map((c: any) => (c as any).code));

    const toInsert: any[] = [];
    const errors: string[] = [];
    const codeSettings = await getCodeFormatSettings();

    for (let i = 0; i < students.length; i++) {
      const student = students[i] as any;
      const { student_name, mobile_number, mobile_number2, address, national_id, code } = student;
      if (!mobile_number) {
        errors.push(`Row ${i + 1}: Mobile number is required`);
        continue;
      }
      let finalCode = code as string | undefined;
      if (!finalCode) {
        let attempts = 0;
        do {
          finalCode = generateRandomCode(codeSettings);
          attempts++;
          if (attempts > 100) {
            errors.push(`Row ${i + 1}: Failed to generate unique code`);
            break;
          }
        } while (finalCode && existingCodeSet.has(finalCode));
      }
      if (!finalCode || existingCodeSet.has(finalCode)) {
        errors.push(`Row ${i + 1}: Code '${finalCode ?? ""}' already exists`);
        continue;
      }
      existingCodeSet.add(finalCode);
      toInsert.push({ 
        code: finalCode, 
        student_name: student_name || null, 
        mobile_number,
        mobile_number2: mobile_number2 || null,
        address: address || null,
        national_id: national_id || null,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Import errors occurred", details: errors }, { status: 400 });
    }
    if (toInsert.length === 0) {
      return NextResponse.json({ error: "No valid students to import" }, { status: 400 });
    }

    const { data, error } = await svc.from("students").insert(toInsert).select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ students: data, created_count: (data as any[])?.length || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function studentsClearPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const { data, error } = await svc.rpc("clear_all_students");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const row = Array.isArray(data) ? (data[0] as any) : (data as any);
    return NextResponse.json({
      deleted_count: Number(row?.deleted_count ?? 0),
      attempts_deleted: Number(row?.attempts_deleted ?? 0),
      links_deleted: Number(row?.links_deleted ?? 0),
      extra_scores_deleted: Number(row?.extra_scores_deleted ?? 0),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function studentsWhatsappPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    const body = await req.json().catch(() => ({}));
    const { studentIds, message } = body as any;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: "No students selected" }, { status: 400 });
    }
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const { data: students, error: studentsError } = await svc
      .from("students")
      .select("id, code, student_name, mobile_number, mobile_number2")
      .in("id", studentIds)
      .or("mobile_number.is.not.null,mobile_number2.is.not.null");
    if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 400 });
    if (!students || students.length === 0) {
      return NextResponse.json({ error: "No students found with mobile numbers" }, { status: 400 });
    }

    const results = (students as any[]).map((student: any) => {
      const personalizedMessage = (message as string)
        .replace(/\{code\}/g, student.code || "")
        .replace(/\{name\}/g, student.student_name || "");
      const encodedMessage = encodeURIComponent(personalizedMessage);
      const urls: string[] = [];
      if (student.mobile_number) urls.push(`https://wa.me/${student.mobile_number}?text=${encodedMessage}`);
      if (student.mobile_number2) urls.push(`https://wa.me/${student.mobile_number2}?text=${encodedMessage}`);
      return {
        student_id: student.id,
        student_name: student.student_name,
        mobile_number: student.mobile_number,
        mobile_number2: student.mobile_number2,
        whatsapp_urls: urls,
        message: personalizedMessage,
      };
    });

    await svc.from("audit_logs").insert({
      actor: "admin",
      action: "whatsapp_send_global_students",
      meta: { student_count: results.length, message_template: message, timestamp: new Date().toISOString() },
    });

    return NextResponse.json({ success: true, results, message: `WhatsApp URLs generated for ${results.length} students` });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "unexpected_error" }, { status: 500 });
  }
}
