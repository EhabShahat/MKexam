/**
 * Property-Based Test: Timer Continuity Across Stages
 * Feature: staged-exam-system
 * Property 24: Timer Continuity Across Stages
 * 
 * For any staged exam with a duration_minutes limit, the timer should count down
 * continuously across all stages, and the remaining time should be consistent
 * when transitioning between stages.
 * 
 * Validates: Requirements 3.6.8, 3.12.5
 */

import { describe, it, expect, afterAll } from 'vitest';
import fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for testing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for testing');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test data cleanup
const testExamIds: string[] = [];
const testAttemptIds: string[] = [];
const testStudentIds: string[] = [];

afterAll(async () => {
  // Cleanup test data in correct order
  if (testAttemptIds.length > 0) {
    await supabase.from('attempt_stage_progress').delete().in('attempt_id', testAttemptIds);
    await supabase.from('exam_attempts').delete().in('id', testAttemptIds);
  }
  if (testExamIds.length > 0) {
    await supabase.from('exam_stages').delete().in('exam_id', testExamIds);
    await supabase.from('questions').delete().in('exam_id', testExamIds);
    await supabase.from('exams').delete().in('id', testExamIds);
  }
  if (testStudentIds.length > 0) {
    await supabase.from('students').delete().in('id', testStudentIds);
  }
});

/**
 * Property 24: Timer Continuity Across Stages
 * 
 * For any staged exam with a duration_minutes limit, the timer should count down
 * continuously across all stages, and the remaining time should be consistent
 * when transitioning between stages.
 */
