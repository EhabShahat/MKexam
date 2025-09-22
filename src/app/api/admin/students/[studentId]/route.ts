import { NextRequest } from "next/server";
import * as studentsHandlers from "@/server/admin/students";

export async function GET(req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await ctx.params;
  return studentsHandlers.studentsIdGET(req, studentId);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await ctx.params;
  return studentsHandlers.studentsIdPATCH(req, studentId);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await ctx.params;
  return studentsHandlers.studentsIdDELETE(req, studentId);
}