import { NextRequest, NextResponse } from 'next/server';
import { denyRequest } from '@/server/admin/requests';

// POST /api/admin/requests/[id]/deny
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await denyRequest(id, body.reason);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('POST /api/admin/requests/[id]/deny error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to deny request' },
      { status: 400 }
    );
  }
}
