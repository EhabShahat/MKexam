/**
 * Setup verification test for Score Calculator testing infrastructure
 * 
 * This test verifies that:
 * - fast-check is properly installed and configured
 * - Test utilities and arbitrary generators work correctly
 * - TypeScript types are properly defined
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  arbitraryCalculationSettings,
  arbitraryExamAttempt,
  arbitraryExtraField,
  arbitraryExtraScoreData,
  arbitraryCalculationInput,
  arbitraryValidCalculationInput,
  createMinimalInput,
  createInputWithExams,
  createInputWithExtras,
} from './scoreCalculator.testUtils';

describe('Score Calculator Testing Infrastructure', () => {
  describe('fast-check installation', () => {
    it('should be able to import and use fast-check', () => {
      expect(fc).toBeDefined();
      expect(fc.assert).toBeDefined();
      expect(fc.property).toBeDefined();
    });

    it('should generate random integers', () => {
      fc.assert(
        fc.property(fc.integer(), (n) => {
          expect(typeof n).toBe('number');
          expect(Number.isInteger(n)).toBe(true);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Arbitrary generators', () => {
    it('should generate valid calculation settings', () => {
      fc.assert(
        fc.property(arbitraryCalculationSettings(), (settings) => {
          expect(settings).toBeDefined();
          expect(['best', 'avg']).toContain(settings.passCalcMode);
          expect(settings.overallPassThreshold).toBeGreaterThanOrEqual(0);
          expect(settings.overallPassThreshold).toBeLessThanOrEqual(100);
          expect(settings.examWeight).toBeGreaterThanOrEqual(0);
          expect(['final', 'raw']).toContain(settings.examScoreSource);
          expect(typeof settings.failOnAnyExam).toBe('boolean');
        }),
        { numRuns: 20 }
      );
    });

    it('should generate valid exam attempts', () => {
      fc.assert(
        fc.property(arbitraryExamAttempt(), (attempt) => {
          expect(attempt).toBeDefined();
          expect(attempt.examId).toBeDefined();
          expect(attempt.examTitle).toBeDefined();
          expect(attempt.examTitle.length).toBeGreaterThan(0);
          expect(typeof attempt.includeInPass).toBe('boolean');
          
          if (attempt.scorePercentage !== null) {
            expect(attempt.scorePercentage).toBeGreaterThanOrEqual(0);
            expect(attempt.scorePercentage).toBeLessThanOrEqual(100);
          }
        }),
        { numRuns: 20 }
      );
    });

    it('should generate valid extra fields', () => {
      fc.assert(
        fc.property(arbitraryExtraField(), (field) => {
          expect(field).toBeDefined();
          expect(field.key).toBeDefined();
          expect(field.key.length).toBeGreaterThan(0);
          expect(['number', 'text', 'boolean']).toContain(field.type);
          expect(typeof field.includeInPass).toBe('boolean');
          expect(field.passWeight).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 20 }
      );
    });

    it('should generate valid extra score data', () => {
      fc.assert(
        fc.property(arbitraryExtraScoreData(), (data) => {
          expect(data).toBeDefined();
          expect(typeof data).toBe('object');
        }),
        { numRuns: 20 }
      );
    });

    it('should generate valid calculation input', () => {
      fc.assert(
        fc.property(arbitraryCalculationInput(), (input) => {
          expect(input).toBeDefined();
          expect(input.studentId).toBeDefined();
          expect(input.studentCode).toBeDefined();
          expect(input.studentName).toBeDefined();
          expect(Array.isArray(input.examAttempts)).toBe(true);
          expect(Array.isArray(input.extraFields)).toBe(true);
          expect(input.settings).toBeDefined();
          expect(input.extraScores).toBeDefined();
        }),
        { numRuns: 20 }
      );
    });

    it('should generate valid calculation input with at least one exam', () => {
      fc.assert(
        fc.property(arbitraryValidCalculationInput(), (input) => {
          expect(input).toBeDefined();
          expect(input.examAttempts.length).toBeGreaterThan(0);
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Helper functions', () => {
    it('should create minimal valid input', () => {
      const input = createMinimalInput();
      
      expect(input.studentId).toBe('00000000-0000-0000-0000-000000000001');
      expect(input.studentCode).toBe('TEST001');
      expect(input.studentName).toBe('Test Student');
      expect(input.examAttempts).toEqual([]);
      expect(input.extraScores).toEqual({});
      expect(input.extraFields).toEqual([]);
      expect(input.settings.passCalcMode).toBe('best');
    });

    it('should create input with exam scores', () => {
      const input = createInputWithExams([80, 90, 70], 'avg');
      
      expect(input.examAttempts.length).toBe(3);
      expect(input.examAttempts[0].scorePercentage).toBe(80);
      expect(input.examAttempts[1].scorePercentage).toBe(90);
      expect(input.examAttempts[2].scorePercentage).toBe(70);
      expect(input.settings.passCalcMode).toBe('avg');
    });

    it('should create input with extra fields', () => {
      const input = createInputWithExtras([
        { key: 'homework', value: 85, weight: 0.2 },
        { key: 'attendance', value: 95, weight: 0.1 },
      ]);
      
      expect(input.extraFields.length).toBe(2);
      expect(input.extraFields[0].key).toBe('homework');
      expect(input.extraScores.homework).toBe(85);
      expect(input.extraScores.attendance).toBe(95);
    });

    it('should allow overriding minimal input properties', () => {
      const input = createMinimalInput({
        studentCode: 'CUSTOM123',
        studentName: 'Custom Student',
      });
      
      expect(input.studentCode).toBe('CUSTOM123');
      expect(input.studentName).toBe('Custom Student');
      expect(input.studentId).toBe('00000000-0000-0000-0000-000000000001');
    });
  });

  describe('Type definitions', () => {
    it('should have proper TypeScript types', () => {
      const input = createMinimalInput();
      
      // These should compile without errors
      const studentId: string = input.studentId;
      const settings = input.settings;
      const mode: 'best' | 'avg' = settings.passCalcMode;
      
      expect(studentId).toBeDefined();
      expect(mode).toBeDefined();
    });
  });
});
