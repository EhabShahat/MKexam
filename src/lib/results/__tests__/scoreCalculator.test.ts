/**
 * Unit Tests for Score Calculator
 * 
 * Comprehensive tests for score calculation functions including edge cases
 * and specific scenarios.
 * 
 * Requirements: 20.10
 */

import { describe, it, expect } from 'vitest';
import {
  calculateExamComponent,
  calculateExtraComponent,
  calculateFinalScore,
  normalizeExtraFieldValue,
} from '../scoreCalculator';
import type { Exam, ExtraField, AppSettings } from '../types';

describe('Score Calculator - Unit Tests', () => {
  // Helper function to create exam
  const createExam = (overrides: Partial<Exam> = {}): Exam => ({
    id: 'exam-1',
    title: 'Test Exam',
    status: 'published',
    access_type: 'open',
    exam_type: 'exam',
    scheduling_mode: 'Auto',
    is_manually_published: false,
    is_archived: false,
    start_time: null,
    end_time: null,
    include_in_pass: true,
    pass_threshold: 60,
    ...overrides,
  });

  // Helper function to create extra field
  const createExtraField = (overrides: Partial<ExtraField> = {}): ExtraField => ({
    key: 'field-1',
    label: 'Test Field',
    type: 'number',
    hidden: false,
    include_in_pass: true,
    pass_weight: 0.5,
    max_points: 100,
    bool_true_points: null,
    bool_false_points: null,
    text_score_map: null,
    ...overrides,
  });

  // Helper function to create app settings
  const createSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
    result_pass_calc_mode: 'best',
    result_overall_pass_threshold: 60,
    result_exam_weight: 0.7,
    result_fail_on_any_exam: false,
    ...overrides,
  });

  describe('calculateExamComponent', () => {
    it('should calculate best score correctly', () => {
      const exams = [
        createExam({ id: 'exam-1', include_in_pass: true }),
        createExam({ id: 'exam-2', include_in_pass: true }),
        createExam({ id: 'exam-3', include_in_pass: true }),
      ];
      const scores = {
        'exam-1': 75,
        'exam-2': 90,
        'exam-3': 65,
      };

      const result = calculateExamComponent(scores, exams, 'best');

      expect(result.mode).toBe('best');
      expect(result.score).toBe(90);
      expect(result.exams_included).toBe(3);
      expect(result.exams_total).toBe(3);
    });

    it('should calculate average score correctly', () => {
      const exams = [
        createExam({ id: 'exam-1', include_in_pass: true }),
        createExam({ id: 'exam-2', include_in_pass: true }),
        createExam({ id: 'exam-3', include_in_pass: true }),
      ];
      const scores = {
        'exam-1': 60,
        'exam-2': 80,
        'exam-3': 70,
      };

      const result = calculateExamComponent(scores, exams, 'avg');

      expect(result.mode).toBe('avg');
      expect(result.score).toBe(70);
      expect(result.exams_included).toBe(3);
    });

    it('should only include exams with include_in_pass flag', () => {
      const exams = [
        createExam({ id: 'exam-1', include_in_pass: true }),
        createExam({ id: 'exam-2', include_in_pass: false }),
        createExam({ id: 'exam-3', include_in_pass: true }),
      ];
      const scores = {
        'exam-1': 75,
        'exam-2': 90,
        'exam-3': 65,
      };

      const result = calculateExamComponent(scores, exams, 'best');

      expect(result.exams_included).toBe(2);
      expect(result.score).toBe(75); // Max of 75 and 65, ignoring 90
    });

    it('should handle null scores gracefully', () => {
      const exams = [
        createExam({ id: 'exam-1', include_in_pass: true }),
        createExam({ id: 'exam-2', include_in_pass: true }),
        createExam({ id: 'exam-3', include_in_pass: true }),
      ];
      const scores = {
        'exam-1': 75,
        'exam-2': null,
        'exam-3': 65,
      };

      const result = calculateExamComponent(scores, exams, 'best');

      expect(result.score).toBe(75);
    });

    it('should return 0 when all scores are null', () => {
      const exams = [
        createExam({ id: 'exam-1', include_in_pass: true }),
        createExam({ id: 'exam-2', include_in_pass: true }),
      ];
      const scores = {
        'exam-1': null,
        'exam-2': null,
      };

      const result = calculateExamComponent(scores, exams, 'best');

      expect(result.score).toBe(0);
    });

    it('should return 0 when no exams are included', () => {
      const exams = [
        createExam({ id: 'exam-1', include_in_pass: false }),
        createExam({ id: 'exam-2', include_in_pass: false }),
      ];
      const scores = {
        'exam-1': 75,
        'exam-2': 85,
      };

      const result = calculateExamComponent(scores, exams, 'best');

      expect(result.score).toBe(0);
      expect(result.exams_included).toBe(0);
    });

    it('should correctly identify passed exams', () => {
      const exams = [
        createExam({ id: 'exam-1', include_in_pass: true, pass_threshold: 60 }),
        createExam({ id: 'exam-2', include_in_pass: true, pass_threshold: 70 }),
        createExam({ id: 'exam-3', include_in_pass: true, pass_threshold: 50 }),
      ];
      const scores = {
        'exam-1': 75,
        'exam-2': 65,
        'exam-3': 80,
      };

      const result = calculateExamComponent(scores, exams, 'best');

      expect(result.exams_passed).toBe(2); // exam-1 and exam-3 passed
      expect(result.details[0].passed).toBe(true);
      expect(result.details[1].passed).toBe(false);
      expect(result.details[2].passed).toBe(true);
    });

    it('should handle empty exam array', () => {
      const result = calculateExamComponent({}, [], 'best');

      expect(result.score).toBe(0);
      expect(result.exams_included).toBe(0);
      expect(result.exams_total).toBe(0);
      expect(result.details).toEqual([]);
    });
  });

  describe('normalizeExtraFieldValue', () => {
    describe('number type fields', () => {
      it('should normalize number based on max_points', () => {
        const field = createExtraField({ type: 'number', max_points: 50 });
        
        expect(normalizeExtraFieldValue(25, field)).toBe(50);
        expect(normalizeExtraFieldValue(50, field)).toBe(100);
        expect(normalizeExtraFieldValue(0, field)).toBe(0);
      });

      it('should treat value as percentage when max_points is null', () => {
        const field = createExtraField({ type: 'number', max_points: null });
        
        expect(normalizeExtraFieldValue(75, field)).toBe(75);
        expect(normalizeExtraFieldValue(100, field)).toBe(100);
      });

      it('should clamp values to 0-100 range', () => {
        const field = createExtraField({ type: 'number', max_points: null });
        
        expect(normalizeExtraFieldValue(150, field)).toBe(100);
        expect(normalizeExtraFieldValue(-10, field)).toBe(0);
      });

      it('should handle string numbers', () => {
        const field = createExtraField({ type: 'number', max_points: 100 });
        
        expect(normalizeExtraFieldValue('75', field)).toBe(75);
      });

      it('should return 0 for invalid numbers', () => {
        const field = createExtraField({ type: 'number', max_points: 100 });
        
        expect(normalizeExtraFieldValue('invalid', field)).toBe(0);
        expect(normalizeExtraFieldValue(NaN, field)).toBe(0);
      });

      it('should handle zero max_points', () => {
        const field = createExtraField({ type: 'number', max_points: 0 });
        
        expect(normalizeExtraFieldValue(50, field)).toBe(50);
      });
    });

    describe('boolean type fields', () => {
      it('should use bool_true_points for true values', () => {
        const field = createExtraField({ 
          type: 'boolean', 
          bool_true_points: 80,
          bool_false_points: 20,
        });
        
        expect(normalizeExtraFieldValue(true, field)).toBe(80);
      });

      it('should use bool_false_points for false values', () => {
        const field = createExtraField({ 
          type: 'boolean', 
          bool_true_points: 80,
          bool_false_points: 20,
        });
        
        expect(normalizeExtraFieldValue(false, field)).toBe(20);
      });

      it('should default to 100 for true when bool_true_points is null', () => {
        const field = createExtraField({ 
          type: 'boolean', 
          bool_true_points: null,
          bool_false_points: null,
        });
        
        expect(normalizeExtraFieldValue(true, field)).toBe(100);
      });

      it('should default to 0 for false when bool_false_points is null', () => {
        const field = createExtraField({ 
          type: 'boolean', 
          bool_true_points: null,
          bool_false_points: null,
        });
        
        expect(normalizeExtraFieldValue(false, field)).toBe(0);
      });

      it('should handle string boolean values', () => {
        const field = createExtraField({ 
          type: 'boolean', 
          bool_true_points: 100,
          bool_false_points: 0,
        });
        
        expect(normalizeExtraFieldValue('true', field)).toBe(100);
        expect(normalizeExtraFieldValue('false', field)).toBe(0);
      });
    });

    describe('text type fields', () => {
      it('should use text_score_map for matching values', () => {
        const field = createExtraField({ 
          type: 'text',
          text_score_map: {
            'excellent': 100,
            'good': 75,
            'fair': 50,
          },
        });
        
        expect(normalizeExtraFieldValue('excellent', field)).toBe(100);
        expect(normalizeExtraFieldValue('good', field)).toBe(75);
        expect(normalizeExtraFieldValue('fair', field)).toBe(50);
      });

      it('should normalize mapped score with max_points', () => {
        const field = createExtraField({ 
          type: 'text',
          max_points: 50,
          text_score_map: {
            'excellent': 50,
            'good': 25,
          },
        });
        
        expect(normalizeExtraFieldValue('excellent', field)).toBe(100);
        expect(normalizeExtraFieldValue('good', field)).toBe(50);
      });

      it('should return 0 for unmapped values', () => {
        const field = createExtraField({ 
          type: 'text',
          text_score_map: {
            'excellent': 100,
          },
        });
        
        expect(normalizeExtraFieldValue('unknown', field)).toBe(0);
      });

      it('should handle case-sensitive matching', () => {
        const field = createExtraField({ 
          type: 'text',
          text_score_map: {
            'Excellent': 100,
          },
        });
        
        expect(normalizeExtraFieldValue('Excellent', field)).toBe(100);
        expect(normalizeExtraFieldValue('excellent', field)).toBe(0);
      });

      it('should trim whitespace from text values', () => {
        const field = createExtraField({ 
          type: 'text',
          text_score_map: {
            'excellent': 100,
          },
        });
        
        expect(normalizeExtraFieldValue('  excellent  ', field)).toBe(100);
      });

      it('should return 0 when text_score_map is null', () => {
        const field = createExtraField({ 
          type: 'text',
          text_score_map: null,
        });
        
        expect(normalizeExtraFieldValue('anything', field)).toBe(0);
      });
    });

    describe('null/undefined handling', () => {
      it('should return 0 for null values', () => {
        const field = createExtraField({ type: 'number' });
        
        expect(normalizeExtraFieldValue(null, field)).toBe(0);
      });

      it('should return 0 for undefined values', () => {
        const field = createExtraField({ type: 'number' });
        
        expect(normalizeExtraFieldValue(undefined, field)).toBe(0);
      });
    });
  });

  describe('calculateExtraComponent', () => {
    it('should calculate weighted sum correctly', () => {
      const fields = [
        createExtraField({ key: 'attendance', pass_weight: 0.3, max_points: 100 }),
        createExtraField({ key: 'participation', pass_weight: 0.2, max_points: 100 }),
      ];
      const extraData = {
        attendance: 80,
        participation: 90,
      };

      const result = calculateExtraComponent(extraData, fields);

      // Total weight = 0.5
      // Weighted contribution: (80 * 0.3 / 0.5) + (90 * 0.2 / 0.5) = 48 + 36 = 84
      expect(result.score).toBeCloseTo(84, 5);
      expect(result.total_weight).toBe(0.5);
    });

    it('should only include fields with include_in_pass flag', () => {
      const fields = [
        createExtraField({ key: 'attendance', include_in_pass: true, pass_weight: 0.3 }),
        createExtraField({ key: 'notes', include_in_pass: false, pass_weight: 0.2 }),
      ];
      const extraData = {
        attendance: 80,
        notes: 100,
      };

      const result = calculateExtraComponent(extraData, fields);

      expect(result.details).toHaveLength(1);
      expect(result.total_weight).toBe(0.3);
    });

    it('should handle missing extra data gracefully', () => {
      const fields = [
        createExtraField({ key: 'attendance', pass_weight: 0.5, max_points: 100 }),
      ];
      const extraData = {};

      const result = calculateExtraComponent(extraData, fields);

      expect(result.score).toBe(0);
      expect(result.details[0].raw_value).toBe(null);
      expect(result.details[0].normalized_score).toBe(0);
    });

    it('should return 0 when total weight is 0', () => {
      const fields = [
        createExtraField({ key: 'attendance', pass_weight: 0, max_points: 100 }),
      ];
      const extraData = {
        attendance: 100,
      };

      const result = calculateExtraComponent(extraData, fields);

      expect(result.score).toBe(0);
      expect(result.total_weight).toBe(0);
    });

    it('should handle empty fields array', () => {
      const result = calculateExtraComponent({}, []);

      expect(result.score).toBe(0);
      expect(result.total_weight).toBe(0);
      expect(result.details).toEqual([]);
    });

    it('should handle null pass_weight', () => {
      const fields = [
        createExtraField({ key: 'attendance', pass_weight: null, max_points: 100 }),
      ];
      const extraData = {
        attendance: 80,
      };

      const result = calculateExtraComponent(extraData, fields);

      expect(result.score).toBe(0);
      expect(result.total_weight).toBe(0);
    });
  });

  describe('calculateFinalScore', () => {
    it('should calculate final score with weighted combination', () => {
      const examComp = {
        mode: 'best' as const,
        score: 80,
        exams_included: 2,
        exams_total: 2,
        exams_passed: 2,
        details: [],
      };
      const extraComp = {
        score: 90,
        total_weight: 0.5,
        details: [],
      };
      const settings = createSettings({
        result_exam_weight: 0.7,
        result_overall_pass_threshold: 60,
      });

      const result = calculateFinalScore(examComp, extraComp, settings);

      // Final = (80 * 0.7) + (90 * 0.3) = 56 + 27 = 83
      expect(result.final_score).toBeCloseTo(83, 5);
      expect(result.passed).toBe(true);
    });

    it('should fail when final score is below threshold', () => {
      const examComp = {
        mode: 'best' as const,
        score: 50,
        exams_included: 1,
        exams_total: 1,
        exams_passed: 0,
        details: [],
      };
      const extraComp = {
        score: 60,
        total_weight: 0.5,
        details: [],
      };
      const settings = createSettings({
        result_exam_weight: 0.7,
        result_overall_pass_threshold: 70,
      });

      const result = calculateFinalScore(examComp, extraComp, settings);

      // Final = (50 * 0.7) + (60 * 0.3) = 35 + 18 = 53
      expect(result.final_score).toBeCloseTo(53, 5);
      expect(result.passed).toBe(false);
    });

    it('should fail when fail_on_any_exam is true and an exam failed', () => {
      const examComp = {
        mode: 'best' as const,
        score: 90,
        exams_included: 2,
        exams_total: 2,
        exams_passed: 1,
        details: [
          { exam_id: 'e1', exam_title: 'Exam 1', score: 90, passed: true, pass_threshold: 60 },
          { exam_id: 'e2', exam_title: 'Exam 2', score: 50, passed: false, pass_threshold: 60 },
        ],
      };
      const extraComp = {
        score: 100,
        total_weight: 0.5,
        details: [],
      };
      const settings = createSettings({
        result_exam_weight: 0.7,
        result_overall_pass_threshold: 60,
        result_fail_on_any_exam: true,
      });

      const result = calculateFinalScore(examComp, extraComp, settings);

      expect(result.passed).toBe(false);
      expect(result.failed_due_to_exam).toBe(true);
    });

    it('should pass when fail_on_any_exam is false even if an exam failed', () => {
      const examComp = {
        mode: 'best' as const,
        score: 90,
        exams_included: 2,
        exams_total: 2,
        exams_passed: 1,
        details: [
          { exam_id: 'e1', exam_title: 'Exam 1', score: 90, passed: true, pass_threshold: 60 },
          { exam_id: 'e2', exam_title: 'Exam 2', score: 50, passed: false, pass_threshold: 60 },
        ],
      };
      const extraComp = {
        score: 100,
        total_weight: 0.5,
        details: [],
      };
      const settings = createSettings({
        result_exam_weight: 0.7,
        result_overall_pass_threshold: 60,
        result_fail_on_any_exam: false,
      });

      const result = calculateFinalScore(examComp, extraComp, settings);

      // Final = (90 * 0.7) + (100 * 0.3) = 63 + 30 = 93
      expect(result.passed).toBe(true);
      expect(result.failed_due_to_exam).toBe(false);
    });

    it('should handle exam weight of 1 (no extra component)', () => {
      const examComp = {
        mode: 'best' as const,
        score: 75,
        exams_included: 1,
        exams_total: 1,
        exams_passed: 1,
        details: [],
      };
      const extraComp = {
        score: 90,
        total_weight: 0.5,
        details: [],
      };
      const settings = createSettings({
        result_exam_weight: 1,
        result_overall_pass_threshold: 60,
      });

      const result = calculateFinalScore(examComp, extraComp, settings);

      expect(result.final_score).toBe(75);
      expect(result.passed).toBe(true);
    });

    it('should handle exam weight of 0 (only extra component)', () => {
      const examComp = {
        mode: 'best' as const,
        score: 50,
        exams_included: 1,
        exams_total: 1,
        exams_passed: 0,
        details: [],
      };
      const extraComp = {
        score: 80,
        total_weight: 0.5,
        details: [],
      };
      const settings = createSettings({
        result_exam_weight: 0,
        result_overall_pass_threshold: 60,
      });

      const result = calculateFinalScore(examComp, extraComp, settings);

      expect(result.final_score).toBe(80);
      expect(result.passed).toBe(true);
    });

    it('should not set failed_due_to_exam when no exams have scores', () => {
      const examComp = {
        mode: 'best' as const,
        score: 0,
        exams_included: 2,
        exams_total: 2,
        exams_passed: 0,
        details: [
          { exam_id: 'e1', exam_title: 'Exam 1', score: null, passed: false, pass_threshold: 60 },
          { exam_id: 'e2', exam_title: 'Exam 2', score: null, passed: false, pass_threshold: 60 },
        ],
      };
      const extraComp = {
        score: 50,
        total_weight: 0.5,
        details: [],
      };
      const settings = createSettings({
        result_exam_weight: 0.7,
        result_overall_pass_threshold: 60,
        result_fail_on_any_exam: true,
      });

      const result = calculateFinalScore(examComp, extraComp, settings);

      expect(result.failed_due_to_exam).toBe(false);
    });
  });
});
