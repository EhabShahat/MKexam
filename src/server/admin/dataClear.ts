import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";

function getSvcForAdmin(req: NextRequest) {
  return getBearerToken(req).then((token) =>
    supabaseServer(process.env.SUPABASE_SERVICE_ROLE_KEY ? undefined : (token || undefined))
  );
}

// List of tables that can be cleared
const CLEARABLE_TABLES = [
  "attempt_activity_events",
  "attendance_records", 
  "audit_logs",
  "blocked_entries",
  "exam_attempts",
  "exam_bypass_codes",
  "exam_ips",
  "exam_results",
  "exams",
  "extra_score_fields",
  "manual_grades",
  "questions",
  "student_exam_attempts",
  "student_exam_summary",
  "student_requests",
  "students"
];

export async function dataClearPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = await getSvcForAdmin(req);
    
    const { tables, confirmationToken } = await req.json();
    
    // Validate confirmation token (double confirmation)
    if (confirmationToken !== "CLEAR_ALL_DATA_CONFIRMED") {
      return NextResponse.json({ 
        error: "Invalid confirmation token. This operation requires double confirmation." 
      }, { status: 400 });
    }
    
    // Validate tables parameter
    if (!Array.isArray(tables) || tables.length === 0) {
      return NextResponse.json({ 
        error: "Tables parameter must be a non-empty array" 
      }, { status: 400 });
    }
    
    // Validate that all requested tables are in the clearable list
    const invalidTables = tables.filter(table => !CLEARABLE_TABLES.includes(table));
    if (invalidTables.length > 0) {
      return NextResponse.json({ 
        error: `Invalid tables: ${invalidTables.join(", ")}. Only these tables can be cleared: ${CLEARABLE_TABLES.join(", ")}` 
      }, { status: 400 });
    }
    
    const results = [];
    const errors = [];
    
    // Clear tables in dependency order (most dependent first)
    const orderedTables = [
      "attempt_activity_events",
      "manual_grades", 
      "exam_results",
      "student_exam_attempts",
      "student_exam_summary",
      "exam_attempts",
      "attendance_records",
      "exam_bypass_codes",
      "exam_ips",
      "questions",
      "exams",
      "extra_score_fields",
      "student_requests",
      "students",
      "blocked_entries",
      "audit_logs"
    ].filter(table => tables.includes(table));
    
    // Execute deletions
    for (const table of orderedTables) {
      try {
        const { count, error } = await svc
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
        
        if (error) {
          errors.push({ table, error: error.message });
        } else {
          results.push({ table, deletedCount: count || 0 });
        }
      } catch (err: any) {
        errors.push({ table, error: err.message || "Unknown error" });
      }
    }
    
    // Log this critical action
    try {
      await svc.from("audit_logs").insert({
        action: "data_clear",
        details: { 
          tables_cleared: orderedTables,
          results,
          errors,
          admin_action: true
        },
        timestamp: new Date().toISOString()
      });
    } catch (auditError) {
      // If audit_logs was cleared, this will fail, but that's expected
      console.warn("Could not log data clear action (audit_logs may have been cleared):", auditError);
    }
    
    return NextResponse.json({ 
      success: true,
      message: `Data clearing completed. ${results.length} tables processed successfully, ${errors.length} errors.`,
      results,
      errors
    });
    
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ 
      error: e?.message || "unexpected_error" 
    }, { status: 500 });
  }
}

export async function dataClearGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    
    // Return the list of clearable tables for the UI
    return NextResponse.json({ 
      clearableTables: CLEARABLE_TABLES,
      warning: "This operation will permanently delete all data from the selected tables. This cannot be undone."
    });
    
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ 
      error: e?.message || "unexpected_error" 
    }, { status: 500 });
  }
}
