import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

/**
 * Bulk Attempts API - Optimized endpoint for All Exams and Matrix views
 * Returns all attempts across all exams in a single query
 * 
 * Performance: 1 request instead of N requests (where N = number of exams)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    await requireAdmin(request);

    const supabase = supabaseServer();
    const { searchParams } = new URL(request.url);
    
    // Optional filters
    const examIds = searchParams.get('exam_ids')?.split(',').filter(Boolean);
    const includeArchived = searchParams.get('include_archived') === 'true';

    // First, get valid (non-archived) exam IDs
    const { data: validExams } = await supabase
      .from('exams')
      .select('id')
      .eq('is_archived', false)
      .neq('status', 'archived');

    const validExamIds = validExams?.map(e => e.id) || [];
    
    // If no valid exams, return empty result
    if (validExamIds.length === 0) {
      return NextResponse.json({
        success: true,
        attemptsByExam: {},
        allAttempts: [],
        totalAttempts: 0,
        examCount: 0,
      });
    }

    // Build query - use explicit foreign key names to avoid ambiguity
    let query = supabase
      .from('exam_attempts')
      .select(`
        id,
        exam_id,
        student_id,
        student_name,
        completion_status,
        started_at,
        submitted_at,
        ip_address,
        device_info,
        students!exam_attempts_student_id_fkey(code, student_name),
        exam_results!exam_results_attempt_id_fkey(
          score_percentage,
          final_score_percentage,
          auto_points,
          manual_points,
          max_points,
          manual_total_count,
          manual_graded_count,
          manual_pending_count
        )
      `)
      .in('exam_id', validExamIds)
      .order('started_at', { ascending: false });

    // Filter by specific exam IDs if provided
    if (examIds && examIds.length > 0) {
      const filteredIds = examIds.filter(id => validExamIds.includes(id));
      if (filteredIds.length > 0) {
        query = query.in('exam_id', filteredIds);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Bulk attempts fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch attempts', details: error.message },
        { status: 500 }
      );
    }

    console.log('[Bulk API] Query returned:', {
      totalRows: data?.length || 0,
      sampleRow: data?.[0],
      sampleStudentsObject: data?.[0]?.students
    });

    // Group attempts by exam_id for easier client-side processing
    const attemptsByExam: Record<string, any[]> = {};
    const allAttempts: any[] = [];

    (data || []).forEach((row) => {
      const examId = row.exam_id;
      // Handle both array and object formats for exam_results
      const examResults = Array.isArray(row.exam_results) 
        ? row.exam_results?.[0] || {}
        : row.exam_results || {};
      const studentCode = row.students?.code || null;
      const studentName = row.students?.student_name || row.student_name || null;
      
      // Debug logging
      if (!studentName) {
        console.log('[Bulk API] Missing student name:', {
          attemptId: row.id,
          studentId: row.student_id,
          studentsObject: row.students,
          attemptStudentName: row.student_name
        });
      }
      
      // Flatten the nested structure to match expected format
      const flattenedAttempt = {
        id: row.id,
        exam_id: examId,
        student_id: row.student_id,
        student_name: studentName,
        code: studentCode,
        completion_status: row.completion_status,
        started_at: row.started_at,
        submitted_at: row.submitted_at,
        ip_address: row.ip_address,
        device_info: row.device_info,
        score_percentage: examResults.score_percentage,
        final_score_percentage: examResults.final_score_percentage,
        auto_points: examResults.auto_points,
        manual_points: examResults.manual_points,
        max_points: examResults.max_points,
        manual_total_count: examResults.manual_total_count || 0,
        manual_graded_count: examResults.manual_graded_count || 0,
        manual_pending_count: examResults.manual_pending_count || 0,
      };
      
      if (!attemptsByExam[examId]) {
        attemptsByExam[examId] = [];
      }
      
      attemptsByExam[examId].push(flattenedAttempt);
      allAttempts.push(flattenedAttempt);
    });

    return NextResponse.json({
      success: true,
      attemptsByExam,
      allAttempts,
      totalAttempts: allAttempts.length,
      examCount: Object.keys(attemptsByExam).length,
    });

  } catch (error) {
    console.error('Bulk attempts API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
