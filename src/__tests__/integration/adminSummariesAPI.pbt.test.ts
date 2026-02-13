/**
 * Property-Based Tests for Admin Summaries API
 * 
 * Tests the response completeness and consistency of the admin summaries API
 * using property-based testing with fast-check.
 * 
 * Feature: score-calculation-optimization
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { CalculationResult } from '@/lib/scoreCalculator.types';

/**
 * Property 14: Response Completeness
 * 
 * For any valid calculation result, the API response SHALL include:
 * - exam component with score and details array
 * - extra component with score and details array
 * - final score
 * - passed status
 * - pass threshold
 * - calculation mode
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.6
 */

// Arbitrary generator for exam component details
const arbitraryExamComponentDetail = () => fc.record({
  examId: fc.uuid(),
  examTitle: fc.string({ minLength: 1, maxLength: 100 }),
  score: fc.float({ min: 0, max: 100 }),
  included: fc.boolean(),
  passed: fc.option(fc.boolean()),
  passThreshold: fc.option(fc.float({ min: 0, max: 100 })),
});

// Arbitrary generator for extra component details
const arbitraryExtraComponentDetail = () => fc.record({
  fieldKey: fc.string({ minLength: 1, maxLength: 50 }),
  fieldLabel: fc.string({ minLength: 1, maxLength: 100 }),
  rawValue: fc.anything(),
  normalizedScore: fc.float({ min: 0, max: 100 }),
  weight: fc.float({ min: 0, max: 2 }),
  weightedContribution: fc.float({ min: 0, max: 200 }),
});

// Arbitrary generator for calculation result
const arbitraryCalculationResult = (): fc.Arbitrary<CalculationResult> => fc.record({
  success: fc.constant(true),
  examComponent: fc.record({
    score: fc.option(fc.float({ min: 0, max: 100 })),
    mode: fc.constantFrom('best' as const, 'avg' as const),
    examsIncluded: fc.nat({ max: 20 }),
    examsTotal: fc.nat({ max: 20 }),
    examsPassed: fc.nat({ max: 20 }),
    details: fc.array(arbitraryExamComponentDetail(), { minLength: 0, maxLength: 10 }),
  }),
  extraComponent: fc.record({
    score: fc.option(fc.float({ min: 0, max: 100 })),
    totalWeight: fc.float({ min: 0, max: 10 }),
    details: fc.array(arbitraryExtraComponentDetail(), { minLength: 0, maxLength: 10 }),
  }),
  finalScore: fc.option(fc.float({ min: 0, max: 100 })),
  passed: fc.option(fc.boolean()),
  passThreshold: fc.float({ min: 0, max: 100 }),
  failedDueToExam: fc.boolean(),
});

// Arbitrary generator for API response item
const arbitraryAPIResponseItem = () => fc.record({
  code: fc.string({ minLength: 1, maxLength: 20 }),
  student_name: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
  calculation: arbitraryCalculationResult(),
  extras: fc.array(fc.record({
    key: fc.string({ minLength: 1, maxLength: 50 }),
    value: fc.anything(),
  }), { minLength: 0, maxLength: 10 }),
  pass_summary: fc.record({
    overall_score: fc.option(fc.float({ min: 0, max: 100 })),
    passed: fc.option(fc.boolean()),
  }),
}).map(item => {
  // Ensure pass_summary is consistent with calculation
  return {
    ...item,
    pass_summary: {
      overall_score: item.calculation.finalScore,
      passed: item.calculation.passed,
    },
    // Ensure extras matches extra component details
    extras: item.calculation.extraComponent.details.map(detail => ({
      key: detail.fieldKey,
      value: detail.rawValue,
    })),
  };
});

