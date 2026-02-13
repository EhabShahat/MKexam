/**
 * Integration Tests for Admin Summaries API
 * 
 * Tests the score calculation logic with various student data scenarios
 * to ensure correct score calculation and response formatting.
 * 
 * Feature: score-calculation-optimization
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { calculateFinalScore } from '@/lib/scoreCalculator';
import { BatchProcessor } from '@/lib/batchProcessor';
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

describe('Admin Summaries API - Integration Tests', () => {
  const defaultSettings: CalculationSettings = {
    passCalcMode: 'best',
    overallPassThreshold: 60,
    examWeight: 1.0,
    examScoreSource: 'final',
    failOnAnyExam: false,
  };

  describe('Single Student Scenarios', () => {
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

    it('should calculate score for student with multiple exams in best mode', () => {
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
      expect(result.examComponent.examsIncluded).toBe(2);
    });

    it('should calculate score for student with multiple exams in average mode', () => {
      const input = createCalculationInput(
        'CODE3',
        [
          {
            examId: 'exam-1',
            examTitle: 'Math Exam',
            scorePercentage: 70,
            finalScorePercentage: 70,
            includeInPass: true,
            passThreshold: 60,
          },
          {
            examId: 'exam-2',
            examTitle: 'Science Exam',
            scorePercentage: 80,
            finalScorePercentage: 80,
            includeInPass: true,
            passThreshold: 60,
          },
        ],
        {},
        [],
        { ...defaultSettings, passCalcMode: 'avg' }
      );

      const result = calculateFinalScore(input);

      expect(result.success).toBe(true);
      expect(result.finalScore).toBe(75);
      expect(result.passed).toBe(true);
      expect(result.examComponent.score).toBe(75);
      expect(result.examComponent.mode).toBe('avg');
    });

    it('should calculate score for student with extra scores', () => {
      const input = createCalculationInput(
        'CODE4',
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
        'CODE5',
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

    it('should apply failOnAnyExam rule correctly', () => {
      const input = createCalculationInput(
        'CODE6',
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

  describe('Batch Processing Scenarios', () => {
    it('should calculate scores for multiple students with consistent results', () => {
      const students = [];
      
      for (let i = 1; i <= 10; i++) {
        const input = createCalculationInput(
          `CODE${i}`,
          [
            {
              examId: 'exam-1',
              examTitle: 'Math Exam',
              scorePercentage: 70 + i,
              finalScorePercentage: 70 + i,
              includeInPass: true,
              passThreshold: 60,
            },
          ],
          {},
          [],
          defaultSettings
        );
        
        students.push({ code: `CODE${i}`, input });
      }

      // Calculate scores for all students
      const results = students.map(s => ({
        code: s.code,
        result: calculateFinalScore(s.input),
      }));

      // Verify all results
      expect(results).toHaveLength(10);
      
      for (let i = 0; i < 10; i++) {
        const { code, result } = results[i];
        expect(result.success).toBe(true);
        expect(result.finalScore).toBe(71 + i);
        expect(result.passed).toBe(true);
      }
    });

    it('should handle students with varying data completeness', () => {
      const students = [
        // Student with full data
        createCalculationInput(
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
        ),
        // Student with no exams
        createCalculationInput('CODE2', [], {}, [], defaultSettings),
        // Student with exams but no extra scores
        createCalculationInput(
          'CODE3',
          [
            {
              examId: 'exam-1',
              examTitle: 'Math Exam',
              scorePercentage: 75,
              finalScorePercentage: 75,
              includeInPass: true,
              passThreshold: 60,
            },
          ],
          {},
          [],
          defaultSettings
        ),
      ];

      const results = students.map(input => calculateFinalScore(input));

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // First student should have both components
      expect(results[0].examComponent.score).toBe(85);
      expect(results[0].extraComponent.score).toBeGreaterThan(0);
      
      // Second student should have null scores
      expect(results[1].finalScore).toBeNull();
      
      // Third student should have only exam component
      expect(results[2].examComponent.score).toBe(75);
      expect(results[2].extraComponent.score).toBeNull();
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
});


/**
 * Mock Supabase client for testing
 * 
 * This mock simulates the database responses without requiring a real database connection.
 */
class MockSupabaseClient {
  private mockData: {
    students: Map<string, any>;
    extraFields: ExtraField[];
    settings: CalculationSettings;
  };

