/**
 * Property-Based Tests for Exam Component Calculation
 * 
 * Feature: score-calculation-optimization, Property 5: Exam Component Calculation - Best Mode
 * Feature: score-calculation-optimization, Property 6: Exam Component Calculation - Average Mode
 * Validates: Requirements 3.1
 * 
 * Tests that the exam component calculation correctly implements both 'best' and 'avg' modes.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateFinalScore } from '../scoreCalculator';
import {
  createInputWithExams,
  arbitraryValidCalculationInput,
} from './scoreCalculator.testUtils';

describe('Score Calculator - Exam Component Properties', () => {
  describe('Property 5: Exam Component Calculation - Best Mode', () => {
    it('should return the maximum score among included exams in best mode', () => {
      const scores = [70, 85, 92, 78];
      const input = createInputWithExams(scores, 'best');
      
      const result = calculateFinalScore(input);
      
      expect(result.success).toBe(true);
      expect(result.examComponent.mode).toBe('best');
      expect(result.examComponent.score).toBe(92); // Maximum score
      expect(result.examComponent.examsIncluded).toBe(4);
    });

    it('Property 5: best mode should always return max score', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }), { minLength: 1, maxLength: 10 }),
          (scores) => {
            const input = createInputWithExams(scores, 'best');
            const result = calculateFinalScore(input);
            
            expect(result.success).toBe(true);
            expect(result.examComponent.mode).toBe('best');
            
            // Account for rounding in implementation
            const expectedMax = Math.round(Math.max(...scores) * 100) / 100;
            expect(result.examComponent.score).toBe(expectedMax);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 5: best mode score should be >= all individual exam scores', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }), { minLength: 1, maxLength: 10 }),
          (scores) => {
            const input = createInputWithExams(scores, 'best');
            const result = calculateFinalScore(input);
            
            expect(result.success).toBe(true);
            
            // Best score should be >= all individual scores (accounting for rounding)
            result.examComponent.details.forEach(detail => {
              if (detail.included) {
                // Allow for small floating point differences due to rounding
                expect(result.examComponent.score!).toBeGreaterThanOrEqual(detail.score - 0.01);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 5: best mode with single exam should return that exam score', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }),
          (score) => {
            const input = createInputWithExams([score], 'best');
            const result = calculateFinalScore(input);
            
            expect(result.success).toBe(true);
            // Account for rounding in implementation
            const expectedScore = Math.round(score * 100) / 100;
            expect(result.examComponent.score).toBe(expectedScore);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Exam Component Calculation - Average Mode', () => {
    it('should return the average score of included exams in avg mode', () => {
      const scores = [70, 80, 90];
      const input = createInputWithExams(scores, 'avg');
      
      const result = calculateFinalScore(input);
      
      expect(result.success).toBe(true);
      expect(result.examComponent.mode).toBe('avg');
      expect(result.examComponent.score).toBe(80); // Average: (70+80+90)/3 = 80
      expect(result.examComponent.examsIncluded).toBe(3);
    });

    it('Property 6: avg mode should return arithmetic mean', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }), { minLength: 1, maxLength: 10 }),
          (scores) => {
            const input = createInputWithExams(scores, 'avg');
            const result = calculateFinalScore(input);
            
            expect(result.success).toBe(true);
            expect(result.examComponent.mode).toBe('avg');
            
            // Calculate expected average with same rounding logic as implementation
            const sum = scores.reduce((acc, s) => acc + s, 0);
            const rawAvg = sum / scores.length;
            const expectedAvg = Math.round(rawAvg * 100) / 100;
            
            // Allow for small floating-point differences
            const actualScore = result.examComponent.score ?? 0;
            const diff = Math.abs(actualScore - expectedAvg);
            expect(diff).toBeLessThan(0.02); // Increased tolerance for floating-point precision
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 6: avg mode score should be between min and max exam scores', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }), { minLength: 2, maxLength: 10 }),
          (scores) => {
            const input = createInputWithExams(scores, 'avg');
            const result = calculateFinalScore(input);
            
            expect(result.success).toBe(true);
            
            // Round min and max to account for implementation rounding
            const min = Math.round(Math.min(...scores) * 100) / 100;
            const max = Math.round(Math.max(...scores) * 100) / 100;
            
            // Allow for small floating point differences due to rounding
            expect(result.examComponent.score!).toBeGreaterThanOrEqual(min - 0.01);
            expect(result.examComponent.score!).toBeLessThanOrEqual(max + 0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 6: avg mode with single exam should return that exam score', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }),
          (score) => {
            const input = createInputWithExams([score], 'avg');
            const result = calculateFinalScore(input);
            
            expect(result.success).toBe(true);
            // Account for rounding in implementation
            const expectedScore = Math.round(score * 100) / 100;
            expect(result.examComponent.score).toBe(expectedScore);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 6: avg mode with identical scores should return that score', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (score, count) => {
            const scores = Array(count).fill(score);
            const input = createInputWithExams(scores, 'avg');
            const result = calculateFinalScore(input);
            
            expect(result.success).toBe(true);
            // Account for rounding in implementation
            const expectedScore = Math.round(score * 100) / 100;
            expect(result.examComponent.score).toBe(expectedScore);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Common Exam Component Properties', () => {
    it('should only include exams with includeInPass=true', () => {
      fc.assert(
        fc.property(
          arbitraryValidCalculationInput(),
          (input) => {
            const result = calculateFinalScore(input);
            
            expect(result.success).toBe(true);
            
            const expectedIncluded = input.examAttempts.filter(e => e.includeInPass).length;
            expect(result.examComponent.examsIncluded).toBe(expectedIncluded);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track total number of exams correctly', () => {
      fc.assert(
        fc.property(
          arbitraryValidCalculationInput(),
          (input) => {
            const result = calculateFinalScore(input);
            
            expect(result.success).toBe(true);
            expect(result.examComponent.examsTotal).toBe(input.examAttempts.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide details for all exams', () => {
      fc.assert(
        fc.property(
          arbitraryValidCalculationInput(),
          (input) => {
            const result = calculateFinalScore(input);
            
            expect(result.success).toBe(true);
            expect(result.examComponent.details.length).toBe(input.examAttempts.length);
            
            // Each detail should have required fields
            result.examComponent.details.forEach(detail => {
              expect(detail.examId).toBeDefined();
              expect(detail.examTitle).toBeDefined();
              expect(typeof detail.score).toBe('number');
              expect(typeof detail.included).toBe('boolean');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clamp exam scores to [0, 100] range', () => {
      fc.assert(
        fc.property(
          arbitraryValidCalculationInput(),
          (input) => {
            const result = calculateFinalScore(input);
            
            expect(result.success).toBe(true);
            
            // Component score should be in range or null
            if (result.examComponent.score !== null) {
              expect(result.examComponent.score).toBeGreaterThanOrEqual(0);
              expect(result.examComponent.score).toBeLessThanOrEqual(100);
            }
            
            // All detail scores should be in range
            result.examComponent.details.forEach(detail => {
              expect(detail.score).toBeGreaterThanOrEqual(0);
              expect(detail.score).toBeLessThanOrEqual(100);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null score when no exams are included', () => {
      const input = createInputWithExams([], 'best');
      const result = calculateFinalScore(input);
      
      expect(result.success).toBe(true);
      expect(result.examComponent.score).toBeNull();
      expect(result.examComponent.examsIncluded).toBe(0);
    });

    it('should round scores to 2 decimal places', () => {
      const scores = [33.333, 66.666, 99.999];
      const input = createInputWithExams(scores, 'avg');
      
      const result = calculateFinalScore(input);
      
      expect(result.success).toBe(true);
      
      // Check that score has at most 2 decimal places
      const scoreStr = result.examComponent.score!.toString();
      const decimalPart = scoreStr.split('.')[1];
      if (decimalPart) {
        expect(decimalPart.length).toBeLessThanOrEqual(2);
      }
    });
  });
});
