/**
 * useSummaries Hook
 * 
 * Fetches aggregated student scores from results_summary_mv materialized view.
 * Supports optional view refresh for up-to-date data.
 * Requirements: 4.9, 13.1
 */

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, resultsQueryConfig } from '@/lib/results/queryConfig';
import type { StudentSummary } from '@/lib/results/types';

interface UseSummariesOptions {
  /** Filter by specific student IDs */
  studentIds?: string[];
  /** Filter by specific exam IDs */
  examIds?: string[];
  /** Whether to refresh materialized view before fetching */
  refresh?: boolean;
}

interface UseSummariesResult {
  /** List of student summaries */
  summaries: StudentSummary[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => Promise<void>;
  /** Refresh materialized view and refetch */
  refreshView: () => Promise<void>;
}

/**
 * Fetch summaries from materialized view
 */
async function fetchSummaries(
  options: UseSummariesOptions = {}
): Promise<StudentSummary[]> {
  const params = new URLSearchParams();
  
  if (options.studentIds && options.studentIds.length > 0) {
    params.append('student_ids', options.studentIds.join(','));
  }
  
  if (options.examIds && options.examIds.length > 0) {
    params.append('exam_ids', options.examIds.join(','));
  }
  
  if (options.refresh) {
    params.append('refresh', 'true');
  }
  
  const url = `/api/admin/results/summary${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch summaries: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.students || [];
}

/**
 * Transform raw summary data into StudentSummary format
 */
function transformSummaries(rawData: any[]): StudentSummary[] {
  const studentMap = new Map<string, StudentSummary>();
  
  for (const row of rawData) {
    const studentId = row.student_id;
    
    if (!studentMap.has(studentId)) {
      studentMap.set(studentId, {
        student_id: studentId,
        student_name: row.student_name,
        code: row.code,
        scores: {},
        attempt_counts: {},
        extra_data: row.extra_data || {},
      });
    }
    
    const summary = studentMap.get(studentId)!;
    
    // Add exam score
    if (row.exam_id) {
      summary.scores[row.exam_id] = row.best_score;
      summary.attempt_counts[row.exam_id] = row.attempt_count || 0;
    }
  }
  
  return Array.from(studentMap.values());
}

/**
 * Refresh materialized view
 */
async function refreshMaterializedView(): Promise<void> {
  const response = await fetch('/api/admin/results/summary/refresh', {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to refresh view: ${response.statusText}`);
  }
}

/**
 * Hook to fetch student summaries from materialized view
 */
export function useSummaries(
  options: UseSummariesOptions = {}
): UseSummariesResult {
  const { studentIds, examIds, refresh } = options;
  
  const {
    data: rawSummaries = [],
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: QUERY_KEYS.summaries.filtered(studentIds, examIds),
    queryFn: () => fetchSummaries({ studentIds, examIds, refresh }),
    ...resultsQueryConfig,
    // Use longer stale time for materialized view (5 minutes)
    staleTime: 5 * 60 * 1000,
  });
  
  // Transform raw data into StudentSummary format
  const summaries = transformSummaries(rawSummaries);
  
  const refetch = async () => {
    await queryRefetch();
  };
  
  const refreshView = async () => {
    try {
      await refreshMaterializedView();
      await queryRefetch();
    } catch (err) {
      throw err;
    }
  };
  
  return {
    summaries,
    isLoading,
    error: error as Error | null,
    refetch,
    refreshView,
  };
}
