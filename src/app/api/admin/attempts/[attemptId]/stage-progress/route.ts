import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;

    if (!attemptId) {
      return NextResponse.json(
        { error: 'Attempt ID is required' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Call the get_student_stage_progress RPC function
    const { data, error } = await supabase.rpc('get_student_stage_progress', {
      p_attempt_id: attemptId
    });

    if (error) {
      console.error('Error fetching student stage progress:', error);
      return NextResponse.json(
        { error: 'Failed to fetch student stage progress' },
        { status: 500 }
      );
    }

    return NextResponse.json({ stageProgress: data || [] });
  } catch (error) {
    console.error('Unexpected error in student stage progress API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
