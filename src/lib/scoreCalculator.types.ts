/**
 * Type definitions for the Score Calculator module
 * 
 * This file contains all TypeScript interfaces and types used throughout
 * the score calculation system to ensure type safety and consistency.
 */

/**
 * Configuration settings for score calculation
 */
export interface CalculationSettings {
  /** Calculation mode: 'best' uses highest score, 'avg' uses average */
  passCalcMode: 'best' | 'avg';
  /** Overall pass threshold percentage (0-100) */
  overallPassThreshold: number;
  /** Weight of exam component in final score */
  examWeight: number;
  /** Which score field to use from exam results */
  examScoreSource: 'final' | 'raw';
  /** If true, failing any individual exam fails the student overall */
  failOnAnyExam: boolean;
}

/**
 * Definition of an extra score field (attendance, homework, quiz, etc.)
 */
export interface ExtraField {
  /** Unique identifier for the field */
  key: string;
  /** Display label for the field */
  label: string;
  /** Data type of the field */
  type: 'number' | 'text' | 'boolean';
  /** Whether this field is included in pass calculation */
  includeInPass: boolean;
  /** Weight of this field in the extra component */
  passWeight: number;
  /** Maximum possible points for normalization (null = no normalization) */
  maxPoints: number | null;
  /** Points awarded for boolean true value */
  boolTruePoints?: number;
  /** Points awarded for boolean false value */
  boolFalsePoints?: number;
  /** Mapping of text values to numeric scores */
  textScoreMap?: Record<string, number>;
}

/**
 * A single exam attempt with score information
 */
export interface ExamAttempt {
  /** Unique exam identifier */
  examId: string;
  /** Display title of the exam */
  examTitle: string;
  /** Raw score percentage (0-100) */
  scorePercentage: number | null;
  /** Final score percentage after adjustments (0-100) */
  finalScorePercentage: number | null;
  /** Whether this exam is included in pass calculation */
  includeInPass: boolean;
  /** Individual pass threshold for this exam (null = no individual threshold) */
  passThreshold: number | null;
}

/**
 * Extra score data for a student (key-value pairs)
 */
export interface ExtraScoreData {
  [key: string]: any;
}

/**
 * Complete input data for score calculation
 */
export interface CalculationInput {
  /** Student unique identifier */
  studentId: string;
  /** Student code (display identifier) */
  studentCode: string;
  /** Student full name */
  studentName: string;
  /** Array of exam attempts for this student */
  examAttempts: ExamAttempt[];
  /** Extra score data (attendance, homework, etc.) */
  extraScores: ExtraScoreData;
  /** Definitions of extra score fields */
  extraFields: ExtraField[];
  /** Calculation settings and configuration */
  settings: CalculationSettings;
}

/**
 * Detailed information about a single exam in the calculation
 */
export interface ExamComponentDetail {
  /** Exam unique identifier */
  examId: string;
  /** Exam display title */
  examTitle: string;
  /** Score percentage for this exam (0-100) */
  score: number;
  /** Whether this exam was included in the calculation */
  included: boolean;
  /** Whether the student passed this exam (null if no threshold) */
  passed: boolean | null;
  /** Pass threshold for this exam (null if no threshold) */
  passThreshold: number | null;
}

/**
 * Exam component of the final score
 */
export interface ExamComponent {
  /** Calculated exam component score (0-100) or null if no exams */
  score: number | null;
  /** Calculation mode used ('best' or 'avg') */
  mode: 'best' | 'avg';
  /** Number of exams included in calculation */
  examsIncluded: number;
  /** Total number of exams available */
  examsTotal: number;
  /** Number of exams passed (with individual thresholds) */
  examsPassed: number;
  /** Detailed breakdown of each exam */
  details: ExamComponentDetail[];
}

/**
 * Detailed information about a single extra field in the calculation
 */
export interface ExtraComponentDetail {
  /** Field unique key */
  fieldKey: string;
  /** Field display label */
  fieldLabel: string;
  /** Raw value from extra scores data */
  rawValue: any;
  /** Normalized score (0-100) */
  normalizedScore: number;
  /** Weight of this field */
  weight: number;
  /** Contribution to final score (normalizedScore * weight) */
  weightedContribution: number;
}

/**
 * Extra component of the final score
 */
export interface ExtraComponent {
  /** Calculated extra component score (0-100) or null if no fields */
  score: number | null;
  /** Sum of all field weights */
  totalWeight: number;
  /** Detailed breakdown of each extra field */
  details: ExtraComponentDetail[];
}

/**
 * Complete calculation result with all components and metadata
 */
export interface CalculationResult {
  /** Whether the calculation succeeded */
  success: boolean;
  /** Error message if calculation failed */
  error?: string;
  
  /** Exam component breakdown */
  examComponent: ExamComponent;
  
  /** Extra component breakdown */
  extraComponent: ExtraComponent;
  
  /** Final combined score (0-100) or null if calculation failed */
  finalScore: number | null;
  /** Whether the student passed overall (null if cannot determine) */
  passed: boolean | null;
  /** Overall pass threshold used */
  passThreshold: number;
  /** Whether student failed due to failing an individual exam */
  failedDueToExam: boolean;
}

/**
 * Error result structure for failed calculations
 */
export interface CalculationError {
  /** Always false for error results */
  success: false;
  /** Error message describing what went wrong */
  error: string;
  /** Error code for programmatic handling */
  errorCode: 
    | 'INVALID_INPUT'
    | 'MISSING_REQUIRED_FIELD'
    | 'CALCULATION_ERROR'
    | 'DATA_NOT_FOUND'
    | 'DATABASE_ERROR';
  /** Additional error details */
  details?: Record<string, any>;
  /** Timestamp of the error */
  timestamp: string;
}

/**
 * Validation result for input data
 */
export interface ValidationResult {
  /** Whether the input is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Array of specific validation errors */
  errors?: string[];
}

/**
 * Legacy API response format for backward compatibility
 */
export interface LegacyApiResponse {
  /** Student code */
  code: string;
  /** Student name */
  student_name: string | null;
  /** Modern calculation result */
  calculation: CalculationResult;
  /** Legacy extras format */
  extras: Array<{
    key: string;
    label?: string;
    value: any;
    max_points?: number | null;
    type?: string;
  }>;
  /** Legacy pass summary format */
  pass_summary: {
    overall_score: number | null;
    passed: boolean | null;
    threshold?: number;
    message?: string | null;
    hidden?: boolean;
    exam_passed?: number;
    exam_total?: number;
  };
}

/**
 * Legacy data format for input conversion
 */
export interface LegacyDataFormat {
  // Student information (multiple possible field names)
  studentId?: string;
  student_id?: string;
  studentCode?: string;
  student_code?: string;
  code?: string;
  studentName?: string;
  student_name?: string;
  name?: string;
  
  // Exam attempts (multiple possible field names and formats)
  examAttempts?: any[];
  exams?: any[];
  
  // Extra scores (multiple possible field names)
  extraScores?: Record<string, any>;
  extra_scores?: Record<string, any>;
  
  // Extra fields (multiple possible field names)
  extraFields?: any[];
  fields?: any[];
  
  // Settings (multiple possible formats)
  settings?: any;
  passCalcMode?: string;
  pass_calc_mode?: string;
  passThreshold?: number;
  examWeight?: number;
  exam_weight?: number;
}
