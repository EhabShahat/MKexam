/**
 * Unit tests for BatchProcessor
 * 
 * Tests batching logic, cache behavior, error handling, and data fetching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchProcessor } from '../batchProcessor';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalculationResult } from '../scoreCalculator.types';

/**
 * Create a mock Supabase client for testing
 */
function createMockSupabaseClient(mockData: {
  students?: any[];
  fields?: any[];
  settings?: any[];
  studentError?: any;
  fieldError?: any;
  settingsError?: any;
}): SupabaseClient {
  const mock = {
    from: vi.fn((table: string) => {
      const query = {
        select: vi.fn(() => query),
        in: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        maybeSingle: vi.fn(() => query),
      };

      // Configure response based on table
      if (table === 'student_score_summary') {
        (query as any).then = (resolve: any) => {
          resolve({
            data: mockData.students || [],
            error: mockData.studentError || null,
          });
        };
      } else if (table === 'extra_score_fields') {
        (query as any).then = (resolve: any) => {
          resolve({
            data: mockData.fields || [],
            error: mockData.fieldError || null,
          });
        };
      } else if (table === 'app_settings') {
        (query as any).then = (resolve: any) => {
          resolve({
            data: mockData.settings?.[0] || null,
            error: mockData.settingsError || null,
          });
        };
      }

      return query;
    }),
  };

  return mock as unknown as SupabaseClient;
}

