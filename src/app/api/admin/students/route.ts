import { NextRequest } from "next/server";
import * as studentsHandlers from "@/server/admin/students";

export async function GET(req: NextRequest) {
  return studentsHandlers.studentsGET(req);
}

export async function POST(req: NextRequest) {
  return studentsHandlers.studentsPOST(req);
}