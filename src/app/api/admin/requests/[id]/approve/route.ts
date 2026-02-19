import { NextRequest, NextResponse } from 'next/server';
import { approveRequest } from '@/server/admin/requests';

// POST /api/admin/requests/[id]/approve
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await approveRequest(id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('POST /api/admin/requests/[id]/approve error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve request' },
      { status: 400 }
    );
  }
}
