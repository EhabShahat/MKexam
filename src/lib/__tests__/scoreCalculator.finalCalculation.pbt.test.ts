/**
 * Property-Based Tests for Final Score Calculation
 * 
 * Feature: score-calculation-optimization
 * Tests: Property 8, 9, 10 - Weighted Combination, Pass/Fail, Fail on Any Exam
 * 
 * These tests verify that final score calculation, pass/fail determination,
 * and the failOnAnyExam rule work correctly across all valid input combinations.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateFinalScore } from '../scoreCalculator';
import {
  createMinimalInput,
  createInputWithExams,
  createInputWithExtras,
} from './scoreCalculator.testUtils';

describe('Final Calculation Property-Based Tests', () => {
  describe('Property 8: Weighted Component Combination', () => {
    it('should combine exam and extra components using weighted formula', () => {
      // Feature: score-calculation-optimization, Property 8: Weighted Component Combination
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }), // exam score
          fc.float({ min: 0, max: 100, noNaN: true }), // extra score
          fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }), // exam weight
          fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }), // extra weight
          (examScore, extraScore, examWeight, extraWeight) => {
            const input = createMinimalInput({
              examAttempts: [
                {
                  examId: 'exam-1',
                  examTitle: 'Test Exam',
                  scorePercentage: examScore,
                  finalScorePercentage: examScore,
                  includeInPass: true,
                  passThreshold: null,
                },
              ],
              extraFields: [
                {
                  key: 'extra_field',
                  label: 'Extra Field',
                  type: 'number',
                  includeInPass: true,
                  passWeight: extraWeight,
                  maxPoints: null,
                },
              ],
              extraScores: {
                extra_field: extraScore,
              },
              settings: {
                passCalcMode: 'best',
                overallPassThreshold: 50,
                examWeight: examWeight,
                examScoreSource: 'final',
                failOnAnyExam: false,
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            expect(result.finalScore).not.toBeNull();

            // Calculate expected weighted average
            const totalWeight = examWeight + extraWeight;
            const expectedScore = (examScore * examWeight + extraScore * extraWeight) / totalWeight;
            
            // Round to 2 decimal places for comparison
            const roundedExpected = Math.round(expectedScore * 100) / 100;
            
            // The result should also be rounded to 2 decimal places
            // Allow tolerance of 0.02 for floating point arithmetic (to handle cases like 0.010000000000000009)
            if (result.finalScore !== null) {
              expect(Math.abs(result.finalScore - roundedExpected)).toBeLessThanOrEqual(0.02);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 9: Pass/Fail Determination', () => {
    it('should determine pass status based on final score and threshold', () => {
      // Feature: score-calculation-optimization, Property 9: Pass/Fail Determination
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }), // final score (avoid very small values)
          fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }), // threshold (avoid very small values)
          (finalScore, threshold) => {
            const input = createMinimalInput({
              examAttempts: [
                {
                  examId: 'exam-1',
                  examTitle: 'Test Exam',
                  scorePercentage: finalScore,
                  finalScorePercentage: finalScore,
                  includeInPass: true,
                  passThreshold: null,
                },
              ],
              settings: {
                passCalcMode: 'best',
                overallPassThreshold: threshold,
                examWeight: 1.0,
                examScoreSource: 'final',
                failOnAnyExam: false,
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            expect(result.finalScore).not.toBeNull();
            
            // Pass status should be determined by the calculator's final score vs threshold
            // The calculator rounds the final score to 2 decimal places
            if (result.finalScore !== null) {
              const expectedPass = result.finalScore >= input.settings.overallPassThreshold;
              expect(result.passed).toBe(expectedPass);
            }
            expect(result.failedDueToExam).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return null passed status when final score is null', () => {
      // Feature: score-calculation-optimization, Property 9: Pass/Fail Determination
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }), // threshold
          (threshold) => {
            const input = createMinimalInput({
              examAttempts: [], // No exams
              extraFields: [], // No extras
              settings: {
                passCalcMode: 'best',
                overallPassThreshold: threshold,
                examWeight: 1.0,
                examScoreSource: 'final',
                failOnAnyExam: false,
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            expect(result.finalScore).toBeNull();
            expect(result.passed).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 10: Fail on Any Exam Rule', () => {
    it('should fail overall when any exam fails and failOnAnyExam is true', () => {
      // Feature: score-calculation-optimization, Property 10: Fail on Any Exam Rule
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }), // passing exam score
          fc.float({ min: 0, max: 100, noNaN: true }), // failing exam score
          fc.float({ min: 0, max: 100, noNaN: true }), // exam threshold
          (passingScore, failingScore, threshold) => {
            // Ensure failing score is actually below threshold
            const actualFailingScore = Math.min(failingScore, threshold - 0.01);
            // Ensure passing score is actually above threshold
            const actualPassingScore = Math.max(passingScore, threshold + 0.01);
            
            // Skip if we can't create valid test case
            if (actualFailingScore < 0 || actualPassingScore > 100) {
              return true;
            }

            const input = createMinimalInput({
              examAttempts: [
                {
                  examId: 'exam-1',
                  examTitle: 'Passing Exam',
                  scorePercentage: actualPassingScore,
                  finalScorePercentage: actualPassingScore,
                  includeInPass: true,
                  passThreshold: threshold,
                },
                {
                  examId: 'exam-2',
                  examTitle: 'Failing Exam',
                  scorePercentage: actualFailingScore,
                  finalScorePercentage: actualFailingScore,
                  includeInPass: true,
                  passThreshold: threshold,
                },
              ],
              settings: {
                passCalcMode: 'best',
                overallPassThreshold: 0, // Very low threshold so final score would pass
                examWeight: 1.0,
                examScoreSource: 'final',
                failOnAnyExam: true, // Enable the rule
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            
            // Even though final score might be high, should fail due to one exam failing
            expect(result.passed).toBe(false);
            expect(result.failedDueToExam).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should pass overall when all exams pass and failOnAnyExam is true', () => {
      // Feature: score-calculation-optimization, Property 10: Fail on Any Exam Rule
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }), // exam score 1
          fc.float({ min: 0, max: 100, noNaN: true }), // exam score 2
          fc.float({ min: 0, max: 100, noNaN: true }), // exam threshold
          fc.float({ min: 0, max: 100, noNaN: true }), // overall threshold
          (score1, score2, examThreshold, overallThreshold) => {
            // Ensure both scores are above exam threshold
            const actualScore1 = Math.max(score1, examThreshold + 0.01);
            const actualScore2 = Math.max(score2, examThreshold + 0.01);
            
            // Skip if we can't create valid test case
            if (actualScore1 > 100 || actualScore2 > 100) {
              return true;
            }

            const input = createMinimalInput({
              examAttempts: [
                {
                  examId: 'exam-1',
                  examTitle: 'Exam 1',
                  scorePercentage: actualScore1,
                  finalScorePercentage: actualScore1,
                  includeInPass: true,
                  passThreshold: examThreshold,
                },
                {
                  examId: 'exam-2',
                  examTitle: 'Exam 2',
                  scorePercentage: actualScore2,
                  finalScorePercentage: actualScore2,
                  includeInPass: true,
                  passThreshold: examThreshold,
                },
              ],
              settings: {
                passCalcMode: 'best',
                overallPassThreshold: overallThreshold,
                examWeight: 1.0,
                examScoreSource: 'final',
                failOnAnyExam: true,
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            expect(result.failedDueToExam).toBe(false);
            
            // Pass status should depend on final score vs overall threshold
            if (result.finalScore !== null) {
              const expectedPass = result.finalScore >= overallThreshold;
              expect(result.passed).toBe(expectedPass);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not apply failOnAnyExam rule when disabled', () => {
      // Feature: score-calculation-optimization, Property 10: Fail on Any Exam Rule
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }), // passing exam score
          fc.float({ min: 0, max: 100, noNaN: true }), // failing exam score
          fc.float({ min: 0, max: 100, noNaN: true }), // exam threshold
          (passingScore, failingScore, threshold) => {
            // Ensure failing score is actually below threshold
            const actualFailingScore = Math.min(failingScore, threshold - 0.01);
            // Ensure passing score is actually above threshold
            const actualPassingScore = Math.max(passingScore, threshold + 0.01);
            
            // Skip if we can't create valid test case
            if (actualFailingScore < 0 || actualPassingScore > 100) {
              return true;
            }

            const input = createMinimalInput({
              examAttempts: [
                {
                  examId: 'exam-1',
                  examTitle: 'Passing Exam',
                  scorePercentage: actualPassingScore,
                  finalScorePercentage: actualPassingScore,
                  includeInPass: true,
                  passThreshold: threshold,
                },
                {
                  examId: 'exam-2',
                  examTitle: 'Failing Exam',
                  scorePercentage: actualFailingScore,
                  finalScorePercentage: actualFailingScore,
                  includeInPass: true,
                  passThreshold: threshold,
                },
              ],
              settings: {
                passCalcMode: 'best',
                overallPassThreshold: 0, // Very low threshold
                examWeight: 1.0,
                examScoreSource: 'final',
                failOnAnyExam: false, // Disable the rule
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            expect(result.failedDueToExam).toBe(false);
            
            // Should pass based on final score (best mode with high passing score)
            // Final score should be actualPassingScore (best mode)
            expect(result.finalScore).toBeCloseTo(actualPassingScore, 2);
            expect(result.passed).toBe(true); // Should pass since threshold is 0
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});