/**
 * Property-Based Test: Answer Aggregation Across Stages
 * Feature: staged-exam-system
 * Property 15: Answer Aggregation Across Stages
 * 
 * For any staged exam with multiple Questions_Stages, all answers from all stages
 * should be aggregated into the single exam_attempts.answers JSONB column.
 * 
 * Validates: Requirements 3.4.7
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
 * Property 15: Answer Aggregation Across Stages
 * 
 * For any staged exam with multiple Questions_Stages, all answers from all stages
 * should be aggregated into the single exam_attempts.answers JSONB column.
 */
describe('Feature: staged-exam-system, Property 15: Answer Aggregation Across Stages', () => {
  it('should aggregate answers from all Questions_Stages into single answers column', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate configuration for multiple question stages
        fc.record({
          title: fc.string({ minLength: 5, maxLength: 100 }),
          stage_count: fc.integer({ min: 2, max: 4 }), // 2-4 question stages
          questions_per_stage: fc.integer({ min: 2, max: 5 }) // 2-5 questions per stage
        }),
        async (config) => {
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

          // Create test exam
          const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert({
              title: config.title,
              description: 'Staged exam for answer aggregation test',
              status: 'published',
              access_type: 'open',
              exam_type: 'exam',
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

          // Create questions for all stages
          const allQuestions: any[] = [];
          const stageQuestionIds: string[][] = [];

          for (let stageIdx = 0; stageIdx < config.stage_count; stageIdx++) {
            const stageQuestions: string[] = [];
            
            for (let qIdx = 0; qIdx < config.questions_per_stage; qIdx++) {
              const questionId = crypto.randomUUID();
              stageQuestions.push(questionId);
              
              allQuestions.push({
                id: questionId,
                exam_id: exam.id,
                question_text: `Stage ${stageIdx + 1} Question ${qIdx + 1}`,
                question_type: 'multiple_choice',
                options: ['Option A', 'Option B', 'Option C', 'Option D'],
                correct_answers: ['Option A'],
                points: 1,
                required: true,
                order_index: stageIdx * config.questions_per_stage + qIdx
              });
            }
            
            stageQuestionIds.push(stageQuestions);
          }

          // Insert all questions
          const { error: questionsError } = await supabase
            .from('questions')
            .insert(allQuestions);

          if (questionsError) {
            throw new Error(`Failed to create questions: ${questionsError?.message}`);
          }

          // Create stages (alternating between Questions stages and other stage types)
          const stages: any[] = [];
          
          for (let i = 0; i < config.stage_count; i++) {
            stages.push({
              exam_id: exam.id,
              stage_type: 'questions',
              stage_order: i,
              configuration: {
                question_ids: stageQuestionIds[i],
                randomize_within_stage: false
              }
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

          // Simulate answering questions from different stages
          const aggregatedAnswers: Record<string, string> = {};
          
          for (let stageIdx = 0; stageIdx < config.stage_count; stageIdx++) {
            const stageQuestions = stageQuestionIds[stageIdx];
            
            // Answer all questions in this stage
            for (const questionId of stageQuestions) {
              aggregatedAnswers[questionId] = `Answer from Stage ${stageIdx + 1}`;
            }
          }

          // Save all answers using save_attempt RPC
          const { error: saveError } = await supabase.rpc('save_attempt', {
            p_attempt_id: attemptId,
            p_answers: aggregatedAnswers,
            p_auto_save_data: { 
              progress: { 
                answered: Object.keys(aggregatedAnswers).length, 
                total: allQuestions.length 
              } 
            },
            p_expected_version: 1
          });

          if (saveError) {
            throw new Error(`Failed to save answers: ${saveError?.message}`);
          }

          // Retrieve attempt state
          const { data: attemptState, error: stateError } = await supabase.rpc('get_attempt_state', {
            p_attempt_id: attemptId
          });

          if (stateError) {
            throw new Error(`Failed to get attempt state: ${stateError?.message}`);
          }

          const state = Array.isArray(attemptState) ? attemptState[0] : attemptState;

          // PROPERTY ASSERTIONS:
          
          // 1. All answers should be in the single answers JSONB column
          expect(state.answers).toBeDefined();
          expect(typeof state.answers).toBe('object');

          // 2. Answers should contain entries for all questions from all stages
          const totalQuestions = config.stage_count * config.questions_per_stage;
          expect(Object.keys(state.answers).length).toBe(totalQuestions);

          // 3. Each question from each stage should have an answer
          for (let stageIdx = 0; stageIdx < config.stage_count; stageIdx++) {
            const stageQuestions = stageQuestionIds[stageIdx];
            
            for (const questionId of stageQuestions) {
              expect(state.answers[questionId]).toBeDefined();
              expect(state.answers[questionId]).toBe(`Answer from Stage ${stageIdx + 1}`);
            }
          }

          // 4. Verify answers are persisted in database
          const { data: attemptRecord, error: attemptRecordError } = await supabase
            .from('exam_attempts')
            .select('answers')
            .eq('id', attemptId)
            .single();

          expect(attemptRecordError).toBeNull();
          expect(attemptRecord).toBeDefined();
          expect(attemptRecord.answers).toBeDefined();

          // 5. Database answers should match the aggregated answers
          expect(Object.keys(attemptRecord.answers).length).toBe(totalQuestions);
          
          for (const [questionId, answer] of Object.entries(aggregatedAnswers)) {
            expect(attemptRecord.answers[questionId]).toBe(answer);
          }

          // 6. Submit attempt and verify answers are preserved
          const { error: submitError } = await supabase.rpc('submit_attempt', {
            p_attempt_id: attemptId
          });

          expect(submitError).toBeNull();

          // 7. Verify answers are still present after submission
          const { data: submittedState, error: submittedStateError } = await supabase.rpc('get_attempt_state', {
            p_attempt_id: attemptId
          });

          expect(submittedStateError).toBeNull();
          const submittedStateData = Array.isArray(submittedState) ? submittedState[0] : submittedState;
          
          expect(Object.keys(submittedStateData.answers).length).toBe(totalQuestions);
          
          // 8. Verify all answers from all stages are included in results calculation
          const { error: calculateError } = await supabase.rpc('calculate_result_for_attempt', {
            p_attempt_id: attemptId
          });

          expect(calculateError).toBeNull();

          // 9. Verify results include all questions
          const { data: results, error: resultsError } = await supabase
            .from('exam_results')
            .select('*')
            .eq('attempt_id', attemptId)
            .single();

          expect(resultsError).toBeNull();
          expect(results).toBeDefined();
          expect(results.total_questions).toBe(totalQuestions);
        }
      ),
      { numRuns: 10 } // Reduced for performance with database operations
    );
  }, 60000); // 60 second timeout for property-based test with database operations
});