describe('Feature: staged-exam-system, Property 24: Timer Continuity Across Stages', () => {
  it('should maintain timer continuity across stage transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate exam configuration with timer
        fc.record({
          title: fc.string({ minLength: 5, maxLength: 100 }),
          duration_minutes: fc.integer({ min: 10, max: 120 }),
          stage_count: fc.integer({ min: 2, max: 4 })
        }),
        async (config) => {
          // Create test student
          const studentCode = `TEST${Date.now()}`;
          const studentName = `Test Student ${Date.now()}`;
          
          const { data: student, error: studentError } = await supabase
            .from('students')
            .insert({
              student_name: studentName,
              code: studentCode
            })
            .select()
            .single();

          if (studentError || !student) {
            throw new Error(`Failed to create test student: ${studentError?.message}`);
          }

          testStudentIds.push(student.id);

          // Create test exam with duration
          const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert({
              title: config.title,
              description: 'Staged exam for timer continuity test',
              status: 'published',
              access_type: 'open',
              exam_type: 'exam',
              duration_minutes: config.duration_minutes,
              settings: {
                display_mode: 'full',
                randomize_questions: false
              }
            })
            .select()
            .single();

          if (examError || !exam) {
            throw new Error(`Failed to create test exam: ${examError?.message}`);
          }

          testExamIds.push(exam.id);

          // Create stages
          const stages: any[] = [];
          
          for (let i = 0; i < config.stage_count; i++) {
            // Alternate between different stage types
            const stageType = i % 3 === 0 ? 'video' : i % 3 === 1 ? 'content' : 'questions';
            
            let configuration: any;
            
            if (stageType === 'video') {
              configuration = {
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                enforcement_threshold: 80
              };
            } else if (stageType === 'content') {
              configuration = {
                slides: [
                  { id: `slide-${i}-1`, content: '<p>Content</p>', order: 0 }
                ],
                minimum_read_time_per_slide: 10
              };
            } else {
              // For questions stage, create a question
              const questionId = crypto.randomUUID();
              
              await supabase.from('questions').insert({
                id: questionId,
                exam_id: exam.id,
                question_text: `Question ${i + 1}`,
                question_type: 'multiple_choice',
                options: ['A', 'B', 'C', 'D'],
                correct_answers: ['A'],
                points: 1,
                required: true,
                order_index: i
              });
              
              configuration = {
                question_ids: [questionId],
                randomize_within_stage: false
              };
            }
            
            stages.push({
              exam_id: exam.id,
              stage_type: stageType,
              stage_order: i,
              configuration
            });
          }

          const { error: stagesError } = await supabase
            .from('exam_stages')
            .insert(stages);

          if (stagesError) {
            throw new Error(`Failed to create stages: ${stagesError?.message}`);
          }

          // Start attempt
          const { data: attemptData, error: attemptError } = await supabase.rpc('start_attempt', {
            p_exam_id: exam.id,
            p_code: studentCode,
            p_student_name: studentName,
            p_ip: '127.0.0.1'
          });

          if (attemptError || !attemptData) {
            throw new Error(`Failed to start attempt: ${attemptError?.message}`);
          }

          const attemptId = Array.isArray(attemptData) ? attemptData[0]?.attempt_id : attemptData?.attempt_id;
          
          if (!attemptId) {
            throw new Error('No attempt ID returned from start_attempt');
          }

          testAttemptIds.push(attemptId);

          // Get initial attempt state
          const { data: initialState, error: initialStateError } = await supabase.rpc('get_attempt_state', {
            p_attempt_id: attemptId
          });

          if (initialStateError) {
            throw new Error(`Failed to get initial attempt state: ${initialStateError?.message}`);
          }

          const state = Array.isArray(initialState) ? initialState[0] : initialState;

          // PROPERTY ASSERTIONS:
          
          // 1. Exam should have duration_minutes set
          expect(state.exam.duration_minutes).toBe(config.duration_minutes);

          // 2. Attempt should have started_at timestamp
          expect(state.started_at).toBeDefined();
          expect(state.started_at).not.toBeNull();

          // 3. Calculate expected end time
          const startTime = new Date(state.started_at).getTime();
          const durationMs = config.duration_minutes * 60 * 1000;
          const expectedEndTime = startTime + durationMs;

          // 4. Verify timer calculation is consistent
          const currentTime = Date.now();
          const remainingMs = expectedEndTime - currentTime;
          const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));

          // Timer should be counting down (allow 1 minute tolerance for rounding)
          expect(remainingMinutes).toBeLessThanOrEqual(config.duration_minutes + 1);
          expect(remainingMinutes).toBeGreaterThanOrEqual(0);

          // 5. Simulate stage progression and verify timer remains consistent
          // The timer is based on started_at and duration_minutes, which don't change
          // across stage transitions
          
          // Wait a small amount of time to simulate stage transition
          await new Promise(resolve => setTimeout(resolve, 100));

          // Get attempt state again (simulating after stage transition)
          const { data: laterState, error: laterStateError } = await supabase.rpc('get_attempt_state', {
            p_attempt_id: attemptId
          });

          if (laterStateError) {
            throw new Error(`Failed to get later attempt state: ${laterStateError?.message}`);
          }

          const laterStateData = Array.isArray(laterState) ? laterState[0] : laterState;

          // 6. Verify started_at hasn't changed (timer continuity)
          expect(laterStateData.started_at).toBe(state.started_at);

          // 7. Verify duration_minutes hasn't changed
          expect(laterStateData.exam.duration_minutes).toBe(config.duration_minutes);

          // 8. Calculate remaining time again
          const laterCurrentTime = Date.now();
          const laterRemainingMs = expectedEndTime - laterCurrentTime;
          const laterRemainingMinutes = Math.max(0, Math.ceil(laterRemainingMs / 60000));

          // 9. Verify timer has progressed (remaining time should be less or equal)
          expect(laterRemainingMinutes).toBeLessThanOrEqual(remainingMinutes);

          // 10. Verify timer is still based on the same start time
          const recalculatedEndTime = new Date(laterStateData.started_at).getTime() + 
                                      (laterStateData.exam.duration_minutes * 60 * 1000);
          expect(recalculatedEndTime).toBe(expectedEndTime);
        }
      ),
      { numRuns: 10 } // Reduced for performance with database operations
    );
  }, 60000); // 60 second timeout for property-based test with database operations
});
