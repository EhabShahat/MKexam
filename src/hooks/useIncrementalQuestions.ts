/**
 * React Query hooks for incremental question loading
 * 
 * Provides React Query integration for progressive question loading
 * with caching and offline support.
 * 
 * Requirements: 13.1, 13.2, 13.4, 13.5, 13.6, 13.7
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import {
  loadInitialQuestions,
  loadQuestionChunk,
  prefetchNextQuestions,
  loadResumeQuestions,
  calculateLoadingStrategy,
  mergeQuestionChunks,
  isSlowNetwork,
  getLoadingPriority,
  type QuestionChunk,
  type LoaderConfig,
} from '@/lib/incrementalLoader';
import type { Question } from '@/lib/types';

const DEFAULT_CONFIG: LoaderConfig = {
  initialCount: 5,
  chunkSize: 10,
  prefetchCount: 3,
};

/**
 * Hook for loading initial questions
 * Requirement 13.1: Load first 5 questions on exam start
 */
export function useInitialQuestions(examId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['exam-questions-initial', examId],
    queryFn: () => {
      if (!examId) throw new Error('Exam ID is required');
      return loadInitialQuestions(examId, DEFAULT_CONFIG.initialCount);
    },
    enabled: enabled && !!examId,
    staleTime: Infinity, // Questions don't change during exam
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes (Requirement 13.7: offline caching)
    retry: 2,
  });
}

/**
 * Hook for loading question chunks
 * Requirement 13.4: Load questions in chunks of 10
 */
export function useQuestionChunk(
  examId: string | null,
  offset: number,
  limit: number = DEFAULT_CONFIG.chunkSize,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['exam-questions-chunk', examId, offset, limit],
    queryFn: () => {
      if (!examId) throw new Error('Exam ID is required');
      return loadQuestionChunk(examId, offset, limit);
    },
    enabled: enabled && !!examId && offset >= 0,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000, // Requirement 13.7: offline caching
    retry: 2,
  });
}

/**
 * Hook for loading resume questions
 * Requirement 13.6: Load last answered question first on resume
 */
export function useResumeQuestions(
  examId: string | null,
  lastAnsweredIndex: number | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['exam-questions-resume', examId, lastAnsweredIndex],
    queryFn: () => {
      if (!examId) throw new Error('Exam ID is required');
      if (lastAnsweredIndex === null) throw new Error('Last answered index is required');
      return loadResumeQuestions(examId, lastAnsweredIndex);
    },
    enabled: enabled && !!examId && lastAnsweredIndex !== null,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Main hook for incremental question loading with automatic prefetching
 * Combines all loading strategies with React Query caching
 */
export function useIncrementalQuestions(
  examId: string | null,
  currentIndex: number,
  isResuming: boolean = false,
  lastAnsweredIndex: number | null = null
) {
  const queryClient = useQueryClient();
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const loadedCountRef = useRef(0);
  const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSlowNetRef = useRef(false);

  // Detect network speed
  useEffect(() => {
    isSlowNetRef.current = isSlowNetwork();
    
    // Re-check periodically
    const interval = setInterval(() => {
      isSlowNetRef.current = isSlowNetwork();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Load initial or resume questions
  const initialQuery = useInitialQuestions(examId, !isResuming);
  const resumeQuery = useResumeQuestions(examId, lastAnsweredIndex, isResuming);

  // Initialize questions from initial load or resume
  useEffect(() => {
    if (isResuming && resumeQuery.data) {
      const { initial, surrounding } = resumeQuery.data;
      const allQuestions = surrounding 
        ? mergeQuestionChunks(initial.questions, surrounding.questions)
        : initial.questions;
      
      setQuestions(allQuestions);
      setTotalCount(initial.pagination.total);
      loadedCountRef.current = allQuestions.length;
      setIsLoading(false);
    } else if (!isResuming && initialQuery.data) {
      setQuestions(initialQuery.data.questions);
      setTotalCount(initialQuery.data.pagination.total);
      loadedCountRef.current = initialQuery.data.questions.length;
      setIsLoading(false);
    }
  }, [isResuming, initialQuery.data, resumeQuery.data]);

  // Automatic prefetching based on current position
  // Requirement 13.2: Prefetch next 3 questions in background
  // Requirement 13.5: Prioritize current question on slow network
  useEffect(() => {
    if (!examId || isLoading || totalCount === 0) return;

    const strategy = calculateLoadingStrategy(
      currentIndex,
      totalCount,
      loadedCountRef.current,
      DEFAULT_CONFIG
    );

    if (!strategy.shouldLoadMore) return;

    const priority = getLoadingPriority(isSlowNetRef.current);

    if (!priority.shouldPrefetch) {
      // On slow network, don't prefetch
      return;
    }

    // Clear existing timer
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
    }

    // Schedule prefetch with delay to prioritize current question
    prefetchTimerRef.current = setTimeout(async () => {
      try {
        const chunk = await queryClient.fetchQuery({
          queryKey: ['exam-questions-chunk', examId, strategy.nextOffset, strategy.nextLimit],
          queryFn: () => loadQuestionChunk(examId, strategy.nextOffset, strategy.nextLimit),
          staleTime: Infinity,
        });

        if (chunk && chunk.questions.length > 0) {
          setQuestions(prev => mergeQuestionChunks(prev, chunk.questions));
          loadedCountRef.current += chunk.questions.length;
        }
      } catch (error) {
        console.warn('Prefetch failed (non-critical):', error);
      }
    }, priority.prefetchDelay);

    return () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
      }
    };
  }, [examId, currentIndex, totalCount, isLoading, queryClient]);

  // Manual load more function for explicit loading
  const loadMore = useCallback(async () => {
    if (!examId || loadedCountRef.current >= totalCount) return;

    const strategy = calculateLoadingStrategy(
      currentIndex,
      totalCount,
      loadedCountRef.current,
      DEFAULT_CONFIG
    );

    if (!strategy.shouldLoadMore) return;

    try {
      const chunk = await queryClient.fetchQuery({
        queryKey: ['exam-questions-chunk', examId, strategy.nextOffset, strategy.nextLimit],
        queryFn: () => loadQuestionChunk(examId, strategy.nextOffset, strategy.nextLimit),
        staleTime: Infinity,
      });

      if (chunk && chunk.questions.length > 0) {
        setQuestions(prev => mergeQuestionChunks(prev, chunk.questions));
        loadedCountRef.current += chunk.questions.length;
      }
    } catch (error) {
      console.error('Failed to load more questions:', error);
      throw error;
    }
  }, [examId, currentIndex, totalCount, queryClient]);

  return {
    questions,
    totalCount,
    loadedCount: loadedCountRef.current,
    isLoading: isLoading || initialQuery.isLoading || resumeQuery.isLoading,
    error: initialQuery.error || resumeQuery.error,
    hasMore: loadedCountRef.current < totalCount,
    loadMore,
    isSlowNetwork: isSlowNetRef.current,
  };
}

// Need to import React for useState
import React from 'react';
