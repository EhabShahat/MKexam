import { NextRequest, NextResponse } from "next/server";

// Run on Edge to reduce standard Netlify Functions usage
export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 10; // Limit to 10 seconds to prevent long-running functions

// Catch-all dispatcher for public API endpoints
export async function GET(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const segments = path;
  if (segments.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [root, ...rest] = segments;

  try {
    switch (root) {
      case "active-exam": {
        const mod = await import("@/server/public/activeExam");
        return mod.activeExamGET(request as any);
      }
      case "code-settings": {
        const mod = await import("@/server/public/codeSettings");
        return mod.codeSettingsGET();
      }
      case "results": {
        const mod = await import("@/server/public/results");
        return mod.resultsGET(request as any);
      }
      case "settings": {
        const mod = await import("@/server/public/publicSettings");
        return mod.publicSettingsGET();
      }
      case "review": {
        const mod = await import("@/server/public/review");
        return mod.reviewGET(request as any);
      }
      case "summary": {
        const mod = await import("@/server/public/summary");
        return mod.summaryGET(request as any);
      }
      case "system-mode": {
        const mod = await import("@/server/public/systemMode");
        return mod.systemModeGET();
      }
      case "validate-code": {
        const mod = await import("@/server/public/validateCode");
        return mod.validateCodeGET(request as any);
      }
      case "exams": {
        const [sub, ...subrest] = rest;
        // /api/public/exams/by-code
        if (sub === "by-code") {
          const mod = await import("@/server/public/examsByCode");
          return mod.examsByCodeGET(request as any);
        }
        // /api/public/exams/[examId]/info
        if (sub && subrest[0] === "info") {
          const examId = sub;
          const mod = await import("@/server/public/examInfo");
          return mod.examInfoGET(examId);
        }
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      case "students": {
        const [sub] = rest;
        // /api/public/students/by-national
        if (sub === "by-national") {
          const mod = await import("@/server/public/studentsByNational");
          return mod.studentsByNationalGET(request as any);
        }
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      default:
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } catch (e: any) {
    console.error("public catch-all error", e);
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// Handle POST requests for public endpoints (Edge)
export async function POST(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const segments = path;
  if (segments.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [root, ...rest] = segments;
  try {
    switch (root) {
      case "exams": {
        const [examId, action] = rest;
        // /api/public/exams/:examId/access
        if (examId && action === "access") {
          const mod = await import("@/server/public/examAccess");
          return mod.examAccessPOST(request as any, examId);
        }
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      default:
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } catch (e: any) {
    console.error("public catch-all POST error", e);
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
