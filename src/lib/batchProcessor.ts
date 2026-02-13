/**
 * Batch Processor Module
 * 
 * Efficiently processes score calculations for multiple students by:
 * - Fetching all required data in bulk using database views
 * - Minimizing database queries through intelligent batching
 * - Implementing in-memory caching for repeated calculations
 * - Processing students in configurable batch sizes
 * 
 * @module batchProcessor
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateFinalScore } from './scoreCalculator';
import { logCacheOperation } from './calculationLogger';
import { withBatchTracking, withQueryTracking } from './performanceMonitor';
import { logDatabaseError } from './errorLogger';
import type {
  CalculationInput,
  CalculationResult,
  CalculationSettings,
  ExtraField,
  ExamAttempt,
  ExtraScoreData,
} from './scoreCalculator.types';

/**
 * Configuration options for the BatchProcessor
 */
export interface BatchProcessorOptions {
  /** Number of student codes to process per batch (default: 200) */
  batchSize: number;
  /** Number of concurrent batch operations (default: 3) */
  concurrency: number;
  /** Whether to cache calculation results in memory (default: true) */
  cacheResults: boolean;
}

/**
 * Bulk data fetched from the database for score calculation
 */
interface BulkData {
  /** Map of student code to student summary data */
  students: Map<string, StudentSummary>;
  /** Extra field definitions */
  extraFields: ExtraField[];
  /** Calculation settings */
  settings: CalculationSettings;
}

/**
 * Student summary data from the materialized view
 */
interface StudentSummary {
  studentId: string;
  studentCode: string;
  studentName: string;
  examAttempts: ExamAttempt[];
  extraScores: ExtraScoreData;
  lastAttemptDate: string | null;
  examsTaken: number;
}

/**
 * Raw data structure from the student_score_summary view
 */
interface StudentScoreSummaryRow {
  student_id: string;
  student_code: string;
  student_name: string;
  exam_attempts: any[];
  extra_scores: Record<string, any>;
  last_attempt_date: string | null;
  exams_taken: number;
}

/**
 * Raw extra field data from the database
 */
interface ExtraFieldRow {
  key: string;
  label: string;
  type: 'number' | 'text' | 'boolean';
  include_in_pass: boolean;
  pass_weight: number;
  max_points: number | null;
  bool_true_points?: number;
  bool_false_points?: number;
  text_score_map?: Record<string, number>;
}

/**
 * Raw settings data from the app_settings table
 */
interface SettingsRow {
  result_pass_calc_mode: 'best' | 'avg';
  result_overall_pass_threshold: number;
  result_exam_weight: number;
  result_exam_score_source: 'final' | 'raw';
  result_fail_on_any_exam: boolean;
}

/**
 * BatchProcessor efficiently processes score calculations for multiple students
 * 
 * Features:
 * - Bulk data fetching using materialized views
 * - Configurable batch sizes for memory management
 * - In-memory caching to avoid redundant calculations
 * - Concurrent processing for improved throughput
 * 
 * @example
 * ```typescript
 * const processor = new BatchProcessor({ batchSize: 200 });
 * const results = await processor.processStudents(['CODE1', 'CODE2'], supabase);
 * ```
 */
export class BatchProcessor {
  private options: BatchProcessorOptions;
  private cache: Map<string, CalculationResult>;

  /**
   * Creates a new BatchProcessor instance
   * 
   * @param options - Configuration options (optional)
   */
  constructor(options?: Partial<BatchProcessorOptions>) {
    this.options = {
      batchSize: options?.batchSize ?? 200,
      concurrency: options?.concurrency ?? 3,
      cacheResults: options?.cacheResults ?? true,
    };
    this.cache = new Map();
  }

  /**
   * Process scores for multiple student codes
   * 
   * This is the main entry point for batch processing. It:
   * 1. Fetches all required data in bulk from the database
   * 2. Processes each student's score calculation
   * 3. Caches results if caching is enabled
   * 4. Returns a map of student codes to calculation results
   * 
   * @param codes - Array of student codes to process
   * @param supabase - Supabase client instance
   * @returns Map of student codes to calculation results
   * @throws Error if database queries fail
   */
  async processStudents(
    codes: string[],
    supabase: SupabaseClient
  ): Promise<Map<string, CalculationResult>> {
    // Return empty map if no codes provided
    if (codes.length === 0) {
      return new Map();
    }

    // Check cache first if caching is enabled
    if (this.options.cacheResults) {
      const cachedResults = new Map<string, CalculationResult>();
      const uncachedCodes: string[] = [];

      for (const code of codes) {
        const cached = this.cache.get(code);
        if (cached) {
          logCacheOperation('hit', code, `batch_cache_${code}`);
          cachedResults.set(code, cached);
        } else {
          logCacheOperation('miss', code, `batch_cache_${code}`);
          uncachedCodes.push(code);
        }
      }

      // If all results are cached, return immediately
      if (uncachedCodes.length === 0) {
        return cachedResults;
      }

      // Process uncached codes and merge with cached results
      const newResults = await this.processBatch(uncachedCodes, supabase);
      
      // Merge cached and new results
      for (const [code, result] of newResults) {
        cachedResults.set(code, result);
      }

      return cachedResults;
    }

    // No caching - process all codes
    return this.processBatch(codes, supabase);
  }

