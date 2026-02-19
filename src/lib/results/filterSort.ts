/**
 * Filter and Sort Utilities
 * 
 * Pure functions for filtering and sorting attempts and student summaries.
 * All operations are case-insensitive and handle null values gracefully.
 * 
 * Requirements: 6.1-6.8, 7.1-7.5
 */

import type { Attempt, StudentSummary, CalculationResult } from './types';

/**
 * Filter attempts by student name or code (case-insensitive)
 * 
 * @param attempts - Array of attempts to filter
 * @param searchTerm - Search term to match against name or code
 * @returns Filtered array of attempts
 * 
 * Requirements: 6.1, 6.4
 */
export function filterAttemptsByStudent(
  attempts: Attempt[],
  searchTerm: string
): Attempt[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return attempts;
  }
  
  const normalizedSearch = searchTerm.toLowerCase().trim();
  
  return attempts.filter(attempt => {
    const name = (attempt.student_name ?? '').toLowerCase();
    const code = (attempt.code ?? '').toLowerCase();
    
    return name.includes(normalizedSearch) || code.includes(normalizedSearch);
  });
}

/**
 * Filter attempts by date range (inclusive)
 * 
 * @param attempts - Array of attempts to filter
 * @param startDate - Start date (ISO string) or null
 * @param endDate - End date (ISO string) or null
 * @returns Filtered array of attempts
 * 
 * Requirements: 6.2
 */
export function filterAttemptsByDateRange(
  attempts: Attempt[],
  startDate: string | null,
  endDate: string | null
): Attempt[] {
  if (!startDate && !endDate) {
    return attempts;
  }
  
  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDate ? new Date(endDate).getTime() : null;
  
  return attempts.filter(attempt => {
    if (!attempt.submitted_at) {
      return false;
    }
    
    const submittedTime = new Date(attempt.submitted_at).getTime();
    
    if (start !== null && submittedTime < start) {
      return false;
    }
    
    if (end !== null && submittedTime > end) {
      return false;
    }
    
    return true;
  });
}

/**
 * Sort attempts by score (ascending or descending)
 * Null scores are placed last in both directions
 * 
 * @param attempts - Array of attempts to sort
 * @param order - Sort order ('asc' or 'desc')
 * @returns Sorted array of attempts (new array)
 * 
 * Requirements: 7.1, 7.4
 */
export function sortAttemptsByScore(
  attempts: Attempt[],
  order: 'asc' | 'desc'
): Attempt[] {
  return [...attempts].sort((a, b) => {
    // Use final_score_percentage if available, otherwise score_percentage
    const scoreA = a.final_score_percentage ?? a.score_percentage;
    const scoreB = b.final_score_percentage ?? b.score_percentage;
    
    // Handle null scores - always place them last
    if (scoreA === null && scoreB === null) return 0;
    if (scoreA === null) return 1;  // A is null, place it after B
    if (scoreB === null) return -1; // B is null, place A before B
    
    // Compare scores based on order
    if (order === 'asc') {
      return scoreA - scoreB;
    } else {
      return scoreB - scoreA;
    }
  });
}

/**
 * Sort student summaries by final score (ascending or descending)
 * Null scores are placed last in both directions
 * 
 * @param summaries - Array of student summaries to sort
 * @param calculations - Map of student ID to calculation result
 * @param order - Sort order ('asc' or 'desc')
 * @returns Sorted array of summaries (new array)
 * 
 * Requirements: 7.2, 7.4
 */
export function sortSummariesByFinalScore(
  summaries: StudentSummary[],
  calculations: Map<string, CalculationResult>,
  order: 'asc' | 'desc'
): StudentSummary[] {
  return [...summaries].sort((a, b) => {
    const calcA = calculations.get(a.student_id);
    const calcB = calculations.get(b.student_id);
    
    const scoreA = calcA?.final_score ?? null;
    const scoreB = calcB?.final_score ?? null;
    
    // Handle null scores - always place them last
    if (scoreA === null && scoreB === null) return 0;
    if (scoreA === null) return 1;
    if (scoreB === null) return -1;
    
    // Compare scores based on order
    if (order === 'asc') {
      return scoreA - scoreB;
    } else {
      return scoreB - scoreA;
    }
  });
}

/**
 * Filter student summaries by student name or code (case-insensitive)
 * 
 * @param summaries - Array of summaries to filter
 * @param searchTerm - Search term to match against name or code
 * @returns Filtered array of summaries
 * 
 * Requirements: 6.3, 6.4
 */
export function filterSummariesByStudent(
  summaries: StudentSummary[],
  searchTerm: string
): StudentSummary[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return summaries;
  }
  
  const normalizedSearch = searchTerm.toLowerCase().trim();
  
  return summaries.filter(summary => {
    const name = (summary.student_name ?? '').toLowerCase();
    const code = (summary.code ?? '').toLowerCase();
    
    return name.includes(normalizedSearch) || code.includes(normalizedSearch);
  });
}

/**
 * Apply multiple filters to attempts
 * 
 * @param attempts - Array of attempts to filter
 * @param filters - Filter options
 * @returns Filtered array of attempts
 * 
 * Requirements: 6.5, 6.7
 */
export function applyAttemptFilters(
  attempts: Attempt[],
  filters: {
    searchTerm?: string;
    startDate?: string | null;
    endDate?: string | null;
  }
): Attempt[] {
  let filtered = attempts;
  
  if (filters.searchTerm) {
    filtered = filterAttemptsByStudent(filtered, filters.searchTerm);
  }
  
  if (filters.startDate || filters.endDate) {
    filtered = filterAttemptsByDateRange(
      filtered,
      filters.startDate ?? null,
      filters.endDate ?? null
    );
  }
  
  return filtered;
}

/**
 * Apply filters and sorting to attempts
 * 
 * @param attempts - Array of attempts to process
 * @param filters - Filter options
 * @param sortOrder - Sort order ('none', 'asc', or 'desc')
 * @returns Processed array of attempts
 * 
 * Requirements: 6.5, 7.3, 7.5
 */
export function processAttempts(
  attempts: Attempt[],
  filters: {
    searchTerm?: string;
    startDate?: string | null;
    endDate?: string | null;
  },
  sortOrder: 'none' | 'asc' | 'desc'
): Attempt[] {
  // Apply filters first
  let processed = applyAttemptFilters(attempts, filters);
  
  // Then apply sorting if requested
  if (sortOrder !== 'none') {
    processed = sortAttemptsByScore(processed, sortOrder);
  }
  
  return processed;
}

/**
 * Apply filters and sorting to summaries
 * 
 * @param summaries - Array of summaries to process
 * @param searchTerm - Search term for filtering
 * @param calculations - Map of student ID to calculation result
 * @param sortOrder - Sort order ('none', 'asc', or 'desc')
 * @returns Processed array of summaries
 * 
 * Requirements: 6.5, 7.3, 7.5
 */
export function processSummaries(
  summaries: StudentSummary[],
  searchTerm: string,
  calculations: Map<string, CalculationResult>,
  sortOrder: 'none' | 'asc' | 'desc'
): StudentSummary[] {
  // Apply filter first
  let processed = filterSummariesByStudent(summaries, searchTerm);
  
  // Then apply sorting if requested
  if (sortOrder !== 'none') {
    processed = sortSummariesByFinalScore(processed, calculations, sortOrder);
  }
  
  return processed;
}