  constructor() {
    this.mockData = {
      students: new Map(),
      extraFields: [],
      settings: {
        passCalcMode: 'best',
        overallPassThreshold: 60,
        examWeight: 1.0,
        examScoreSource: 'final',
        failOnAnyExam: false,
      },
    };
  }

  setMockData(data: Partial<typeof this.mockData>) {
    this.mockData = { ...this.mockData, ...data };
  }

  from(table: string) {
    const self = this;
    return {
      select: (columns: string) => {
        if (table === 'student_score_summary') {
          return {
            in: (column: string, values: string[]) => {
              const results = values
                .map(code => self.mockData.students.get(code))
                .filter(Boolean);
              return Promise.resolve({ data: results, error: null });
            },
          };
        }
        
        if (table === 'extra_score_fields') {
          return {
            order: (column: string, options?: any) => {
              return Promise.resolve({ data: self.mockData.extraFields, error: null });
            },
          };
        }
        
        if (table === 'app_settings') {
          return {
            limit: (count: number) => ({
              maybeSingle: () => {
                return Promise.resolve({
                  data: {
                    result_pass_calc_mode: self.mockData.settings.passCalcMode,
                    result_overall_pass_threshold: self.mockData.settings.overallPassThreshold,
                    result_exam_weight: self.mockData.settings.examWeight,
                    result_exam_score_source: self.mockData.settings.examScoreSource,
                    result_fail_on_any_exam: self.mockData.settings.failOnAnyExam,
                  },
                  error: null,
                });
              },
            }),
          };
        }
        
        return {
          in: () => Promise.resolve({ data: [], error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
          limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        };
      },
    };
  }
}

describe('Admin Summaries API - Integration Tests', () => {
  let mockSupabase: MockSupabaseClient;
  let processor: BatchProcessor;

  beforeAll(() => {
    mockSupabase = new MockSupabaseClient();
    processor = new BatchProcessor({ batchSize: 200, cacheResults: true });
  });

  beforeEach(() => {
    // Clear cache before each test to avoid interference
    processor.clearCache();
  });

  afterAll(() => {
    processor.clearCache();
  });

  describe('Single Student Scenarios', () => {
    it('should calculate score for student with one exam', async () => {
      // Setup mock data
      mockSupabase.setMockData({
        students: new Map([
          ['CODE1', {
            student_id: 'student-1',
            student_code: 'CODE1',
            student_name: 'Test Student',
            exam_attempts: [
              {
                exam_id: 'exam-1',
                exam_title: 'Math Exam',
                exam_type: 'exam',
                score_percentage: 85,
                final_score_percentage: 85,
                submitted_at: '2024-01-01T10:00:00Z',
                include_in_pass: true,
                pass_threshold: 60,
              },
            ],
            extra_scores: {},
            last_attempt_date: '2024-01-01T10:00:00Z',
            exams_taken: 1,
          }],
        ]),
        extraFields: [],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      });

      // Process student
      const results = await processor.processStudents(['CODE1'], mockSupabase as any);
      const result = results.get('CODE1');

      // Verify result
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.finalScore).toBe(85);
      expect(result?.passed).toBe(true);
      expect(result?.examComponent.score).toBe(85);
      expect(result?.examComponent.examsIncluded).toBe(1);
      expect(result?.examComponent.examsPassed).toBe(1);
    });

    it('should calculate score for student with multiple exams in best mode', async () => {
      // Setup mock data
      mockSupabase.setMockData({
        students: new Map([
          ['CODE2', {
            student_id: 'student-2',
            student_code: 'CODE2',
            student_name: 'Test Student 2',
            exam_attempts: [
              {
                exam_id: 'exam-1',
                exam_title: 'Math Exam',
                exam_type: 'exam',
                score_percentage: 75,
                final_score_percentage: 75,
                submitted_at: '2024-01-01T10:00:00Z',
                include_in_pass: true,
                pass_threshold: 60,
              },
              {
                exam_id: 'exam-2',
                exam_title: 'Science Exam',
                exam_type: 'exam',
                score_percentage: 90,
                final_score_percentage: 90,
                submitted_at: '2024-01-02T10:00:00Z',
                include_in_pass: true,
                pass_threshold: 60,
              },
            ],
            extra_scores: {},
            last_attempt_date: '2024-01-02T10:00:00Z',
            exams_taken: 2,
          }],
        ]),
        extraFields: [],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      });

      // Process student
      const results = await processor.processStudents(['CODE2'], mockSupabase as any);
      const result = results.get('CODE2');

      // Verify result - should use best score (90)
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.finalScore).toBe(90);
      expect(result?.passed).toBe(true);
      expect(result?.examComponent.score).toBe(90);
      expect(result?.examComponent.mode).toBe('best');
      expect(result?.examComponent.examsIncluded).toBe(2);
    });

    it('should calculate score for student with multiple exams in average mode', async () => {
      // Setup mock data
      mockSupabase.setMockData({
        students: new Map([
          ['CODE3', {
            student_id: 'student-3',
            student_code: 'CODE3',
            student_name: 'Test Student 3',
            exam_attempts: [
              {
                exam_id: 'exam-1',
                exam_title: 'Math Exam',
                exam_type: 'exam',
                score_percentage: 70,
                final_score_percentage: 70,
                submitted_at: '2024-01-01T10:00:00Z',
                include_in_pass: true,
                pass_threshold: 60,
              },
              {
                exam_id: 'exam-2',
                exam_title: 'Science Exam',
                exam_type: 'exam',
                score_percentage: 80,
                final_score_percentage: 80,
                submitted_at: '2024-01-02T10:00:00Z',
                include_in_pass: true,
                pass_threshold: 60,
              },
            ],
            extra_scores: {},
            last_attempt_date: '2024-01-02T10:00:00Z',
            exams_taken: 2,
          }],
        ]),
        extraFields: [],
        settings: {
          passCalcMode: 'avg',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      });

      // Process student
      const results = await processor.processStudents(['CODE3'], mockSupabase as any);
      const result = results.get('CODE3');

      // Verify result - should use average score (75)
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.finalScore).toBe(75);
      expect(result?.passed).toBe(true);
      expect(result?.examComponent.score).toBe(75);
      expect(result?.examComponent.mode).toBe('avg');
    });

    it('should calculate score for student with extra scores', async () => {
      // Setup mock data
      mockSupabase.setMockData({
        students: new Map([
          ['CODE4', {
            student_id: 'student-4',
            student_code: 'CODE4',
            student_name: 'Test Student 4',
            exam_attempts: [
              {
                exam_id: 'exam-1',
                exam_title: 'Math Exam',
                exam_type: 'exam',
                score_percentage: 80,
                final_score_percentage: 80,
                submitted_at: '2024-01-01T10:00:00Z',
                include_in_pass: true,
                pass_threshold: 60,
              },
            ],
            extra_scores: {
              attendance: 90,
              homework: 85,
            },
            last_attempt_date: '2024-01-01T10:00:00Z',
            exams_taken: 1,
          }],
        ]),
        extraFields: [
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'number' as const,
            include_in_pass: true,
            pass_weight: 0.2,
            max_points: 100,
          },
          {
            key: 'homework',
            label: 'Homework',
            type: 'number' as const,
            include_in_pass: true,
            pass_weight: 0.3,
            max_points: 100,
          },
        ],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      });

      // Process student
      const results = await processor.processStudents(['CODE4'], mockSupabase as any);
      const result = results.get('CODE4');

      // Verify result
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.examComponent.score).toBe(80);
      expect(result?.extraComponent.score).toBeGreaterThan(0);
      expect(result?.extraComponent.details).toHaveLength(2);
      expect(result?.finalScore).toBeGreaterThan(80); // Should be higher due to extra scores
      expect(result?.passed).toBe(true);
    });

    it('should handle student with no exams', async () => {
      // Setup mock data
      mockSupabase.setMockData({
        students: new Map([
          ['CODE5', {
            student_id: 'student-5',
            student_code: 'CODE5',
            student_name: 'Test Student 5',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          }],
        ]),
        extraFields: [],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      });

      // Process student
      const results = await processor.processStudents(['CODE5'], mockSupabase as any);
      const result = results.get('CODE5');

      // Verify result
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.examComponent.score).toBeNull();
      expect(result?.finalScore).toBeNull();
      expect(result?.passed).toBeNull();
    });

