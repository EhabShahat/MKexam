/**
 * Integration Tests for Stage Progress API
 * Feature: staged-exam-system
 * Task: 4.3 Write integration tests for stage progress API
 * 
 * Tests the update_stage_progress RPC function and get_attempt_state integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for testing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for testing');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test data
let testExamId: string;
let testAttemptId: string;
let testStageId: string;

beforeAll(async () => {
  // Create test exam
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .insert({
      title: `Stage Progress API Test ${Date.now()}`,
      description: 'Integration test exam',
      status: 'published',
      access_type: 'open',
      settings: {}
    })
    .select()
    .single();

  if (examError || !exam) {
    throw new Error(`Failed to create test exam: ${examError?.message}`);
  }

  testExamId = exam.id;

  // Create test stage
  const { data: stage, error: stageError } = await supabase
    .from('exam_stages')
    .insert({
      exam_id: testExamId,
      stage_type: 'video',
      stage_order: 0,
      configuration: {
        youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        enforcement_threshold: 80
      }
    })
    .select()
    .single();

  if (stageError || !stage) {
    throw new Error(`Failed to create test stage: ${stageError?.message}`);
  }

  testStageId = stage.id;

  // Create test attempt
  const { data: attempt, error: attemptError } = await supabase.rpc('start_attempt', {
    p_exam_id: testExamId,
    p_code: 'TEST001',
    p_student_name: 'Test Student',
    p_ip: '127.0.0.1'
  });

  if (attemptError || !attempt) {
    throw new Error(`Failed to create test attempt: ${attemptError?.message}`);
  }

  testAttemptId = attempt[0].attempt_id;
});

afterAll(async () => {
  // Cleanup test data
  if (testAttemptId) {
    await supabase.from('attempt_stage_progress').delete().eq('attempt_id', testAttemptId);
    await supabase.from('exam_attempts').delete().eq('id', testAttemptId);
  }
  if (testExamId) {
    await supabase.from('exam_stages').delete().eq('exam_id', testExamId);
    await supabase.from('exams').delete().eq('id', testExamId);
  }
});

describe('Stage Progress API Integration Tests', () => {
  /**
   * Test: Successful progress update
   * Validates: Requirements 3.8.2, 3.8.5
   */
  it('should successfully update stage progress', async () => {
    const progressData = {
      watch_percentage: 45.5,
      total_watch_time: 120,
      last_position: 150,
      watched_segments: [[0, 60], [90, 150]]
    };

    const { data, error } = await supabase.rpc('update_stage_progress', {
      p_attempt_id: testAttemptId,
      p_stage_id: testStageId,
      p_progress_data: progressData,
      p_completed: false
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();

    // Verify response structure
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('attempt_id', testAttemptId);
    expect(data).toHaveProperty('stage_id', testStageId);
    expect(data).toHaveProperty('started_at');
    expect(data).toHaveProperty('completed_at');
    expect(data).toHaveProperty('progress_data');
    expect(data).toHaveProperty('created_at');
    expect(data).toHaveProperty('updated_at');

    // Verify progress data
    expect(data.progress_data).toEqual(progressData);
    expect(data.started_at).not.toBeNull();
    expect(data.completed_at).toBeNull(); // Not completed yet
  });

  /**
   * Test: Update progress with completion
   * Validates: Requirements 3.8.2, 3.5.2
   */
  it('should mark stage as completed when completed flag is true', async () => {
    const progressData = {
      watch_percentage: 100,
      total_watch_time: 300,
      last_position: 300,
      watched_segments: [[0, 300]]
    };

    const { data, error } = await supabase.rpc('update_stage_progress', {
      p_attempt_id: testAttemptId,
      p_stage_id: testStageId,
      p_progress_data: progressData,
      p_completed: true
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();

    // Verify completion
    expect(data.completed_at).not.toBeNull();
    expect(data.progress_data.watch_percentage).toBe(100);
  });

  /**
   * Test: Invalid attempt_id rejection
   * Validates: Requirements 3.8.5
   */
  it('should reject invalid attempt_id', async () => {
    const invalidAttemptId = '00000000-0000-0000-0000-000000000000';
    const progressData = {
      watch_percentage: 50,
      total_watch_time: 100,
      last_position: 100,
      watched_segments: [[0, 100]]
    };

    const { data, error } = await supabase.rpc('update_stage_progress', {
      p_attempt_id: invalidAttemptId,
      p_stage_id: testStageId,
      p_progress_data: progressData,
      p_completed: false
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain('invalid_attempt_id');
  });

  /**
   * Test: Invalid stage_id rejection
   * Validates: Requirements 3.8.5
   */
  it('should reject invalid stage_id', async () => {
    const invalidStageId = '00000000-0000-0000-0000-000000000000';
    const progressData = {
      watch_percentage: 50,
      total_watch_time: 100,
      last_position: 100,
      watched_segments: [[0, 100]]
    };

    const { data, error } = await supabase.rpc('update_stage_progress', {
      p_attempt_id: testAttemptId,
      p_stage_id: invalidStageId,
      p_progress_data: progressData,
      p_completed: false
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain('invalid_stage_id');
  });

  /**
   * Test: Progress persistence and retrieval
   * Validates: Requirements 3.5.7, 3.5.8
   */
  it('should persist progress and retrieve it via get_attempt_state', async () => {
    const progressData = {
      watch_percentage: 75,
      total_watch_time: 200,
      last_position: 225,
      watched_segments: [[0, 100], [150, 225]]
    };

    // Update progress
    const { data: updateData, error: updateError } = await supabase.rpc('update_stage_progress', {
      p_attempt_id: testAttemptId,
      p_stage_id: testStageId,
      p_progress_data: progressData,
      p_completed: false
    });

    expect(updateError).toBeNull();
    expect(updateData).toBeDefined();

    // Retrieve via get_attempt_state
    const { data: stateData, error: stateError } = await supabase.rpc('get_attempt_state', {
      p_attempt_id: testAttemptId
    });

    expect(stateError).toBeNull();
    expect(stateData).toBeDefined();

    // Verify stages and stage_progress are included
    expect(stateData).toHaveProperty('stages');
    expect(stateData).toHaveProperty('stage_progress');
    expect(Array.isArray(stateData.stages)).toBe(true);
    expect(Array.isArray(stateData.stage_progress)).toBe(true);

    // Find our stage progress
    const ourProgress = stateData.stage_progress.find(
      (p: any) => p.stage_id === testStageId
    );

    expect(ourProgress).toBeDefined();
    expect(ourProgress.progress_data).toEqual(progressData);
  });
});
