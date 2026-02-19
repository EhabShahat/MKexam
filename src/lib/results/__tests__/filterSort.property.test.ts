/**
 * Property-Based Tests for Filter and Sort Utilities
 * 
 * Uses fast-check to validate universal properties of filtering and sorting
 * operations with randomly generated inputs.
 * 
 * Feature: results-page-rebuild
 * Requirements: 6.1-6.8, 7.1-7.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  filterAttemptsByStudent,
  filterAttemptsByDateRange,
  sortAttemptsByScore,
  sortSummariesByFinalScore,
  filterSummariesByStudent,
} from '../filterSort';
import type { Attempt, StudentSummary, CalculationResult } from '../types';

// Arbitraries for generating test data
const attemptArbitrary = fc.record({
  id: fc.uuid(),
  exam_id: fc.uuid(),
  student_id: fc.option(fc.uuid(), { nil: null }),
  student_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  code: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  completion_status: fc.constantFrom('completed', 'in_progress', 'abandoned'),
  started_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  submitted_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
  score_percentage: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  final_score_percentage: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  ip_address: fc.option(fc.ipV4(), { nil: null }),
  device_info: fc.option(fc.string(), { nil: null }),
  manual_total_count: fc.integer({ min: 0, max: 10 }),
  manual_graded_count: fc.integer({ min: 0, max: 10 }),
  manual_pending_count: fc.integer({ min: 0, max: 10 }),
}) as fc.Arbitrary<Attempt>;

const studentSummaryArbitrary = fc.record({
  student_id: fc.uuid(),
  student_name: fc.string({ minLength: 1, maxLength: 50 }),
  code: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  scores: fc.dictionary(fc.uuid(), fc.option(fc.integer({ min: 0, max: 100 }), { nil: null })),
  attempt_counts: fc.dictionary(fc.uuid(), fc.integer({ min: 0, max: 10 })),
  extra_data: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
}) as fc.Arbitrary<StudentSummary>;

describe('Filter and Sort - Property Tests', () => {
  describe('Property 7: Filtering preserves data integrity', () => {
    it('should not modify original array', () => {
      // Feature: results-page-rebuild, Property 7: Filtering preserves data integrity
      // Validates: Requirements 6.1-6.7
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 1, maxLength: 20 }),
          fc.string(),
          (attempts, searchTerm) => {
            const original = JSON.parse(JSON.stringify(attempts));
            filterAttemptsByStudent(attempts, searchTerm);
            
            // Original array should be unchanged
            expect(attempts).toEqual(original);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return subset of original data', () => {
      // Feature: results-page-rebuild, Property 7: Filtering preserves data integrity
      // Validates: Requirements 6.1-6.7
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 1, maxLength: 20 }),
          fc.string(),
          (attempts, searchTerm) => {
            const filtered = filterAttemptsByStudent(attempts, searchTerm);
            
            // Every filtered item should exist in original
            filtered.forEach(item => {
              expect(attempts).toContainEqual(item);
            });
            
            // Filtered length should not exceed original
            expect(filtered.length).toBeLessThanOrEqual(attempts.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all properties of filtered items', () => {
      // Feature: results-page-rebuild, Property 7: Filtering preserves data integrity
      // Validates: Requirements 6.1-6.7
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 1, maxLength: 20 }),
          fc.string(),
          (attempts, searchTerm) => {
            const filtered = filterAttemptsByStudent(attempts, searchTerm);
            
            // Each filtered item should be identical to its original
            filtered.forEach(item => {
              const original = attempts.find(a => a.id === item.id);
              expect(item).toEqual(original);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Case-insensitive search equivalence', () => {
    it('should return same results regardless of search term case', () => {
      // Feature: results-page-rebuild, Property 8: Case-insensitive search equivalence
      // Validates: Requirements 6.4
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          (attempts, searchTerm) => {
            const lowerResult = filterAttemptsByStudent(attempts, searchTerm.toLowerCase());
            const upperResult = filterAttemptsByStudent(attempts, searchTerm.toUpperCase());
            const mixedResult = filterAttemptsByStudent(attempts, searchTerm);
            
            // All should return same IDs
            const lowerIds = lowerResult.map(a => a.id).sort();
            const upperIds = upperResult.map(a => a.id).sort();
            const mixedIds = mixedResult.map(a => a.id).sort();
            
            expect(lowerIds).toEqual(upperIds);
            expect(lowerIds).toEqual(mixedIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should match regardless of student name case', () => {
      // Feature: results-page-rebuild, Property 8: Case-insensitive search equivalence
      // Validates: Requirements 6.4
      
      const attempt: Attempt = {
        id: 'test-1',
        exam_id: 'exam-1',
        student_id: 'student-1',
        student_name: 'John Doe',
        code: 'CODE123',
        completion_status: 'completed',
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        score_percentage: 85,
        final_score_percentage: 85,
        ip_address: '192.168.1.1',
        device_info: null,
        manual_total_count: 0,
        manual_graded_count: 0,
        manual_pending_count: 0,
      };

      const attempts = [attempt];
      
      expect(filterAttemptsByStudent(attempts, 'john')).toHaveLength(1);
      expect(filterAttemptsByStudent(attempts, 'JOHN')).toHaveLength(1);
      expect(filterAttemptsByStudent(attempts, 'JoHn')).toHaveLength(1);
      expect(filterAttemptsByStudent(attempts, 'code123')).toHaveLength(1);
      expect(filterAttemptsByStudent(attempts, 'CODE123')).toHaveLength(1);
    });
  });

  describe('Property 9: Sorting maintains order consistency', () => {
    it('should maintain consistent order for same inputs', () => {
      // Feature: results-page-rebuild, Property 9: Sorting maintains order consistency
      // Validates: Requirements 7.1-7.4
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 2, maxLength: 20 }),
          fc.constantFrom('asc', 'desc'),
          (attempts, order) => {
            const sorted1 = sortAttemptsByScore(attempts, order);
            const sorted2 = sortAttemptsByScore(attempts, order);
            
            // Should produce identical order
            expect(sorted1.map(a => a.id)).toEqual(sorted2.map(a => a.id));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place null scores last in both directions', () => {
      // Feature: results-page-rebuild, Property 9: Sorting maintains order consistency
      // Validates: Requirements 7.4
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 5, maxLength: 20 }),
          fc.constantFrom('asc', 'desc'),
          (attempts, order) => {
            const sorted = sortAttemptsByScore(attempts, order);
            
            // Find first null score
            const firstNullIndex = sorted.findIndex(a => 
              (a.final_score_percentage ?? a.score_percentage) === null
            );
            
            if (firstNullIndex !== -1) {
              // All items after first null should also be null
              for (let i = firstNullIndex; i < sorted.length; i++) {
                const score = sorted[i].final_score_percentage ?? sorted[i].score_percentage;
                expect(score).toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain ascending order when specified', () => {
      // Feature: results-page-rebuild, Property 9: Sorting maintains order consistency
      // Validates: Requirements 7.1
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 2, maxLength: 20 }),
          (attempts) => {
            const sorted = sortAttemptsByScore(attempts, 'asc');
            
            // Check that non-null scores are in ascending order
            for (let i = 0; i < sorted.length - 1; i++) {
              const scoreA = sorted[i].final_score_percentage ?? sorted[i].score_percentage;
              const scoreB = sorted[i + 1].final_score_percentage ?? sorted[i + 1].score_percentage;
              
              if (scoreA !== null && scoreB !== null) {
                expect(scoreA).toBeLessThanOrEqual(scoreB);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain descending order when specified', () => {
      // Feature: results-page-rebuild, Property 9: Sorting maintains order consistency
      // Validates: Requirements 7.1
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 2, maxLength: 20 }),
          (attempts) => {
            const sorted = sortAttemptsByScore(attempts, 'desc');
            
            // Check that non-null scores are in descending order
            for (let i = 0; i < sorted.length - 1; i++) {
              const scoreA = sorted[i].final_score_percentage ?? sorted[i].score_percentage;
              const scoreB = sorted[i + 1].final_score_percentage ?? sorted[i + 1].score_percentage;
              
              if (scoreA !== null && scoreB !== null) {
                expect(scoreA).toBeGreaterThanOrEqual(scoreB);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 10: Sort stability with filters', () => {
    it('should produce same results when filtering then sorting vs sorting then filtering', () => {
      // Feature: results-page-rebuild, Property 10: Sort stability with filters
      // Validates: Requirements 6.5, 7.3
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 5, maxLength: 20 }),
          fc.string(),
          fc.constantFrom('asc', 'desc'),
          (attempts, searchTerm, order) => {
            // Filter then sort
            const filtered = filterAttemptsByStudent(attempts, searchTerm);
            const filterThenSort = sortAttemptsByScore(filtered, order);
            
            // Sort then filter
            const sorted = sortAttemptsByScore(attempts, order);
            const sortThenFilter = filterAttemptsByStudent(sorted, searchTerm);
            
            // Should contain same items (order may differ due to sort stability)
            const ids1 = filterThenSort.map(a => a.id).sort();
            const ids2 = sortThenFilter.map(a => a.id).sort();
            
            expect(ids1).toEqual(ids2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 22: Date range filter inclusivity', () => {
    it('should include attempts on boundary dates', () => {
      // Feature: results-page-rebuild, Property 22: Date range filter inclusivity
      // Validates: Requirements 6.2
      
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');
      
      const attemptOnStart: Attempt = {
        id: 'test-1',
        exam_id: 'exam-1',
        student_id: 'student-1',
        student_name: 'Test Student',
        code: 'CODE1',
        completion_status: 'completed',
        started_at: startDate.toISOString(),
        submitted_at: startDate.toISOString(),
        score_percentage: 85,
        final_score_percentage: 85,
        ip_address: '192.168.1.1',
        device_info: null,
        manual_total_count: 0,
        manual_graded_count: 0,
        manual_pending_count: 0,
      };

      const attemptOnEnd: Attempt = {
        ...attemptOnStart,
        id: 'test-2',
        submitted_at: endDate.toISOString(),
      };

      const attempts = [attemptOnStart, attemptOnEnd];
      
      const filtered = filterAttemptsByDateRange(
        attempts,
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      // Both boundary attempts should be included
      expect(filtered).toHaveLength(2);
    });

    it('should exclude attempts outside date range', () => {
      // Feature: results-page-rebuild, Property 22: Date range filter inclusivity
      // Validates: Requirements 6.2
      
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 5, maxLength: 20 }),
          fc.date(),
          fc.date(),
          (attempts, date1, date2) => {
            const startDate = date1 < date2 ? date1 : date2;
            const endDate = date1 < date2 ? date2 : date1;
            
            const filtered = filterAttemptsByDateRange(
              attempts,
              startDate.toISOString(),
              endDate.toISOString()
            );
            
            // All filtered attempts should be within range
            filtered.forEach(attempt => {
              if (attempt.submitted_at) {
                const submittedTime = new Date(attempt.submitted_at).getTime();
                expect(submittedTime).toBeGreaterThanOrEqual(startDate.getTime());
                expect(submittedTime).toBeLessThanOrEqual(endDate.getTime());
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Summary filtering properties', () => {
    it('should preserve data integrity when filtering summaries', () => {
      fc.assert(
        fc.property(
          fc.array(studentSummaryArbitrary, { minLength: 1, maxLength: 20 }),
          fc.string(),
          (summaries, searchTerm) => {
            const filtered = filterSummariesByStudent(summaries, searchTerm);
            
            // Every filtered item should exist in original
            filtered.forEach(item => {
              expect(summaries).toContainEqual(item);
            });
            
            // Filtered length should not exceed original
            expect(filtered.length).toBeLessThanOrEqual(summaries.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle case-insensitive search for summaries', () => {
      fc.assert(
        fc.property(
          fc.array(studentSummaryArbitrary, { minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          (summaries, searchTerm) => {
            const lowerResult = filterSummariesByStudent(summaries, searchTerm.toLowerCase());
            const upperResult = filterSummariesByStudent(summaries, searchTerm.toUpperCase());
            
            // Should return same IDs
            const lowerIds = lowerResult.map(s => s.student_id).sort();
            const upperIds = upperResult.map(s => s.student_id).sort();
            
            expect(lowerIds).toEqual(upperIds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
