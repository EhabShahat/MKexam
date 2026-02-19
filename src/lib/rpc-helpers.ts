/**
 * RPC Helper Functions
 * 
 * Provides type-safe wrappers for calling optimized RPC functions
 * with field selection and compression support.
 * 
 * Requirements: 1.2, 1.3, 10.1
 */

import { createClient } from '@/lib/supabase/client';
import { fieldSelectionToJSONB, type FieldSelection } from './field-selection';

/**
 * Attempt state response structure
 */
export interface AttemptState {
  attemptId: string;
  version: number;
  started_at: string;
  completion_status: string;
  submitted_at?: string;
  exam?: {
    id: string;
    title: string;
    description?: string;
    start_time?: string;
    end_time?: string;
    duration_minutes?: number;
    settings?: any;
    access_type: string;
  };
  answers?: Record<string, any>;
  auto_save_data?: any;
  questions?: Array<{
    id: string;
    question_text: string;
    question_type: string;
    options?: any;
    points?: number;
    required: boolean;
    order_index: number;
    question_image_url?: string;
    option_image_urls?: any;
  }>;
  stages?: any[];
  stage_progress?: any[];
}

/**
 * Admin attempt list item structure
 */
export interface AdminAttemptListItem {
  id: string;
  exam_id: string;
  started_at: string;
  submitted_at?: string;
  completion_status: string;
  ip_address?: string;
  device_info?: any;
  student_name?: string;
  code?: string;
  score_percentage?: number;
  final_score_percentage?: number;
  manual_total_count: number;
  manual_graded_count: number;
  manual_pending_count: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Get attempt state with optional field selection
 * 
 * @param attemptId - Attempt UUID
 * @param fields - Optional field selection
 * @returns Attempt state data
 */
export async function getAttemptStateV2(
  attemptId: string,
  fields?: FieldSelection
): Promise<AttemptState> {
  const supabase = createClient();
  
  const fieldsParam = fieldSelectionToJSONB(fields);
  
  const { data, error } = await supabase.rpc('get_attempt_state_v2', {
    p_attempt_id: attemptId,
    p_fields: fieldsParam,
  });

  if (error) {
    throw new Error(`Failed to get attempt state: ${error.message}`);
  }

  return data as AttemptState;
}

/**
 * Get attempt state using legacy function (backward compatibility)
 * 
 * @param attemptId - Attempt UUID
 * @returns Attempt state data
 */
export async function getAttemptState(attemptId: string): Promise<AttemptState> {
  const supabase = createClient();
  
  const { data, error } = await supabase.rpc('get_attempt_state', {
    p_attempt_id: attemptId,
  });

  if (error) {
    throw new Error(`Failed to get attempt state: ${error.message}`);
  }

  return data as AttemptState;
}

/**
 * List admin attempts with pagination and field selection
 * 
 * @param examId - Exam UUID
 * @param pagination - Pagination options
 * @param fields - Optional field selection
 * @returns Array of attempt list items
 */
export async function adminListAttemptsV2(
  examId: string,
  pagination?: PaginationOptions,
  fields?: FieldSelection
): Promise<AdminAttemptListItem[]> {
  const supabase = createClient();
  
  const fieldsParam = fieldSelectionToJSONB(fields);
  
  const { data, error } = await supabase.rpc('admin_list_attempts_v2', {
    p_exam_id: examId,
    p_limit: pagination?.limit || 50,
    p_offset: pagination?.offset || 0,
    p_fields: fieldsParam,
  });

  if (error) {
    throw new Error(`Failed to list attempts: ${error.message}`);
  }

  return data as AdminAttemptListItem[];
}

/**
 * List admin attempts using legacy function (backward compatibility)
 * 
 * @param examId - Exam UUID
 * @returns Array of attempt list items
 */
export async function adminListAttempts(examId: string): Promise<AdminAttemptListItem[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase.rpc('admin_list_attempts', {
    p_exam_id: examId,
  });

  if (error) {
    throw new Error(`Failed to list attempts: ${error.message}`);
  }

  return data as AdminAttemptListItem[];
}

/**
 * Get total count of attempts for an exam (for pagination)
 * 
 * @param examId - Exam UUID
 * @returns Total count of attempts
 */
export async function getAttemptCount(examId: string): Promise<number> {
  const supabase = createClient();
  
  const { count, error } = await supabase
    .from('exam_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('exam_id', examId);

  if (error) {
    throw new Error(`Failed to get attempt count: ${error.message}`);
  }

  return count || 0;
}
