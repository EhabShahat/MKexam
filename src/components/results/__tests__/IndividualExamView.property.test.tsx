/**
 * Property-based tests for IndividualExamView filtering
 * 
 * Tests Property 7 (Filtering preserves data integrity) and
 * Property 22 (Date range filter inclusivity)
 * 
 * Validates: Requirements 6.1-6.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterAttemptsByStudent, filterAttemptsByDateRange } from '@/lib/results/filterSort';
import type { Attempt } from '@/lib/results/types';

describe('IndividualExamView Property Tests', () => {
  // Arbitrary for generating attempts
  const attemptArbitrary = fc.record({
    id: fc.uuid(),
    exam_id: fc.uuid(),
    student_id: fc.option(fc.uuid(), { nil: null }),
    student_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    code: fc.option(fc.string({ minLength: 3, maxLength: 10 }), { nil: null }),
    completion_status: fc.constantFrom('completed', 'in_progress', 'abandoned') as fc.Arbitrary<'completed' | 'in_progress' | 'abandoned'>,
    started_at: fc.option(fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2024-12-31') }).map(ts => new Date(ts).toISOString()), { nil: null }),
    submitted_at: fc.option(fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2024-12-31') }).map(ts => new Date(ts).toISOString()), { nil: null }),
    score_percentage: fc.option(fc.float({ min: 0, max: 100 }), { nil: null }),
    final_score_percentage: fc.option(fc.float({ min: 0, max: 100 }), { nil: null }),
    ip_address: fc.option(fc.ipV4(), { nil: null }),
    device_info: fc.option(fc.jsonValue(), { nil: null }).map(v => v ? JSON.stringify(v) : null),
    manual_total_count: fc.nat({ max: 20 }),
    manual_graded_count: fc.nat({ max: 20 }),
    manual_pending_count: fc.nat({ max: 20 }),
  }) as fc.Arbitrary<Attempt>;

  describe('Property 7: Filtering preserves data integrity', () => {
    it('should include only attempts that match the student filter', () => {
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          (attempts, searchTerm) => {
            const filtered = filterAttemptsByStudent(attempts, searchTerm);

            // Every filtered attempt should match the search term
            const searchLower = searchTerm.toLowerCase().trim();
            filtered.forEach((attempt) => {
              const nameMatch = attempt.student_name?.toLowerCase().includes(searchLower) ?? false;
              const codeMatch = attempt.code?.toLowerCase().includes(searchLower) ?? false;
              expect(nameMatch || codeMatch).toBe(true);
            });

            // No attempt that matches should be excluded
            attempts.forEach((attempt) => {
              const nameMatch = attempt.student_name?.toLowerCase().includes(searchLower) ?? false;
              const codeMatch = attempt.code?.toLowerCase().includes(searchLower) ?? false;
              
              if (nameMatch || codeMatch) {
                expect(filtered).toContainEqual(attempt);
              } else {
                // If neither name nor code match, it should not be in filtered results
                expect(filtered).not.toContainEqual(attempt);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no attempts match filter', () => {
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 1, maxLength: 50 }),
          (attempts) => {
            // Use a search term that definitely won't match
            const impossibleSearch = '___IMPOSSIBLE_MATCH_STRING_XYZ___';
            const filtered = filterAttemptsByStudent(attempts, impossibleSearch);

            expect(filtered).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all attempts when filter is empty', () => {
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 0, maxLength: 100 }),
          (attempts) => {
            const filtered = filterAttemptsByStudent(attempts, '');

            expect(filtered).toHaveLength(attempts.length);
            expect(filtered).toEqual(attempts);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be case-insensitive', () => {
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          (attempts, searchTerm) => {
            const lowerFiltered = filterAttemptsByStudent(attempts, searchTerm.toLowerCase());
            const upperFiltered = filterAttemptsByStudent(attempts, searchTerm.toUpperCase());
            const mixedFiltered = filterAttemptsByStudent(attempts, searchTerm);

            expect(lowerFiltered).toEqual(upperFiltered);
            expect(lowerFiltered).toEqual(mixedFiltered);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 22: Date range filter inclusivity', () => {
    it('should include attempts with submitted_at exactly equal to start_date', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2024-12-31') }),
          (timestamp) => {
            const startDate = new Date(timestamp);
            const startDateStr = startDate.toISOString().split('T')[0];
            
            const attempt: Attempt = {
              id: '1',
              exam_id: 'exam1',
              student_id: 'student1',
              student_name: 'Test Student',
              code: 'CODE123',
              completion_status: 'completed',
              started_at: new Date(startDate.getTime() - 3600000).toISOString(),
              submitted_at: startDate.toISOString(),
              score_percentage: 85,
              final_score_percentage: 85,
              ip_address: '192.168.1.1',
              device_info: null,
              manual_total_count: 0,
              manual_graded_count: 0,
              manual_pending_count: 0,
            };

            const filtered = filterAttemptsByDateRange([attempt], startDateStr, null);

            expect(filtered).toContainEqual(attempt);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include attempts within the date range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2024-01-01') }),
          fc.integer({ min: Date.parse('2024-06-01'), max: Date.parse('2024-12-31') }),
          (startTimestamp, endTimestamp) => {
            const startDate = new Date(startTimestamp);
            const endDate = new Date(endTimestamp);
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];
            
            // Create attempt within range
            const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
            const attempt: Attempt = {
              id: '1',
              exam_id: 'exam1',
              student_id: 'student1',
              student_name: 'Test Student',
              code: 'CODE123',
              completion_status: 'completed',
              started_at: new Date(midDate.getTime() - 3600000).toISOString(),
              submitted_at: midDate.toISOString(),
              score_percentage: 85,
              final_score_percentage: 85,
              ip_address: '192.168.1.1',
              device_info: null,
              manual_total_count: 0,
              manual_graded_count: 0,
              manual_pending_count: 0,
            };

            const filtered = filterAttemptsByDateRange([attempt], startDateStr, endDateStr);

            expect(filtered).toContainEqual(attempt);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude attempts outside the date range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: Date.parse('2023-01-01'), max: Date.parse('2023-06-30') }),
          fc.integer({ min: Date.parse('2023-07-01'), max: Date.parse('2023-12-31') }),
          (startTimestamp, endTimestamp) => {
            const startDate = new Date(startTimestamp);
            const endDate = new Date(endTimestamp);
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];
            
            // Create attempt before range (2 days before to avoid timezone issues)
            const beforeDate = new Date(startDate.getTime() - 2 * 86400000);
            const attemptBefore: Attempt = {
              id: '1',
              exam_id: 'exam1',
              student_id: 'student1',
              student_name: 'Test Student',
              code: 'CODE123',
              completion_status: 'completed',
              started_at: new Date(beforeDate.getTime() - 3600000).toISOString(),
              submitted_at: beforeDate.toISOString(),
              score_percentage: 85,
              final_score_percentage: 85,
              ip_address: '192.168.1.1',
              device_info: null,
              manual_total_count: 0,
              manual_graded_count: 0,
              manual_pending_count: 0,
            };

            // Create attempt after range (2 days after to avoid timezone issues)
            const afterDate = new Date(endDate.getTime() + 2 * 86400000);
            const attemptAfter: Attempt = {
              ...attemptBefore,
              id: '2',
              started_at: new Date(afterDate.getTime() - 3600000).toISOString(),
              submitted_at: afterDate.toISOString(),
            };

            const filtered = filterAttemptsByDateRange([attemptBefore, attemptAfter], startDateStr, endDateStr);

            expect(filtered).not.toContainEqual(attemptBefore);
            expect(filtered).not.toContainEqual(attemptAfter);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle null dates gracefully', () => {
      fc.assert(
        fc.property(
          fc.array(attemptArbitrary, { minLength: 0, maxLength: 50 }),
          (attempts) => {
            // Filter with no date range should return all attempts
            const filtered = filterAttemptsByDateRange(attempts, null, null);

            expect(filtered).toEqual(attempts);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
