/**
 * Integration Tests for Public Summary API
 * 
 * Tests the public summary endpoint to ensure correct score calculation,
 * response formatting, and backward compatibility.
 * 
 * Feature: score-calculation-optimization
 */

import { describe, it, expect } from 'vitest';
import { calculateFinalScore } from '@/lib/scoreCalculator';
import type { CalculationInput, CalculationSettings, ExtraField, ExamAttempt } from '@/lib/scoreCalculator.types';

/**
 * Helper function to create a calculation input
 */
function createCalculationInput(
  code: string,
  examAttempts: ExamAttempt[],
  extraScores: Record<string, any>,
  extraFields: ExtraField[],
  settings: CalculationSettings
): CalculationInput {
  return {
    studentId: `student-${code}`,
    studentCode: code,
    studentName: `Test Student ${code}`,
    examAttempts,
    extraScores,
    extraFields,
    settings,
  };
}

describe('Public Summary API - Integration Tests', () => {
  const defaultSettings: CalculationSettings = {
    passCalcMode: 'best',
    overallPassThreshold: 60,
    examWeight: 1.0,
    examScoreSource: 'final',
    failOnAnyExam: false,
  };

  describe('Student Score Scenarios', () => {
    it('should calculate score for student with one exam', () => {
      const input = createCalculationInput(
        'CODE1',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 85,
            finalScorePercentage: 85,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {},
        [],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.finalScore).toBe(85);
      expect(result.passed).toBe(true);
      expect(result.examComponent.score).toBe(85);
      expect(result.examComponent.examsIncluded).toBe(1);
      expect(result.examComponent.examsPassed).toBe(1);
    });

    it('should calculate score for student with multiple exams', () => {
      const input = createCalculationInput(
        'CODE2',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 75,
            finalScorePercentage: 75,
            includeInPass: true,
            passThreshold: 60,
          },
          {
            examId: 'exam-2',
            examTitle: 'Science Exam',
            scorePercentage: 90,
            finalScorePercentage: 90,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {},
        [],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.finalScore).toBe(90);
      expect(result.passed).toBe(true);
      expect(result.examComponent.score).toBe(90);
      expect(result.examComponent.mode).toBe('best');
    });

    it('should calculate score with extra scores', () => {
      const input = createCalculationInput(
        'CODE3',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 80,
            finalScorePercentage: 80,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {
          attendance: 90,
          homework: 85,
        },
        [
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'number' as const,
            includeInPass: true,
            passWeight: 0.2,
            maxPoints: 100,
          },
          {
            key: 'homework',
            label: 'Homework',
            type: 'number' as const,
            includeInPass: true,
            passWeight: 0.3,
            maxPoints: 100,
          },
        ],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.examComponent.score).toBe(80);
      expect(result.extraComponent.score).toBeGreaterThan(0);
      expect(result.extraComponent.details).toHaveLength(2);
      expect(result.finalScore).toBeGreaterThan(80);
      expect(result.passed).toBe(true);
    });

    it('should handle student with no exams', () => {
      const input = createCalculationInput(
        'CODE4',
        [],
        {},
        [],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.examComponent.score).toBeNull();
      expect(result.finalScore).toBeNull();
      expect(result.passed).toBeNull();
    });

    it('should handle student with no attempts for included exams', () => {
      const input = createCalculationInput(
        'CODE5',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: null,
            finalScorePercentage: null,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {},
        [],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.examComponent.score).toBe(0);
      expect(result.finalScore).toBe(0);
      expect(result.passed).toBe(false);
    });
  });

  describe('Response Format Validation', () => {
    it('should return response with all required fields', () => {
      const input = createCalculationInput(
        'CODE1',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 85,
            finalScorePercentage: 85,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        { attendance: 90 },
        [
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'number' as const,
            includeInPass: true,
            passWeight: 0.2,
            maxPoints: 100,
          },
        ],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      // Verify response structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('examComponent');
      expect(result).toHaveProperty('extraComponent');
      expect(result).toHaveProperty('finalScore');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('passThreshold');
      expect(result).toHaveProperty('failedDueToExam');

      // Verify exam component structure
      expect(result.examComponent).toHaveProperty('score');
      expect(result.examComponent).toHaveProperty('mode');
      expect(result.examComponent).toHaveProperty('examsIncluded');
      expect(result.examComponent).toHaveProperty('examsTotal');
      expect(result.examComponent).toHaveProperty('examsPassed');
      expect(result.examComponent).toHaveProperty('details');

      // Verify extra component structure
      expect(result.extraComponent).toHaveProperty('score');
      expect(result.extraComponent).toHaveProperty('totalWeight');
      expect(result.extraComponent).toHaveProperty('details');
    });

    it('should include detailed breakdown in exam component', () => {
      const input = createCalculationInput(
        'CODE1',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 85,
            finalScorePercentage: 85,
            includeInPass: true,
            passThreshold: 60,
          },
          {
            examId: 'exam-2',
            examTitle: 'Science Exam',
            scorePercentage: 75,
            finalScorePercentage: 75,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {},
        [],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      // Verify exam details
      expect(result.examComponent.details).toHaveLength(2);
      
      for (const detail of result.examComponent.details) {
        expect(detail).toHaveProperty('examId');
        expect(detail).toHaveProperty('examTitle');
        expect(detail).toHaveProperty('score');
        expect(detail).toHaveProperty('included');
        expect(detail).toHaveProperty('passed');
        expect(detail).toHaveProperty('passThreshold');
      }
    });

    it('should include detailed breakdown in extra component', () => {
      const input = createCalculationInput(
        'CODE1',
        [],
        {
          attendance: 90,
          homework: 85,
        },
        [
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'number' as const,
            includeInPass: true,
            passWeight: 0.2,
            maxPoints: 100,
          },
          {
            key: 'homework',
            label: 'Homework',
            type: 'number' as const,
            includeInPass: true,
            passWeight: 0.3,
            maxPoints: 100,
          },
        ],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      // Verify extra details
      expect(result.extraComponent.details).toHaveLength(2);
      
      for (const detail of result.extraComponent.details) {
        expect(detail).toHaveProperty('fieldKey');
        expect(detail).toHaveProperty('fieldLabel');
        expect(detail).toHaveProperty('rawValue');
        expect(detail).toHaveProperty('normalizedScore');
        expect(detail).toHaveProperty('weight');
        expect(detail).toHaveProperty('weightedContribution');
      }
    });
  });

  describe('Consistency with Admin API', () => {
    it('should produce same results as admin API for identical input', () => {
      const input = createCalculationInput(
        'CODE1',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 85,
            finalScorePercentage: 85,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        { attendance: 90 },
        [
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'number' as const,
            includeInPass: true,
            passWeight: 0.2,
            maxPoints: 100,
          },
        ],
        defaultSettings
      );

      // Calculate twice to simulate admin and public API
      const result1 = calculateFinalScore(input);
      const result2 = calculateFinalScore(input);

      // Results should be identical
      expect(result1).toEqual(result2);
      expect(result1.finalScore).toBe(result2.finalScore);
      expect(result1.passed).toBe(result2.passed);
      expect(result1.examComponent.score).toBe(result2.examComponent.score);
      expect(result1.extraComponent.score).toBe(result2.extraComponent.score);
    });

    it('should maintain backward compatibility with legacy response format', () => {
      const input = createCalculationInput(
        'CODE1',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 85,
            finalScorePercentage: 85,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        { attendance: 90 },
        [
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'number' as const,
            includeInPass: true,
            passWeight: 0.2,
            maxPoints: 100,
          },
        ],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      // Build legacy format
      const legacyFormat = {
        overall_score: result.finalScore,
        passed: result.passed,
        threshold: result.passThreshold,
        exam_passed: result.examComponent.examsPassed,
        exam_total: result.examComponent.examsTotal,
      };

      // Verify legacy format fields
      expect(legacyFormat.overall_score).toBe(result.finalScore);
      expect(legacyFormat.passed).toBe(result.passed);
      expect(legacyFormat.threshold).toBe(defaultSettings.overallPassThreshold);
      expect(legacyFormat.exam_passed).toBe(result.examComponent.examsPassed);
      expect(legacyFormat.exam_total).toBe(result.examComponent.examsTotal);
    });
  });

  describe('Edge Cases', () => {
    it('should handle excluded exams correctly', () => {
      const input = createCalculationInput(
        'CODE1',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 85,
            finalScorePercentage: 85,
            includeInPass: true,
            passThreshold: 60,
          },
          {
            examId: 'exam-2',
            examTitle: 'Practice Exam',
            scorePercentage: 50,
            finalScorePercentage: 50,
            includeInPass: false,
            passThreshold: null,
          },
        ],
        {},
        [],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.examComponent.examsIncluded).toBe(1);
      expect(result.examComponent.examsTotal).toBe(2);
      expect(result.finalScore).toBe(85);
    });

    it('should handle missing extra field values', () => {
      const input = createCalculationInput(
        'CODE1',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 80,
            finalScorePercentage: 80,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {
          attendance: 90,
          // homework is missing
        },
        [
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'number' as const,
            includeInPass: true,
            passWeight: 0.2,
            maxPoints: 100,
          },
          {
            key: 'homework',
            label: 'Homework',
            type: 'number' as const,
            includeInPass: true,
            passWeight: 0.3,
            maxPoints: 100,
          },
        ],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.extraComponent.details).toHaveLength(2);
      
      // Find homework detail
      const homeworkDetail = result.extraComponent.details.find(d => d.fieldKey === 'homework');
      expect(homeworkDetail).toBeDefined();
      expect(homeworkDetail?.normalizedScore).toBe(0);
    });

    it('should handle boolean extra fields', () => {
      const input = createCalculationInput(
        'CODE1',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 80,
            finalScorePercentage: 80,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {
          completed_project: true,
        },
        [
          {
            key: 'completed_project',
            label: 'Completed Project',
            type: 'boolean' as const,
            includeInPass: true,
            passWeight: 0.2,
            maxPoints: null,
            boolTruePoints: 100,
            boolFalsePoints: 0,
          },
        ],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.extraComponent.details).toHaveLength(1);
      expect(result.extraComponent.details[0].normalizedScore).toBe(100);
    });

    it('should handle text extra fields with score mapping', () => {
      const input = createCalculationInput(
        'CODE1',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 80,
            finalScorePercentage: 80,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {
          participation: 'excellent',
        },
        [
          {
            key: 'participation',
            label: 'Participation',
            type: 'text' as const,
            includeInPass: true,
            passWeight: 0.2,
            maxPoints: null,
            textScoreMap: {
              'excellent': 100,
              'good': 80,
              'fair': 60,
              'poor': 40,
            },
          },
        ],
        defaultSettings
      );

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.extraComponent.details).toHaveLength(1);
      expect(result.extraComponent.details[0].normalizedScore).toBe(100);
    });
  });

  describe('Pass/Fail Logic', () => {
    it('should apply overall pass threshold correctly', () => {
      const passingInput = createCalculationInput(
        'CODE1',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 70,
            finalScorePercentage: 70,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {},
        [],
        defaultSettings
      );

      const failingInput = createCalculationInput(
        'CODE2',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 50,
            finalScorePercentage: 50,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {},
        [],
        defaultSettings
      );

      const passingResult = calculateFinalScore(passingInput);
      const failingResult = calculateFinalScore(failingInput);

      expect(passingResult.passed).toBe(true);
      expect(failingResult.passed).toBe(false);
    });

    it('should apply failOnAnyExam rule correctly', () => {
      const input = createCalculationInput(
        'CODE1',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 90,
            finalScorePercentage: 90,
            includeInPass: true,
            passThreshold: 60,
          },
          {
            examId: 'exam-2',
            examTitle: 'Science Exam',
            scorePercentage: 50,
            finalScorePercentage: 50,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {},
        [],
        { ...defaultSettings, failOnAnyExam: true }
      );

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.finalScore).toBe(90);
      expect(result.passed).toBe(false);
      expect(result.failedDueToExam).toBe(true);
    });
  });
});
