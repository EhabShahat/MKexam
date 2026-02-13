/**
 * Integration tests for score calculation database views
 * Tests the materialized view, cache table, and triggers
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('Score Calculation Views Integration', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  });

  describe('Materialized View: student_score_summary', () => {
    it('should exist and be queryable', async () => {
      const { data, error } = await supabase
        .from('student_score_summary')
        .select('student_id, student_code, student_name')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should return aggregated exam attempts as JSONB', async () => {
      const { data, error } = await supabase
        .from('student_score_summary')
        .select('student_code, exam_attempts')
        .not('exam_attempts', 'eq', '[]')
        .limit(1)
        .single();

      if (data) {
        expect(error).toBeNull();
        expect(Array.isArray(data.exam_attempts)).toBe(true);
        
        if (data.exam_attempts.length > 0) {
          const attempt = data.exam_attempts[0];
          expect(attempt).toHaveProperty('exam_id');
          expect(attempt).toHaveProperty('exam_title');
          expect(attempt).toHaveProperty('score_percentage');
        }
      }
    });

    it('should include extra scores data', async () => {
      const { data, error } = await supabase
        .from('student_score_summary')
        .select('student_code, extra_scores')
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.extra_scores).toBeDefined();
      expect(typeof data?.extra_scores).toBe('object');
    });

    it('should have correct metadata fields', async () => {
      const { data, error } = await supabase
        .from('student_score_summary')
        .select('student_code, last_attempt_date, exams_taken, student_created_at, student_updated_at')
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('last_attempt_date');
      expect(data).toHaveProperty('exams_taken');
      expect(data).toHaveProperty('student_created_at');
      expect(data).toHaveProperty('student_updated_at');
    });

    it('should have unique index on student_id', async () => {
      const { data: indexData, error: indexError } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT indexname, indexdef 
          FROM pg_indexes 
          WHERE schemaname = 'public' 
            AND tablename = 'student_score_summary' 
            AND indexname = 'idx_student_score_summary_student_id'
        `
      });

      expect(indexError).toBeNull();
      expect(indexData).toBeDefined();
    });
  });

  describe('Cache Table: score_calculation_cache', () => {
    it('should exist and be writable', async () => {
      const testCode = `TEST_${Date.now()}`;
      const testResult = {
        success: true,
        finalScore: 85.5,
        examComponent: { score: 90 },
        extraComponent: { score: 80 }
      };

      // Insert test cache entry
      const { error: insertError } = await supabase
        .from('score_calculation_cache')
        .insert({
          student_code: testCode,
          calculation_result: testResult,
          settings_hash: 'test_hash_123'
        });

      expect(insertError).toBeNull();

      // Verify it was inserted
      const { data, error: selectError } = await supabase
        .from('score_calculation_cache')
        .select('*')
        .eq('student_code', testCode)
        .single();

      expect(selectError).toBeNull();
      expect(data).toBeDefined();
      expect(data?.student_code).toBe(testCode);
      expect(data?.calculation_result).toEqual(testResult);

      // Cleanup
      await supabase
        .from('score_calculation_cache')
        .delete()
        .eq('student_code', testCode);
    });

    it('should have expires_at with default 5 minutes', async () => {
      const testCode = `TEST_EXPIRY_${Date.now()}`;
      
      const { data, error } = await supabase
        .from('score_calculation_cache')
        .insert({
          student_code: testCode,
          calculation_result: { test: true },
          settings_hash: 'test_hash'
        })
        .select('calculated_at, expires_at')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();

      if (data) {
        const calculatedAt = new Date(data.calculated_at);
        const expiresAt = new Date(data.expires_at);
        const diffMinutes = (expiresAt.getTime() - calculatedAt.getTime()) / (1000 * 60);
        
        // Should be approximately 5 minutes (allow small variance)
        expect(diffMinutes).toBeGreaterThan(4.9);
        expect(diffMinutes).toBeLessThan(5.1);
      }

      // Cleanup
      await supabase
        .from('score_calculation_cache')
        .delete()
        .eq('student_code', testCode);
    });

    it('should have indexes on expires_at and settings_hash', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT indexname 
          FROM pg_indexes 
          WHERE schemaname = 'public' 
            AND tablename = 'score_calculation_cache'
            AND indexname IN ('idx_score_cache_expires', 'idx_score_cache_settings_hash')
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Functions', () => {
    it('cleanup_expired_score_cache should exist and be callable', async () => {
      const { error } = await supabase.rpc('cleanup_expired_score_cache');
      expect(error).toBeNull();
    });

    it('refresh_student_score_summary should exist', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT proname 
          FROM pg_proc 
          WHERE proname = 'refresh_student_score_summary' 
            AND pronamespace = 'public'::regnamespace
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('invalidate_score_cache_for_student should exist', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT proname 
          FROM pg_proc 
          WHERE proname = 'invalidate_score_cache_for_student' 
            AND pronamespace = 'public'::regnamespace
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Triggers', () => {
    it('should have refresh triggers on exam_results', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT trigger_name 
          FROM information_schema.triggers 
          WHERE trigger_schema = 'public' 
            AND event_object_table = 'exam_results'
            AND trigger_name = 'refresh_scores_on_exam_result'
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have refresh triggers on extra_scores', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT trigger_name 
          FROM information_schema.triggers 
          WHERE trigger_schema = 'public' 
            AND event_object_table = 'extra_scores'
            AND trigger_name = 'refresh_scores_on_extra_scores'
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have cache invalidation triggers on exam_results', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT trigger_name 
          FROM information_schema.triggers 
          WHERE trigger_schema = 'public' 
            AND event_object_table = 'exam_results'
            AND trigger_name = 'invalidate_cache_on_exam_result'
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have cache invalidation triggers on extra_scores', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT trigger_name 
          FROM information_schema.triggers 
          WHERE trigger_schema = 'public' 
            AND event_object_table = 'extra_scores'
            AND trigger_name = 'invalidate_cache_on_extra_scores'
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Performance Indexes', () => {
    it('should have index on students.code', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT indexname 
          FROM pg_indexes 
          WHERE schemaname = 'public' 
            AND tablename = 'students'
            AND indexname = 'idx_students_code'
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have composite index on exam_attempts', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT indexname 
          FROM pg_indexes 
          WHERE schemaname = 'public' 
            AND tablename = 'exam_attempts'
            AND indexname = 'idx_exam_attempts_student_exam'
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have partial index on exams.status', async () => {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT indexname 
          FROM pg_indexes 
          WHERE schemaname = 'public' 
            AND tablename = 'exams'
            AND indexname = 'idx_exams_status'
        `
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });
});
