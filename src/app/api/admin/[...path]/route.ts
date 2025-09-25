import { NextRequest, NextResponse } from "next/server";

// Admin APIs should run on Node runtime (uses jose, etc.)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30; // Limit duration for admin functions

async function getSegments(ctx: { params: Promise<{ path?: string[] }> }): Promise<string[]> {
  const { path = [] } = await ctx.params;
  return path;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const segments = await getSegments(ctx);
    const [root, sub] = segments;
    switch (root) {
      case "whoami": {
        const mod = await import("@/server/admin/whoami");
        return mod.whoamiGET(req);
      }
      case "settings": {
        const mod = await import("@/server/admin/settings");
        return mod.settingsGET(req);
      }
      case "blocked-entries": {
        const mod = await import("@/server/admin/blockedEntries");
        return mod.blockedEntriesGET(req);
      }
      case "dashboard": {
        const mod = await import("@/server/admin/dashboard");
        return mod.dashboardGET(req);
      }
      case "admins": {
        const mod = await import("@/server/admin/admins");
        return mod.adminsGET(req);
      }
      case "students": {
        const id = sub;
        const mod = await import("@/server/admin/students");
        if (!id) return mod.studentsGET(req);
        // GET /students/:id
        return mod.studentsIdGET(req, id);
      }
      case "attempts": {
        const id = sub;
        const sub2 = segments[2];
        if (!id) return NextResponse.json({ error: "attempt_id_required" }, { status: 400 });
        const mod = await import("@/server/admin/attempts");
        if (!sub2) return mod.attemptsIdGET(req, id);
        if (sub2 === "activity") return mod.attemptsIdActivityGET(req, id);
        if (sub2 === "state") return mod.attemptsIdStateGET(req, id);
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      case "extra-scores": {
        const mod = await import("@/server/admin/extraScores");
        const sub2 = segments[2];
        if (sub === "fields" && sub2 === "values") return mod.extraScoresFieldsValuesGET(req);
        if (sub === "fields") return mod.extraScoresFieldsGET(req);
        if (sub === "exams") return mod.extraScoresExamsGET(req);
        if (sub === "attendance") {
          const mod2 = await import("@/server/admin/extraScores");
          return mod2.extraScoresAttendanceGET(req);
        }
        if (sub === "exam-tags") return mod.extraScoresExamTagsGET(req);
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      case "attendance": {
        const mod = await import("@/server/admin/attendance");
        const url = new URL(req.url);
        const action = url.searchParams.get("action");
        
        switch (action) {
          case "recent":
            return mod.attendanceRecentGET(req);
          case "history":
            return mod.attendanceHistoryGET(req);
          case "today-count":
            return mod.attendanceTodayCountGET(req);
          default:
            return NextResponse.json({ error: "Invalid action. Use: recent, history, today-count" }, { status: 400 });
        }
      }
      case "audit-logs": {
        const mod = await import("@/server/admin/auditLogs");
        return mod.auditLogsGET(req);
      }
      case "monitoring": {
        const mod = await import("@/server/admin/monitoring");
        return mod.monitoringGET(req);
      }
      case "answer-keys": {
        const mod = await import("@/server/admin/answerKeys");
        return mod.answerKeysGET(req);
      }
      case "system": {
        const mod = await import("@/server/admin/system");
        return mod.systemGET(req);
      }
      case "data-clear": {
        const mod = await import("@/server/admin/dataClear");
        return mod.dataClearGET(req);
      }
      case "summaries": {
        const mod = await import("@/server/admin/summaries");
        return mod.adminSummariesGET(req);
      }
      case "exams": {
        const id = sub;
        const sub2 = segments[2];
        const sub3 = segments[3];
        if (!id) {
          const mod = await import("@/server/admin/exams");
          return mod.examsGET(req);
        }
        if (sub2 === "questions") {
          const mod = await import("@/server/admin/examsQuestions");
          if (!sub3) return mod.examsIdQuestionsGET(req, id);
          if (sub3 === "reorder") return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
          // /exams/:id/questions/:questionId GET not supported
          return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
        if (sub2 === "codes") {
          const mod = await import("@/server/admin/examsCodes");
          if (!sub3) return mod.examsIdCodesGET(req, id);
          if (sub3 === "clear") return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
          // /exams/:id/codes/:codeId
          return mod.examsIdCodesCodeIdGET(req, id, sub3);
        }
        if (sub2 === "attempts") {
          const mod = await import("@/server/admin/examsAttempts");
          if (!sub3) return mod.examsIdAttemptsGET(req, id);
          if (sub3 === "export") return mod.examsIdAttemptsExportGET(req, id);
          return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
        // Default GET /exams/:id
        const mod = await import("@/server/admin/examsId");
        return mod.examsIdGET(req, id);
      }
      default:
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

 

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const segments = await getSegments(ctx);
    const [root, sub] = segments;
    switch (root) {
      case "system": {
        const mod = await import("@/server/admin/system");
        return mod.systemPOST(req);
      }
      case "data-clear": {
        const mod = await import("@/server/admin/dataClear");
        return mod.dataClearPOST(req);
      }
      case "blocked-entries": {
        const mod = await import("@/server/admin/blockedEntries");
        if (!sub) return mod.blockedEntriesPOST(req);
        return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
      }
      case "cleanup-expired": {
        const mod = await import("@/server/admin/cleanupExpired");
        return mod.cleanupExpiredPOST(req);
      }
      case "cleanup-attempts": {
        const mod = await import("@/server/admin/attemptsCleanup");
        if (sub === "by-ip") return mod.attemptsCleanupByIpPOST(req);
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      case "admins": {
        const mod = await import("@/server/admin/admins");
        if (!sub) return mod.adminsPOST(req);
        return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
      }
      case "users": {
        const mod = await import("@/server/admin/users");
        if (!sub) return mod.usersPOST(req);
        return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
      }
      case "upload": {
        const mod = await import("@/server/admin/upload");
        if (sub === "question-image") return mod.uploadQuestionImagePOST(req);
        if (sub === "logo") return mod.uploadLogoPOST(req);
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      case "students": {
        const mod = await import("@/server/admin/students");
        if (!sub) return mod.studentsPOST(req);
        if (sub === "bulk") return mod.studentsBulkPOST(req);
        if (sub === "clear") return mod.studentsClearPOST(req);
        if (sub === "whatsapp") return mod.studentsWhatsappPOST(req);
        if (sub === "check-duplicates") return mod.studentsCheckDuplicatesPOST(req);
        // /students/:id/reset-attempts
        if (sub && segments[2] === "reset-attempts") return mod.studentsIdResetAttemptsPOST(req, sub);
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      case "bootstrap": {
        const mod = await import("@/server/admin/bootstrap");
        if (!sub) return mod.bootstrapPOST();
        if (sub === "create-first-user") return mod.bootstrapCreateFirstUserPOST();
        if (sub === "reset-password") return mod.bootstrapResetPasswordPOST();
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      case "attempts": {
        const id = sub;
        const sub2 = segments[2];
        if (!id) return NextResponse.json({ error: "attempt_id_required" }, { status: 400 });
        const mod = await import("@/server/admin/attempts");
        if (sub2 === "manual-grades") return mod.attemptsIdManualGradesPOST(req, id);
        if (sub2 === "regrade") return mod.attemptsIdRegradePOST(req, id);
        return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
      }
      case "extra-scores": {
        const mod = await import("@/server/admin/extraScores");
        if (sub === "fields") return mod.extraScoresFieldsPOST(req);
        if (sub === "exams") return mod.extraScoresExamsPOST(req);
        if (sub === "import") return mod.extraScoresImportPOST(req);
        if (sub === "sync-attendance") {
          const mod2 = await import("@/server/admin/extraScores");
          return mod2.extraScoresSyncAttendancePOST(req);
        }
        if (sub === "sync-exam-tags") return mod.extraScoresSyncExamTagsPOST(req);
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      case "attendance": {
        const mod = await import("@/server/admin/attendance");
        const url = new URL(req.url);
        const action = url.searchParams.get("action");
        
        switch (action) {
          case "scan":
            return mod.attendanceScanPOST(req);
          default:
            return NextResponse.json({ error: "Invalid action. Use: scan" }, { status: 400 });
        }
      }
      case "exams": {
        const id = sub;
        const sub2 = segments[2];
        const sub3 = segments[3];
        if (!id) {
          const mod = await import("@/server/admin/exams");
          return mod.examsPOST(req);
        }
        if (sub2 === "publish") {
          const mod = await import("@/server/admin/examsActions");
          return mod.examsIdPublishPOST(req, id);
        }
        if (sub2 === "done") {
          const mod = await import("@/server/admin/examsActions");
          return mod.examsIdDonePOST(req, id);
        }
        if (sub2 === "duplicate") {
          const mod = await import("@/server/admin/examsActions");
          return mod.examsIdDuplicatePOST(req, id);
        }
        if (sub2 === "archive") {
          const mod = await import("@/server/admin/examsActions");
          return mod.examsIdArchivePOST(req, id);
        }
        if (sub2 === "regrade") {
          const mod = await import("@/server/admin/examsActions");
          return mod.examsIdRegradePOST(req, id);
        }
        if (sub2 === "questions" && !sub3) {
          const mod = await import("@/server/admin/examsQuestions");
          return mod.examsIdQuestionsPOST(req, id);
        }
        if (sub2 === "codes") {
          const mod = await import("@/server/admin/examsCodes");
          if (!sub3) return mod.examsIdCodesPOST(req, id);
          if (sub3 === "clear") return mod.examsIdCodesClearPOST(req, id);
          return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
        }
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      default:
        return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const segments = await getSegments(ctx);
    const [root, sub] = segments;
    switch (root) {
      case "blocked-entries": {
        if (!sub) return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
        const mod = await import("@/server/admin/blockedEntries");
        return mod.blockedEntriesIdDELETE(req, sub);
      }
      case "admins": {
        if (!sub) return NextResponse.json({ error: "user_id_required" }, { status: 400 });
        const mod = await import("@/server/admin/adminsId");
        return mod.adminsIdDELETE(req, sub);
      }
      case "upload": {
        if (sub !== "logo") return NextResponse.json({ error: "not_found" }, { status: 404 });
        const mod = await import("@/server/admin/upload");
        return mod.uploadLogoDELETE(req);
      }
      case "students": {
        if (!sub) return NextResponse.json({ error: "student_id_required" }, { status: 400 });
        const mod = await import("@/server/admin/students");
        return mod.studentsIdDELETE(req, sub);
      }
      case "attempts": {
        if (!sub) return NextResponse.json({ error: "attempt_id_required" }, { status: 400 });
        const mod = await import("@/server/admin/attempts");
        return mod.attemptsIdDELETE(req, sub);
      }
      case "exams": {
        const id = sub;
        const sub2 = segments[2];
        const sub3 = segments[3];
        if (!id) return NextResponse.json({ error: "exam_id_required" }, { status: 400 });
        if (!sub2) {
          const mod = await import("@/server/admin/examsId");
          return mod.examsIdDELETE(req, id);
        }
        if (sub2 === "questions" && sub3) {
          const mod = await import("@/server/admin/examsQuestions");
          return mod.examsIdQuestionsQuestionIdDELETE(req, id, sub3);
        }
        if (sub2 === "codes" && sub3) {
          const mod = await import("@/server/admin/examsCodes");
          return mod.examsIdCodesCodeIdDELETE(req, id, sub3);
        }
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      case "extra-scores": {
        const mod = await import("@/server/admin/extraScores");
        if (sub === "fields") return mod.extraScoresFieldsDELETE(req);
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      case "attendance": {
        const mod = await import("@/server/admin/attendance");
        return mod.attendanceDeleteDELETE(req);
      }
      default:
        return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const segments = await getSegments(ctx);
    const [root, sub] = segments;
    switch (root) {
      case "settings": {
        const mod = await import("@/server/admin/settings");
        return mod.settingsPATCH(req);
      }
      case "system": {
        const mod = await import("@/server/admin/system");
        return mod.systemPATCH(req);
      }
      case "students": {
        if (!sub) return NextResponse.json({ error: "student_id_required" }, { status: 400 });
        const mod = await import("@/server/admin/students");
        return mod.studentsIdPATCH(req, sub);
      }
      case "admins": {
        if (!sub) return NextResponse.json({ error: "user_id_required" }, { status: 400 });
        const mod = await import("@/server/admin/adminsId");
        return mod.adminsIdPATCH(req, sub);
      }
      case "exams": {
        const id = sub;
        const sub2 = segments[2];
        const sub3 = segments[3];
        if (!id) return NextResponse.json({ error: "exam_id_required" }, { status: 400 });
        if (!sub2) {
          const mod = await import("@/server/admin/examsId");
          return mod.examsIdPATCH(req, id);
        }
        if (sub2 === "questions") {
          const mod = await import("@/server/admin/examsQuestions");
          if (sub3 === "reorder") return mod.examsIdQuestionsReorderPATCH(req, id);
          if (sub3) return mod.examsIdQuestionsQuestionIdPATCH(req, id, sub3);
          return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
        }
        if (sub2 === "codes" && sub3) {
          const mod = await import("@/server/admin/examsCodes");
          return mod.examsIdCodesCodeIdPATCH(req, id, sub3);
        }
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      default:
        return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
