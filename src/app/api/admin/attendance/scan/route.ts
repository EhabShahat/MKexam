import { NextRequest } from "next/server";
import { attendanceScanPOST } from "@/server/admin/attendance";

export async function POST(req: NextRequest) {
  return attendanceScanPOST(req);
}
