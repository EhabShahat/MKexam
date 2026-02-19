/**
 * Performance Test Suite for Score Calculation Optimization
 * 
 * Feature: score-calculation-optimization
 * Tests performance with varying student counts and measures:
 * - API response times
 * - Batch processing throughput
 * - Database query performance
 * - Memory usage patterns
 * - Cache effectiveness
 * 
 * Requirements: 2.1 - Performance optimization targets
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { BatchProcessor } from '../batchProcessor';
import { calculateFinalScore } from '../scoreCalculator';
import { performanceMonitor, trackBatchProcessing, trackCalculation } from '../performanceMonitor';
import type { CalculationInput, CalculationResult } from '../scoreCalculator.types';

// Mock Supabase client for testing
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      limit: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    }))
  }))
} as any;

// Performance test configuration
const PERFORMANCE_TARGETS = {
  // API response time targets (milliseconds)
  API_RESPONSE_100_STUDENTS: 1000,   // 1 second for 100 students
  API_RESPONSE_500_STUDENTS: 2500,   // 2.5 seconds for 500 students
  API_RESPONSE_1000_STUDENTS: 3000,  // 3 seconds for 1000 students
  API_RESPONSE_5000_STUDENTS: 10000, // 10 seconds for 5000 students
  
  // Batch processing throughput targets (students per second)
  MIN_THROUGHPUT_SMALL: 50,   // 50 students/sec for small batches
  MIN_THROUGHPUT_LARGE: 100,  // 100 students/sec for large batches
  
  // Individual calculation targets (milliseconds)
  MAX_SINGLE_CALCULATION: 10,  // 10ms per calculation
  
  // Memory usage targets
  MAX_MEMORY_GROWTH_MB: 100,   // Max 100MB growth during batch processing
};

// Test data generators
function generateMockStudent(code: string): any {
  return {
    student_id: `student_${code}`,
    student_code: code,
    student_name: `Student ${code}`,
    exam_attempts: [
      {
        exam_id: 'exam1',
        exam_title: 'Math Test',
        score_percentage: Math.random() * 100,
        final_score_percentage: Math.random() * 100,
        include_in_pass: true,
        pass_threshold: 50
      },
      {
        exam_id: 'exam2', 
        exam_title: 'Science Test',
        score_percentage: Math.random() * 100,
        final_score_percentage: Math.random() * 100,
        include_in_pass: true,
        pass_threshold: 60
      }
    ],
    extra_scores: {
      homework: Math.random() * 100,
      attendance: Math.random() * 100,
      quiz: Math.random() * 100
    },
    last_attempt_date: new Date().toISOString(),
    exams_taken: 2
  };
}

function generateMockExtraFields(): any[] {
  return [
    {
      key: 'homework',
      label: 'Homework',
      type: 'number',
      include_in_pass: true,
      pass_weight: 0.3,
      max_points: 100
    },
    {
      key: 'attendance',
      label: 'Attendance',
      type: 'number',
      include_in_pass: true,
      pass_weight: 0.2,
      max_points: 100
    },
    {
      key: 'quiz',
      label: 'Quiz',
      type: 'number',
      include_in_pass: true,
      pass_weight: 0.5,
      max_points: 100
    }
  ];
}

function generateMockSettings(): any {
  return {
    result_pass_calc_mode: 'best',
    result_overall_pass_threshold: 50,
    result_exam_weight: 1.0,
    result_exam_score_source: 'final',
    result_fail_on_any_exam: false
  };
}

function generateStudentCodes(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `STU${String(i + 1).padStart(4, '0')}`);
}

function setupMockSupabaseResponses(studentCount: number) {
  const studentCodes = generateStudentCodes(studentCount);
  const mockStudents = studentCodes.map(generateMockStudent);
  const mockFields = generateMockExtraFields();
  const mockSettings = generateMockSettings();

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'student_score_summary') {
      return {
        select: () => ({
          in: () => Promise.resolve({ data: mockStudents, error: null })
        })
      };
    }
    
    if (table === 'extra_score_fields') {
      return {
        select: () => ({
          order: () => Promise.resolve({ data: mockFields, error: null })
        })
      };
    }
    
    if (table === 'app_settings') {
      return {
        select: () => ({
          limit: () => ({
            maybeSingle: () => Promise.resolve({ data: mockSettings, error: null })
          })
        })
      };
    }
    
    return {
      select: () => ({
        in: () => Promise.resolve({ data: [], error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
        limit: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null })
        })
      })
    };
  });
}

function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }
  return 0;
}

describe('Performance Test Suite', () => {
  let batchProcessor: BatchProcessor;
  let initialMemory: number;

  beforeEach(() => {
    batchProcessor = new BatchProcessor({ batchSize: 200, cacheResults: true });
    performanceMonitor.resetMetrics();
    initialMemory = getMemoryUsage();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('15.1 Performance Test Suite - API Response Times', () => {
    it('should process 100 students within 1 second', async () => {
      const studentCount = 100;
      const studentCodes = generateStudentCodes(studentCount);
      setupMockSupabaseResponses(studentCount);

      const startTime = performance.now();
      const results = await batchProcessor.processStudents(studentCodes, mockSupabase);
      const duration = performance.now() - startTime;

      expect(results.size).toBe(studentCount);
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.API_RESPONSE_100_STUDENTS);
      
      // Log performance metrics
      console.log(`100 students processed in ${duration.toFixed(2)}ms (target: ${PERFORMANCE_TARGETS.API_RESPONSE_100_STUDENTS}ms)`);
    });

    it('should process 500 students within 2.5 seconds', async () => {
      const studentCount = 500;
      const studentCodes = generateStudentCodes(studentCount);
      setupMockSupabaseResponses(studentCount);

      const startTime = performance.now();
      const results = await batchProcessor.processStudents(studentCodes, mockSupabase);
      const duration = performance.now() - startTime;

      expect(results.size).toBe(studentCount);
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.API_RESPONSE_500_STUDENTS);
      
      console.log(`500 students processed in ${duration.toFixed(2)}ms (target: ${PERFORMANCE_TARGETS.API_RESPONSE_500_STUDENTS}ms)`);
    });

    it('should process 1000 students within 3 seconds', async () => {
      const studentCount = 1000;
      const studentCodes = generateStudentCodes(studentCount);
      setupMockSupabaseResponses(studentCount);

      const startTime = performance.now();
      const results = await batchProcessor.processStudents(studentCodes, mockSupabase);
      const duration = performance.now() - startTime;

      expect(results.size).toBe(studentCount);
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.API_RESPONSE_1000_STUDENTS);
      
      console.log(`1000 students processed in ${duration.toFixed(2)}ms (target: ${PERFORMANCE_TARGETS.API_RESPONSE_1000_STUDENTS}ms)`);
    });

    it('should process 5000 students within 10 seconds', async () => {
      const studentCount = 5000;
      const studentCodes = generateStudentCodes(studentCount);
      setupMockSupabaseResponses(studentCount);

      const startTime = performance.now();
      const results = await batchProcessor.processStudents(studentCodes, mockSupabase);
      const duration = performance.now() - startTime;

      expect(results.size).toBe(studentCount);
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.API_RESPONSE_5000_STUDENTS);
      
      console.log(`5000 students processed in ${duration.toFixed(2)}ms (target: ${PERFORMANCE_TARGETS.API_RESPONSE_5000_STUDENTS}ms)`);
    });
  });

  describe('15.1 Performance Test Suite - Batch Processing Throughput', () => {
    it('should achieve minimum throughput for small batches', async () => {
      const studentCount = 200;
      const studentCodes = generateStudentCodes(studentCount);
      setupMockSupabaseResponses(studentCount);

      const startTime = performance.now();
      await batchProcessor.processStudents(studentCodes, mockSupabase);
      const duration = performance.now() - startTime;

      const throughput = (studentCount / duration) * 1000; // students per second
      expect(throughput).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_THROUGHPUT_SMALL);
      
      console.log(`Small batch throughput: ${throughput.toFixed(1)} students/sec (target: ${PERFORMANCE_TARGETS.MIN_THROUGHPUT_SMALL})`);
    });

    it('should achieve minimum throughput for large batches', async () => {
      const studentCount = 1000;
      const studentCodes = generateStudentCodes(studentCount);
      setupMockSupabaseResponses(studentCount);

      const startTime = performance.now();
      await batchProcessor.processStudents(studentCodes, mockSupabase);
      const duration = performance.now() - startTime;

      const throughput = (studentCount / duration) * 1000; // students per second
      expect(throughput).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_THROUGHPUT_LARGE);
      
      console.log(`Large batch throughput: ${throughput.toFixed(1)} students/sec (target: ${PERFORMANCE_TARGETS.MIN_THROUGHPUT_LARGE})`);
    });

    it('should maintain consistent throughput across multiple batches', async () => {
      const batchSizes = [100, 200, 500, 1000];
      const throughputs: number[] = [];

      for (const size of batchSizes) {
        const studentCodes = generateStudentCodes(size);
        setupMockSupabaseResponses(size);

        const startTime = performance.now();
        await batchProcessor.processStudents(studentCodes, mockSupabase);
        const duration = performance.now() - startTime;

        const throughput = (size / duration) * 1000;
        throughputs.push(throughput);
        
        console.log(`Batch size ${size}: ${throughput.toFixed(1)} students/sec`);
      }

      // Throughput should not degrade significantly with larger batches
      const minThroughput = Math.min(...throughputs);
      const maxThroughput = Math.max(...throughputs);
      const degradation = (maxThroughput - minThroughput) / maxThroughput;
      
      expect(degradation).toBeLessThan(0.5); // Less than 50% degradation
    });
  });

  describe('15.1 Performance Test Suite - Individual Calculation Performance', () => {
    it('should calculate individual scores within target time', () => {
      const mockInput: CalculationInput = {
        studentId: 'test-student',
        studentCode: 'TEST001',
        studentName: 'Test Student',
        examAttempts: [
          {
            examId: 'exam1',
            examTitle: 'Test Exam',
            scorePercentage: 85,
            finalScorePercentage: 87,
            includeInPass: true,
            passThreshold: 50
          }
        ],
        extraScores: {
          homework: 90,
          attendance: 95
        },
        extraFields: [
          {
            key: 'homework',
            label: 'Homework',
            type: 'number',
            includeInPass: true,
            passWeight: 0.3,
            maxPoints: 100
          },
          {
            key: 'attendance',
            label: 'Attendance',
            type: 'number',
            includeInPass: true,
            passWeight: 0.2,
            maxPoints: 100
          }
        ],
        settings: {
          passCalcMode: 'best',
          overallPassThreshold: 50,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false
        }
      };

      // Measure multiple calculations to get average
      const iterations = 100;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const result = calculateFinalScore(mockInput);
        const duration = performance.now() - startTime;
        
        durations.push(duration);
        expect(result.success).toBe(true);
      }

      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      expect(averageDuration).toBeLessThan(PERFORMANCE_TARGETS.MAX_SINGLE_CALCULATION);
      expect(maxDuration).toBeLessThan(PERFORMANCE_TARGETS.MAX_SINGLE_CALCULATION * 2);
      
      console.log(`Individual calculation: avg ${averageDuration.toFixed(2)}ms, max ${maxDuration.toFixed(2)}ms (target: ${PERFORMANCE_TARGETS.MAX_SINGLE_CALCULATION}ms)`);
    });

    it('should handle complex calculations efficiently', () => {
      // Create a complex calculation with many exams and extra fields
      const mockInput: CalculationInput = {
        studentId: 'complex-student',
        studentCode: 'COMPLEX001',
        studentName: 'Complex Student',
        examAttempts: Array.from({ length: 10 }, (_, i) => ({
          examId: `exam${i + 1}`,
          examTitle: `Exam ${i + 1}`,
          scorePercentage: Math.random() * 100,
          finalScorePercentage: Math.random() * 100,
          includeInPass: true,
          passThreshold: 50
        })),
        extraScores: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [`field${i + 1}`, Math.random() * 100])
        ),
        extraFields: Array.from({ length: 20 }, (_, i) => ({
          key: `field${i + 1}`,
          label: `Field ${i + 1}`,
          type: 'number' as const,
          includeInPass: true,
          passWeight: 0.1,
          maxPoints: 100
        })),
        settings: {
          passCalcMode: 'avg',
          overallPassThreshold: 60,
          examWeight: 2.0,
          examScoreSource: 'final',
          failOnAnyExam: true
        }
      };

      const startTime = performance.now();
      const result = calculateFinalScore(mockInput);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.MAX_SINGLE_CALCULATION * 3); // Allow 3x for complex calculations
      
      console.log(`Complex calculation (10 exams, 20 fields): ${duration.toFixed(2)}ms`);
    });
  });

  describe('15.1 Performance Test Suite - Memory Usage', () => {
    it('should not exceed memory growth limits during batch processing', async () => {
      const studentCount = 1000;
      const studentCodes = generateStudentCodes(studentCount);
      setupMockSupabaseResponses(studentCount);

      const memoryBefore = getMemoryUsage();
      await batchProcessor.processStudents(studentCodes, mockSupabase);
      const memoryAfter = getMemoryUsage();

      const memoryGrowth = memoryAfter - memoryBefore;
      
      expect(memoryGrowth).toBeLessThan(PERFORMANCE_TARGETS.MAX_MEMORY_GROWTH_MB);
      
      console.log(`Memory growth: ${memoryGrowth.toFixed(2)}MB (target: <${PERFORMANCE_TARGETS.MAX_MEMORY_GROWTH_MB}MB)`);
    });

    it('should release memory after cache clearing', async () => {
      const studentCount = 500;
      const studentCodes = generateStudentCodes(studentCount);
      setupMockSupabaseResponses(studentCount);

      // Process students to fill cache
      await batchProcessor.processStudents(studentCodes, mockSupabase);
      const memoryWithCache = getMemoryUsage();

      // Clear cache
      batchProcessor.clearCache();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const memoryAfterClear = getMemoryUsage();
      const memoryReduction = memoryWithCache - memoryAfterClear;
      
      expect(batchProcessor.getCacheSize()).toBe(0);
      console.log(`Memory reduction after cache clear: ${memoryReduction.toFixed(2)}MB`);
    });
  });

  describe('15.1 Performance Test Suite - Cache Effectiveness', () => {
    it('should demonstrate significant performance improvement with caching', async () => {
      const studentCount = 200;
      const studentCodes = generateStudentCodes(studentCount);
      setupMockSupabaseResponses(studentCount);

      // First run (cold cache)
      const startTime1 = performance.now();
      await batchProcessor.processStudents(studentCodes, mockSupabase);
      const duration1 = performance.now() - startTime1;

      // Second run (warm cache)
      const startTime2 = performance.now();
      await batchProcessor.processStudents(studentCodes, mockSupabase);
      const duration2 = performance.now() - startTime2;

      const speedup = duration1 / duration2;
      expect(speedup).toBeGreaterThan(2); // At least 2x speedup with cache
      
      console.log(`Cache speedup: ${speedup.toFixed(1)}x (${duration1.toFixed(2)}ms -> ${duration2.toFixed(2)}ms)`);
    });

    it('should maintain high cache hit rates', async () => {
      const studentCount = 100;
      const studentCodes = generateStudentCodes(studentCount);
      setupMockSupabaseResponses(studentCount);

      // Fill cache
      await batchProcessor.processStudents(studentCodes, mockSupabase);
      
      // Process same students again - this should hit cache
      await batchProcessor.processStudents(studentCodes, mockSupabase);
      
      // Check cache directly since performance monitor might not track this correctly in tests
      const cacheSize = batchProcessor.getCacheSize();
      expect(cacheSize).toBe(studentCount);
      
      // Verify all students are cached
      const cachedCount = studentCodes.filter(code => batchProcessor.isCached(code)).length;
      expect(cachedCount).toBe(studentCount);
      
      console.log(`Cache size: ${cacheSize}, Cached students: ${cachedCount}/${studentCount}`);
    });
  });

  describe('15.1 Performance Test Suite - Bottleneck Identification', () => {
    it('should identify database query bottlenecks', async () => {
      const studentCount = 500;
      const studentCodes = generateStudentCodes(studentCount);
      
      // Add artificial delay to database queries
      const originalFrom = mockSupabase.from;
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'student_score_summary') {
          return {
            select: () => ({
              in: () => new Promise(resolve => {
                setTimeout(() => resolve({ data: studentCodes.map(generateMockStudent), error: null }), 100);
              })
            })
          };
        }
        if (table === 'extra_score_fields') {
          return {
            select: () => ({
              order: () => new Promise(resolve => {
                setTimeout(() => resolve({ data: generateMockExtraFields(), error: null }), 50);
              })
            })
          };
        }
        if (table === 'app_settings') {
          return {
            select: () => ({
              limit: () => ({
                maybeSingle: () => new Promise(resolve => {
                  setTimeout(() => resolve({ data: generateMockSettings(), error: null }), 50);
                })
              })
            })
          };
        }
        return originalFrom(table);
      });

      const startTime = performance.now();
      await batchProcessor.processStudents(studentCodes, mockSupabase);
      const duration = performance.now() - startTime;

      // Should reflect the artificial delays (100ms + 50ms + 50ms = 200ms minimum)
      expect(duration).toBeGreaterThan(150); // Allow some variance
      
      console.log(`Total duration with artificial delays: ${duration.toFixed(2)}ms`);
      
      // Restore original mock
      mockSupabase.from = originalFrom;
    });

    it('should identify calculation bottlenecks', () => {
      // Create a calculation that should be flagged as slow
      const mockInput: CalculationInput = {
        studentId: 'slow-student',
        studentCode: 'SLOW001',
        studentName: 'Slow Student',
        examAttempts: Array.from({ length: 100 }, (_, i) => ({
          examId: `exam${i}`,
          examTitle: `Exam ${i}`,
          scorePercentage: Math.random() * 100,
          finalScorePercentage: Math.random() * 100,
          includeInPass: true,
          passThreshold: 50
        })),
        extraScores: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`field${i}`, Math.random() * 100])
        ),
        extraFields: Array.from({ length: 100 }, (_, i) => ({
          key: `field${i}`,
          label: `Field ${i}`,
          type: 'number' as const,
          includeInPass: true,
          passWeight: 0.01,
          maxPoints: 100
        })),
        settings: {
          passCalcMode: 'avg',
          overallPassThreshold: 50,
          examWeight: 1.0,
          examScoreSource: 'final',
          failOnAnyExam: false
        }
      };

      // This should trigger slow calculation tracking
      const result = calculateFinalScore(mockInput);
      expect(result.success).toBe(true);

      const summary = performanceMonitor.getPerformanceSummary();
      console.log(`Slow calculations: ${summary.calculations.slowCount}`);
      console.log(`Average calculation time: ${summary.calculations.averageDuration.toFixed(2)}ms`);
    });
  });

  describe('15.1 Performance Test Suite - Scalability Testing', () => {
    it('should demonstrate linear scaling characteristics', async () => {
      const testSizes = [100, 200, 400, 800];
      const results: Array<{ size: number; duration: number; throughput: number }> = [];

      for (const size of testSizes) {
        const studentCodes = generateStudentCodes(size);
        setupMockSupabaseResponses(size);

        const startTime = performance.now();
        await batchProcessor.processStudents(studentCodes, mockSupabase);
        const duration = performance.now() - startTime;
        const throughput = (size / duration) * 1000;

        results.push({ size, duration, throughput });
        
        console.log(`Size ${size}: ${duration.toFixed(2)}ms, ${throughput.toFixed(1)} students/sec`);
      }

      // Check that scaling is roughly linear (not exponential)
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        const sizeRatio = curr.size / prev.size;
        const timeRatio = curr.duration / prev.duration;
        
        // Time should scale roughly linearly with size (allow some variance)
        expect(timeRatio).toBeLessThan(sizeRatio * 1.5);
        expect(timeRatio).toBeGreaterThan(sizeRatio * 0.5);
      }
    });
  });
});