import { NextRequest } from "next/server";
import { attendanceHistoryGET } from "@/server/admin/attendance";

export async function GET(req: NextRequest) {
  return attendanceHistoryGET(req);
}
