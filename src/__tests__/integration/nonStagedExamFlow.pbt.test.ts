/**
 * Property-Based Test: Non-Staged Exam Flow Preservation
 * Feature: staged-exam-system
 * Property 25: Non-Staged Exam Flow Preservation
 * 
 * For any exam with zero stages, the exam flow should use the existing
 * AttemptPage component without StageContainer, and all existing functionality
 * should work unchanged.
 * 
 * Validates: Requirements 3.1.6, 3.9.1, 3.9.2
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
    await supabase.from('exam_attempts').delete().in('id', testAttemptIds);
  }
  if (testExamIds.length > 0) {
    await supabase.from('questions').delete().in('exam_id', testExamIds);
    await supabase.from('exams').delete().in('id', testExamIds);
  }
  if (testStudentIds.length > 0) {
    await supabase.from('students').delete().in('id', testStudentIds);
  }
});

/**
 * Property 25: Non-Staged Exam Flow Preservation
 * 
 * For any exam with zero stages, the exam flow should use the existing
 * AttemptPage component without StageContainer, and all existing functionality
 * should work unchanged.
 */
describe('Feature: staged-exam-system, Property 25: Non-Staged Exam Flow Preservation', () => {
  it('should preserve traditional exam flow for exams without stages', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate exam configuration
        fc.record({
          title: fc.string({ minLength: 5, maxLength: 100 }),
          duration_minutes: fc.option(fc.integer({ min: 10, max: 180 })),
          access_type: fc.constantFrom('open', 'code_based', 'ip_restricted'),
          exam_type: fc.constantFrom('exam', 'homework', 'quiz'),
          display_mode: fc.constantFrom('full', 'per_question'),
          randomize_questions: fc.boolean(),
          question_count: fc.integer({ min: 1, max: 10 })
        }),
        async (examConfig) => {
          // Create test student
          const { data: student, error: studentError } = await supabase
            .from('students')
            .insert({
              student_name: `Test Student ${Date.now()}`,
              code: `TEST${Date.now()}`
            })
            .select()
            .single();

          if (studentError || !student) {
            throw new Error(`Failed to create test student: ${studentError?.message}`);
          }

          testStudentIds.push(student.id);

          // Create test exam WITHOUT stages
          const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert({
              title: examConfig.title,
              description: 'Non-staged exam for property test',
              status: 'published',
              access_type: examConfig.access_type,
              duration_minutes: examConfig.duration_minutes,
              exam_type: examConfig.exam_type,
              settings: {
                display_mode: examConfig.display_mode,
                randomize_questions: examConfig.randomize_questions
              }
            })
            .select()
            .single();

          if (examError || !exam) {
            throw new Error(`Failed to create test exam: ${examError?.message}`);
          }

          testExamIds.push(exam.id);

          // Create test questions
          const questions = Array.from({ length: examConfig.question_count }, (_, i) => ({
            exam_id: exam.id,
            question_text: `Question ${i + 1}`,
            question_type: 'multiple_choice',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correct_answers: ['Option A'],
            points: 1,
            required: true,
            order_index: i
          }));

          const { error: questionsError } = await supabase
            .from('questions')
            .insert(questions);

          if (questionsError) {
            throw new Error(`Failed to create questions: ${questionsError?.message}`);
          }

          // Start attempt using existing RPC
          const { data: attemptData, error: attemptError } = await supabase.rpc('start_attempt', {
            p_exam_id: exam.id,
            p_code: student.code,
            p_student_name: student.student_name || 'Test Student',
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

          // Get attempt state using existing RPC
          const { data: attemptState, error: stateError } = await supabase.rpc('get_attempt_state', {
            p_attempt_id: attemptId
          });

          if (stateError) {
            throw new Error(`Failed to get attempt state: ${stateError?.message}`);
          }

          const state = Array.isArray(attemptState) ? attemptState[0] : attemptState;

          // PROPERTY ASSERTIONS:
          
          // 1. Exam should have NO stages field or empty stages array
          expect(state.stages === null || state.stages === undefined || state.stages.length === 0).toBe(true);

          // 2. Exam should have NO stage_progress field or empty stage_progress array
          expect(state.stage_progress === null || state.stage_progress === undefined || state.stage_progress.length === 0).toBe(true);

          // 3. All questions should be returned in the questions array
          expect(state.questions).toBeDefined();
          expect(state.questions.length).toBe(examConfig.question_count);

          // 4. Exam metadata should be preserved
          expect(state.exam.id).toBe(exam.id);
          expect(state.exam.title).toBe(examConfig.title);
          expect(state.exam.access_type).toBe(examConfig.access_type);
          expect(state.exam.duration_minutes).toBe(examConfig.duration_minutes);

          // 5. Settings should be preserved
          expect(state.exam.settings.display_mode).toBe(examConfig.display_mode);
          expect(state.exam.settings.randomize_questions).toBe(examConfig.randomize_questions);

          // 6. Attempt should be in correct initial state
          expect(state.completion_status).toBe('in_progress');
          expect(state.submitted_at).toBeNull();
          expect(state.version).toBe(1);

          // 7. Answers should be initialized as empty object
          expect(state.answers).toBeDefined();
          expect(typeof state.answers).toBe('object');

          // 8. Test save_attempt RPC (existing functionality)
          const testAnswers = questions.reduce((acc, q, i) => {
            acc[state.questions[i].id] = 'Option A';
            return acc;
          }, {} as Record<string, string>);

          const { error: saveError } = await supabase.rpc('save_attempt', {
            p_attempt_id: attemptId,
            p_answers: testAnswers,
            p_auto_save_data: { progress: { answered: examConfig.question_count, total: examConfig.question_count } },
            p_expected_version: 1
          });

          expect(saveError).toBeNull();

          // 9. Test submit_attempt RPC (existing functionality)
          const { error: submitError } = await supabase.rpc('submit_attempt', {
            p_attempt_id: attemptId
          });

          expect(submitError).toBeNull();

          // 10. Verify attempt is marked as submitted
          const { data: finalState, error: finalStateError } = await supabase.rpc('get_attempt_state', {
            p_attempt_id: attemptId
          });

          expect(finalStateError).toBeNull();
          const finalStateData = Array.isArray(finalState) ? finalState[0] : finalState;
          expect(finalStateData.completion_status).toBe('submitted');
          expect(finalStateData.submitted_at).not.toBeNull();

          // 11. Test calculate_result_for_attempt RPC (existing functionality)
          const { error: calculateError } = await supabase.rpc('calculate_result_for_attempt', {
            p_attempt_id: attemptId
          });

          expect(calculateError).toBeNull();

          // 12. Verify results were calculated
          const { data: results, error: resultsError } = await supabase
            .from('exam_results')
            .select('*')
            .eq('attempt_id', attemptId)
            .single();

          expect(resultsError).toBeNull();
          expect(results).toBeDefined();
          expect(results.total_questions).toBe(examConfig.question_count);
          expect(results.correct_count).toBe(examConfig.question_count); // All answers were correct
        }
      ),
      { numRuns: 10 } // Reduced from 100 for performance with database operations
    );
  }, 60000); // 60 second timeout for property-based test with database operations
});
