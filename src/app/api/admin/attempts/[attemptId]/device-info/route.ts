import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';

/**
 * GET /api/admin/attempts/[attemptId]/device-info
 * 
 * Fetches device info for a specific attempt for diagnostic purposes
 * Admin authentication required
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    // Verify admin authentication
    await requireAdmin(request);

    const { attemptId } = await params;

    // Fetch attempt data with device info
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from('exam_attempts')
      .select('id, device_info, ip_address, started_at, submitted_at, student_id, exam_id')
      .eq('id', attemptId)
      .single();

    if (error) {
      console.error('Error fetching attempt device info:', error);
      return NextResponse.json(
        { error: 'Failed to fetch attempt data' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Attempt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in device-info endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
