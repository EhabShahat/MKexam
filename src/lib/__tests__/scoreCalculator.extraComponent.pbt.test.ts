/**
 * Property-Based Tests for Extra Component Calculation
 * 
 * Feature: score-calculation-optimization
 * Tests: Property 7 - Extra Score Normalization
 * 
 * These tests verify that extra score normalization works correctly
 * across all valid input combinations using property-based testing.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateFinalScore } from '../scoreCalculator';
import {
  createMinimalInput,
  arbitraryExtraField,
} from './scoreCalculator.testUtils';
import type { ExtraField } from '../scoreCalculator.types';

describe('Extra Component Property-Based Tests', () => {
  describe('Property 7: Extra Score Normalization', () => {
    it('should normalize number fields with maxPoints correctly', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1000, noNaN: true }), // raw value
          fc.float({ min: 1, max: 1000, noNaN: true }), // max points
          fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }), // weight
          (rawValue, maxPoints, weight) => {
            // Create input with a single number field
            const input = createMinimalInput({
              extraFields: [
                {
                  key: 'test_field',
                  label: 'Test Field',
                  type: 'number',
                  includeInPass: true,
                  passWeight: weight,
                  maxPoints: maxPoints,
                },
              ],
              extraScores: {
                test_field: rawValue,
              },
            });

            const result = calculateFinalScore(input);

            // Verify calculation succeeded
            expect(result.success).toBe(true);
            expect(result.extraComponent).toBeDefined();

            const detail = result.extraComponent.details[0];
            expect(detail).toBeDefined();

            // Calculate expected normalized score
            const expectedNormalized = Math.min(100, Math.max(0, (rawValue / maxPoints) * 100));
            const expectedRounded = Math.round(expectedNormalized * 100) / 100;

            // Verify normalization formula: (rawValue / maxPoints) * 100, clamped to [0, 100]
            expect(detail.normalizedScore).toBeCloseTo(expectedRounded, 2);

            // Verify score is within valid range [0, 100]
            expect(detail.normalizedScore).toBeGreaterThanOrEqual(0);
            expect(detail.normalizedScore).toBeLessThanOrEqual(100);

            // Verify weighted contribution is correct
            const expectedContribution = detail.normalizedScore * weight;
            expect(detail.weightedContribution).toBeCloseTo(expectedContribution, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle number fields without maxPoints (no normalization)', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }), // raw value (already 0-100)
          fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }), // weight
          (rawValue, weight) => {
            // Create input with a number field without maxPoints
            const input = createMinimalInput({
              extraFields: [
                {
                  key: 'test_field',
                  label: 'Test Field',
                  type: 'number',
                  includeInPass: true,
                  passWeight: weight,
                  maxPoints: null, // No normalization
                },
              ],
              extraScores: {
                test_field: rawValue,
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            const detail = result.extraComponent.details[0];

            // When maxPoints is null, normalized score should equal raw value (clamped)
            const expectedNormalized = Math.min(100, Math.max(0, rawValue));
            const expectedRounded = Math.round(expectedNormalized * 100) / 100;

            expect(detail.normalizedScore).toBeCloseTo(expectedRounded, 2);
            expect(detail.normalizedScore).toBeGreaterThanOrEqual(0);
            expect(detail.normalizedScore).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should normalize boolean fields correctly', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.float({ min: 0, max: 100, noNaN: true }), // true points
          fc.float({ min: 0, max: 100, noNaN: true }), // false points
          fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }), // weight
          (boolValue, truePoints, falsePoints, weight) => {
            const input = createMinimalInput({
              extraFields: [
                {
                  key: 'test_bool',
                  label: 'Test Boolean',
                  type: 'boolean',
                  includeInPass: true,
                  passWeight: weight,
                  maxPoints: null,
                  boolTruePoints: truePoints,
                  boolFalsePoints: falsePoints,
                },
              ],
              extraScores: {
                test_bool: boolValue,
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            const detail = result.extraComponent.details[0];

            // Boolean should map to configured points
            const expectedScore = boolValue ? truePoints : falsePoints;
            const expectedRounded = Math.round(expectedScore * 100) / 100;

            expect(detail.normalizedScore).toBeCloseTo(expectedRounded, 2);
            expect(detail.normalizedScore).toBeGreaterThanOrEqual(0);
            expect(detail.normalizedScore).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default boolean points when not specified', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }), // weight
          (boolValue, weight) => {
            const input = createMinimalInput({
              extraFields: [
                {
                  key: 'test_bool',
                  label: 'Test Boolean',
                  type: 'boolean',
                  includeInPass: true,
                  passWeight: weight,
                  maxPoints: null,
                  // No boolTruePoints or boolFalsePoints specified
                },
              ],
              extraScores: {
                test_bool: boolValue,
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            const detail = result.extraComponent.details[0];

            // Default: true = 100, false = 0
            const expectedScore = boolValue ? 100 : 0;

            expect(detail.normalizedScore).toBe(expectedScore);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should normalize text fields using textScoreMap', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          fc.constantFrom('excellent', 'good', 'fair', 'poor'),
          fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }), // weight
          (textValue, weight) => {
            const scoreMap = {
              excellent: 100,
              good: 75,
              fair: 50,
              poor: 25,
            };

            const input = createMinimalInput({
              extraFields: [
                {
                  key: 'test_text',
                  label: 'Test Text',
                  type: 'text',
                  includeInPass: true,
                  passWeight: weight,
                  maxPoints: null,
                  textScoreMap: scoreMap,
                },
              ],
              extraScores: {
                test_text: textValue,
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            const detail = result.extraComponent.details[0];

            // Text should map to configured score
            const expectedScore = scoreMap[textValue as keyof typeof scoreMap];

            expect(detail.normalizedScore).toBe(expectedScore);
            expect(detail.normalizedScore).toBeGreaterThanOrEqual(0);
            expect(detail.normalizedScore).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle unmapped text values as 0', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => !['A', 'B', 'C'].includes(s)),
          fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }), // weight
          (textValue, weight) => {
            const input = createMinimalInput({
              extraFields: [
                {
                  key: 'test_text',
                  label: 'Test Text',
                  type: 'text',
                  includeInPass: true,
                  passWeight: weight,
                  maxPoints: null,
                  textScoreMap: { A: 100, B: 75, C: 50 },
                },
              ],
              extraScores: {
                test_text: textValue,
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            const detail = result.extraComponent.details[0];

            // Unmapped text values should default to 0
            expect(detail.normalizedScore).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle missing extra score values as 0', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          arbitraryExtraField(),
          (field) => {
            // Ensure field is included in pass calculation
            const includedField = { ...field, includeInPass: true };

            const input = createMinimalInput({
              extraFields: [includedField],
              extraScores: {}, // No value for this field
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            const detail = result.extraComponent.details[0];

            // Missing values should normalize to 0
            expect(detail.normalizedScore).toBe(0);
            expect(detail.weightedContribution).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle null extra score values as 0', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          arbitraryExtraField(),
          (field) => {
            const includedField = { ...field, includeInPass: true };

            const input = createMinimalInput({
              extraFields: [includedField],
              extraScores: {
                [field.key]: null, // Explicit null value
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            const detail = result.extraComponent.details[0];

            // Null values should normalize to 0
            expect(detail.normalizedScore).toBe(0);
            expect(detail.weightedContribution).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clamp normalized scores to [0, 100] range', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          fc.float({ min: -1000, max: 2000, noNaN: true }), // raw value (can be out of range)
          fc.float({ min: 1, max: 100, noNaN: true }), // max points
          fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }), // weight
          (rawValue, maxPoints, weight) => {
            const input = createMinimalInput({
              extraFields: [
                {
                  key: 'test_field',
                  label: 'Test Field',
                  type: 'number',
                  includeInPass: true,
                  passWeight: weight,
                  maxPoints: maxPoints,
                },
              ],
              extraScores: {
                test_field: rawValue,
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            const detail = result.extraComponent.details[0];

            // All normalized scores must be clamped to [0, 100]
            expect(detail.normalizedScore).toBeGreaterThanOrEqual(0);
            expect(detail.normalizedScore).toBeLessThanOrEqual(100);

            // Verify clamping logic
            const unclamped = (rawValue / maxPoints) * 100;
            if (unclamped < 0) {
              expect(detail.normalizedScore).toBe(0);
            } else if (unclamped > 100) {
              expect(detail.normalizedScore).toBe(100);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round normalized scores to 2 decimal places', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 1, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }),
          (rawValue, maxPoints, weight) => {
            const input = createMinimalInput({
              extraFields: [
                {
                  key: 'test_field',
                  label: 'Test Field',
                  type: 'number',
                  includeInPass: true,
                  passWeight: weight,
                  maxPoints: maxPoints,
                },
              ],
              extraScores: {
                test_field: rawValue,
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);
            const detail = result.extraComponent.details[0];

            // Verify score has at most 2 decimal places
            const scoreStr = detail.normalizedScore.toString();
            const decimalPart = scoreStr.split('.')[1];
            if (decimalPart) {
              expect(decimalPart.length).toBeLessThanOrEqual(2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate weighted average correctly for multiple fields', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              value: fc.float({ min: 0, max: 100, noNaN: true }),
              weight: fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }),
              maxPoints: fc.option(fc.float({ min: 1, max: 100, noNaN: true })),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (fields) => {
            const extraFields = fields.map((f, i) => ({
              key: `field_${i}`,
              label: `Field ${i}`,
              type: 'number' as const,
              includeInPass: true,
              passWeight: f.weight,
              maxPoints: f.maxPoints || null,
            }));

            const extraScores = fields.reduce((acc, f, i) => ({
              ...acc,
              [`field_${i}`]: f.value,
            }), {});

            const input = createMinimalInput({
              extraFields,
              extraScores,
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);

            // Calculate expected weighted average manually
            let totalWeight = 0;
            let weightedSum = 0;

            for (let i = 0; i < fields.length; i++) {
              const field = fields[i];
              let normalized: number;

              if (field.maxPoints) {
                normalized = Math.min(100, Math.max(0, (field.value / field.maxPoints) * 100));
              } else {
                normalized = Math.min(100, Math.max(0, field.value));
              }

              normalized = Math.round(normalized * 100) / 100;

              totalWeight += field.weight;
              weightedSum += normalized * field.weight;
            }

            const expectedScore = Math.round((weightedSum / totalWeight) * 100) / 100;

            // Verify component score matches expected weighted average
            expect(result.extraComponent.score).toBeCloseTo(expectedScore, 2);
            expect(result.extraComponent.totalWeight).toBeCloseTo(totalWeight, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should skip fields with includeInPass=false', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(0.1), max: 2, noNaN: true }),
          (value, weight) => {
            const input = createMinimalInput({
              extraFields: [
                {
                  key: 'included_field',
                  label: 'Included',
                  type: 'number',
                  includeInPass: true,
                  passWeight: weight,
                  maxPoints: null,
                },
                {
                  key: 'excluded_field',
                  label: 'Excluded',
                  type: 'number',
                  includeInPass: false, // Should be skipped
                  passWeight: weight,
                  maxPoints: null,
                },
              ],
              extraScores: {
                included_field: value,
                excluded_field: 100, // High value but should be ignored
              },
            });

            const result = calculateFinalScore(input);

            expect(result.success).toBe(true);

            // Only one field should be in details (the included one)
            expect(result.extraComponent.details.length).toBe(1);
            expect(result.extraComponent.details[0].fieldKey).toBe('included_field');

            // Total weight should only include the included field
            expect(result.extraComponent.totalWeight).toBeCloseTo(weight, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null score when no fields are included', () => {
      // Feature: score-calculation-optimization, Property 7: Extra Score Normalization
      const input = createMinimalInput({
        extraFields: [
          {
            key: 'excluded_field',
            label: 'Excluded',
            type: 'number',
            includeInPass: false, // Not included
            passWeight: 0.5,
            maxPoints: null,
          },
        ],
        extraScores: {
          excluded_field: 100,
        },
      });

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.extraComponent.score).toBeNull();
      expect(result.extraComponent.totalWeight).toBe(0);
      expect(result.extraComponent.details.length).toBe(0);
    });
  });
});
