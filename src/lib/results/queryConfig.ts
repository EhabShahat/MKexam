/**
 * React Query configuration for Results Page
 * 
 * Defines cache settings, retry logic, and query key patterns
 * for optimal performance and reliability.
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Cache key patterns for all results-related queries
 */
export const QUERY_KEYS = {
  /** All exams list */
  exams: {
    all: ['admin', 'exams', 'all'] as const,
    filtered: (statusFilter?: string, searchTerm?: string) =>
      ['admin', 'exams', 'filtered', statusFilter, searchTerm] as const,
  },
  /** Attempts for specific exam or bulk */
  attempts: {
    byExam: (examId: string) => ['admin', 'attempts', examId] as const,
    bulk: ['admin', 'attempts', 'bulk'] as const,
  },
  /** Aggregated summaries from materialized view */
  summaries: {
    all: ['admin', 'results', 'summary'] as const,
    filtered: (studentIds?: string[], examIds?: string[]) =>
      ['admin', 'results', 'summary', studentIds, examIds] as const,
  },
  /** App settings */
  settings: ['admin', 'settings'] as const,
  /** Extra field definitions */
  extraFields: ['admin', 'extra-fields'] as const,
} as const;

/**
 * Default query configuration for results page
 */
export const resultsQueryConfig = {
  /** Cache data for 2 minutes before considering stale */
  staleTime: 2 * 60 * 1000,
  /** Keep unused data in cache for 5 minutes before garbage collection */
  gcTime: 5 * 60 * 1000,
  /** Don't refetch on window focus to reduce unnecessary requests */
  refetchOnWindowFocus: false,
  /** Retry failed requests up to 3 times */
  retry: 3,
  /** Exponential backoff for retries (max 30 seconds) */
  retryDelay: (attemptIndex: number) =>
    Math.min(1000 * 2 ** attemptIndex, 30000),
};

/**
 * Create a configured QueryClient for results page
 */
export function createResultsQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: resultsQueryConfig,
    },
  });
}

/**
 * Cache invalidation helpers
 */
export const invalidateQueries = {
  /** Invalidate all exam-related queries */
  exams: (queryClient: QueryClient) => {
    return queryClient.invalidateQueries({
      queryKey: ['admin', 'exams'],
    });
  },
  /** Invalidate attempts for specific exam */
  attemptsByExam: (queryClient: QueryClient, examId: string) => {
    return queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.attempts.byExam(examId),
    });
  },
  /** Invalidate bulk attempts */
  bulkAttempts: (queryClient: QueryClient) => {
    return queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.attempts.bulk,
    });
  },
  /** Invalidate all summaries */
  summaries: (queryClient: QueryClient) => {
    return queryClient.invalidateQueries({
      queryKey: ['admin', 'results', 'summary'],
    });
  },
  /** Invalidate all results-related queries */
  all: (queryClient: QueryClient) => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'attempts'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'results'] }),
    ]);
  },
};