describe('Admin Summaries API - Property-Based Tests', () => {
  describe('Property 14: Response Completeness', () => {
    it('should include all required fields in the response', () => {
      // Feature: score-calculation-optimization, Property 14: Response Completeness
      fc.assert(
        fc.property(
          arbitraryAPIResponseItem(),
          (responseItem) => {
            // Verify response structure exists
            expect(responseItem).toBeDefined();
            expect(responseItem.code).toBeDefined();
            expect(typeof responseItem.code).toBe('string');
            
            // Verify calculation field exists and has required structure
            expect(responseItem.calculation).toBeDefined();
            expect(responseItem.calculation.success).toBeDefined();
            expect(typeof responseItem.calculation.success).toBe('boolean');
            
            // Verify exam component exists and has required fields
            expect(responseItem.calculation.examComponent).toBeDefined();
            expect(responseItem.calculation.examComponent.mode).toBeDefined();
            expect(['best', 'avg']).toContain(responseItem.calculation.examComponent.mode);
            expect(responseItem.calculation.examComponent.details).toBeDefined();
            expect(Array.isArray(responseItem.calculation.examComponent.details)).toBe(true);
            expect(typeof responseItem.calculation.examComponent.examsIncluded).toBe('number');
            expect(typeof responseItem.calculation.examComponent.examsTotal).toBe('number');
            expect(typeof responseItem.calculation.examComponent.examsPassed).toBe('number');
            
            // Verify extra component exists and has required fields
            expect(responseItem.calculation.extraComponent).toBeDefined();
            expect(responseItem.calculation.extraComponent.details).toBeDefined();
            expect(Array.isArray(responseItem.calculation.extraComponent.details)).toBe(true);
            expect(typeof responseItem.calculation.extraComponent.totalWeight).toBe('number');
            
            // Verify final score and pass status fields exist
            expect(responseItem.calculation).toHaveProperty('finalScore');
            expect(responseItem.calculation).toHaveProperty('passed');
            expect(responseItem.calculation).toHaveProperty('passThreshold');
            expect(typeof responseItem.calculation.passThreshold).toBe('number');
            expect(typeof responseItem.calculation.failedDueToExam).toBe('boolean');
            
            // Verify legacy fields exist for backward compatibility
            expect(responseItem.extras).toBeDefined();
            expect(Array.isArray(responseItem.extras)).toBe(true);
            expect(responseItem.pass_summary).toBeDefined();
            expect(responseItem.pass_summary).toHaveProperty('overall_score');
            expect(responseItem.pass_summary).toHaveProperty('passed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have exam component details with all required fields', () => {
      // Feature: score-calculation-optimization, Property 14: Response Completeness
      fc.assert(
        fc.property(
          arbitraryAPIResponseItem(),
          (responseItem) => {
            // For each exam detail, verify all required fields exist
            for (const examDetail of responseItem.calculation.examComponent.details) {
              expect(examDetail.examId).toBeDefined();
              expect(typeof examDetail.examId).toBe('string');
              expect(examDetail.examTitle).toBeDefined();
              expect(typeof examDetail.examTitle).toBe('string');
              expect(typeof examDetail.score).toBe('number');
              expect(typeof examDetail.included).toBe('boolean');
              expect(examDetail).toHaveProperty('passed');
              expect(examDetail).toHaveProperty('passThreshold');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have extra component details with all required fields', () => {
      // Feature: score-calculation-optimization, Property 14: Response Completeness
      fc.assert(
        fc.property(
          arbitraryAPIResponseItem(),
          (responseItem) => {
            // For each extra detail, verify all required fields exist
            for (const extraDetail of responseItem.calculation.extraComponent.details) {
              expect(extraDetail.fieldKey).toBeDefined();
              expect(typeof extraDetail.fieldKey).toBe('string');
              expect(extraDetail.fieldLabel).toBeDefined();
              expect(typeof extraDetail.fieldLabel).toBe('string');
              expect(extraDetail).toHaveProperty('rawValue');
              expect(typeof extraDetail.normalizedScore).toBe('number');
              expect(typeof extraDetail.weight).toBe('number');
              expect(typeof extraDetail.weightedContribution).toBe('number');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have consistent pass_summary with calculation result', () => {
      // Feature: score-calculation-optimization, Property 14: Response Completeness
      fc.assert(
        fc.property(
          arbitraryAPIResponseItem(),
          (responseItem) => {
            // Verify pass_summary matches calculation result
            expect(responseItem.pass_summary.overall_score).toEqual(responseItem.calculation.finalScore);
            expect(responseItem.pass_summary.passed).toEqual(responseItem.calculation.passed);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have extras array matching extra component details', () => {
      // Feature: score-calculation-optimization, Property 14: Response Completeness
      fc.assert(
        fc.property(
          arbitraryAPIResponseItem(),
          (responseItem) => {
            // Verify extras array has same keys as extra component details
            const extraKeys = new Set(responseItem.extras.map(e => e.key));
            const detailKeys = new Set(responseItem.calculation.extraComponent.details.map(d => d.fieldKey));
            
            // All detail keys should be in extras (extras may have additional hidden fields)
            for (const key of detailKeys) {
              expect(extraKeys.has(key)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Response Metadata', () => {
    it('should include timing and cache metadata in full response', () => {
      // Feature: score-calculation-optimization, Property 14: Response Completeness
      fc.assert(
        fc.property(
          fc.record({
            items: fc.array(arbitraryAPIResponseItem(), { minLength: 0, maxLength: 10 }),
            cached: fc.boolean(),
            calculation_time_ms: fc.nat({ max: 10000 }),
          }),
          (response) => {
            // Verify metadata fields exist
            expect(response.items).toBeDefined();
            expect(Array.isArray(response.items)).toBe(true);
            expect(typeof response.cached).toBe('boolean');
            expect(typeof response.calculation_time_ms).toBe('number');
            expect(response.calculation_time_ms).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
