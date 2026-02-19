/**
 * Cost Reporting API Route
 * 
 * Provides cost data for the dashboard:
 * - Daily/weekly/monthly cost trends
 * - Cost comparison vs previous period
 * - Cost per exam and cost per student
 * - Bandwidth savings from optimization
 * 
 * Requirements: 12.3, 12.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { compareCostPeriods, getDailyCostMetrics } from '@/lib/costTracking';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'weekly';

    // Calculate date ranges based on period
    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case 'daily':
        // Last 7 days vs previous 7 days
        currentEnd = new Date(now);
        currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - 6);
        
        previousEnd = new Date(currentStart);
        previousEnd.setDate(previousEnd.getDate() - 1);
        previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - 6);
        break;

      case 'weekly':
        // Last 4 weeks vs previous 4 weeks
        currentEnd = new Date(now);
        currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - 27); // 4 weeks
        
        previousEnd = new Date(currentStart);
        previousEnd.setDate(previousEnd.getDate() - 1);
        previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - 27);
        break;

      case 'monthly':
        // Last 3 months vs previous 3 months
        currentEnd = new Date(now);
        currentStart = new Date(now);
        currentStart.setMonth(currentStart.getMonth() - 3);
        
        previousEnd = new Date(currentStart);
        previousEnd.setDate(previousEnd.getDate() - 1);
        previousStart = new Date(previousEnd);
        previousStart.setMonth(previousStart.getMonth() - 3);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid period. Use daily, weekly, or monthly.' },
          { status: 400 }
        );
    }

    // Get comparison data
    const comparisonData = await compareCostPeriods(
      currentStart,
      currentEnd,
      previousStart,
      previousEnd
    );

    // Calculate cost per exam and per student
    const perExam = await calculateCostPerExam(currentStart, currentEnd);
    const perStudent = await calculateCostPerStudent(currentStart, currentEnd);

    return NextResponse.json({
      ...comparisonData,
      perExam,
      perStudent
    });
  } catch (error) {
    console.error('Error fetching cost data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost data' },
      { status: 500 }
    );
  }
}

/**
 * Calculate cost per exam
 * 
 * Requirement 12.6: Display cost per exam
 */
async function calculateCostPerExam(
  startDate: Date,
  endDate: Date
): Promise<Record<string, number>> {
  try {
    const supabase = supabaseServer();

    // Get all egress metrics with exam_id in metadata
    const { data: metrics, error } = await supabase
      .from('performance_metrics')
      .select('value, metadata')
      .eq('metric_type', 'egress')
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString());

    if (error) {
      console.error('Error calculating cost per exam:', error);
      return {};
    }

    const costPerExam: Record<string, number> = {};

    for (const metric of metrics || []) {
      const examId = metric.metadata?.exam_id;
      if (examId) {
        const bytes = metric.value || 0;
        const gb = bytes / (1024 * 1024 * 1024);
        const cost = gb * 0.09; // $0.09 per GB

        if (!costPerExam[examId]) {
          costPerExam[examId] = 0;
        }
        costPerExam[examId] += cost;
      }
    }

    return costPerExam;
  } catch (error) {
    console.error('Error in calculateCostPerExam:', error);
    return {};
  }
}

/**
 * Calculate cost per student
 * 
 * Requirement 12.6: Display cost per student
 */
async function calculateCostPerStudent(
  startDate: Date,
  endDate: Date
): Promise<Record<string, number>> {
  try {
    const supabase = supabaseServer();

    // Get all egress metrics with student_id in metadata
    const { data: metrics, error } = await supabase
      .from('performance_metrics')
      .select('value, metadata')
      .eq('metric_type', 'egress')
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString());

    if (error) {
      console.error('Error calculating cost per student:', error);
      return {};
    }

    const costPerStudent: Record<string, number> = {};

    for (const metric of metrics || []) {
      const studentId = metric.metadata?.student_id;
      if (studentId) {
        const bytes = metric.value || 0;
        const gb = bytes / (1024 * 1024 * 1024);
        const cost = gb * 0.09; // $0.09 per GB

        if (!costPerStudent[studentId]) {
          costPerStudent[studentId] = 0;
        }
        costPerStudent[studentId] += cost;
      }
    }

    return costPerStudent;
  } catch (error) {
    console.error('Error in calculateCostPerStudent:', error);
    return {};
  }
}