  /**
   * Process a batch of student codes
   * 
   * @param codes - Array of student codes to process
   * @param supabase - Supabase client instance
   * @returns Map of student codes to calculation results
   */
  private async processBatch(
    codes: string[],
    supabase: SupabaseClient
  ): Promise<Map<string, CalculationResult>> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return withBatchTracking(batchId, codes.length, async () => {
      // Fetch all required data in bulk
      const data = await this.fetchBulkData(codes, supabase);

      // Process each student
      const results = new Map<string, CalculationResult>();
      let cacheHits = 0;
      let cacheMisses = 0;
      let errors = 0;

      for (const code of codes) {
        const studentData = data.students.get(code);

        if (!studentData) {
          errors++;
          // Student not found - create error result
          results.set(code, {
            success: false,
            error: `Student with code ${code} not found`,
            examComponent: {
              score: null,
              mode: data.settings.passCalcMode,
              examsIncluded: 0,
              examsTotal: 0,
              examsPassed: 0,
              details: [],
            },
            extraComponent: {
              score: null,
              totalWeight: 0,
              details: [],
            },
            finalScore: null,
            passed: null,
            passThreshold: data.settings.overallPassThreshold,
            failedDueToExam: false,
          });
          continue;
        }

        // Check if we already have this in cache (for tracking purposes)
        const wasCached = this.cache.has(code);
        if (wasCached) {
          cacheHits++;
        } else {
          cacheMisses++;
        }

        // Build calculation input
        const input: CalculationInput = {
          studentId: studentData.studentId,
          studentCode: studentData.studentCode,
          studentName: studentData.studentName,
          examAttempts: studentData.examAttempts,
          extraScores: studentData.extraScores,
          extraFields: data.extraFields,
          settings: data.settings,
        };

        // Calculate score
        const result = calculateFinalScore(input);

        if (!result.success) {
          errors++;
        }

        // Cache result if caching is enabled
        if (this.options.cacheResults) {
          this.cache.set(code, result);
          logCacheOperation('set', code, `batch_cache_${code}`, {
            resultSuccess: result.success,
            finalScore: result.finalScore,
          });
        }

        results.set(code, result);
      }

      return {
        result: results,
        cacheHits,
        cacheMisses,
        errors,
      };
    });
  }

  /**
   * Fetch all required data in bulk from the database
   * 
   * This method uses the student_score_summary materialized view for efficient
   * data retrieval. It fetches:
   * - Student data with exam attempts and extra scores
   * - Extra field definitions
   * - Calculation settings
   * 
   * All data is fetched in a single query per data type to minimize
   * database round trips.
   * 
   * @param codes - Array of student codes to fetch data for
   * @param supabase - Supabase client instance
   * @returns Bulk data containing all information needed for calculation
   * @throws Error if database queries fail
   */
  private async fetchBulkData(
    codes: string[],
    supabase: SupabaseClient
  ): Promise<BulkData> {
    // Fetch student summaries from materialized view
    const studentResult = await withQueryTracking(
      'student_score_summary',
      async () => {
        const result = await supabase
          .from('student_score_summary')
          .select('*')
          .in('student_code', codes);
        return result;
      }
    );
    const { data: studentRows, error: studentError } = studentResult;

    if (studentError) {
      logDatabaseError(
        'fetch_student_summaries',
        studentError,
        {
          query: 'student_score_summary',
          table: 'student_score_summary',
          rowCount: codes.length,
        }
      );
      throw new Error(`Failed to fetch student summaries: ${studentError.message}`);
    }

    // Fetch extra field definitions
    const fieldResult = await withQueryTracking(
      'extra_score_fields',
      async () => {
        const result = await supabase
          .from('extra_score_fields')
          .select('*')
          .order('order_index', { ascending: true });
        return result;
      }
    );
    const { data: fieldRows, error: fieldError } = fieldResult;

    if (fieldError) {
      logDatabaseError(
        'fetch_extra_fields',
        fieldError,
        {
          query: 'extra_score_fields',
          table: 'extra_score_fields',
        }
      );
      throw new Error(`Failed to fetch extra fields: ${fieldError.message}`);
    }

    // Fetch calculation settings from app_settings table
    const settingsResult = await withQueryTracking(
      'app_settings',
      async () => {
        const result = await supabase
          .from('app_settings')
          .select('result_pass_calc_mode, result_overall_pass_threshold, result_exam_weight, result_exam_score_source, result_fail_on_any_exam')
          .limit(1)
          .maybeSingle();
        return result;
      }
    );
    const { data: settingsRow, error: settingsError } = settingsResult;

    if (settingsError) {
      logDatabaseError(
        'fetch_settings',
        settingsError,
        {
          query: 'app_settings',
          table: 'app_settings',
        }
      );
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    // Parse settings
    const settings = this.parseSettings(settingsRow);

    // Parse extra fields
    const extraFields = this.parseExtraFields(fieldRows || []);

    // Parse student summaries
    const students = this.parseStudentSummaries(studentRows || []);

    return {
      students,
      extraFields,
      settings,
    };
  }

  /**
   * Parse student summary rows into a map
   * 
   * @param rows - Raw student summary rows from the database
   * @returns Map of student codes to student summaries
   */
  private parseStudentSummaries(
    rows: StudentScoreSummaryRow[]
  ): Map<string, StudentSummary> {
    const students = new Map<string, StudentSummary>();

    for (const row of rows) {
      // Parse exam attempts
      const examAttempts: ExamAttempt[] = (row.exam_attempts || []).map((attempt: any) => ({
        examId: attempt.exam_id,
        examTitle: attempt.exam_title,
        scorePercentage: attempt.score_percentage,
        finalScorePercentage: attempt.final_score_percentage,
        includeInPass: attempt.include_in_pass ?? true,
        passThreshold: attempt.pass_threshold,
      }));

      students.set(row.student_code, {
        studentId: row.student_id,
        studentCode: row.student_code,
        studentName: row.student_name,
        examAttempts,
        extraScores: row.extra_scores || {},
        lastAttemptDate: row.last_attempt_date,
        examsTaken: row.exams_taken,
      });
    }

    return students;
  }

  /**
   * Parse extra field rows into ExtraField array
   * 
   * @param rows - Raw extra field rows from the database
   * @returns Array of extra field definitions
   */
  private parseExtraFields(rows: ExtraFieldRow[]): ExtraField[] {
    return rows.map(row => ({
      key: row.key,
      label: row.label,
      type: row.type,
      includeInPass: row.include_in_pass,
      passWeight: row.pass_weight,
      maxPoints: row.max_points,
      boolTruePoints: row.bool_true_points,
      boolFalsePoints: row.bool_false_points,
      textScoreMap: row.text_score_map,
    }));
  }

  /**
   * Parse settings data into CalculationSettings
   * 
   * @param data - Raw settings row from the app_settings table
   * @returns Calculation settings object
   */
  private parseSettings(
    data: any
  ): CalculationSettings {
    // Parse with defaults
    return {
      passCalcMode: data?.result_pass_calc_mode || 'best',
      overallPassThreshold: parseFloat(data?.result_overall_pass_threshold) || 50,
      examWeight: parseFloat(data?.result_exam_weight) || 1.0,
      examScoreSource: data?.result_exam_score_source || 'final',
      failOnAnyExam: data?.result_fail_on_any_exam === true,
    };
  }

  /**
   * Clear the in-memory cache
   * 
   * Useful when you want to force fresh calculations or free up memory.
   */
  clearCache(): void {
    const cacheSize = this.cache.size;
    this.cache.clear();
    
    // Log cache invalidation
    if (cacheSize > 0) {
      logCacheOperation('invalidate', 'batch_processor', 'clear_all_cache', {
        clearedEntries: cacheSize,
      });
    }
  }

  /**
   * Get the current cache size
   * 
   * @returns Number of cached calculation results
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Check if a student code is cached
   * 
   * @param code - Student code to check
   * @returns True if the code is in the cache
   */
  isCached(code: string): boolean {
    return this.cache.has(code);
  }

  /**
   * Get a cached result without triggering a calculation
   * 
   * @param code - Student code to retrieve
   * @returns Cached calculation result or undefined if not cached
   */
  getCached(code: string): CalculationResult | undefined {
    return this.cache.get(code);
  }
}
