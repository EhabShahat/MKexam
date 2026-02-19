/**
 * Incremental Question Loader Component
 * 
 * Demonstrates incremental question loading with React Query integration.
 * This component can be integrated into the attempt page when ready.
 * 
 * Requirements: 13.1, 13.2, 13.4, 13.5, 13.6, 13.7
 */

'use client';

import { useEffect, useState } from 'react';
import { useIncrementalQuestions } from '@/hooks/useIncrementalQuestions';
import type { Question } from '@/lib/types';
import type { AnswerValue } from '@/components/ExamQuestion';

interface IncrementalQuestionLoaderProps {
  examId: string;
  currentIndex: number;
  isResuming?: boolean;
  lastAnsweredIndex?: number | null;
  onQuestionsLoaded?: (questions: Question[]) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  children: (props: {
    questions: Question[];
    totalCount: number;
    loadedCount: number;
    isLoading: boolean;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    isSlowNetwork: boolean;
  }) => React.ReactNode;
}

/**
 * Incremental Question Loader Component
 * 
 * Usage example:
 * ```tsx
 * <IncrementalQuestionLoader
 *   examId={examId}
 *   currentIndex={currentIdx}
 *   isResuming={isResuming}
 *   lastAnsweredIndex={lastAnsweredIndex}
 * >
 *   {({ questions, isLoading, hasMore, loadMore }) => (
 *     <div>
 *       {questions.map(q => (
 *         <ExamQuestion key={q.id} question={q} ... />
 *       ))}
 *       {hasMore && <button onClick={loadMore}>Load More</button>}
 *     </div>
 *   )}
 * </IncrementalQuestionLoader>
 * ```
 */
export function IncrementalQuestionLoader({
  examId,
  currentIndex,
  isResuming = false,
  lastAnsweredIndex = null,
  onQuestionsLoaded,
  onLoadingChange,
  children,
}: IncrementalQuestionLoaderProps) {
  const {
    questions,
    totalCount,
    loadedCount,
    isLoading,
    error,
    hasMore,
    loadMore,
    isSlowNetwork,
  } = useIncrementalQuestions(examId, currentIndex, isResuming, lastAnsweredIndex);

  // Notify parent of questions loaded
  useEffect(() => {
    if (questions.length > 0 && onQuestionsLoaded) {
      onQuestionsLoaded(questions);
    }
  }, [questions, onQuestionsLoaded]);

  // Notify parent of loading state changes
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading);
    }
  }, [isLoading, onLoadingChange]);

  if (error) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#dc2626' }}>
        <p>Error loading questions: {(error as Error).message}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {children({
        questions,
        totalCount,
        loadedCount,
        isLoading,
        hasMore,
        loadMore,
        isSlowNetwork,
      })}
    </>
  );
}

/**
 * Loading indicator for incremental loading
 */
export function QuestionLoadingIndicator({ 
  isLoading, 
  loadedCount, 
  totalCount 
}: { 
  isLoading: boolean; 
  loadedCount: number; 
  totalCount: number; 
}) {
  if (!isLoading) return null;

  return (
    <div style={{
      padding: '1rem',
      textAlign: 'center',
      color: '#6b7280',
      fontSize: '0.875rem',
    }}>
      <div className="loading-spinner" style={{ 
        margin: '0 auto 0.5rem auto',
        width: '20px',
        height: '20px',
      }} />
      <p>Loading questions... ({loadedCount} of {totalCount})</p>
    </div>
  );
}

/**
 * Network speed indicator
 */
export function NetworkSpeedIndicator({ isSlowNetwork }: { isSlowNetwork: boolean }) {
  if (!isSlowNetwork) return null;

  return (
    <div style={{
      padding: '0.5rem 1rem',
      backgroundColor: '#fef3c7',
      border: '1px solid #fbbf24',
      borderRadius: '0.375rem',
      fontSize: '0.875rem',
      color: '#92400e',
      marginBottom: '1rem',
    }}>
      <strong>Slow network detected:</strong> Questions will load one at a time to prioritize your current question.
    </div>
  );
}
