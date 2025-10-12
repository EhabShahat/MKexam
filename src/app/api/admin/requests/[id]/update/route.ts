import { NextRequest, NextResponse } from "next/server";
import { updateRequest } from "@/server/admin/requests";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requestId = id;
    const body = await request.json();

    const result = await updateRequest(requestId, body);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error updating request:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update request" },
      { status: 500 }
    );
  }
}
