/**
 * Unit Tests for Filter and Sort Utilities
 * 
 * Comprehensive tests for filtering and sorting functions including edge cases
 * and specific scenarios.
 * 
 * Requirements: 20.10
 */

import { describe, it, expect } from 'vitest';
import {
  filterAttemptsByStudent,
  filterAttemptsByDateRange,
  sortAttemptsByScore,
  sortSummariesByFinalScore,
  filterSummariesByStudent,
  applyAttemptFilters,
  processAttempts,
  processSummaries,
} from '../filterSort';
import type { Attempt, StudentSummary, CalculationResult } from '../types';

describe('Filter and Sort Utilities - Unit Tests', () => {
  // Helper function to create attempt
  const createAttempt = (overrides: Partial<Attempt> = {}): Attempt => ({
    id: 'attempt-1',
    exam_id: 'exam-1',
    student_id: 'student-1',
    student_name: 'John Doe',
    code: 'CODE123',
    completion_status: 'completed',
    started_at: '2024-01-15T10:00:00Z',
    submitted_at: '2024-01-15T11:00:00Z',
    score_percentage: 85,
    final_score_percentage: 85,
    ip_address: '192.168.1.1',
    device_info: null,
    manual_total_count: 0,
    manual_graded_count: 0,
    manual_pending_count: 0,
    ...overrides,
  });

  // Helper function to create student summary
  const createSummary = (overrides: Partial<StudentSummary> = {}): StudentSummary => ({
    student_id: 'student-1',
    student_name: 'John Doe',
    code: 'CODE123',
    scores: {},
    attempt_counts: {},
    ...overrides,
  });

  describe('filterAttemptsByStudent', () => {
    it('should filter by student name', () => {
      const attempts = [
        createAttempt({ id: '1', student_name: 'John Doe' }),
        createAttempt({ id: '2', student_name: 'Jane Smith' }),
        createAttempt({ id: '3', student_name: 'Bob Johnson' }),
      ];

      const result = filterAttemptsByStudent(attempts, 'john');

      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['1', '3']);
    });

    it('should filter by student code', () => {
      const attempts = [
        createAttempt({ id: '1', code: 'CODE123' }),
        createAttempt({ id: '2', code: 'CODE456' }),
        createAttempt({ id: '3', code: 'CODE789' }),
      ];

      const result = filterAttemptsByStudent(attempts, '456');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should be case-insensitive', () => {
      const attempts = [
        createAttempt({ id: '1', student_name: 'John Doe', code: 'CODE123' }),
      ];

      expect(filterAttemptsByStudent(attempts, 'JOHN')).toHaveLength(1);
      expect(filterAttemptsByStudent(attempts, 'john')).toHaveLength(1);
      expect(filterAttemptsByStudent(attempts, 'JoHn')).toHaveLength(1);
      expect(filterAttemptsByStudent(attempts, 'code123')).toHaveLength(1);
    });

    it('should return all attempts when search term is empty', () => {
      const attempts = [
        createAttempt({ id: '1' }),
        createAttempt({ id: '2' }),
      ];

      expect(filterAttemptsByStudent(attempts, '')).toHaveLength(2);
      expect(filterAttemptsByStudent(attempts, '   ')).toHaveLength(2);
    });

    it('should handle null student name and code', () => {
      const attempts = [
        createAttempt({ id: '1', student_name: null, code: null }),
        createAttempt({ id: '2', student_name: 'John Doe', code: 'CODE123' }),
      ];

      const result = filterAttemptsByStudent(attempts, 'john');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should return empty array when no matches', () => {
      const attempts = [
        createAttempt({ id: '1', student_name: 'John Doe' }),
      ];

      const result = filterAttemptsByStudent(attempts, 'nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should handle partial matches', () => {
      const attempts = [
        createAttempt({ id: '1', student_name: 'John Doe' }),
        createAttempt({ id: '2', student_name: 'Johnny Smith' }),
      ];

      const result = filterAttemptsByStudent(attempts, 'john');

      expect(result).toHaveLength(2);
    });
  });

  describe('filterAttemptsByDateRange', () => {
    it('should filter by start date only', () => {
      const attempts = [
        createAttempt({ id: '1', submitted_at: '2024-01-10T10:00:00Z' }),
        createAttempt({ id: '2', submitted_at: '2024-01-15T10:00:00Z' }),
        createAttempt({ id: '3', submitted_at: '2024-01-20T10:00:00Z' }),
      ];

      const result = filterAttemptsByDateRange(attempts, '2024-01-15T00:00:00Z', null);

      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['2', '3']);
    });

    it('should filter by end date only', () => {
      const attempts = [
        createAttempt({ id: '1', submitted_at: '2024-01-10T10:00:00Z' }),
        createAttempt({ id: '2', submitted_at: '2024-01-15T10:00:00Z' }),
        createAttempt({ id: '3', submitted_at: '2024-01-20T10:00:00Z' }),
      ];

      const result = filterAttemptsByDateRange(attempts, null, '2024-01-15T23:59:59Z');

      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['1', '2']);
    });

    it('should filter by date range', () => {
      const attempts = [
        createAttempt({ id: '1', submitted_at: '2024-01-10T10:00:00Z' }),
        createAttempt({ id: '2', submitted_at: '2024-01-15T10:00:00Z' }),
        createAttempt({ id: '3', submitted_at: '2024-01-20T10:00:00Z' }),
        createAttempt({ id: '4', submitted_at: '2024-01-25T10:00:00Z' }),
      ];

      const result = filterAttemptsByDateRange(
        attempts,
        '2024-01-12T00:00:00Z',
        '2024-01-22T23:59:59Z'
      );

      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['2', '3']);
    });

    it('should return all attempts when both dates are null', () => {
      const attempts = [
        createAttempt({ id: '1' }),
        createAttempt({ id: '2' }),
      ];

      const result = filterAttemptsByDateRange(attempts, null, null);

      expect(result).toHaveLength(2);
    });

    it('should exclude attempts with null submitted_at', () => {
      const attempts = [
        createAttempt({ id: '1', submitted_at: '2024-01-15T10:00:00Z' }),
        createAttempt({ id: '2', submitted_at: null }),
      ];

      const result = filterAttemptsByDateRange(
        attempts,
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should include boundary dates', () => {
      const attempts = [
        createAttempt({ id: '1', submitted_at: '2024-01-15T00:00:00Z' }),
        createAttempt({ id: '2', submitted_at: '2024-01-15T23:59:59Z' }),
      ];

      const result = filterAttemptsByDateRange(
        attempts,
        '2024-01-15T00:00:00Z',
        '2024-01-15T23:59:59Z'
      );

      expect(result).toHaveLength(2);
    });
  });

  describe('sortAttemptsByScore', () => {
    it('should sort ascending by score', () => {
      const attempts = [
        createAttempt({ id: '1', score_percentage: 75, final_score_percentage: 75 }),
        createAttempt({ id: '2', score_percentage: 90, final_score_percentage: 90 }),
        createAttempt({ id: '3', score_percentage: 60, final_score_percentage: 60 }),
      ];

      const result = sortAttemptsByScore(attempts, 'asc');

      expect(result.map(a => a.id)).toEqual(['3', '1', '2']);
      expect(result.map(a => a.score_percentage)).toEqual([60, 75, 90]);
    });

    it('should sort descending by score', () => {
      const attempts = [
        createAttempt({ id: '1', score_percentage: 75, final_score_percentage: 75 }),
        createAttempt({ id: '2', score_percentage: 90, final_score_percentage: 90 }),
        createAttempt({ id: '3', score_percentage: 60, final_score_percentage: 60 }),
      ];

      const result = sortAttemptsByScore(attempts, 'desc');

      expect(result.map(a => a.id)).toEqual(['2', '1', '3']);
      expect(result.map(a => a.score_percentage)).toEqual([90, 75, 60]);
    });

    it('should prefer final_score_percentage over score_percentage', () => {
      const attempts = [
        createAttempt({ id: '1', score_percentage: 75, final_score_percentage: 80 }),
        createAttempt({ id: '2', score_percentage: 90, final_score_percentage: 85 }),
      ];

      const result = sortAttemptsByScore(attempts, 'asc');

      expect(result.map(a => a.id)).toEqual(['1', '2']);
    });

    it('should place null scores last in ascending order', () => {
      const attempts = [
        createAttempt({ id: '1', score_percentage: 75, final_score_percentage: 75 }),
        createAttempt({ id: '2', score_percentage: null, final_score_percentage: null }),
        createAttempt({ id: '3', score_percentage: 90, final_score_percentage: 90 }),
        createAttempt({ id: '4', score_percentage: null, final_score_percentage: null }),
      ];

      const result = sortAttemptsByScore(attempts, 'asc');

      expect(result.map(a => a.id)).toEqual(['1', '3', '2', '4']);
    });

    it('should place null scores last in descending order', () => {
      const attempts = [
        createAttempt({ id: '1', score_percentage: 75, final_score_percentage: 75 }),
        createAttempt({ id: '2', score_percentage: null, final_score_percentage: null }),
        createAttempt({ id: '3', score_percentage: 90, final_score_percentage: 90 }),
        createAttempt({ id: '4', score_percentage: null, final_score_percentage: null }),
      ];

      const result = sortAttemptsByScore(attempts, 'desc');

      expect(result.map(a => a.id)).toEqual(['3', '1', '2', '4']);
    });

    it('should not modify original array', () => {
      const attempts = [
        createAttempt({ id: '1', score_percentage: 75 }),
        createAttempt({ id: '2', score_percentage: 90 }),
      ];
      const originalIds = attempts.map(a => a.id);

      sortAttemptsByScore(attempts, 'asc');

      expect(attempts.map(a => a.id)).toEqual(originalIds);
    });

    it('should handle empty array', () => {
      const result = sortAttemptsByScore([], 'asc');

      expect(result).toEqual([]);
    });

    it('should handle single item', () => {
      const attempts = [createAttempt({ id: '1', score_percentage: 75 })];

      const result = sortAttemptsByScore(attempts, 'asc');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });

  describe('sortSummariesByFinalScore', () => {
    it('should sort summaries by final score ascending', () => {
      const summaries = [
        createSummary({ student_id: 's1', student_name: 'Student 1' }),
        createSummary({ student_id: 's2', student_name: 'Student 2' }),
        createSummary({ student_id: 's3', student_name: 'Student 3' }),
      ];
      const calculations = new Map<string, CalculationResult>([
        ['s1', { final_score: 75 } as CalculationResult],
        ['s2', { final_score: 90 } as CalculationResult],
        ['s3', { final_score: 60 } as CalculationResult],
      ]);

      const result = sortSummariesByFinalScore(summaries, calculations, 'asc');

      expect(result.map(s => s.student_id)).toEqual(['s3', 's1', 's2']);
    });

    it('should sort summaries by final score descending', () => {
      const summaries = [
        createSummary({ student_id: 's1', student_name: 'Student 1' }),
        createSummary({ student_id: 's2', student_name: 'Student 2' }),
        createSummary({ student_id: 's3', student_name: 'Student 3' }),
      ];
      const calculations = new Map<string, CalculationResult>([
        ['s1', { final_score: 75 } as CalculationResult],
        ['s2', { final_score: 90 } as CalculationResult],
        ['s3', { final_score: 60 } as CalculationResult],
      ]);

      const result = sortSummariesByFinalScore(summaries, calculations, 'desc');

      expect(result.map(s => s.student_id)).toEqual(['s2', 's1', 's3']);
    });

    it('should place students without calculations last', () => {
      const summaries = [
        createSummary({ student_id: 's1' }),
        createSummary({ student_id: 's2' }),
        createSummary({ student_id: 's3' }),
      ];
      const calculations = new Map<string, CalculationResult>([
        ['s1', { final_score: 75 } as CalculationResult],
        ['s3', { final_score: 90 } as CalculationResult],
      ]);

      const result = sortSummariesByFinalScore(summaries, calculations, 'asc');

      expect(result.map(s => s.student_id)).toEqual(['s1', 's3', 's2']);
    });

    it('should not modify original array', () => {
      const summaries = [
        createSummary({ student_id: 's1' }),
        createSummary({ student_id: 's2' }),
      ];
      const originalIds = summaries.map(s => s.student_id);
      const calculations = new Map<string, CalculationResult>();

      sortSummariesByFinalScore(summaries, calculations, 'asc');

      expect(summaries.map(s => s.student_id)).toEqual(originalIds);
    });
  });

  describe('filterSummariesByStudent', () => {
    it('should filter summaries by student name', () => {
      const summaries = [
        createSummary({ student_id: 's1', student_name: 'John Doe' }),
        createSummary({ student_id: 's2', student_name: 'Jane Smith' }),
        createSummary({ student_id: 's3', student_name: 'Bob Johnson' }),
      ];

      const result = filterSummariesByStudent(summaries, 'john');

      expect(result).toHaveLength(2);
      expect(result.map(s => s.student_id)).toEqual(['s1', 's3']);
    });

    it('should filter summaries by code', () => {
      const summaries = [
        createSummary({ student_id: 's1', code: 'CODE123' }),
        createSummary({ student_id: 's2', code: 'CODE456' }),
      ];

      const result = filterSummariesByStudent(summaries, '456');

      expect(result).toHaveLength(1);
      expect(result[0].student_id).toBe('s2');
    });

    it('should be case-insensitive', () => {
      const summaries = [
        createSummary({ student_id: 's1', student_name: 'John Doe', code: 'CODE123' }),
      ];

      expect(filterSummariesByStudent(summaries, 'JOHN')).toHaveLength(1);
      expect(filterSummariesByStudent(summaries, 'code123')).toHaveLength(1);
    });

    it('should return all summaries when search term is empty', () => {
      const summaries = [
        createSummary({ student_id: 's1' }),
        createSummary({ student_id: 's2' }),
      ];

      expect(filterSummariesByStudent(summaries, '')).toHaveLength(2);
    });
  });

  describe('applyAttemptFilters', () => {
    it('should apply student filter only', () => {
      const attempts = [
        createAttempt({ id: '1', student_name: 'John Doe' }),
        createAttempt({ id: '2', student_name: 'Jane Smith' }),
      ];

      const result = applyAttemptFilters(attempts, { searchTerm: 'john' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should apply date filter only', () => {
      const attempts = [
        createAttempt({ id: '1', submitted_at: '2024-01-10T10:00:00Z' }),
        createAttempt({ id: '2', submitted_at: '2024-01-20T10:00:00Z' }),
      ];

      const result = applyAttemptFilters(attempts, {
        startDate: '2024-01-15T00:00:00Z',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should apply both filters', () => {
      const attempts = [
        createAttempt({ id: '1', student_name: 'John Doe', submitted_at: '2024-01-10T10:00:00Z' }),
        createAttempt({ id: '2', student_name: 'John Smith', submitted_at: '2024-01-20T10:00:00Z' }),
        createAttempt({ id: '3', student_name: 'Jane Doe', submitted_at: '2024-01-20T10:00:00Z' }),
      ];

      const result = applyAttemptFilters(attempts, {
        searchTerm: 'john',
        startDate: '2024-01-15T00:00:00Z',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should return all attempts when no filters', () => {
      const attempts = [
        createAttempt({ id: '1' }),
        createAttempt({ id: '2' }),
      ];

      const result = applyAttemptFilters(attempts, {});

      expect(result).toHaveLength(2);
    });
  });

  describe('processAttempts', () => {
    it('should filter and sort attempts', () => {
      const attempts = [
        createAttempt({ id: '1', student_name: 'John Doe', score_percentage: 75, final_score_percentage: 75 }),
        createAttempt({ id: '2', student_name: 'John Smith', score_percentage: 90, final_score_percentage: 90 }),
        createAttempt({ id: '3', student_name: 'Jane Doe', score_percentage: 85, final_score_percentage: 85 }),
      ];

      const result = processAttempts(
        attempts,
        { searchTerm: 'john' },
        'desc'
      );

      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['2', '1']);
    });

    it('should not sort when order is "none"', () => {
      const attempts = [
        createAttempt({ id: '1', score_percentage: 75, final_score_percentage: 75 }),
        createAttempt({ id: '2', score_percentage: 90, final_score_percentage: 90 }),
      ];

      const result = processAttempts(attempts, {}, 'none');

      expect(result.map(a => a.id)).toEqual(['1', '2']);
    });
  });

  describe('processSummaries', () => {
    it('should filter and sort summaries', () => {
      const summaries = [
        createSummary({ student_id: 's1', student_name: 'John Doe' }),
        createSummary({ student_id: 's2', student_name: 'John Smith' }),
        createSummary({ student_id: 's3', student_name: 'Jane Doe' }),
      ];
      const calculations = new Map<string, CalculationResult>([
        ['s1', { final_score: 75 } as CalculationResult],
        ['s2', { final_score: 90 } as CalculationResult],
        ['s3', { final_score: 85 } as CalculationResult],
      ]);

      const result = processSummaries(summaries, 'john', calculations, 'desc');

      expect(result).toHaveLength(2);
      expect(result.map(s => s.student_id)).toEqual(['s2', 's1']);
    });

    it('should not sort when order is "none"', () => {
      const summaries = [
        createSummary({ student_id: 's1' }),
        createSummary({ student_id: 's2' }),
      ];
      const calculations = new Map<string, CalculationResult>();

      const result = processSummaries(summaries, '', calculations, 'none');

      expect(result.map(s => s.student_id)).toEqual(['s1', 's2']);
    });
  });
});
