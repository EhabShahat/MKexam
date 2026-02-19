/**
 * Cached Query Module
 * 
 * Provides cached versions of frequently accessed database queries
 * to reduce Supabase egress and improve performance.
 */

import { caches as cachesInternal, CacheKeys, getOrSet } from './cache';
import { supabaseServer } from './supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Re-export caches for external use
export { caches } from './cache';
export { CacheKeys } from './cache';

/**
 * Exam metadata interface
 */
export interface ExamMetadata {
  id: string;
  title: string;
  description: string | null;
  access_type: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  status: string;
  is_archived: boolean;
}

/**
 * Get exam metadata with caching (5 minute TTL)
 * Requirements: 1.7, 6.1
 */
export async function getCachedExamMetadata(
  examId: string,
  supabase?: SupabaseClient
): Promise<ExamMetadata | null> {
  const key = CacheKeys.examMetadata(examId);
  
  return getOrSet(
    cachesInternal.exam,
    key,
    async () => {
      const client = supabase || supabaseServer();
      const { data, error } = await client
        .from('exams')
        .select('id, title, description, access_type, start_time, end_time, duration_minutes, status, is_archived')
        .eq('id', examId)
        .single();

      if (error || !data) {
        return null;
      }

      return data as ExamMetadata;
    },
    300000 // 5 minutes
  );
}

/**
 * Invalidate exam metadata cache
 */
export function invalidateExamMetadata(examId: string): void {
  const key = CacheKeys.examMetadata(examId);
  cachesInternal.exam.delete(key);
}

/**
 * Question interface
 */
export interface Question {
  id: string;
  exam_id: string;
  question_text: string;
  question_type: string;
  options: any;
  correct_answers: any;
  points: number;
  required: boolean;
  order_index: number;
  question_image_url: string | null;
  option_image_urls: any;
}

/**
 * Get exam questions with caching (infinite TTL for published exams)
 * Requirements: 6.2
 */
export async function getCachedExamQuestions(
  examId: string,
  includeCorrectAnswers: boolean = true,
  supabase?: SupabaseClient
): Promise<Question[]> {
  const key = CacheKeys.examQuestions(examId);
  
  return getOrSet(
    cachesInternal.questions,
    key,
    async () => {
      const client = supabase || supabaseServer();
      const { data, error } = await client
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_index', { ascending: true });

      if (error || !data) {
        return [];
      }

      return data as Question[];
    },
    -1 // Infinite TTL for published exams
  );
}

/**
 * Invalidate exam questions cache
 */
export function invalidateExamQuestions(examId: string): void {
  const key = CacheKeys.examQuestions(examId);
  cachesInternal.questions.delete(key);
}

/**
 * Student code validation result
 */
export interface StudentCodeValidation {
  isValid: boolean;
  studentId?: string;
  studentName?: string;
  mobileNumber?: string;
}

/**
 * Validate student code with caching (10 minute TTL)
 * Uses hashed cache key for security
 * Requirements: 6.3
 */
export async function getCachedStudentCodeValidation(
  code: string,
  supabase?: SupabaseClient
): Promise<StudentCodeValidation> {
  // Use hashed key for privacy
  const key = CacheKeys.studentCode(code);
  
  return getOrSet(
    cachesInternal.student,
    key,
    async () => {
      const client = supabase || supabaseServer();
      const { data, error } = await client
        .from('students')
        .select('id, student_name, mobile_number')
        .eq('code', code)
        .single();

      if (error || !data) {
        return { isValid: false };
      }

      return {
        isValid: true,
        studentId: data.id,
        studentName: data.student_name || undefined,
        mobileNumber: data.mobile_number || undefined,
      };
    },
    600000 // 10 minutes
  );
}

/**
 * Invalidate student code cache
 */
export function invalidateStudentCode(code: string): void {
  const key = CacheKeys.studentCode(code);
  cachesInternal.student.delete(key);
}

/**
 * IP rule interface
 */
export interface IPRule {
  id: string;
  exam_id: string;
  ip_address: string;
  rule_type: 'whitelist' | 'blacklist';
  created_at: string;
}

/**
 * Get exam IP rules with caching (15 minute TTL)
 * Requirements: 6.4
 */
export async function getCachedExamIPRules(
  examId: string,
  supabase?: SupabaseClient
): Promise<IPRule[]> {
  const key = CacheKeys.ipRules(examId);
  
  return getOrSet(
    cachesInternal.general,
    key,
    async () => {
      const client = supabase || supabaseServer();
      const { data, error } = await client
        .from('exam_ips')
        .select('*')
        .eq('exam_id', examId);

      if (error || !data) {
        return [];
      }

      return data as IPRule[];
    },
    900000 // 15 minutes
  );
}

/**
 * Invalidate exam IP rules cache
 */
export function invalidateExamIPRules(examId: string): void {
  const key = CacheKeys.ipRules(examId);
  cachesInternal.general.delete(key);
}

/**
 * App config value interface
 */
export interface AppConfigValue {
  key: string;
  value: string;
  updated_at?: string;
}

/**
 * Get app config value with caching (30 minute TTL)
 * Requirements: 6.5
 */
export async function getCachedAppConfig(
  configKey: string,
  supabase?: SupabaseClient
): Promise<string | null> {
  const key = CacheKeys.appConfig(configKey);
  
  return getOrSet(
    cachesInternal.config,
    key,
    async () => {
      const client = supabase || supabaseServer();
      const { data, error } = await client
        .from('app_config')
        .select('value')
        .eq('key', configKey)
        .single();

      if (error || !data) {
        return null;
      }

      return data.value;
    },
    1800000 // 30 minutes
  );
}

/**
 * Get multiple app config values with caching
 * Requirements: 6.5
 */
export async function getCachedAppConfigs(
  configKeys: string[],
  supabase?: SupabaseClient
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  
  // Fetch each config value (will use cache if available)
  await Promise.all(
    configKeys.map(async (key) => {
      const value = await getCachedAppConfig(key, supabase);
      if (value !== null) {
        results[key] = value;
      }
    })
  );
  
  return results;
}

/**
 * Invalidate app config cache
 */
export function invalidateAppConfig(configKey: string): void {
  const key = CacheKeys.appConfig(configKey);
  cachesInternal.config.delete(key);
}

/**
 * Clear all app config cache
 * Requirements: 6.7
 */
export function clearAllAppConfigCache(): number {
  return cachesInternal.config.clear('config:.*');
}
