/**
 * Property-Based Tests for Invalid Input Handling
 * 
 * Feature: score-calculation-optimization, Property 2: Invalid Input Handling
 * Validates: Requirements 1.6, 9.1
 * 
 * Tests that the Score Calculator handles invalid or incomplete input data
 * gracefully without throwing exceptions or crashing.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateFinalScore, validateInput } from '../scoreCalculator';
import {
  arbitraryInvalidCalculationInput,
  createMinimalInput,
} from './scoreCalculator.testUtils';

describe('Score Calculator - Property 2: Invalid Input Handling', () => {
  it('should return error result for null or undefined input', () => {
    const nullResult = calculateFinalScore(null as any);
    expect(nullResult.success).toBe(false);
    expect(nullResult.error).toBeDefined();

    const undefinedResult = calculateFinalScore(undefined as any);
    expect(undefinedResult.success).toBe(false);
    expect(undefinedResult.error).toBeDefined();
  });

  it('should return error result for non-object input', () => {
    const stringResult = calculateFinalScore('invalid' as any);
    expect(stringResult.success).toBe(false);
    expect(stringResult.error).toBeDefined();

    const numberResult = calculateFinalScore(123 as any);
    expect(numberResult.success).toBe(false);
    expect(numberResult.error).toBeDefined();

    const arrayResult = calculateFinalScore([] as any);
    expect(arrayResult.success).toBe(false);
    expect(arrayResult.error).toBeDefined();
  });

  it('should return error result for missing required fields', () => {
    // Missing studentId
    const noStudentId = { ...createMinimalInput() };
    delete (noStudentId as any).studentId;
    const result1 = calculateFinalScore(noStudentId as any);
    expect(result1.success).toBe(false);
    expect(result1.error).toBeDefined();

    // Missing studentCode
    const noStudentCode = { ...createMinimalInput() };
    delete (noStudentCode as any).studentCode;
    const result2 = calculateFinalScore(noStudentCode as any);
    expect(result2.success).toBe(false);
    expect(result2.error).toBeDefined();

    // Missing settings
    const noSettings = { ...createMinimalInput() };
    delete (noSettings as any).settings;
    const result3 = calculateFinalScore(noSettings as any);
    expect(result3.success).toBe(false);
    expect(result3.error).toBeDefined();
  });

  it('should return error result for invalid settings values', () => {
    // Invalid passCalcMode
    const invalidMode = createMinimalInput({
      settings: {
        ...createMinimalInput().settings,
        passCalcMode: 'invalid' as any,
      },
    });
    const result1 = calculateFinalScore(invalidMode);
    expect(result1.success).toBe(false);

    // Invalid overallPassThreshold (negative)
    const negativeThreshold = createMinimalInput({
      settings: {
        ...createMinimalInput().settings,
        overallPassThreshold: -10,
      },
    });
    const result2 = calculateFinalScore(negativeThreshold);
    expect(result2.success).toBe(false);

    // Invalid overallPassThreshold (> 100)
    const highThreshold = createMinimalInput({
      settings: {
        ...createMinimalInput().settings,
        overallPassThreshold: 150,
      },
    });
    const result3 = calculateFinalScore(highThreshold);
    expect(result3.success).toBe(false);

    // Invalid examWeight (negative)
    const negativeWeight = createMinimalInput({
      settings: {
        ...createMinimalInput().settings,
        examWeight: -0.5,
      },
    });
    const result4 = calculateFinalScore(negativeWeight);
    expect(result4.success).toBe(false);

    // Invalid examScoreSource
    const invalidSource = createMinimalInput({
      settings: {
        ...createMinimalInput().settings,
        examScoreSource: 'invalid' as any,
      },
    });
    const result5 = calculateFinalScore(invalidSource);
    expect(result5.success).toBe(false);
  });

  it('should return error result for invalid exam attempt data', () => {
    // Missing examId
    const noExamId = createMinimalInput({
      examAttempts: [
        {
          examId: '',
          examTitle: 'Test Exam',
          scorePercentage: 80,
          finalScorePercentage: 80,
          includeInPass: true,
          passThreshold: null,
        },
      ],
    });
    const result1 = calculateFinalScore(noExamId);
    expect(result1.success).toBe(false);

    // Invalid scorePercentage (NaN)
    const nanScore = createMinimalInput({
      examAttempts: [
        {
          examId: 'exam-1',
          examTitle: 'Test Exam',
          scorePercentage: NaN,
          finalScorePercentage: 80,
          includeInPass: true,
          passThreshold: null,
        },
      ],
    });
    const result2 = calculateFinalScore(nanScore);
    expect(result2.success).toBe(false);
  });

  it('should return error result for invalid extra field data', () => {
    // Missing field key
    const noKey = createMinimalInput({
      extraFields: [
        {
          key: '',
          label: 'Test Field',
          type: 'number',
          includeInPass: true,
          passWeight: 0.3,
          maxPoints: 100,
        },
      ],
    });
    const result1 = calculateFinalScore(noKey);
    expect(result1.success).toBe(false);

    // Invalid field type
    const invalidType = createMinimalInput({
      extraFields: [
        {
          key: 'test',
          label: 'Test Field',
          type: 'invalid' as any,
          includeInPass: true,
          passWeight: 0.3,
          maxPoints: 100,
        },
      ],
    });
    const result2 = calculateFinalScore(invalidType);
    expect(result2.success).toBe(false);

    // Negative passWeight
    const negativeWeight = createMinimalInput({
      extraFields: [
        {
          key: 'test',
          label: 'Test Field',
          type: 'number',
          includeInPass: true,
          passWeight: -0.5,
          maxPoints: 100,
        },
      ],
    });
    const result3 = calculateFinalScore(negativeWeight);
    expect(result3.success).toBe(false);

    // Invalid maxPoints (zero or negative)
    const zeroMaxPoints = createMinimalInput({
      extraFields: [
        {
          key: 'test',
          label: 'Test Field',
          type: 'number',
          includeInPass: true,
          passWeight: 0.3,
          maxPoints: 0,
        },
      ],
    });
    const result4 = calculateFinalScore(zeroMaxPoints);
    expect(result4.success).toBe(false);
  });

  it('Property 2: should never throw exceptions for any invalid input', () => {
    fc.assert(
      fc.property(arbitraryInvalidCalculationInput(), (input) => {
        // Should not throw
        let result;
        expect(() => {
          result = calculateFinalScore(input as any);
        }).not.toThrow();

        // Should return error result
        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: should return structured error result with required fields', () => {
    fc.assert(
      fc.property(arbitraryInvalidCalculationInput(), (input) => {
        const result = calculateFinalScore(input as any);

        // Must have success = false
        expect(result.success).toBe(false);

        // Must have error message
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);

        // Must have component structures (even if empty)
        expect(result.examComponent).toBeDefined();
        expect(result.extraComponent).toBeDefined();

        // Must have null scores
        expect(result.finalScore).toBeNull();
        expect(result.passed).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: validateInput should identify all validation errors', () => {
    fc.assert(
      fc.property(arbitraryInvalidCalculationInput(), (input) => {
        const validation = validateInput(input);

        // Should be invalid
        expect(validation.valid).toBe(false);

        // Should have error message
        expect(validation.error).toBeDefined();

        // Should have errors array with details
        if (validation.errors) {
          expect(Array.isArray(validation.errors)).toBe(true);
          expect(validation.errors.length).toBeGreaterThan(0);
          validation.errors.forEach(error => {
            expect(typeof error).toBe('string');
            expect(error.length).toBeGreaterThan(0);
          });
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: should handle edge cases gracefully', () => {
    // Empty strings
    const emptyStrings = createMinimalInput({
      studentId: '',
      studentCode: '',
      studentName: '',
    });
    const result1 = calculateFinalScore(emptyStrings);
    expect(result1.success).toBe(false);

    // Wrong types
    const wrongTypes = {
      studentId: 123,
      studentCode: true,
      studentName: [],
      examAttempts: 'not an array',
      extraScores: 'not an object',
      extraFields: null,
      settings: 'not an object',
    };
    const result2 = calculateFinalScore(wrongTypes as any);
    expect(result2.success).toBe(false);

    // Partial objects
    const partial = {
      studentId: 'test-id',
      // Missing other required fields
    };
    const result3 = calculateFinalScore(partial as any);
    expect(result3.success).toBe(false);
  });
});
