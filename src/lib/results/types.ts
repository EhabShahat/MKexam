/**
 * Type definitions for Results Page Rebuild
 * 
 * This module contains all TypeScript interfaces and types used across
 * the results page components, hooks, and utilities.
 */

/**
 * Exam entity representing an assessment
 */
export interface Exam {
  /** Unique identifier */
  id: string;
  /** Exam title */
  title: string;
  /** Current status (published, completed, draft) */
  status: string;
  /** Access control type */
  access_type: string;
  /** Type of assessment */
  exam_type: 'exam' | 'homework' | 'quiz';
  /** Scheduling mode for status determination */
  scheduling_mode: 'Auto' | 'Manual';
  /** Manual publication flag (used when scheduling_mode is Manual) */
  is_manually_published: boolean;
  /** Whether exam is archived */
  is_archived: boolean;
  /** Scheduled start time */
  start_time: string | null;
  /** Scheduled end time */
  end_time: string | null;
  /** Whether to include in pass calculation */
  include_in_pass: boolean;
  /** Minimum score required to pass this exam */
  pass_threshold: number;
}

/**
 * Attempt entity representing a student's exam submission
 */
export interface Attempt {
  /** Unique attempt identifier */
  id: string;
  /** Associated exam ID */
  exam_id: string;
  /** Student identifier (nullable for anonymous attempts) */
  student_id: string | null;
  /** Student name */
  student_name: string | null;
  /** Student code */
  code: string | null;
  /** Completion status */
  completion_status: 'completed' | 'in_progress' | 'abandoned';
  /** When attempt was started */
  started_at: string | null;
  /** When attempt was submitted */
  submitted_at: string | null;
  /** Score percentage (before manual grading) */
  score_percentage: number | null;
  /** Final score percentage (after manual grading) */
  final_score_percentage: number | null;
  /** IP address used for attempt */
  ip_address: string | null;
  /** Device information JSON string */
  device_info: string | null;
  /** Total count of manually graded questions */
  manual_total_count: number;
  /** Count of manually graded questions */
  manual_graded_count: number;
  /** Count of pending manual grading questions */
  manual_pending_count: number;
}

/**
 * Student summary from materialized view
 * Aggregates best scores across all exams for a student
 */
export interface StudentSummary {
  /** Student identifier */
  student_id: string;
  /** Student name */
  student_name: string;
  /** Student code */
  code: string | null;
  /** Map of exam ID to best score percentage */
  scores: Record<string, number | null>;
  /** Map of exam ID to attempt count */
  attempt_counts: Record<string, number>;
  /** Extra score data from student record */
  extra_data?: Record<string, any>;
}

/**
 * Extra field definition for additional scoring
 */
export interface ExtraField {
  /** Unique field key */
  key: string;
  /** Display label */
  label: string;
  /** Field data type */
  type: 'number' | 'text' | 'boolean';
  /** Whether field is hidden from display */
  hidden: boolean;
  /** Whether to include in pass calculation */
  include_in_pass: boolean;
  /** Weight in pass calculation (0-1) */
  pass_weight: number | null;
  /** Maximum points for normalization */
  max_points: number | null;
  /** Points awarded for boolean true value */
  bool_true_points: number | null;
  /** Points awarded for boolean false value */
  bool_false_points: number | null;
  /** Map of text values to scores */
  text_score_map: Record<string, number> | null;
}

/**
 * Application settings for score calculation
 */
export interface AppSettings {
  /** Mode for calculating exam component (best or average) */
  result_pass_calc_mode: 'best' | 'avg';
  /** Overall pass threshold percentage */
  result_overall_pass_threshold: number;
  /** Weight of exam component in final score (0-1) */
  result_exam_weight: number;
  /** Whether to fail if any included exam is below threshold */
  result_fail_on_any_exam: boolean;
}

/**
 * Exam component calculation result
 */
export interface ExamComponentResult {
  /** Calculation mode used */
  mode: 'best' | 'avg';
  /** Calculated exam component score */
  score: number;
  /** Number of exams included in calculation */
  exams_included: number;
  /** Total number of exams */
  exams_total: number;
  /** Number of exams passed */
  exams_passed: number;
  /** Detailed breakdown per exam */
  details: Array<{
    exam_id: string;
    exam_title: string;
    score: number | null;
    passed: boolean;
    pass_threshold: number;
  }>;
}

/**
 * Extra component calculation result
 */
export interface ExtraComponentResult {
  /** Calculated extra component score */
  score: number;
  /** Total weight of all extra fields */
  total_weight: number;
  /** Detailed breakdown per field */
  details: Array<{
    field_key: string;
    field_label: string;
    raw_value: any;
    normalized_score: number;
    weight: number;
    weighted_contribution: number;
  }>;
}

/**
 * Complete score calculation result with pass/fail determination
 */
export interface CalculationResult {
  /** Exam component breakdown */
  exam_component: ExamComponentResult;
  /** Extra component breakdown */
  extra_component: ExtraComponentResult;
  /** Final calculated score */
  final_score: number;
  /** Whether student passed */
  passed: boolean;
  /** Whether student failed due to exam requirement */
  failed_due_to_exam: boolean;
  /** Pass threshold used for determination */
  pass_threshold: number;
}

/**
 * Parsed device information
 */
export interface DeviceInfo {
  /** Device type category */
  type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  /** Device model name */
  model: string;
  /** Local IP address */
  local_ip: string;
  /** Server IP address */
  server_ip: string;
  /** Whether automation/bot risk detected */
  automation_risk: boolean;
}

/**
 * Status filter values for exam selector
 */
export type StatusFilterValue = 'all' | 'published' | 'completed';

/**
 * View mode for results page
 */
export type ViewMode = 'individual' | 'all' | 'matrix';

/**
 * Sort order for tables
 */
export type SortOrder = 'none' | 'asc' | 'desc';

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'xlsx';
