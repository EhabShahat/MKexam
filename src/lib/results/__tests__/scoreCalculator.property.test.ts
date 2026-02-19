/**
 * Property-Based Tests for Score Calculator
 * 
 * Uses fast-check to validate universal properties of score calculations
 * with randomly generated inputs.
 * 
 * Feature: results-page-rebuild
 * Requirements: 5.1-5.9
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateExamComponent,
  calculateExtraComponent,
  calculateFinalScore,
  normalizeExtraFieldValue,
} from '../scoreCalculator';
import type { Exam, ExtraField, AppSettings } from '../types';

// Arbitraries for generating test data
const examArbitrary = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  status: fc.constantFrom('published', 'completed', 'draft'),
  access_type: fc.constantFrom('open', 'code', 'ip'),
  exam_type: fc.constantFrom('exam', 'quiz', 'homework'),
  scheduling_mode: fc.constantFrom('Auto', 'Manual'),
  is_manually_published: fc.boolean(),
  is_archived: fc.boolean(),
  start_time: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()), { nil: null }),
  end_time: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()), { nil: null }),
  include_in_pass: fc.boolean(),
  pass_threshold: fc.integer({ min: 0, max: 100 }),
}) as fc.Arbitrary<Exam>;

const extraFieldArbitrary = fc.record({
  key: fc.string({ minLength: 1, maxLength: 20 }),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.constantFrom('number', 'text', 'boolean'),
  hidden: fc.boolean(),
  include_in_pass: fc.boolean(),
  pass_weight: fc.option(fc.float({ min: 0, max: 1 }), { nil: null }),
  max_points: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  bool_true_points: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  bool_false_points: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  text_score_map: fc.option(fc.dictionary(fc.string(), fc.integer({ min: 0, max: 100 })), { nil: null }),
}) as fc.Arbitrary<ExtraField>;

const appSettingsArbitrary = fc.record({
  result_pass_calc_mode: fc.constantFrom('best', 'avg'),
  result_overall_pass_threshold: fc.integer({ min: 0, max: 100 }),
  result_exam_weight: fc.float({ min: 0, max: 1 }),
  result_fail_on_any_exam: fc.boolean(),
}) as fc.Arbitrary<AppSettings>;

describe('Score Calculator - Property Tests', () => {
  describe('Property 1: Score calculation determinism', () => {
    it('should produce identical results for same inputs across multiple runs', () => {
      // Feature: results-page-rebuild, Property 1: Score calculation determinism
      // Validates: Requirements 5.1, 5.2, 5.3, 5.5, 5.6, 5.7
      
      fc.assert(
        fc.property(
          fc.array(examArbitrary, { minLength: 1, maxLength: 10 }),
          fc.array(extraFieldArbitrary, { minLength: 0, maxLength: 5 }),
          appSettingsArbitrary,
          fc.dictionary(fc.uuid(), fc.option(fc.integer({ min: 0, max: 100 }), { nil: null })),
          fc.dictionary(fc.string(), fc.oneof(
            fc.integer({ min: 0, max: 100 }),
            fc.boolean(),
            fc.string()
          )),
          (exams, fields, settings, scores, extraData) => {
            // Calculate scores multiple times
            const examComp1 = calculateExamComponent(scores, exams, settings.result_pass_calc_mode);
            const examComp2 = calculateExamComponent(scores, exams, settings.result_pass_calc_mode);
            
            const extraComp1 = calculateExtraComponent(extraData, fields);
            const extraComp2 = calculateExtraComponent(extraData, fields);
            
            const final1 = calculateFinalScore(examComp1, extraComp1, settings);
            const final2 = calculateFinalScore(examComp2, extraComp2, settings);
            
            // Results should be identical
            expect(examComp1).toEqual(examComp2);
            expect(extraComp1).toEqual(extraComp2);
            expect(final1).toEqual(final2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Exam component best mode correctness', () => {
    it('should return the maximum score when mode is "best"', () => {
      // Feature: results-page-rebuild, Property 2: Exam component best mode correctness
      // Validates: Requirements 5.2, 5.3, 5.4
      
      fc.assert(
        fc.property(
          fc.array(examArbitrary, { minLength: 1, maxLength: 10 }),
          fc.dictionary(fc.uuid(), fc.integer({ min: 0, max: 100 })),
          (exams, scores) => {
            // Set all exams to include_in_pass
            const includedExams = exams.map(e => ({ ...e, include_in_pass: true }));
            
            const result = calculateExamComponent(scores, includedExams, 'best');
            
            // Get valid scores for included exams
            const validScores = includedExams
              .map(e => scores[e.id])
              .filter((s): s is number => s !== null && s !== undefined);
            
            if (validScores.length > 0) {
              const expectedMax = Math.max(...validScores);
              expect(result.score).toBe(expectedMax);
            } else {
              expect(result.score).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Exam component average mode correctness', () => {
    it('should return the average score when mode is "avg"', () => {
      // Feature: results-page-rebuild, Property 3: Exam component average mode correctness
      // Validates: Requirements 5.2, 5.3, 5.4
      
      fc.assert(
        fc.property(
          fc.array(examArbitrary, { minLength: 1, maxLength: 10 }),
          fc.dictionary(fc.uuid(), fc.integer({ min: 0, max: 100 })),
          (exams, scores) => {
            // Set all exams to include_in_pass
            const includedExams = exams.map(e => ({ ...e, include_in_pass: true }));
            
            const result = calculateExamComponent(scores, includedExams, 'avg');
            
            // Get valid scores for included exams
            const validScores = includedExams
              .map(e => scores[e.id])
              .filter((s): s is number => s !== null && s !== undefined);
            
            if (validScores.length > 0) {
              const sum = validScores.reduce((acc, s) => acc + s, 0);
              const expectedAvg = sum / validScores.length;
              expect(result.score).toBeCloseTo(expectedAvg, 5);
            } else {
              expect(result.score).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Extra field normalization', () => {
    it('should produce normalized scores between 0-100', () => {
      // Feature: results-page-rebuild, Property 4: Extra field normalization
      // Validates: Requirements 5.6
      
      fc.assert(
        fc.property(
          extraFieldArbitrary,
          fc.oneof(
            fc.integer({ min: 0, max: 200 }),
            fc.boolean(),
            fc.string()
          ),
          (field, value) => {
            const normalized = normalizeExtraFieldValue(value, field);
            
            // Score should be between 0 and 100
            expect(normalized).toBeGreaterThanOrEqual(0);
            expect(normalized).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should normalize max_points to 100', () => {
      // Feature: results-page-rebuild, Property 4: Extra field normalization
      // Validates: Requirements 5.6
      
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (maxPoints) => {
            const field: ExtraField = {
              key: 'test',
              label: 'Test',
              type: 'number',
              hidden: false,
              include_in_pass: true,
              pass_weight: 1,
              max_points: maxPoints,
              bool_true_points: null,
              bool_false_points: null,
              text_score_map: null,
            };
            
            const normalized = normalizeExtraFieldValue(maxPoints, field);
            
            // Max points should normalize to 100
            expect(normalized).toBe(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Pass/fail determination with exam requirement', () => {
    it('should fail student if any included exam is below threshold when fail_on_any_exam is true', () => {
      // Feature: results-page-rebuild, Property 5: Pass/fail determination with exam requirement
      // Validates: Requirements 5.8, 5.9
      
      fc.assert(
        fc.property(
          fc.array(examArbitrary, { minLength: 2, maxLength: 5 }),
          fc.dictionary(fc.uuid(), fc.integer({ min: 0, max: 100 })),
          fc.integer({ min: 0, max: 100 }),
          (exams, scores, threshold) => {
            // Set all exams to include_in_pass
            const includedExams = exams.map(e => ({ 
              ...e, 
              include_in_pass: true,
              pass_threshold: threshold,
            }));
            
            const settings: AppSettings = {
              result_pass_calc_mode: 'best',
              result_overall_pass_threshold: 0, // Set low so we only test exam requirement
              result_exam_weight: 1,
              result_fail_on_any_exam: true,
            };
            
            const examComp = calculateExamComponent(scores, includedExams, 'best');
            const extraComp = calculateExtraComponent({}, []);
            const result = calculateFinalScore(examComp, extraComp, settings);
            
            // Check if any exam failed
            const hasFailedExam = examComp.details.some(
              d => d.score !== null && d.score < threshold
            );
            
            if (hasFailedExam) {
              expect(result.passed).toBe(false);
              expect(result.failed_due_to_exam).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Pass/fail determination by threshold', () => {
    it('should pass student if final score meets or exceeds threshold', () => {
      // Feature: results-page-rebuild, Property 6: Pass/fail determination by threshold
      // Validates: Requirements 5.8, 5.9
      
      fc.assert(
        fc.property(
          fc.array(examArbitrary, { minLength: 1, maxLength: 5 }),
          fc.dictionary(fc.uuid(), fc.integer({ min: 0, max: 100 })),
          fc.integer({ min: 0, max: 100 }),
          (exams, scores, passThreshold) => {
            // Set all exams to include_in_pass with low thresholds
            const includedExams = exams.map(e => ({ 
              ...e, 
              include_in_pass: true,
              pass_threshold: 0, // Set low so exams don't cause failure
            }));
            
            const settings: AppSettings = {
              result_pass_calc_mode: 'best',
              result_overall_pass_threshold: passThreshold,
              result_exam_weight: 1,
              result_fail_on_any_exam: false, // Disable exam requirement
            };
            
            const examComp = calculateExamComponent(scores, includedExams, 'best');
            const extraComp = calculateExtraComponent({}, []);
            const result = calculateFinalScore(examComp, extraComp, settings);
            
            // Check pass/fail based on threshold
            if (result.final_score >= passThreshold) {
              expect(result.passed).toBe(true);
            } else {
              expect(result.passed).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
