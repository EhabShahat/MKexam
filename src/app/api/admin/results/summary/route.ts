import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

/**
 * Results Summary API - Uses materialized view for fast aggregated data
 * Perfect for All Exams view - returns pre-computed student scores
 * 
 * Performance: Single query with pre-aggregated data from materialized view
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const supabase = supabaseServer();
    const { searchParams } = new URL(request.url);
    
    const studentIds = searchParams.get('student_ids')?.split(',').filter(Boolean);
    const examIds = searchParams.get('exam_ids')?.split(',').filter(Boolean);
    const refresh = searchParams.get('refresh') === 'true';

    // Optionally refresh the materialized view (expensive operation)
    if (refresh) {
      const { error: refreshError } = await supabase.rpc('refresh_results_summary');
      if (refreshError) {
        console.warn('Failed to refresh results summary:', refreshError);
      }
    }

    // Query the materialized view
    let query = supabase
      .from('results_summary_mv')
      .select('*');

    if (studentIds && studentIds.length > 0) {
      query = query.in('student_id', studentIds);
    }

    if (examIds && examIds.length > 0) {
      query = query.in('exam_id', examIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Results summary fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch results summary', details: error.message },
        { status: 500 }
      );
    }

    // Transform data into student-centric format
    const studentScores: Record<string, {
      student_id: string;
      student_name: string;
      code: string | null;
      scores: Record<string, number | null>;
      attempt_counts: Record<string, number>;
    }> = {};

    (data || []).forEach((row) => {
      const studentKey = row.student_id;
      
      if (!studentScores[studentKey]) {
        studentScores[studentKey] = {
          student_id: row.student_id,
          student_name: row.student_name,
          code: row.code,
          scores: {},
          attempt_counts: {},
        };
      }

      studentScores[studentKey].scores[row.exam_id] = row.best_score;
      studentScores[studentKey].attempt_counts[row.exam_id] = row.attempt_count;
    });

    return NextResponse.json({
      success: true,
      students: Object.values(studentScores),
      totalStudents: Object.keys(studentScores).length,
    });

  } catch (error) {
    console.error('Results summary API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Trigger materialized view refresh
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const supabase = supabaseServer();
    
    const { error } = await supabase.rpc('refresh_results_summary');
    
    if (error) {
      console.error('Failed to refresh results summary:', error);
      return NextResponse.json(
        { error: 'Refresh failed', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Results summary refreshed successfully',
    });

  } catch (error) {
    console.error('Results summary refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
