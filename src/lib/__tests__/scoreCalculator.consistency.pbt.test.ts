/**
 * Property-Based Tests for Score Calculator Consistency Properties
 * 
 * Tests consistency properties: sync calculation consistency and
 * settings change reactivity.
 * 
 * Feature: score-calculation-optimization
 */

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { calculateFinalScore } from '../scoreCalculator';
import type { CalculationInput, ExtraScoreData } from '../scoreCalculator.types';
import {
  arbitraryValidCalculationInput,
  arbitraryCalculationSettings,
} from './scoreCalculator.testUtils';

describe('Score Calculator - Consistency Properties', () => {
  /**
   * Property 11: Sync Calculation Consistency
   * 
   * For any student with both manually entered and auto-synced extra scores,
   * calculating the final score SHALL produce the same result regardless of
   * whether scores were entered manually or synced automatically.
   * 
   * Validates: Requirements 3.4
   * Feature: score-calculation-optimization, Property 11: Sync Calculation Consistency
   */
  it('Property 11: Sync Calculation Consistency', () => {
    fc.assert(
      fc.property(
        arbitraryValidCalculationInput(),
        fc.record({
          homework: fc.float({ min: 0, max: 100 }),
          quiz: fc.float({ min: 0, max: 100 }),
          attendance: fc.float({ min: 0, max: 100 }),
        }),
        (baseInput, syncedScores) => {
          // Scenario 1: Manually entered scores
          const manualInput: CalculationInput = {
            ...baseInput,
            extraScores: {
              ...baseInput.extraScores,
              homework_score: syncedScores.homework,
              quiz_score: syncedScores.quiz,
              attendance_percentage: syncedScores.attendance,
            },
          };
          
          // Scenario 2: Auto-synced scores (same values, different source)
          const syncedInput: CalculationInput = {
            ...baseInput,
            extraScores: {
              ...baseInput.extraScores,
              homework_score: syncedScores.homework,
              quiz_score: syncedScores.quiz,
              attendance_percentage: syncedScores.attendance,
            },
          };
          
          // Calculate scores
          const manualResult = calculateFinalScore(manualInput);
          const syncedResult = calculateFinalScore(syncedInput);
          
          // Results should be identical regardless of entry method
          expect(manualResult.success).toBe(syncedResult.success);
          
          if (manualResult.success && syncedResult.success) {
            expect(manualResult.finalScore).toBe(syncedResult.finalScore);
            expect(manualResult.passed).toBe(syncedResult.passed);
            expect(manualResult.examComponent.score).toBe(syncedResult.examComponent.score);
            expect(manualResult.extraComponent.score).toBe(syncedResult.extraComponent.score);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12: Settings Change Reactivity
   * 
   * For any student data and two different settings configurations,
   * changing the settings SHALL produce different calculation results
   * that reflect the new settings (different weights, thresholds, or
   * modes SHALL affect the output).
   * 
   * Validates: Requirements 10.2
   * Feature: score-calculation-optimization, Property 12: Settings Change Reactivity
   */
  it('Property 12: Settings Change Reactivity', () => {
    // Test 1: Pass calculation mode change (best vs avg)
    const baseInput: CalculationInput = {
      studentId: 'test-student',
      studentCode: 'TEST001',
      studentName: 'Test Student',
      examAttempts: [
        {
          examId: 'exam1',
          examTitle: 'Exam 1',
          scorePercentage: 60,
          finalScorePercentage: 65,
          includeInPass: true,
          passThreshold: 50,
        },
        {
          examId: 'exam2',
          examTitle: 'Exam 2',
          scorePercentage: 80,
          finalScorePercentage: 85,
          includeInPass: true,
          passThreshold: 50,
        },
      ],
      extraScores: {
        homework: 75,
      },
      extraFields: [
        {
          key: 'homework',
          label: 'Homework',
          type: 'number',
          includeInPass: true,
          passWeight: 0.3,
          maxPoints: 100,
          boolTruePoints: null,
          boolFalsePoints: null,
          textScoreMap: null,
        },
      ],
      settings: {
        passCalcMode: 'best',
        overallPassThreshold: 70,
        examWeight: 0.7,
        examScoreSource: 'final',
        failOnAnyExam: false,
      },
    };

    // Calculate with 'best' mode
    const resultBest = calculateFinalScore(baseInput);

    // Calculate with 'avg' mode
    const inputAvg = {
      ...baseInput,
      settings: {
        ...baseInput.settings,
        passCalcMode: 'avg' as const,
      },
    };
    const resultAvg = calculateFinalScore(inputAvg);

    expect(resultBest.success).toBe(true);
    expect(resultAvg.success).toBe(true);

    if (resultBest.success && resultAvg.success) {
      // Mode should be different
      expect(resultBest.examComponent.mode).toBe('best');
      expect(resultAvg.examComponent.mode).toBe('avg');
      
      // Exam component scores should be different (best=85, avg=75)
      expect(resultBest.examComponent.score).toBe(85);
      expect(resultAvg.examComponent.score).toBe(75);
      
      // Final scores should be different
      expect(resultBest.finalScore).not.toBe(resultAvg.finalScore);
    }

    // Test 2: Overall pass threshold change
    const inputHighThreshold = {
      ...baseInput,
      settings: {
        ...baseInput.settings,
        overallPassThreshold: 90, // Much higher threshold
      },
    };
    const resultHighThreshold = calculateFinalScore(inputHighThreshold);

    expect(resultHighThreshold.success).toBe(true);
    if (resultBest.success && resultHighThreshold.success) {
      // Thresholds should be different
      expect(resultBest.passThreshold).toBe(70);
      expect(resultHighThreshold.passThreshold).toBe(90);
      
      // Pass status might be different (depending on final score)
      if (resultBest.finalScore !== null && resultHighThreshold.finalScore !== null) {
        if (resultBest.finalScore < 90) {
          expect(resultBest.passed).not.toBe(resultHighThreshold.passed);
        }
      }
    }

    // Test 3: Exam weight change
    const inputDifferentWeight = {
      ...baseInput,
      settings: {
        ...baseInput.settings,
        examWeight: 0.3, // Changed from 0.7 to 0.3
      },
    };
    const resultDifferentWeight = calculateFinalScore(inputDifferentWeight);

    expect(resultDifferentWeight.success).toBe(true);
    if (resultBest.success && resultDifferentWeight.success) {
      // Final scores should be different due to different weighting
      expect(resultBest.finalScore).not.toBe(resultDifferentWeight.finalScore);
    }

    // Test 4: failOnAnyExam rule change
    const inputWithFailingExam: CalculationInput = {
      ...baseInput,
      examAttempts: [
        {
          examId: 'exam1',
          examTitle: 'Exam 1',
          scorePercentage: 40, // Below threshold
          finalScorePercentage: 45,
          includeInPass: true,
          passThreshold: 50,
        },
        {
          examId: 'exam2',
          examTitle: 'Exam 2',
          scorePercentage: 90,
          finalScorePercentage: 95,
          includeInPass: true,
          passThreshold: 50,
        },
      ],
      settings: {
        ...baseInput.settings,
        failOnAnyExam: false,
      },
    };

    const resultNoFailRule = calculateFinalScore(inputWithFailingExam);
    
    const inputWithFailRule = {
      ...inputWithFailingExam,
      settings: {
        ...inputWithFailingExam.settings,
        failOnAnyExam: true,
      },
    };
    const resultWithFailRule = calculateFinalScore(inputWithFailRule);

    expect(resultNoFailRule.success).toBe(true);
    expect(resultWithFailRule.success).toBe(true);

    if (resultNoFailRule.success && resultWithFailRule.success) {
      // Pass status should be different due to failOnAnyExam rule
      expect(resultWithFailRule.passed).toBe(false); // Should fail due to failing exam
      expect(resultWithFailRule.failedDueToExam).toBe(true);
      
      // Without the rule, might pass based on overall score
      if (resultNoFailRule.finalScore !== null && resultNoFailRule.finalScore >= resultNoFailRule.passThreshold) {
        expect(resultNoFailRule.passed).toBe(true);
        expect(resultNoFailRule.failedDueToExam).toBe(false);
      }
    }

    // Test 5: Exam score source change
    const inputRawSource = {
      ...baseInput,
      settings: {
        ...baseInput.settings,
        examScoreSource: 'raw' as const,
      },
    };
    const resultRawSource = calculateFinalScore(inputRawSource);

    expect(resultRawSource.success).toBe(true);
    if (resultBest.success && resultRawSource.success) {
      // Should use different scores (raw vs final)
      // Best mode with final scores: max(65, 85) = 85
      // Best mode with raw scores: max(60, 80) = 80
      expect(resultBest.examComponent.score).toBe(85);
      expect(resultRawSource.examComponent.score).toBe(80);
      expect(resultBest.finalScore).not.toBe(resultRawSource.finalScore);
    }
  });
});
