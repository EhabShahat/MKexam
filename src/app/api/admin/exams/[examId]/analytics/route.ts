import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params;

    if (!examId) {
      return NextResponse.json(
        { error: 'Exam ID is required' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Call the get_stage_analytics RPC function
    const { data, error } = await supabase.rpc('get_stage_analytics', {
      p_exam_id: examId
    });

    if (error) {
      console.error('Error fetching stage analytics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stage analytics' },
        { status: 500 }
      );
    }

    return NextResponse.json({ analytics: data || [] });
  } catch (error) {
    console.error('Unexpected error in stage analytics API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
