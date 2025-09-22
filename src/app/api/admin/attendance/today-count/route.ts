import { NextRequest } from "next/server";
import { attendanceTodayCountGET } from "@/server/admin/attendance";

export async function GET(req: NextRequest) {
  return attendanceTodayCountGET(req);
}
