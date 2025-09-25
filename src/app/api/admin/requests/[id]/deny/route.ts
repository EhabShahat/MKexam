import { NextRequest, NextResponse } from 'next/server';
import { denyRequest } from '@/server/admin/requests';

// POST /api/admin/requests/[id]/deny
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await denyRequest(params.id, body.reason);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('POST /api/admin/requests/[id]/deny error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to deny request' },
      { status: 400 }
    );
  }
}
