/**
 * Incremental Question Loading Module
 * 
 * Implements progressive question loading to reduce initial load time
 * and improve perceived performance for exam attempts.
 * 
 * Requirements: 13.1, 13.2, 13.4, 13.5, 13.6, 13.7
 */

import { supabaseClient } from '@/lib/supabase/client';
import type { Question } from '@/lib/types';

export interface QuestionChunk {
  questions: Question[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
    has_more: boolean;
  };
}

export interface LoaderConfig {
  initialCount: number;      // First questions to load (default: 5)
  chunkSize: number;          // Size of subsequent chunks (default: 10)
  prefetchCount: number;      // Questions to prefetch ahead (default: 3)
}

const DEFAULT_CONFIG: LoaderConfig = {
  initialCount: 5,
  chunkSize: 10,
  prefetchCount: 3,
};

/**
 * Load initial questions for exam start
 * Requirement 13.1: Load first 5 questions immediately
 */
export async function loadInitialQuestions(
  examId: string,
  count: number = DEFAULT_CONFIG.initialCount
): Promise<QuestionChunk> {
  try {
    const { data, error } = await supabaseClient.rpc('get_exam_questions_paginated', {
      p_exam_id: examId,
      p_offset: 0,
      p_limit: count,
      p_exclude_correct_answers: true,
    });

    if (error) {
      throw new Error(`Failed to load initial questions: ${error.message}`);
    }

    return data as QuestionChunk;
  } catch (error) {
    console.error('Error loading initial questions:', error);
    throw error;
  }
}

/**
 * Load a chunk of questions with pagination
 * Requirement 13.4: Load questions in chunks of 10
 */
export async function loadQuestionChunk(
  examId: string,
  offset: number,
  limit: number = DEFAULT_CONFIG.chunkSize
): Promise<QuestionChunk> {
  try {
    const { data, error } = await supabaseClient.rpc('get_exam_questions_paginated', {
      p_exam_id: examId,
      p_offset: offset,
      p_limit: limit,
      p_exclude_correct_answers: true,
    });

    if (error) {
      throw new Error(`Failed to load question chunk: ${error.message}`);
    }

    return data as QuestionChunk;
  } catch (error) {
    console.error('Error loading question chunk:', error);
    throw error;
  }
}

/**
 * Prefetch next questions in background
 * Requirement 13.2: Prefetch next 3 questions in background
 */
export async function prefetchNextQuestions(
  examId: string,
  currentIndex: number,
  count: number = DEFAULT_CONFIG.prefetchCount,
  totalLoaded: number
): Promise<QuestionChunk | null> {
  try {
    // Calculate offset for prefetch (start from next unloaded question)
    const offset = totalLoaded;
    
    // Don't prefetch if we're not near the boundary
    const distanceToEnd = totalLoaded - currentIndex;
    if (distanceToEnd > count) {
      return null; // No need to prefetch yet
    }

    const { data, error } = await supabaseClient.rpc('get_exam_questions_paginated', {
      p_exam_id: examId,
      p_offset: offset,
      p_limit: count,
      p_exclude_correct_answers: true,
    });

    if (error) {
      console.warn('Prefetch failed (non-critical):', error.message);
      return null;
    }

    return data as QuestionChunk;
  } catch (error) {
    console.warn('Error prefetching questions (non-critical):', error);
    return null;
  }
}

/**
 * Load questions for exam resume
 * Requirement 13.6: Load last answered question first on resume
 */
export async function loadResumeQuestions(
  examId: string,
  lastAnsweredIndex: number,
  surroundingCount: number = 5
): Promise<{
  initial: QuestionChunk;
  surrounding: QuestionChunk | null;
}> {
  try {
    // Load the last answered question first
    const startOffset = Math.max(0, lastAnsweredIndex);
    
    const initial = await loadQuestionChunk(examId, startOffset, 1);
    
    // Then load surrounding questions
    const surroundingOffset = Math.max(0, lastAnsweredIndex - Math.floor(surroundingCount / 2));
    const surrounding = await loadQuestionChunk(examId, surroundingOffset, surroundingCount);
    
    return {
      initial,
      surrounding: surrounding.questions.length > 1 ? surrounding : null,
    };
  } catch (error) {
    console.error('Error loading resume questions:', error);
    throw error;
  }
}

/**
 * Calculate which questions need to be loaded based on current position
 */
export function calculateLoadingStrategy(
  currentIndex: number,
  totalQuestions: number,
  loadedQuestions: number,
  config: LoaderConfig = DEFAULT_CONFIG
): {
  shouldLoadMore: boolean;
  nextOffset: number;
  nextLimit: number;
} {
  // Check if we're approaching the end of loaded questions
  const distanceToEnd = loadedQuestions - currentIndex;
  const shouldLoadMore = distanceToEnd <= config.prefetchCount && loadedQuestions < totalQuestions;
  
  return {
    shouldLoadMore,
    nextOffset: loadedQuestions,
    nextLimit: Math.min(config.chunkSize, totalQuestions - loadedQuestions),
  };
}

/**
 * Merge question chunks while maintaining order
 */
export function mergeQuestionChunks(
  existing: Question[],
  newChunk: Question[]
): Question[] {
  const merged = [...existing];
  const existingIds = new Set(existing.map(q => q.id));
  
  // Add only new questions that don't exist
  for (const question of newChunk) {
    if (!existingIds.has(question.id)) {
      merged.push(question);
    }
  }
  
  // Sort by order_index to maintain correct order
  return merged.sort((a, b) => {
    const orderA = a.order_index ?? 0;
    const orderB = b.order_index ?? 0;
    return orderA - orderB;
  });
}

/**
 * Check if network is slow (for priority loading)
 * Requirement 13.5: Prioritize current question on slow network
 */
export function isSlowNetwork(): boolean {
  try {
    // Check if Network Information API is available
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      // Consider slow if effective type is 2g or slow-2g
      const effectiveType = connection.effectiveType;
      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        return true;
      }
      
      // Consider slow if downlink is less than 1 Mbps
      if (connection.downlink && connection.downlink < 1) {
        return true;
      }
    }
    
    // Fallback: assume not slow if we can't detect
    return false;
  } catch (error) {
    console.warn('Error detecting network speed:', error);
    return false;
  }
}

/**
 * Get loading priority based on network conditions
 * Requirement 13.5: Prioritize current question on slow network
 */
export function getLoadingPriority(isSlowNet: boolean): {
  shouldPrefetch: boolean;
  prefetchDelay: number;
} {
  if (isSlowNet) {
    return {
      shouldPrefetch: false, // Don't prefetch on slow network
      prefetchDelay: 0,
    };
  }
  
  return {
    shouldPrefetch: true,
    prefetchDelay: 500, // Small delay to prioritize current question
  };
}