    it('should apply failOnAnyExam rule correctly', async () => {
      // Setup mock data
      mockSupabase.setMockData({
        students: new Map([
          ['CODE6', {
            student_id: 'student-6',
            student_code: 'CODE6',
            student_name: 'Test Student 6',
            exam_attempts: [
              {
                exam_id: 'exam-1',
                exam_title: 'Math Exam',
                exam_type: 'exam',
                score_percentage: 90,
                final_score_percentage: 90,
                submitted_at: '2024-01-01T10:00:00Z',
                include_in_pass: true,
                pass_threshold: 60,
              },
              {
                exam_id: 'exam-2',
                exam_title: 'Science Exam',
                exam_type: 'exam',
                score_percentage: 50, // Below threshold
                final_score_percentage: 50,
                submitted_at: '2024-01-02T10:00:00Z',
                include_in_pass: true,
                pass_threshold: 60,
              },
            ],
            extra_scores: {},
            last_attempt_date: '2024-01-02T10:00:00Z',
            exams_taken: 2,
          }],
        ]),
        extraFields: [],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: true,
        },
      });

      // Process student
      const results = await processor.processStudents(['CODE6'], mockSupabase as any);
      const result = results.get('CODE6');

      // Verify result - should fail due to one exam below threshold
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.finalScore).toBe(90); // Best score
      expect(result?.passed).toBe(false); // Failed due to one exam
      expect(result?.failedDueToExam).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple students efficiently', async () => {
      // Setup mock data with multiple students
      const students = new Map();
      for (let i = 1; i <= 10; i++) {
        students.set(`CODE${i}`, {
          student_id: `student-${i}`,
          student_code: `CODE${i}`,
          student_name: `Test Student ${i}`,
          exam_attempts: [
            {
              exam_id: 'exam-1',
              exam_title: 'Math Exam',
              exam_type: 'exam',
              score_percentage: 70 + i,
              final_score_percentage: 70 + i,
              submitted_at: '2024-01-01T10:00:00Z',
              include_in_pass: true,
              pass_threshold: 60,
            },
          ],
          extra_scores: {},
          last_attempt_date: '2024-01-01T10:00:00Z',
          exams_taken: 1,
        });
      }

