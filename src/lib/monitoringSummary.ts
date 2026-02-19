/**
 * Monitoring Summary Statistics Module
 * 
 * Provides aggregated statistics for monitoring dashboard
 * instead of fetching individual attempt records.
 * 
 * Requirements: 7.4
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Summary statistics for an exam
 * Requirements: 7.4
 */
export interface ExamMonitoringSummary {
  exam_id: string;
  exam_title: string;
  active_count: number;
  submitted_last_hour: number;
  average_duration_minutes: number | null;
  last_activity: string | null;
}

/**
 * Overall monitoring summary
 * Requirements: 7.4
 */
export interface OverallMonitoringSummary {
  total_active: number;
  total_submitted_last_hour: number;
  exams: ExamMonitoringSummary[];
  last_updated: string;
}

/**
 * Fetch aggregated monitoring summary statistics
 * Requirements: 7.4
 * 
 * This function fetches summary statistics instead of individual
 * attempt records, significantly reducing data transfer.
 */
export async function fetchMonitoringSummary(
  supabase: SupabaseClient
): Promise<OverallMonitoringSummary> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  // Fetch active attempts count by exam (aggregated)
  const { data: activeData, error: activeError } = await supabase
    .from('exam_attempts')
    .select('exam_id, exams(title)')
    .is('submitted_at', null)
    .gte('started_at', twoHoursAgo);

  if (activeError) {
    throw new Error(`Failed to fetch active attempts: ${activeError.message}`);
  }

  // Fetch submitted attempts count by exam (aggregated)
  const { data: submittedData, error: submittedError } = await supabase
    .from('exam_attempts')
    .select('exam_id, started_at, submitted_at')
    .not('submitted_at', 'is', null)
    .gte('submitted_at', oneHourAgo);

  if (submittedError) {
    throw new Error(`Failed to fetch submitted attempts: ${submittedError.message}`);
  }

  // Aggregate by exam
  const examMap = new Map<string, ExamMonitoringSummary>();

  // Process active attempts
  for (const attempt of activeData || []) {
    const examId = attempt.exam_id;
    if (!examMap.has(examId)) {
      examMap.set(examId, {
        exam_id: examId,
        exam_title: (attempt as any).exams?.title || 'Unknown',
        active_count: 0,
        submitted_last_hour: 0,
        average_duration_minutes: null,
        last_activity: null,
      });
    }
    const summary = examMap.get(examId)!;
    summary.active_count++;
  }

  // Process submitted attempts
  const durationsByExam = new Map<string, number[]>();
  for (const attempt of submittedData || []) {
    const examId = attempt.exam_id;
    
    if (!examMap.has(examId)) {
      examMap.set(examId, {
        exam_id: examId,
        exam_title: 'Unknown',
        active_count: 0,
        submitted_last_hour: 0,
        average_duration_minutes: null,
        last_activity: null,
      });
    }
    
    const summary = examMap.get(examId)!;
    summary.submitted_last_hour++;
    
    // Calculate duration
    if (attempt.started_at && attempt.submitted_at) {
      const duration = 
        (new Date(attempt.submitted_at).getTime() - 
         new Date(attempt.started_at).getTime()) / 1000 / 60;
      
      if (!durationsByExam.has(examId)) {
        durationsByExam.set(examId, []);
      }
      durationsByExam.get(examId)!.push(duration);
    }
    
    // Update last activity
    if (!summary.last_activity || attempt.submitted_at > summary.last_activity) {
      summary.last_activity = attempt.submitted_at;
    }
  }

  // Calculate average durations
  for (const [examId, durations] of durationsByExam) {
    const summary = examMap.get(examId);
    if (summary && durations.length > 0) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      summary.average_duration_minutes = Math.round(avg);
    }
  }

  // Convert to array and sort by activity
  const exams = Array.from(examMap.values()).sort((a, b) => {
    // Sort by active count first, then by submitted count
    if (a.active_count !== b.active_count) {
      return b.active_count - a.active_count;
    }
    return b.submitted_last_hour - a.submitted_last_hour;
  });

  // Calculate totals
  const total_active = exams.reduce((sum, e) => sum + e.active_count, 0);
  const total_submitted_last_hour = exams.reduce((sum, e) => sum + e.submitted_last_hour, 0);

  return {
    total_active,
    total_submitted_last_hour,
    exams,
    last_updated: now.toISOString(),
  };
}

/**
 * Fetch summary for a specific exam
 * Requirements: 7.4
 */
export async function fetchExamSummary(
  supabase: SupabaseClient,
  examId: string
): Promise<ExamMonitoringSummary> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  // Fetch exam title
  const { data: examData, error: examError } = await supabase
    .from('exams')
    .select('title')
    .eq('id', examId)
    .single();

  if (examError) {
    throw new Error(`Failed to fetch exam: ${examError.message}`);
  }

  // Count active attempts
  const { count: activeCount, error: activeError } = await supabase
    .from('exam_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('exam_id', examId)
    .is('submitted_at', null)
    .gte('started_at', twoHoursAgo);

  if (activeError) {
    throw new Error(`Failed to count active attempts: ${activeError.message}`);
  }

  // Fetch submitted attempts for duration calculation
  const { data: submittedData, count: submittedCount, error: submittedError } = await supabase
    .from('exam_attempts')
    .select('started_at, submitted_at', { count: 'exact' })
    .eq('exam_id', examId)
    .not('submitted_at', 'is', null)
    .gte('submitted_at', oneHourAgo)
    .order('submitted_at', { ascending: false })
    .limit(100);

  if (submittedError) {
    throw new Error(`Failed to fetch submitted attempts: ${submittedError.message}`);
  }

  // Calculate average duration
  let averageDuration: number | null = null;
  let lastActivity: string | null = null;

  if (submittedData && submittedData.length > 0) {
    const durations = submittedData
      .filter(a => a.started_at && a.submitted_at)
      .map(a => {
        const duration = 
          (new Date(a.submitted_at!).getTime() - 
           new Date(a.started_at!).getTime()) / 1000 / 60;
        return duration;
      });

    if (durations.length > 0) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      averageDuration = Math.round(avg);
    }

    lastActivity = submittedData[0].submitted_at;
  }

  return {
    exam_id: examId,
    exam_title: examData.title,
    active_count: activeCount || 0,
    submitted_last_hour: submittedCount || 0,
    average_duration_minutes: averageDuration,
    last_activity: lastActivity,
  };
}
