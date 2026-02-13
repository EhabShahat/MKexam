/**
 * Property-Based Tests for Core Score Calculator Properties
 * 
 * Tests the fundamental correctness properties that must hold across
 * all valid inputs: determinism, score range validation, and rounding consistency.
 * 
 * Feature: score-calculation-optimization
 */

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { calculateFinalScore } from '../scoreCalculator';
import {
  arbitraryCalculationInput,
  arbitraryValidCalculationInput,
} from './scoreCalculator.testUtils';

describe('Score Calculator - Core Properties', () => {
  /**
   * Property 1: Calculation Determinism
   * 
   * For any calculation input, calling the Score_Calculator multiple times
   * SHALL produce identical results, and the function SHALL not modify any input data.
   * 
   * Validates: Requirements 3.1, 3.2, 6.1
   * Feature: score-calculation-optimization, Property 1: Calculation Determinism
   */
  it('Property 1: Calculation Determinism', () => {
    fc.assert(
      fc.property(
        arbitraryCalculationInput(),
        (input) => {
          // Deep clone the input to check for mutations
          const inputClone = JSON.parse(JSON.stringify(input));
          
          // Calculate score twice
          const result1 = calculateFinalScore(input);
          const result2 = calculateFinalScore(input);
          
          // Results should be identical
          expect(result1).toEqual(result2);
          
          // Input should not be modified (check deep equality)
          expect(input).toEqual(inputClone);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Score Range Validation
   * 
   * For any valid calculation result, all score values (exam component,
   * extra component, final score, normalized scores) SHALL be within
   * the range [0, 100] or null.
   * 
   * Validates: Requirements 9.5
   * Feature: score-calculation-optimization, Property 3: Score Range Validation
   */
  it('Property 3: Score Range Validation', () => {
    fc.assert(
      fc.property(
        arbitraryCalculationInput(),
        (input) => {
          const result = calculateFinalScore(input);
          
          // If calculation succeeded, check all scores are in valid range
          if (result.success) {
            // Check exam component score
            if (result.examComponent.score !== null) {
              expect(result.examComponent.score).toBeGreaterThanOrEqual(0);
              expect(result.examComponent.score).toBeLessThanOrEqual(100);
            }
            
            // Check each exam detail score
            result.examComponent.details.forEach((detail, index) => {
              expect(detail.score).toBeGreaterThanOrEqual(0);
              expect(detail.score).toBeLessThanOrEqual(100);
            });
            
            // Check extra component score
            if (result.extraComponent.score !== null) {
              expect(result.extraComponent.score).toBeGreaterThanOrEqual(0);
              expect(result.extraComponent.score).toBeLessThanOrEqual(100);
            }
            
            // Check each extra field normalized score
            result.extraComponent.details.forEach((detail, index) => {
              expect(detail.normalizedScore).toBeGreaterThanOrEqual(0);
              expect(detail.normalizedScore).toBeLessThanOrEqual(100);
            });
            
            // Check final score
            if (result.finalScore !== null) {
              expect(result.finalScore).toBeGreaterThanOrEqual(0);
              expect(result.finalScore).toBeLessThanOrEqual(100);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Rounding Consistency
   * 
   * For any calculated score, the final score and all component scores
   * SHALL be rounded to exactly 2 decimal places in all contexts.
   * 
   * Validates: Requirements 3.3
   * Feature: score-calculation-optimization, Property 4: Rounding Consistency
   */
  it('Property 4: Rounding Consistency', () => {
    fc.assert(
      fc.property(
        arbitraryCalculationInput(),
        (input) => {
          const result = calculateFinalScore(input);
          
          // Helper function to check if a number has at most 2 decimal places
          const hasAtMost2Decimals = (num: number): boolean => {
            // Convert to string and check decimal places
            const str = num.toString();
            const decimalIndex = str.indexOf('.');
            
            if (decimalIndex === -1) {
              // No decimal point - valid
              return true;
            }
            
            const decimalPlaces = str.length - decimalIndex - 1;
            return decimalPlaces <= 2;
          };
          
          if (result.success) {
            // Check exam component score
            if (result.examComponent.score !== null) {
              expect(hasAtMost2Decimals(result.examComponent.score)).toBe(true);
            }
            
            // Check each exam detail score
            result.examComponent.details.forEach((detail) => {
              expect(hasAtMost2Decimals(detail.score)).toBe(true);
            });
            
            // Check extra component score
            if (result.extraComponent.score !== null) {
              expect(hasAtMost2Decimals(result.extraComponent.score)).toBe(true);
            }
            
            // Check each extra field normalized score
            result.extraComponent.details.forEach((detail) => {
              expect(hasAtMost2Decimals(detail.normalizedScore)).toBe(true);
            });
            
            // Check final score
            if (result.finalScore !== null) {
              expect(hasAtMost2Decimals(result.finalScore)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
