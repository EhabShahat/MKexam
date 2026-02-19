/**
 * useExams Hook
 * 
 * Fetches and caches exam list with status filtering and search support.
 * Requirements: 2.1, 2.2, 2.6, 2.7
 */

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, resultsQueryConfig } from '@/lib/results/queryConfig';
import type { Exam, StatusFilterValue } from '@/lib/results/types';

interface UseExamsOptions {
  /** Filter by exam status */
  statusFilter?: StatusFilterValue;
  /** Search term for filtering by title */
  searchTerm?: string;
}

interface UseExamsResult {
  /** Filtered and sorted exam list */
  exams: Exam[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => Promise<void>;
}

/**
 * Fetch exams from API
 */
async function fetchExams(): Promise<Exam[]> {
  const response = await fetch('/api/admin/exams');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch exams: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.exams || [];
}

/**
 * Determine exam status based on scheduling mode
 */
function getExamStatus(exam: Exam): string {
  if (exam.scheduling_mode === 'Manual') {
    return exam.is_manually_published ? 'published' : 'draft';
  }
  
  // Auto mode - determine from timestamps
  const now = new Date();
  const startTime = exam.start_time ? new Date(exam.start_time) : null;
  const endTime = exam.end_time ? new Date(exam.end_time) : null;
  
  if (endTime && now > endTime) {
    return 'completed';
  }
  
  if (startTime && now >= startTime) {
    return 'published';
  }
  
  return 'draft';
}

/**
 * Filter exams by status
 */
function filterByStatus(exams: Exam[], statusFilter?: StatusFilterValue): Exam[] {
  if (!statusFilter || statusFilter === 'all') {
    return exams;
  }
  
  return exams.filter((exam) => {
    const status = getExamStatus(exam);
    return status === statusFilter;
  });
}

/**
 * Filter exams by search term (case-insensitive title match)
 */
function filterBySearch(exams: Exam[], searchTerm?: string): Exam[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return exams;
  }
  
  const term = searchTerm.toLowerCase().trim();
  return exams.filter((exam) =>
    exam.title.toLowerCase().includes(term)
  );
}

/**
 * Sort exams alphabetically by title
 */
function sortExams(exams: Exam[]): Exam[] {
  return [...exams].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  );
}

/**
 * Hook to fetch and filter exams
 */
export function useExams(options: UseExamsOptions = {}): UseExamsResult {
  const { statusFilter, searchTerm } = options;
  
  const {
    data: rawExams = [],
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: QUERY_KEYS.exams.filtered(statusFilter, searchTerm),
    queryFn: fetchExams,
    ...resultsQueryConfig,
  });
  
  // Filter out archived exams
  const nonArchivedExams = rawExams.filter((exam) => !exam.is_archived);
  
  // Apply filters
  const statusFiltered = filterByStatus(nonArchivedExams, statusFilter);
  const searchFiltered = filterBySearch(statusFiltered, searchTerm);
  const sortedExams = sortExams(searchFiltered);
  
  const refetch = async () => {
    await queryRefetch();
  };
  
  return {
    exams: sortedExams,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