describe('BatchProcessor', () => {
  describe('Constructor and Configuration', () => {
    it('should create instance with default options', () => {
      const processor = new BatchProcessor();
      
      expect(processor).toBeDefined();
      expect(processor.getCacheSize()).toBe(0);
    });

    it('should create instance with custom options', () => {
      const processor = new BatchProcessor({
        batchSize: 100,
        concurrency: 5,
        cacheResults: false,
      });
      
      expect(processor).toBeDefined();
    });

    it('should use default values for partial options', () => {
      const processor = new BatchProcessor({
        batchSize: 50,
      });
      
      expect(processor).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    let processor: BatchProcessor;

    beforeEach(() => {
      processor = new BatchProcessor({ cacheResults: true });
    });

    it('should start with empty cache', () => {
      expect(processor.getCacheSize()).toBe(0);
      expect(processor.isCached('CODE1')).toBe(false);
    });

    it('should cache results after processing', async () => {
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      await processor.processStudents(['CODE1'], mockSupabase);

      expect(processor.getCacheSize()).toBe(1);
      expect(processor.isCached('CODE1')).toBe(true);
    });

    it('should return cached results on subsequent calls', async () => {
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      // First call - should fetch from database
      const result1 = await processor.processStudents(['CODE1'], mockSupabase);
      
      // Second call - should return from cache
      const result2 = await processor.processStudents(['CODE1'], mockSupabase);

      expect(result1).toEqual(result2);
      expect(processor.getCacheSize()).toBe(1);
    });

    it('should clear cache when requested', async () => {
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      await processor.processStudents(['CODE1'], mockSupabase);
      expect(processor.getCacheSize()).toBe(1);

      processor.clearCache();
      expect(processor.getCacheSize()).toBe(0);
      expect(processor.isCached('CODE1')).toBe(false);
    });

    it('should retrieve cached result directly', async () => {
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      await processor.processStudents(['CODE1'], mockSupabase);
      
      const cached = processor.getCached('CODE1');
      expect(cached).toBeDefined();
      expect(cached?.success).toBe(true);
    });

    it('should not cache when caching is disabled', async () => {
      const noCacheProcessor = new BatchProcessor({ cacheResults: false });
      
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      await noCacheProcessor.processStudents(['CODE1'], mockSupabase);

      expect(noCacheProcessor.getCacheSize()).toBe(0);
      expect(noCacheProcessor.isCached('CODE1')).toBe(false);
    });
  });

  describe('Batch Processing', () => {
    it('should return empty map for empty input', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({});

      const results = await processor.processStudents([], mockSupabase);

      expect(results.size).toBe(0);
    });

    it('should process single student', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [
              {
                exam_id: 'exam1',
                exam_title: 'Exam 1',
                score_percentage: 85,
                final_score_percentage: 85,
                include_in_pass: true,
                pass_threshold: 50,
              },
            ],
            extra_scores: {},
            last_attempt_date: '2024-01-01',
            exams_taken: 1,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      const results = await processor.processStudents(['CODE1'], mockSupabase);

      expect(results.size).toBe(1);
      expect(results.has('CODE1')).toBe(true);
      
      const result = results.get('CODE1')!;
      expect(result.success).toBe(true);
      expect(result.finalScore).toBe(85);
    });

    it('should process multiple students', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
          {
            student_id: '2',
            student_code: 'CODE2',
            student_name: 'Student 2',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
          {
            student_id: '3',
            student_code: 'CODE3',
            student_name: 'Student 3',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      const results = await processor.processStudents(
        ['CODE1', 'CODE2', 'CODE3'],
        mockSupabase
      );

      expect(results.size).toBe(3);
      expect(results.has('CODE1')).toBe(true);
      expect(results.has('CODE2')).toBe(true);
      expect(results.has('CODE3')).toBe(true);
    });

    it('should handle student not found', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        students: [], // No students returned
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      const results = await processor.processStudents(['NOTFOUND'], mockSupabase);

      expect(results.size).toBe(1);
      expect(results.has('NOTFOUND')).toBe(true);
      
      const result = results.get('NOTFOUND')!;
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should process mix of found and not found students', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      const results = await processor.processStudents(
        ['CODE1', 'NOTFOUND'],
        mockSupabase
      );

      expect(results.size).toBe(2);
      
      const result1 = results.get('CODE1')!;
      expect(result1.success).toBe(true);
      
      const result2 = results.get('NOTFOUND')!;
      expect(result2.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when student query fails', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        studentError: { message: 'Database connection failed' },
      });

      await expect(
        processor.processStudents(['CODE1'], mockSupabase)
      ).rejects.toThrow('Failed to fetch student summaries');
    });

    it('should throw error when fields query fails', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        students: [],
        fieldError: { message: 'Table not found' },
      });

      await expect(
        processor.processStudents(['CODE1'], mockSupabase)
      ).rejects.toThrow('Failed to fetch extra fields');
    });

    it('should throw error when settings query fails', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        students: [],
        fields: [],
        settingsError: { message: 'Permission denied' },
      });

      await expect(
        processor.processStudents(['CODE1'], mockSupabase)
      ).rejects.toThrow('Failed to fetch settings');
    });
  });

  describe('Data Parsing', () => {
    it('should parse exam attempts correctly', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [
              {
                exam_id: 'exam1',
                exam_title: 'Midterm',
                score_percentage: 75,
                final_score_percentage: 80,
                include_in_pass: true,
                pass_threshold: 60,
              },
              {
                exam_id: 'exam2',
                exam_title: 'Final',
                score_percentage: 90,
                final_score_percentage: 95,
                include_in_pass: true,
                pass_threshold: 70,
              },
            ],
            extra_scores: {},
            last_attempt_date: '2024-01-01',
            exams_taken: 2,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      const results = await processor.processStudents(['CODE1'], mockSupabase);
      const result = results.get('CODE1')!;

      expect(result.success).toBe(true);
      expect(result.examComponent.examsTotal).toBe(2);
      expect(result.examComponent.examsIncluded).toBe(2);
    });

    it('should parse extra scores correctly', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [],
            extra_scores: {
              attendance: 95,
              homework: 85,
            },
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'number',
            include_in_pass: true,
            pass_weight: 0.3,
            max_points: 100,
          },
          {
            key: 'homework',
            label: 'Homework',
            type: 'number',
            include_in_pass: true,
            pass_weight: 0.2,
            max_points: 100,
          },
        ],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      const results = await processor.processStudents(['CODE1'], mockSupabase);
      const result = results.get('CODE1')!;

      expect(result.success).toBe(true);
      expect(result.extraComponent.details.length).toBe(2);
      expect(result.extraComponent.totalWeight).toBe(0.5);
    });

    it('should handle null/empty exam attempts', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: null, // Null exam attempts
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      const results = await processor.processStudents(['CODE1'], mockSupabase);
      const result = results.get('CODE1')!;

      expect(result.success).toBe(true);
      expect(result.examComponent.examsTotal).toBe(0);
    });

    it('should handle null/empty extra scores', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [],
            extra_scores: null, // Null extra scores
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      const results = await processor.processStudents(['CODE1'], mockSupabase);
      const result = results.get('CODE1')!;

      expect(result.success).toBe(true);
      expect(result.extraComponent.details.length).toBe(0);
    });

    it('should parse settings with defaults', async () => {
      const processor = new BatchProcessor();
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [],
        settings: [], // Empty settings - should use defaults
      });

      const results = await processor.processStudents(['CODE1'], mockSupabase);
      const result = results.get('CODE1')!;

      expect(result.success).toBe(true);
      expect(result.passThreshold).toBe(50); // Default threshold
    });
  });

  describe('Batching Logic', () => {
    it('should handle batch size smaller than input', async () => {
      const processor = new BatchProcessor({ batchSize: 2 });
      const mockSupabase = createMockSupabaseClient({
        students: [
          {
            student_id: '1',
            student_code: 'CODE1',
            student_name: 'Student 1',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
          {
            student_id: '2',
            student_code: 'CODE2',
            student_name: 'Student 2',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
          {
            student_id: '3',
            student_code: 'CODE3',
            student_name: 'Student 3',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          },
        ],
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      const results = await processor.processStudents(
        ['CODE1', 'CODE2', 'CODE3'],
        mockSupabase
      );

      expect(results.size).toBe(3);
    });

    it('should handle large number of students', async () => {
      const processor = new BatchProcessor({ batchSize: 200 });
      
      // Generate 500 mock students
      const students = Array.from({ length: 500 }, (_, i) => ({
        student_id: `${i + 1}`,
        student_code: `CODE${i + 1}`,
        student_name: `Student ${i + 1}`,
        exam_attempts: [],
        extra_scores: {},
        last_attempt_date: null,
        exams_taken: 0,
      }));

      const codes = students.map(s => s.student_code);

      const mockSupabase = createMockSupabaseClient({
        students,
        fields: [],
        settings: [
          { key: 'pass_calc_mode', value: 'best' },
          { key: 'overall_pass_threshold', value: 50 },
          { key: 'exam_weight', value: 1.0 },
          { key: 'exam_score_source', value: 'final' },
          { key: 'fail_on_any_exam', value: false },
        ],
      });

      const results = await processor.processStudents(codes, mockSupabase);

      expect(results.size).toBe(500);
    });
  });
});