      mockSupabase.setMockData({
        students,
        extraFields: [],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      });

      // Process all students
      const codes = Array.from({ length: 10 }, (_, i) => `CODE${i + 1}`);
      const results = await processor.processStudents(codes, mockSupabase as any);

      // Verify all results
      expect(results.size).toBe(10);
      for (let i = 1; i <= 10; i++) {
        const result = results.get(`CODE${i}`);
        expect(result).toBeDefined();
        expect(result?.success).toBe(true);
        expect(result?.finalScore).toBe(70 + i);
      }
    });

    it('should process 200+ students efficiently', async () => {
      // Setup mock data with 250 students to test batch processing
      const students = new Map();
      for (let i = 1; i <= 250; i++) {
        students.set(`CODE${i}`, {
          student_id: `student-${i}`,
          student_code: `CODE${i}`,
          student_name: `Test Student ${i}`,
          exam_attempts: [
            {
              exam_id: 'exam-1',
              exam_title: 'Math Exam',
              exam_type: 'exam',
              score_percentage: 50 + (i % 50),
              final_score_percentage: 50 + (i % 50),
              submitted_at: '2024-01-01T10:00:00Z',
              include_in_pass: true,
              pass_threshold: 60,
            },
          ],
          extra_scores: {},
          last_attempt_date: '2024-01-01T10:00:00Z',
          exams_taken: 1,
        });
      }

      mockSupabase.setMockData({
        students,
        extraFields: [],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      });

      // Process all students
      const codes = Array.from({ length: 250 }, (_, i) => `CODE${i + 1}`);
      const startTime = Date.now();
      const results = await processor.processStudents(codes, mockSupabase as any);
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Verify all results
      expect(results.size).toBe(250);
      
      // Verify a sample of results
      expect(results.get('CODE1')?.finalScore).toBe(51); // 50 + (1 % 50) = 51
      expect(results.get('CODE50')?.finalScore).toBe(50); // 50 + (50 % 50) = 50
      expect(results.get('CODE100')?.finalScore).toBe(50); // 50 + (100 % 50) = 50
      expect(results.get('CODE250')?.finalScore).toBe(50); // 50 + (250 % 50) = 50

      // Verify processing time is reasonable (should be fast with batch processing)
      // Allow up to 5 seconds for 250 students (very generous for mock data)
      expect(processingTime).toBeLessThan(5000);
    });

    it('should handle mix of valid and invalid student codes', async () => {
      // Setup mock data with only some students
      mockSupabase.setMockData({
        students: new Map([
          ['CODE1', {
            student_id: 'student-1',
            student_code: 'CODE1',
            student_name: 'Test Student 1',
            exam_attempts: [],
            extra_scores: {},
            last_attempt_date: null,
            exams_taken: 0,
          }],
        ]),
        extraFields: [],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      });

      // Process with some invalid codes
      const results = await processor.processStudents(['CODE1', 'INVALID1', 'INVALID2'], mockSupabase as any);

      // Verify results
      expect(results.size).toBe(3);
      expect(results.get('CODE1')?.success).toBe(true);
      expect(results.get('INVALID1')?.success).toBe(false);
      expect(results.get('INVALID2')?.success).toBe(false);
    });

    it('should handle students with varying data complexity', async () => {
      // Setup mock data with students having different data patterns
      const students = new Map([
        // Student with multiple exams and extra scores
        ['COMPLEX1', {
          student_id: 'student-complex-1',
          student_code: 'COMPLEX1',
          student_name: 'Complex Student 1',
          exam_attempts: [
            {
              exam_id: 'exam-1',
              exam_title: 'Math Exam',
              exam_type: 'exam',
              score_percentage: 85,
              final_score_percentage: 85,
              submitted_at: '2024-01-01T10:00:00Z',
              include_in_pass: true,
              pass_threshold: 60,
            },
            {
              exam_id: 'exam-2',
              exam_title: 'Science Exam',
              exam_type: 'exam',
              score_percentage: 90,
              final_score_percentage: 90,
              submitted_at: '2024-01-02T10:00:00Z',
              include_in_pass: true,
              pass_threshold: 60,
            },
            {
              exam_id: 'exam-3',
              exam_title: 'History Exam',
              exam_type: 'exam',
              score_percentage: 78,
              final_score_percentage: 78,
              submitted_at: '2024-01-03T10:00:00Z',
              include_in_pass: true,
              pass_threshold: 60,
            },
          ],
          extra_scores: {
            attendance: 95,
            homework: 88,
            quiz: 92,
          },
          last_attempt_date: '2024-01-03T10:00:00Z',
          exams_taken: 3,
        }],
        // Student with only one exam, no extra scores
        ['SIMPLE1', {
          student_id: 'student-simple-1',
          student_code: 'SIMPLE1',
          student_name: 'Simple Student 1',
          exam_attempts: [
            {
              exam_id: 'exam-1',
              exam_title: 'Math Exam',
              exam_type: 'exam',
              score_percentage: 75,
              final_score_percentage: 75,
              submitted_at: '2024-01-01T10:00:00Z',
              include_in_pass: true,
              pass_threshold: 60,
            },
          ],
          extra_scores: {},
          last_attempt_date: '2024-01-01T10:00:00Z',
          exams_taken: 1,
        }],
        // Student with no exams but has extra scores
        ['NOEXAM1', {
          student_id: 'student-noexam-1',
          student_code: 'NOEXAM1',
          student_name: 'No Exam Student 1',
          exam_attempts: [],
          extra_scores: {
            attendance: 100,
            homework: 95,
          },
          last_attempt_date: null,
          exams_taken: 0,
        }],
      ]);

      mockSupabase.setMockData({
        students,
        extraFields: [
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'number' as const,
            include_in_pass: true,
            pass_weight: 0.2,
            max_points: 100,
          },
          {
            key: 'homework',
            label: 'Homework',
            type: 'number' as const,
            include_in_pass: true,
            pass_weight: 0.3,
            max_points: 100,
          },
          {
            key: 'quiz',
            label: 'Quiz',
            type: 'number' as const,
            include_in_pass: true,
            pass_weight: 0.2,
            max_points: 100,
          },
        ],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      });

      // Process all students
      const results = await processor.processStudents(['COMPLEX1', 'SIMPLE1', 'NOEXAM1'], mockSupabase as any);

      // Verify all succeeded
      expect(results.size).toBe(3);
      expect(results.get('COMPLEX1')?.success).toBe(true);
      expect(results.get('SIMPLE1')?.success).toBe(true);
      expect(results.get('NOEXAM1')?.success).toBe(true);

      // Verify complex student has both components
      const complex = results.get('COMPLEX1');
      expect(complex?.examComponent.score).toBe(90); // Best of 85, 90, 78
      expect(complex?.examComponent.examsIncluded).toBe(3);
      expect(complex?.extraComponent.details.length).toBeGreaterThan(0);
      expect(complex?.finalScore).toBeGreaterThan(90);

      // Verify simple student has only exam component
      const simple = results.get('SIMPLE1');
      expect(simple?.examComponent.score).toBe(75);
      expect(simple?.examComponent.examsIncluded).toBe(1);
      expect(simple?.extraComponent.score).toBe(0); // No extra scores provided, so score is 0
      // Final score is weighted: (75 * 1.0 + 0 * 0.7) / (1.0 + 0.7) = 44.12
      expect(simple?.finalScore).toBeCloseTo(44.12, 2);

      // Verify no-exam student has null exam component but gets score from extra component
      const noExam = results.get('NOEXAM1');
      expect(noExam?.examComponent.score).toBeNull();
      expect(noExam?.extraComponent.score).toBeGreaterThan(0);
      // When there are no exams but extra scores exist, final score = extra score
      expect(noExam?.finalScore).toBeGreaterThan(0);
      expect(noExam?.finalScore).toBe(noExam?.extraComponent.score);
    });

    it('should utilize caching for repeated requests', async () => {
      // Setup mock data
      const students = new Map([
        ['CODE1', {
          student_id: 'student-1',
          student_code: 'CODE1',
          student_name: 'Test Student',
          exam_attempts: [
            {
              exam_id: 'exam-1',
              exam_title: 'Math Exam',
              exam_type: 'exam',
              score_percentage: 85,
              final_score_percentage: 85,
              submitted_at: '2024-01-01T10:00:00Z',
              includeInPass: true,
              passThreshold: 60,
            },
          ],
          extra_scores: {},
          last_attempt_date: '2024-01-01T10:00:00Z',
          exams_taken: 1,
        }],
      ]);

      mockSupabase.setMockData({
        students,
        extraFields: [],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      });

      // First request - should calculate and cache
      const results1 = await processor.processStudents(['CODE1'], mockSupabase as any);
      expect(results1.get('CODE1')?.success).toBe(true);
      expect(processor.isCached('CODE1')).toBe(true);

      // Second request - should use cache
      const results2 = await processor.processStudents(['CODE1'], mockSupabase as any);
      expect(results2.get('CODE1')?.success).toBe(true);
      
      // Results should be identical
      expect(results1.get('CODE1')).toEqual(results2.get('CODE1'));

      // Clear cache
      processor.clearCache();
      expect(processor.isCached('CODE1')).toBe(false);
    });
  });

  describe('Response Format Validation', () => {
    it('should return response with all required fields', async () => {
      // Setup mock data
      mockSupabase.setMockData({
        students: new Map([
          ['CODE1', {
            student_id: 'student-1',
            student_code: 'CODE1',
            student_name: 'Test Student',
            exam_attempts: [
              {
                exam_id: 'exam-1',
                exam_title: 'Math Exam',
                exam_type: 'exam',
                score_percentage: 85,
                final_score_percentage: 85,
                submitted_at: '2024-01-01T10:00:00Z',
                include_in_pass: true,
                pass_threshold: 60,
              },
            ],
            extra_scores: { attendance: 90 },
            last_attempt_date: '2024-01-01T10:00:00Z',
            exams_taken: 1,
          }],
        ]),
        extraFields: [
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'number' as const,
            include_in_pass: true,
            pass_weight: 0.2,
            max_points: 100,
          },
        ],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 60,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false,
        },
      });

      // Process student
      const results = await processor.processStudents(['CODE1'], mockSupabase as any);
      const result = results.get('CODE1');

      // Verify response structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('examComponent');
      expect(result).toHaveProperty('extraComponent');
      expect(result).toHaveProperty('finalScore');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('passThreshold');
      expect(result).toHaveProperty('failedDueToExam');

      // Verify exam component structure
      expect(result?.examComponent).toHaveProperty('score');
      expect(result?.examComponent).toHaveProperty('mode');
      expect(result?.examComponent).toHaveProperty('examsIncluded');
      expect(result?.examComponent).toHaveProperty('examsTotal');
      expect(result?.examComponent).toHaveProperty('examsPassed');
      expect(result?.examComponent).toHaveProperty('details');

      // Verify extra component structure
      expect(result?.extraComponent).toHaveProperty('score');
      expect(result?.extraComponent).toHaveProperty('totalWeight');
      expect(result?.extraComponent).toHaveProperty('details');
    });
  });
});







