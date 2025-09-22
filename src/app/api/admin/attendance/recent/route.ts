import { NextRequest } from "next/server";
import { attendanceRecentGET } from "@/server/admin/attendance";

export async function GET(req: NextRequest) {
  return attendanceRecentGET(req);
}
