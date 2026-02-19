/**
 * Score Calculator Edge Cases Tests
 * 
 * Tests for edge cases and boundary conditions in the score calculator
 */

import { describe, it, expect } from 'vitest';
import { calculateFinalScore } from '../scoreCalculator';
import type { CalculationInput } from '../scoreCalculator.types';

describe('Score Calculator - Edge Cases', () => {
  describe('Zero Exams Scenario', () => {
    it('should handle student with no exams gracefully', () => {
      const input: CalculationInput = {
        studentId: 'test-student',
        studentCode: 'TEST001',
        studentName: 'Test Student',
        examAttempts: [], // No exams
        extraScores: {},
        extraFields: [],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 50,
          examWeight: 0.7,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      };

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.examComponent.score).toBeNull();
        expect(result.examComponent.examsIncluded).toBe(0);
        expect(result.examComponent.examsTotal).toBe(0);
        expect(result.examComponent.examsPassed).toBe(0);
        expect(result.finalScore).toBeNull(); // Should be null when no components
        expect(result.passed).toBeNull(); // Should be null when no final score
      }
    });

    it('should avoid division by zero in average mode with no exams', () => {
      const input: CalculationInput = {
        studentId: 'test-student',
        studentCode: 'TEST001',
        studentName: 'Test Student',
        examAttempts: [], // No exams
        extraScores: {},
        extraFields: [],
        settings: {
          passCalcMode: 'avg', // Average mode
          overallPassThreshold: 50,
          examWeight: 0.7,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      };

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.examComponent.score).toBeNull();
        expect(result.examComponent.mode).toBe('avg');
        expect(result.finalScore).toBeNull();
      }
    });

    it('should handle exams that are not included in pass calculation', () => {
      const input: CalculationInput = {
        studentId: 'test-student',
        studentCode: 'TEST001',
        studentName: 'Test Student',
        examAttempts: [
          {
            examId: 'exam1',
            examTitle: 'Excluded Exam',
            scorePercentage: 85,
            finalScorePercentage: 90,
            includeInPass: false, // Not included
            passThreshold: 60,
          },
        ],
        extraScores: {},
        extraFields: [],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 50,
          examWeight: 0.7,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      };

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.examComponent.score).toBeNull(); // No included exams
        expect(result.examComponent.examsIncluded).toBe(0);
        expect(result.examComponent.examsTotal).toBe(1);
        expect(result.examComponent.details).toHaveLength(1);
        expect(result.examComponent.details[0].included).toBe(false);
      }
    });
  });

  describe('Missing Extra Fields', () => {
    it('should handle missing extra field values gracefully', () => {
      const input: CalculationInput = {
        studentId: 'test-student',
        studentCode: 'TEST001',
        studentName: 'Test Student',
        examAttempts: [
          {
            examId: 'exam1',
            examTitle: 'Test Exam',
            scorePercentage: 75,
            finalScorePercentage: 80,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        extraScores: {}, // Missing field values
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
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'boolean',
            includeInPass: true,
            passWeight: 0.2,
            maxPoints: null,
            boolTruePoints: 100,
            boolFalsePoints: 0,
            textScoreMap: null,
          },
        ],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 50,
          examWeight: 0.7,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      };

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.extraComponent.score).toBe(0); // Missing values default to 0
        expect(result.extraComponent.details).toHaveLength(2);
        
        // Check homework field (missing number value)
        const homeworkDetail = result.extraComponent.details.find(d => d.fieldKey === 'homework');
        expect(homeworkDetail?.rawValue).toBeUndefined();
        expect(homeworkDetail?.normalizedScore).toBe(0);
        
        // Check attendance field (missing boolean value)
        const attendanceDetail = result.extraComponent.details.find(d => d.fieldKey === 'attendance');
        expect(attendanceDetail?.rawValue).toBeUndefined();
        expect(attendanceDetail?.normalizedScore).toBe(0);
      }
    });

    it('should handle null extra scores object', () => {
      const input: CalculationInput = {
        studentId: 'test-student',
        studentCode: 'TEST001',
        studentName: 'Test Student',
        examAttempts: [
          {
            examId: 'exam1',
            examTitle: 'Test Exam',
            scorePercentage: 75,
            finalScorePercentage: 80,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        extraScores: null, // Null scores
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
          overallPassThreshold: 50,
          examWeight: 0.7,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      };

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.extraComponent.score).toBe(0);
        expect(result.extraComponent.details).toHaveLength(1);
        expect(result.extraComponent.details[0].rawValue).toBeUndefined();
        expect(result.extraComponent.details[0].normalizedScore).toBe(0);
      }
    });

    it('should handle text fields with missing score map', () => {
      const input: CalculationInput = {
        studentId: 'test-student',
        studentCode: 'TEST001',
        studentName: 'Test Student',
        examAttempts: [
          {
            examId: 'exam1',
            examTitle: 'Test Exam',
            scorePercentage: 75,
            finalScorePercentage: 80,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        extraScores: {
          grade: 'A', // Text value
        },
        extraFields: [
          {
            key: 'grade',
            label: 'Letter Grade',
            type: 'text',
            includeInPass: true,
            passWeight: 0.3,
            maxPoints: null,
            boolTruePoints: null,
            boolFalsePoints: null,
            textScoreMap: null, // Missing score map
          },
        ],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 50,
          examWeight: 0.7,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      };

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.extraComponent.score).toBe(0); // No score map means 0
        expect(result.extraComponent.details).toHaveLength(1);
        expect(result.extraComponent.details[0].rawValue).toBe('A');
        expect(result.extraComponent.details[0].normalizedScore).toBe(0);
      }
    });
  });

  describe('Weight Validation', () => {
    it('should handle zero weights gracefully', () => {
      const input: CalculationInput = {
        studentId: 'test-student',
        studentCode: 'TEST001',
        studentName: 'Test Student',
        examAttempts: [
          {
            examId: 'exam1',
            examTitle: 'Test Exam',
            scorePercentage: 75,
            finalScorePercentage: 80,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        extraScores: {
          homework: 90,
        },
        extraFields: [
          {
            key: 'homework',
            label: 'Homework',
            type: 'number',
            includeInPass: true,
            passWeight: 0, // Zero weight
            maxPoints: 100,
            boolTruePoints: null,
            boolFalsePoints: null,
            textScoreMap: null,
          },
        ],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 50,
          examWeight: 0, // Zero exam weight
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      };

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      if (result.success) {
        // With zero exam weight but non-zero extra weight, should use exam score only
        // Since extra component has zero total weight, final score = exam score
        expect(result.finalScore).toBe(80);
        expect(result.examComponent.score).toBe(80);
        expect(result.extraComponent.score).toBeNull(); // Zero weight means null score
      }
    });
  });
});