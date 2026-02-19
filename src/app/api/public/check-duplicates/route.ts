import { NextRequest, NextResponse } from 'next/server';
import { checkDuplicatesForPublicForm } from '@/server/admin/requests';

// POST /api/public/check-duplicates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.mobile_number) {
      return NextResponse.json(
        { error: 'Mobile number is required' },
        { status: 400 }
      );
    }

    const cleanMobile = body.mobile_number.replace(/\D/g, '');
    const data = {
      mobile_number: cleanMobile,
      national_id: body.national_id?.trim() || undefined,
    };

    const duplicates = await checkDuplicatesForPublicForm(data);
    return NextResponse.json(duplicates);
  } catch (error: any) {
    console.error('POST /api/public/check-duplicates error:', error);
    return NextResponse.json({
      existingStudents: [],
      existingRequests: [],
      warning: error?.message || 'Failed to check for duplicates'
    });
  }
}
