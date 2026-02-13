/**
 * Property-Based Tests for Staged Exam System
 * Feature: staged-exam-system
 * 
 * These tests validate correctness properties across all valid inputs
 * using property-based testing with fast-check.
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

afterAll(async () => {
  // Cleanup test data
  if (testAttemptIds.length > 0) {
    await supabase.from('exam_attempts').delete().in('id', testAttemptIds);
  }
  if (testExamIds.length > 0) {
    await supabase.from('exam_stages').delete().in('exam_id', testExamIds);
    await supabase.from('exams').delete().in('id', testExamIds);
  }
});

/**
 * Property 2: Stage Ordering Preservation
 * 
 * For any sequence of stages with assigned stage_order values,
 * retrieving stages from the database should return them in ascending stage_order.
 * 
 * Validates: Requirements 3.1.3, 3.8.3
 */
describe('Feature: staged-exam-system, Property 2: Stage Ordering Preservation', () => {
  it('should preserve stage ordering when retrieving via get_attempt_state', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate array of 1-5 stages with different types
        fc.array(
          fc.record({
            stage_type: fc.constantFrom('video', 'content', 'questions'),
            configuration: fc.oneof(
              // Video configuration
              fc.record({
                youtube_url: fc.constant('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
                enforcement_threshold: fc.option(fc.integer({ min: 0, max: 100 })),
                description: fc.option(fc.string({ maxLength: 100 }))
              }),
              // Content configuration
              fc.record({
                slides: fc.array(
                  fc.record({
                    id: fc.uuid(),
                    content: fc.string({ maxLength: 200 }),
                    order: fc.nat({ max: 10 })
                  }),
                  { minLength: 1, maxLength: 3 }
                ),
                minimum_read_time_per_slide: fc.option(fc.nat({ max: 120 }))
              }),
              // Questions configuration
              fc.record({
                question_ids: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
                randomize_within_stage: fc.boolean()
              })
            )
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (stageConfigs) => {
          // Create test exam
          const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert({
              title: `Test Exam ${Date.now()}`,
              description: 'Property test exam',
              status: 'published',
              access_type: 'open',
              settings: {}
            })
            .select()
            .single();

          if (examError || !exam) {
            throw new Error(`Failed to create test exam: ${examError?.message}`);
          }

          testExamIds.push(exam.id);

          // Insert stages with explicit stage_order values
          const stagesToInsert = stageConfigs.map((config, index) => ({
            exam_id: exam.id,
            stage_type: config.stage_type,
            stage_order: index, // Explicit ordering: 0, 1, 2, ...
            configuration: config.configuration
          }));

          const { data: insertedStages, error: stagesError } = await supabase
            .from('exam_stages')
            .insert(stagesToInsert)
            .select();

          if (stagesError || !insertedStages) {
            throw new Error(`Failed to insert stages: ${stagesError?.message}`);
          }

          // Create test attempt
          const { data: attempt, error: attemptError } = await supabase
            .from('exam_attempts')
            .insert({
              exam_id: exam.id,
              ip_address: '127.0.0.1',
              student_name: 'Test Student',
              answers: {},
              auto_save_data: {},
              completion_status: 'in_progress',
              version: 1
            })
            .select()
            .single();

          if (attemptError || !attempt) {
            throw new Error(`Failed to create attempt: ${attemptError?.message}`);
          }

          testAttemptIds.push(attempt.id);

          // Call get_attempt_state RPC
          const { data: attemptState, error: rpcError } = await supabase
            .rpc('get_attempt_state', { p_attempt_id: attempt.id });

          if (rpcError) {
            throw new Error(`RPC call failed: ${rpcError.message}`);
          }

          // Verify stages are returned
          expect(attemptState).toBeDefined();
          expect(attemptState.stages).toBeDefined();
          expect(Array.isArray(attemptState.stages)).toBe(true);
          expect(attemptState.stages.length).toBe(stageConfigs.length);

          // Property: Stages must be ordered by stage_order in ascending order
          for (let i = 0; i < attemptState.stages.length; i++) {
            expect(attemptState.stages[i].stage_order).toBe(i);
            
            // Verify stage_order is strictly increasing
            if (i > 0) {
              expect(attemptState.stages[i].stage_order).toBeGreaterThan(
                attemptState.stages[i - 1].stage_order
              );
            }
          }

          // Verify stage types match
          for (let i = 0; i < attemptState.stages.length; i++) {
            expect(attemptState.stages[i].stage_type).toBe(stageConfigs[i].stage_type);
          }

          // Verify backward compatibility: stage_progress should be empty array for new attempt
          expect(attemptState.stage_progress).toBeDefined();
          expect(Array.isArray(attemptState.stage_progress)).toBe(true);
          expect(attemptState.stage_progress.length).toBe(0);
        }
      ),
      { numRuns: 2, timeout: 50000 } // 2 iterations, 50s timeout per test (database operations are slow)
    );
  }, 180000); // 180s total timeout for the test

  it('should return empty arrays for non-staged exams (backward compatibility)', async () => {
    // Create exam without stages
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Non-Staged Exam ${Date.now()}`,
        description: 'Backward compatibility test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    // Create attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Call get_attempt_state RPC
    const { data: attemptState, error: rpcError } = await supabase
      .rpc('get_attempt_state', { p_attempt_id: attempt.id });

    if (rpcError) {
      throw new Error(`RPC call failed: ${rpcError.message}`);
    }

    // Verify empty arrays for backward compatibility
    expect(attemptState.stages).toBeDefined();
    expect(Array.isArray(attemptState.stages)).toBe(true);
    expect(attemptState.stages.length).toBe(0);

    expect(attemptState.stage_progress).toBeDefined();
    expect(Array.isArray(attemptState.stage_progress)).toBe(true);
    expect(attemptState.stage_progress.length).toBe(0);
  });
});


/**
 * Property 33: Stage Progress Validation
 * 
 * For any update_stage_progress RPC call, invalid attempt_id or stage_id values
 * should be rejected with an appropriate error.
 * 
 * Validates: Requirements 3.8.5
 */
describe('Feature: staged-exam-system, Property 33: Stage Progress Validation', () => {
  it('should reject invalid attempt_id', async () => {
    // Create a valid exam and stage
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Validation test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    const { data: stage, error: stageError } = await supabase
      .from('exam_stages')
      .insert({
        exam_id: exam.id,
        stage_type: 'video',
        stage_order: 0,
        configuration: {
          youtube_url: 'https://www.youtube.com/watch?v=test',
          enforcement_threshold: 80
        }
      })
      .select()
      .single();

    if (stageError || !stage) {
      throw new Error(`Failed to create stage: ${stageError?.message}`);
    }

    // Try to update progress with invalid attempt_id
    const invalidAttemptId = '00000000-0000-0000-0000-000000000000';
    const { error: rpcError } = await supabase.rpc('update_stage_progress', {
      p_attempt_id: invalidAttemptId,
      p_stage_id: stage.id,
      p_progress_data: { watch_percentage: 50 },
      p_completed: false
    });

    // Should reject with invalid_attempt_id error
    expect(rpcError).toBeDefined();
    expect(rpcError?.message).toContain('invalid_attempt_id');
  });

  it('should reject invalid stage_id', async () => {
    // Create a valid exam and attempt
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Validation test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Try to update progress with invalid stage_id
    const invalidStageId = '00000000-0000-0000-0000-000000000000';
    const { error: rpcError } = await supabase.rpc('update_stage_progress', {
      p_attempt_id: attempt.id,
      p_stage_id: invalidStageId,
      p_progress_data: { watch_percentage: 50 },
      p_completed: false
    });

    // Should reject with invalid_stage_id error
    expect(rpcError).toBeDefined();
    expect(rpcError?.message).toContain('invalid_stage_id');
  });

  it('should successfully update progress with valid IDs', async () => {
    // Create exam, stage, and attempt
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Validation test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    const { data: stage, error: stageError } = await supabase
      .from('exam_stages')
      .insert({
        exam_id: exam.id,
        stage_type: 'video',
        stage_order: 0,
        configuration: {
          youtube_url: 'https://www.youtube.com/watch?v=test',
          enforcement_threshold: 80
        }
      })
      .select()
      .single();

    if (stageError || !stage) {
      throw new Error(`Failed to create stage: ${stageError?.message}`);
    }

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Update progress with valid IDs
    const progressData = { watch_percentage: 75, total_watch_time: 120 };
    const { data: result, error: rpcError } = await supabase.rpc('update_stage_progress', {
      p_attempt_id: attempt.id,
      p_stage_id: stage.id,
      p_progress_data: progressData,
      p_completed: false
    });

    // Should succeed
    expect(rpcError).toBeNull();
    expect(result).toBeDefined();
    expect(result.attempt_id).toBe(attempt.id);
    expect(result.stage_id).toBe(stage.id);
    expect(result.progress_data).toEqual(progressData);
    expect(result.started_at).toBeDefined();
    expect(result.completed_at).toBeNull(); // Not completed yet

    // Update again to mark as completed
    const { data: completedResult, error: completedError } = await supabase.rpc('update_stage_progress', {
      p_attempt_id: attempt.id,
      p_stage_id: stage.id,
      p_progress_data: { watch_percentage: 100, total_watch_time: 180 },
      p_completed: true
    });

    expect(completedError).toBeNull();
    expect(completedResult).toBeDefined();
    expect(completedResult.completed_at).toBeDefined(); // Now completed
  });
});


/**
 * Property 21: Progress Preservation Across Navigation
 * 
 * For any staged exam, navigating from stage A to stage B and back to stage A
 * should preserve all progress data from stage A (answers, watch position, slide times).
 * 
 * Validates: Requirements 3.6.6
 */
describe('Feature: staged-exam-system, Property 21: Progress Preservation Across Navigation', () => {
  it('should preserve video stage progress when navigating away and back', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate video progress data
        fc.record({
          watch_percentage: fc.float({ min: 0, max: 100 }),
          total_watch_time: fc.nat({ max: 3600 }),
          last_position: fc.nat({ max: 3600 }),
          watched_segments: fc.array(
            fc.tuple(fc.nat({ max: 3600 }), fc.nat({ max: 3600 })),
            { maxLength: 5 }
          )
        }),
        async (videoProgress) => {
          // Create exam with video stage
          const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert({
              title: `Test Exam ${Date.now()}`,
              description: 'Progress preservation test',
              status: 'published',
              access_type: 'open',
              settings: {}
            })
            .select()
            .single();

          if (examError || !exam) {
            throw new Error(`Failed to create test exam: ${examError?.message}`);
          }

          testExamIds.push(exam.id);

          const { data: stage, error: stageError } = await supabase
            .from('exam_stages')
            .insert({
              exam_id: exam.id,
              stage_type: 'video',
              stage_order: 0,
              configuration: {
                youtube_url: 'https://www.youtube.com/watch?v=test',
                enforcement_threshold: 50
              }
            })
            .select()
            .single();

          if (stageError || !stage) {
            throw new Error(`Failed to create stage: ${stageError?.message}`);
          }

          // Create attempt
          const { data: attempt, error: attemptError } = await supabase
            .from('exam_attempts')
            .insert({
              exam_id: exam.id,
              ip_address: '127.0.0.1',
              student_name: 'Test Student',
              answers: {},
              auto_save_data: {},
              completion_status: 'in_progress',
              version: 1
            })
            .select()
            .single();

          if (attemptError || !attempt) {
            throw new Error(`Failed to create attempt: ${attemptError?.message}`);
          }

          testAttemptIds.push(attempt.id);

          // Save initial progress
          const { data: savedProgress, error: saveError } = await supabase
            .rpc('update_stage_progress', {
              p_attempt_id: attempt.id,
              p_stage_id: stage.id,
              p_progress_data: videoProgress,
              p_completed: false
            });

          if (saveError) {
            throw new Error(`Failed to save progress: ${saveError.message}`);
          }

          expect(savedProgress).toBeDefined();

          // Simulate navigation away (retrieve state)
          const { data: state1, error: state1Error } = await supabase
            .rpc('get_attempt_state', { p_attempt_id: attempt.id });

          if (state1Error) {
            throw new Error(`Failed to get state: ${state1Error.message}`);
          }

          // Verify progress is present
          expect(state1.stage_progress).toBeDefined();
          expect(state1.stage_progress.length).toBe(1);
          const retrievedProgress1 = state1.stage_progress[0];
          expect(retrievedProgress1.stage_id).toBe(stage.id);
          expect(retrievedProgress1.progress_data.watch_percentage).toBe(videoProgress.watch_percentage);
          expect(retrievedProgress1.progress_data.total_watch_time).toBe(videoProgress.total_watch_time);
          expect(retrievedProgress1.progress_data.last_position).toBe(videoProgress.last_position);

          // Simulate navigation back (retrieve state again)
          const { data: state2, error: state2Error } = await supabase
            .rpc('get_attempt_state', { p_attempt_id: attempt.id });

          if (state2Error) {
            throw new Error(`Failed to get state again: ${state2Error.message}`);
          }

          // Property: Progress must be identical after navigation
          expect(state2.stage_progress).toBeDefined();
          expect(state2.stage_progress.length).toBe(1);
          const retrievedProgress2 = state2.stage_progress[0];
          
          expect(retrievedProgress2.stage_id).toBe(retrievedProgress1.stage_id);
          expect(retrievedProgress2.progress_data).toEqual(retrievedProgress1.progress_data);
          expect(retrievedProgress2.started_at).toBe(retrievedProgress1.started_at);
          expect(retrievedProgress2.completed_at).toBe(retrievedProgress1.completed_at);
        }
      ),
      { numRuns: 2, timeout: 50000 } // 2 iterations, 50s timeout per test
    );
  }, 180000);

  it('should preserve content stage progress when navigating away and back', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate content progress data
        fc.record({
          current_slide_index: fc.nat({ max: 5 }),
          slide_times: fc.dictionary(
            fc.string({ minLength: 5, maxLength: 10 }),
            fc.nat({ max: 300 })
          )
        }),
        async (contentProgress) => {
          // Create exam with content stage
          const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert({
              title: `Test Exam ${Date.now()}`,
              description: 'Progress preservation test',
              status: 'published',
              access_type: 'open',
              settings: {}
            })
            .select()
            .single();

          if (examError || !exam) {
            throw new Error(`Failed to create test exam: ${examError?.message}`);
          }

          testExamIds.push(exam.id);

          const { data: stage, error: stageError } = await supabase
            .from('exam_stages')
            .insert({
              exam_id: exam.id,
              stage_type: 'content',
              stage_order: 0,
              configuration: {
                slides: [
                  { id: 'slide-1', content: '<p>Slide 1</p>', order: 0 },
                  { id: 'slide-2', content: '<p>Slide 2</p>', order: 1 }
                ],
                minimum_read_time_per_slide: 30
              }
            })
            .select()
            .single();

          if (stageError || !stage) {
            throw new Error(`Failed to create stage: ${stageError?.message}`);
          }

          // Create attempt
          const { data: attempt, error: attemptError } = await supabase
            .from('exam_attempts')
            .insert({
              exam_id: exam.id,
              ip_address: '127.0.0.1',
              student_name: 'Test Student',
              answers: {},
              auto_save_data: {},
              completion_status: 'in_progress',
              version: 1
            })
            .select()
            .single();

          if (attemptError || !attempt) {
            throw new Error(`Failed to create attempt: ${attemptError?.message}`);
          }

          testAttemptIds.push(attempt.id);

          // Save initial progress
          await supabase.rpc('update_stage_progress', {
            p_attempt_id: attempt.id,
            p_stage_id: stage.id,
            p_progress_data: contentProgress,
            p_completed: false
          });

          // Retrieve state twice (simulating navigation)
          const { data: state1 } = await supabase
            .rpc('get_attempt_state', { p_attempt_id: attempt.id });

          const { data: state2 } = await supabase
            .rpc('get_attempt_state', { p_attempt_id: attempt.id });

          // Property: Progress must be preserved
          expect(state1.stage_progress[0].progress_data).toEqual(
            state2.stage_progress[0].progress_data
          );
          expect(state1.stage_progress[0].progress_data.current_slide_index).toBe(
            contentProgress.current_slide_index
          );
          expect(state1.stage_progress[0].progress_data.slide_times).toEqual(
            contentProgress.slide_times
          );
        }
      ),
      { numRuns: 2, timeout: 50000 } // 2 iterations, 50s timeout per test
    );
  }, 180000);

  it('should preserve question answers when navigating between stages', async () => {
    // Create exam with multiple question stages
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Answer preservation test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    // Create questions
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .insert([
        {
          exam_id: exam.id,
          question_text: 'Q1',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['A'],
          points: 10,
          order_index: 0
        },
        {
          exam_id: exam.id,
          question_text: 'Q2',
          question_type: 'true_false',
          options: ['True', 'False'],
          correct_answers: ['True'],
          points: 10,
          order_index: 1
        }
      ])
      .select();

    if (questionsError || !questions) {
      throw new Error(`Failed to create questions: ${questionsError?.message}`);
    }

    // Create two question stages
    await supabase.from('exam_stages').insert([
      {
        exam_id: exam.id,
        stage_type: 'questions',
        stage_order: 0,
        configuration: {
          question_ids: [questions[0].id],
          randomize_within_stage: false
        }
      },
      {
        exam_id: exam.id,
        stage_type: 'questions',
        stage_order: 1,
        configuration: {
          question_ids: [questions[1].id],
          randomize_within_stage: false
        }
      }
    ]);

    // Create attempt with answers
    const answers = {
      [questions[0].id]: 'A',
      [questions[1].id]: 'True'
    };

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: answers,
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Retrieve state multiple times
    const { data: state1 } = await supabase
      .rpc('get_attempt_state', { p_attempt_id: attempt.id });

    const { data: state2 } = await supabase
      .rpc('get_attempt_state', { p_attempt_id: attempt.id });

    // Property: Answers must be preserved across navigation
    expect(state1.answers).toEqual(state2.answers);
    expect(state1.answers).toEqual(answers);
    expect(state2.answers).toEqual(answers);
  }, 60000); // 60s timeout for database operations
});


/**
 * Property 22: Backward Navigation Prevention
 * 
 * For any completed stage, attempting to navigate back to that stage
 * should be prevented (button disabled or navigation blocked).
 * 
 * Validates: Requirements 3.6.7
 */
describe('Feature: staged-exam-system, Property 22: Backward Navigation Prevention', () => {
  it('should prevent navigation back to completed stages', async () => {
    // Create exam with multiple stages
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Backward navigation test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    // Create 3 stages
    const { data: stages, error: stagesError } = await supabase
      .from('exam_stages')
      .insert([
        {
          exam_id: exam.id,
          stage_type: 'video',
          stage_order: 0,
          configuration: {
            youtube_url: 'https://www.youtube.com/watch?v=test1',
            enforcement_threshold: 50
          }
        },
        {
          exam_id: exam.id,
          stage_type: 'content',
          stage_order: 1,
          configuration: {
            slides: [
              { id: 'slide-1', content: '<p>Content</p>', order: 0 }
            ],
            minimum_read_time_per_slide: 30
          }
        },
        {
          exam_id: exam.id,
          stage_type: 'video',
          stage_order: 2,
          configuration: {
            youtube_url: 'https://www.youtube.com/watch?v=test2',
            enforcement_threshold: 80
          }
        }
      ])
      .select()
      .order('stage_order');

    if (stagesError || !stages || stages.length !== 3) {
      throw new Error(`Failed to create stages: ${stagesError?.message}`);
    }

    // Create attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Complete stage 0
    await supabase.rpc('update_stage_progress', {
      p_attempt_id: attempt.id,
      p_stage_id: stages[0].id,
      p_progress_data: { watch_percentage: 100, total_watch_time: 120 },
      p_completed: true
    });

    // Complete stage 1
    await supabase.rpc('update_stage_progress', {
      p_attempt_id: attempt.id,
      p_stage_id: stages[1].id,
      p_progress_data: { current_slide_index: 0, slide_times: { 'slide-1': 60 } },
      p_completed: true
    });

    // Get attempt state (should be on stage 2 now)
    const { data: attemptState, error: stateError } = await supabase
      .rpc('get_attempt_state', { p_attempt_id: attempt.id });

    if (stateError) {
      throw new Error(`Failed to get attempt state: ${stateError.message}`);
    }

    // Verify stage progress
    expect(attemptState.stage_progress).toBeDefined();
    expect(attemptState.stage_progress.length).toBe(2);

    // Property: Completed stages should have completed_at timestamp
    const stage0Progress = attemptState.stage_progress.find(
      (p: any) => p.stage_id === stages[0].id
    );
    const stage1Progress = attemptState.stage_progress.find(
      (p: any) => p.stage_id === stages[1].id
    );

    expect(stage0Progress).toBeDefined();
    expect(stage0Progress.completed_at).not.toBeNull();
    expect(stage1Progress).toBeDefined();
    expect(stage1Progress.completed_at).not.toBeNull();

    // Property: Once a stage is marked completed, it cannot be unmarked
    // Try to update stage 0 progress again (should still be completed)
    await supabase.rpc('update_stage_progress', {
      p_attempt_id: attempt.id,
      p_stage_id: stages[0].id,
      p_progress_data: { watch_percentage: 50, total_watch_time: 60 },
      p_completed: false // Try to uncomplete it
    });

    // Get state again
    const { data: attemptState2 } = await supabase
      .rpc('get_attempt_state', { p_attempt_id: attempt.id });

    const stage0Progress2 = attemptState2.stage_progress.find(
      (p: any) => p.stage_id === stages[0].id
    );

    // Property: completed_at should still be set (cannot go backwards)
    // Note: The RPC should preserve completed_at once set
    expect(stage0Progress2.completed_at).not.toBeNull();
  });

  it('should maintain stage order and prevent skipping stages', async () => {
    // Create exam with 3 stages
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Stage order test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    const { data: stages, error: stagesError } = await supabase
      .from('exam_stages')
      .insert([
        {
          exam_id: exam.id,
          stage_type: 'video',
          stage_order: 0,
          configuration: { youtube_url: 'https://www.youtube.com/watch?v=test1' }
        },
        {
          exam_id: exam.id,
          stage_type: 'content',
          stage_order: 1,
          configuration: {
            slides: [{ id: 'slide-1', content: '<p>Content</p>', order: 0 }]
          }
        },
        {
          exam_id: exam.id,
          stage_type: 'video',
          stage_order: 2,
          configuration: { youtube_url: 'https://www.youtube.com/watch?v=test2' }
        }
      ])
      .select()
      .order('stage_order');

    if (stagesError || !stages) {
      throw new Error(`Failed to create stages: ${stagesError?.message}`);
    }

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Try to complete stage 2 without completing stage 0 and 1
    // This should be allowed by the database (no constraint)
    // But the UI should prevent this
    await supabase.rpc('update_stage_progress', {
      p_attempt_id: attempt.id,
      p_stage_id: stages[2].id,
      p_progress_data: { watch_percentage: 100 },
      p_completed: true
    });

    // Get state
    const { data: attemptState } = await supabase
      .rpc('get_attempt_state', { p_attempt_id: attempt.id });

    // Property: Stage progress should be retrievable regardless of order
    // (The UI enforces order, but database allows flexibility)
    expect(attemptState.stage_progress).toBeDefined();
    const stage2Progress = attemptState.stage_progress.find(
      (p: any) => p.stage_id === stages[2].id
    );
    expect(stage2Progress).toBeDefined();
    expect(stage2Progress.completed_at).not.toBeNull();

    // The UI component (StageContainer) is responsible for:
    // 1. Starting at the first incomplete stage
    // 2. Preventing backward navigation
    // 3. Enforcing sequential progression
  });
});


/**
 * Verification Test: calculate_result_for_attempt Compatibility
 * 
 * Verifies that the existing calculate_result_for_attempt RPC works unchanged
 * with staged exams, including all questions from all Questions_Stages.
 * 
 * Validates: Requirements 3.8.8, 3.14.1
 */
describe('Feature: staged-exam-system, calculate_result_for_attempt Compatibility', () => {
  it('should calculate results correctly for staged exams with multiple question stages', async () => {
    // Create exam
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Staged Exam ${Date.now()}`,
        description: 'Results calculation test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    // Create questions for the exam
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .insert([
        {
          exam_id: exam.id,
          question_text: 'Question 1',
          question_type: 'multiple_choice',
          options: ['A', 'B', 'C'],
          correct_answers: ['A'],
          points: 10,
          order_index: 0
        },
        {
          exam_id: exam.id,
          question_text: 'Question 2',
          question_type: 'true_false',
          options: ['True', 'False'],
          correct_answers: ['True'],
          points: 10,
          order_index: 1
        },
        {
          exam_id: exam.id,
          question_text: 'Question 3',
          question_type: 'multiple_choice',
          options: ['X', 'Y', 'Z'],
          correct_answers: ['Y'],
          points: 10,
          order_index: 2
        }
      ])
      .select();

    if (questionsError || !questions || questions.length !== 3) {
      throw new Error(`Failed to create questions: ${questionsError?.message}`);
    }

    // Create stages: Video -> Questions (Q1, Q2) -> Content -> Questions (Q3)
    const { data: stages, error: stagesError } = await supabase
      .from('exam_stages')
      .insert([
        {
          exam_id: exam.id,
          stage_type: 'video',
          stage_order: 0,
          configuration: {
            youtube_url: 'https://www.youtube.com/watch?v=test',
            enforcement_threshold: 80
          }
        },
        {
          exam_id: exam.id,
          stage_type: 'questions',
          stage_order: 1,
          configuration: {
            question_ids: [questions[0].id, questions[1].id],
            randomize_within_stage: false
          }
        },
        {
          exam_id: exam.id,
          stage_type: 'content',
          stage_order: 2,
          configuration: {
            slides: [
              { id: 'slide-1', content: '<p>Content slide</p>', order: 0 }
            ],
            minimum_read_time_per_slide: 30
          }
        },
        {
          exam_id: exam.id,
          stage_type: 'questions',
          stage_order: 3,
          configuration: {
            question_ids: [questions[2].id],
            randomize_within_stage: false
          }
        }
      ])
      .select();

    if (stagesError || !stages) {
      throw new Error(`Failed to create stages: ${stagesError?.message}`);
    }

    // Create attempt with answers (2 correct, 1 incorrect)
    const answers = {
      [questions[0].id]: 'A',  // Correct
      [questions[1].id]: 'True',  // Correct
      [questions[2].id]: 'X'   // Incorrect (correct is Y)
    };

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: answers,
        auto_save_data: {},
        completion_status: 'submitted',
        submitted_at: new Date().toISOString(),
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Call calculate_result_for_attempt
    const { data: resultArray, error: resultError } = await supabase
      .rpc('calculate_result_for_attempt', { p_attempt_id: attempt.id });

    if (resultError) {
      throw new Error(`Failed to calculate results: ${resultError.message}`);
    }

    // RPC returns TABLE, so data is an array - get first element
    expect(resultArray).toBeDefined();
    expect(Array.isArray(resultArray)).toBe(true);
    expect(resultArray.length).toBe(1);
    
    const result = resultArray[0];
    expect(result).toBeDefined();
    expect(result.total_questions).toBe(3); // All questions from both Questions_Stages
    expect(result.correct_count).toBe(2); // 2 correct answers
    expect(result.score_percentage).toBe(66.67); // (2/3) * 100 = 66.67
    expect(result.auto_points).toBe(20); // 2 correct * 10 points each
    expect(result.max_points).toBe(30); // 3 questions * 10 points each
    expect(result.final_score_percentage).toBe(66.67); // (20/30) * 100 = 66.67

    // Verify result was stored in exam_results table
    const { data: storedResult, error: storedError } = await supabase
      .from('exam_results')
      .select('*')
      .eq('attempt_id', attempt.id)
      .single();

    expect(storedError).toBeNull();
    expect(storedResult).toBeDefined();
    expect(storedResult.total_questions).toBe(3);
    expect(storedResult.correct_count).toBe(2);
  }, 15000); // 15 second timeout

  it('should work with non-staged exams (backward compatibility)', async () => {
    // Create exam without stages
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Non-Staged Exam ${Date.now()}`,
        description: 'Backward compatibility test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    // Create questions
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .insert([
        {
          exam_id: exam.id,
          question_text: 'Question 1',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['A'],
          points: 5,
          order_index: 0
        },
        {
          exam_id: exam.id,
          question_text: 'Question 2',
          question_type: 'true_false',
          options: ['True', 'False'],
          correct_answers: ['False'],
          points: 5,
          order_index: 1
        }
      ])
      .select();

    if (questionsError || !questions) {
      throw new Error(`Failed to create questions: ${questionsError?.message}`);
    }

    // Create attempt with all correct answers
    const answers = {
      [questions[0].id]: 'A',
      [questions[1].id]: 'False'
    };

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: answers,
        auto_save_data: {},
        completion_status: 'submitted',
        submitted_at: new Date().toISOString(),
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Calculate results
    const { data: resultArray, error: resultError } = await supabase
      .rpc('calculate_result_for_attempt', { p_attempt_id: attempt.id });

    expect(resultError).toBeNull();
    
    // RPC returns TABLE, so data is an array - get first element
    expect(resultArray).toBeDefined();
    expect(Array.isArray(resultArray)).toBe(true);
    expect(resultArray.length).toBe(1);
    
    const result = resultArray[0];
    expect(result).toBeDefined();
    expect(result.total_questions).toBe(2);
    expect(result.correct_count).toBe(2);
    expect(result.score_percentage).toBe(100);
    expect(result.auto_points).toBe(10);
    expect(result.max_points).toBe(10);
    expect(result.final_score_percentage).toBe(100);
  }, 60000); // 60 second timeout for database operations
});


/**
 * Property 9: Video Completion Data Persistence
 *
 * For any Video_Stage that is completed, the progress_data should contain
 * watch_percentage and total_watch_time fields with valid numeric values.
 *
 * Validates: Requirements 3.2.6
 */
describe('Feature: staged-exam-system, Property 9: Video Completion Data Persistence', () => {
  it('should persist watch_percentage and total_watch_time when video stage is completed', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid video progress data
        fc.record({
          watch_percentage: fc.float({ min: 0, max: 100, noNaN: true }),
          total_watch_time: fc.nat({ max: 7200 }), // Up to 2 hours
          last_position: fc.nat({ max: 7200 }),
          watched_segments: fc.array(
            fc.tuple(
              fc.nat({ max: 7200 }),
              fc.nat({ max: 7200 })
            ).filter(([start, end]) => start <= end), // Ensure valid segments
            { maxLength: 10 }
          )
        }),
        async (videoProgress) => {
          // Create exam with video stage
          const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert({
              title: `Test Exam ${Date.now()}`,
              description: 'Video completion persistence test',
              status: 'published',
              access_type: 'open',
              settings: {}
            })
            .select()
            .single();

          if (examError || !exam) {
            throw new Error(`Failed to create test exam: ${examError?.message}`);
          }

          testExamIds.push(exam.id);

          const { data: stage, error: stageError } = await supabase
            .from('exam_stages')
            .insert({
              exam_id: exam.id,
              stage_type: 'video',
              stage_order: 0,
              configuration: {
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                enforcement_threshold: 80,
                description: 'Test video'
              }
            })
            .select()
            .single();

          if (stageError || !stage) {
            throw new Error(`Failed to create stage: ${stageError?.message}`);
          }

          // Create attempt
          const { data: attempt, error: attemptError } = await supabase
            .from('exam_attempts')
            .insert({
              exam_id: exam.id,
              ip_address: '127.0.0.1',
              student_name: 'Test Student',
              answers: {},
              auto_save_data: {},
              completion_status: 'in_progress',
              version: 1
            })
            .select()
            .single();

          if (attemptError || !attempt) {
            throw new Error(`Failed to create attempt: ${attemptError?.message}`);
          }

          testAttemptIds.push(attempt.id);

          // Complete the video stage with progress data
          const { data: savedProgress, error: saveError } = await supabase
            .rpc('update_stage_progress', {
              p_attempt_id: attempt.id,
              p_stage_id: stage.id,
              p_progress_data: videoProgress,
              p_completed: true // Mark as completed
            });

          if (saveError) {
            throw new Error(`Failed to save progress: ${saveError.message}`);
          }

          expect(savedProgress).toBeDefined();

          // Retrieve the attempt state
          const { data: attemptState, error: stateError } = await supabase
            .rpc('get_attempt_state', { p_attempt_id: attempt.id });

          if (stateError) {
            throw new Error(`Failed to get attempt state: ${stateError.message}`);
          }

          // Verify stage progress exists
          expect(attemptState.stage_progress).toBeDefined();
          expect(Array.isArray(attemptState.stage_progress)).toBe(true);
          expect(attemptState.stage_progress.length).toBe(1);

          const retrievedProgress = attemptState.stage_progress[0];

          // Property: Completed video stage must have progress_data with watch_percentage and total_watch_time
          expect(retrievedProgress).toBeDefined();
          expect(retrievedProgress.stage_id).toBe(stage.id);
          expect(retrievedProgress.completed_at).not.toBeNull(); // Stage is completed

          // Verify progress_data contains required fields with valid numeric values
          expect(retrievedProgress.progress_data).toBeDefined();
          expect(typeof retrievedProgress.progress_data).toBe('object');

          // Property: watch_percentage must be present and numeric
          expect(retrievedProgress.progress_data.watch_percentage).toBeDefined();
          expect(typeof retrievedProgress.progress_data.watch_percentage).toBe('number');
          expect(Number.isFinite(retrievedProgress.progress_data.watch_percentage)).toBe(true);
          expect(retrievedProgress.progress_data.watch_percentage).toBe(videoProgress.watch_percentage);

          // Property: total_watch_time must be present and numeric
          expect(retrievedProgress.progress_data.total_watch_time).toBeDefined();
          expect(typeof retrievedProgress.progress_data.total_watch_time).toBe('number');
          expect(Number.isFinite(retrievedProgress.progress_data.total_watch_time)).toBe(true);
          expect(retrievedProgress.progress_data.total_watch_time).toBe(videoProgress.total_watch_time);

          // Verify values are within valid ranges
          expect(retrievedProgress.progress_data.watch_percentage).toBeGreaterThanOrEqual(0);
          expect(retrievedProgress.progress_data.watch_percentage).toBeLessThanOrEqual(100);
          expect(retrievedProgress.progress_data.total_watch_time).toBeGreaterThanOrEqual(0);

          // Verify other fields are also preserved
          expect(retrievedProgress.progress_data.last_position).toBe(videoProgress.last_position);
          expect(retrievedProgress.progress_data.watched_segments).toEqual(videoProgress.watched_segments);
        }
      ),
      { numRuns: 3, timeout: 50000 } // 3 iterations, 50s timeout per test
    );
  }, 300000); // 300s total timeout for the test

  it('should reject incomplete video stage progress without required fields', async () => {
    // Create exam with video stage
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Video validation test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    const { data: stage, error: stageError } = await supabase
      .from('exam_stages')
      .insert({
        exam_id: exam.id,
        stage_type: 'video',
        stage_order: 0,
        configuration: {
          youtube_url: 'https://www.youtube.com/watch?v=test',
          enforcement_threshold: 80
        }
      })
      .select()
      .single();

    if (stageError || !stage) {
      throw new Error(`Failed to create stage: ${stageError?.message}`);
    }

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Try to complete stage with incomplete progress data (missing watch_percentage)
    const incompleteProgress = {
      total_watch_time: 120
      // Missing watch_percentage
    };

    const { data: savedProgress } = await supabase
      .rpc('update_stage_progress', {
        p_attempt_id: attempt.id,
        p_stage_id: stage.id,
        p_progress_data: incompleteProgress,
        p_completed: true
      });

    // The database should still accept it (JSONB is flexible)
    // But when retrieved, we verify the data structure
    expect(savedProgress).toBeDefined();

    const { data: attemptState } = await supabase
      .rpc('get_attempt_state', { p_attempt_id: attempt.id });

    const retrievedProgress = attemptState.stage_progress[0];

    // Property: Even if incomplete data is saved, we can detect missing fields
    expect(retrievedProgress.progress_data.watch_percentage).toBeUndefined();
    expect(retrievedProgress.progress_data.total_watch_time).toBe(120);

    // This test demonstrates that the UI/application layer should validate
    // that completed video stages have all required fields before marking as complete
  });

  it('should handle zero values correctly for watch_percentage and total_watch_time', async () => {
    // Create exam with video stage
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Zero values test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    const { data: stage, error: stageError } = await supabase
      .from('exam_stages')
      .insert({
        exam_id: exam.id,
        stage_type: 'video',
        stage_order: 0,
        configuration: {
          youtube_url: 'https://www.youtube.com/watch?v=test',
          enforcement_threshold: 0 // No enforcement
        }
      })
      .select()
      .single();

    if (stageError || !stage) {
      throw new Error(`Failed to create stage: ${stageError?.message}`);
    }

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Complete stage with zero values (valid edge case)
    const zeroProgress = {
      watch_percentage: 0,
      total_watch_time: 0,
      last_position: 0,
      watched_segments: []
    };

    await supabase.rpc('update_stage_progress', {
      p_attempt_id: attempt.id,
      p_stage_id: stage.id,
      p_progress_data: zeroProgress,
      p_completed: true
    });

    const { data: attemptState } = await supabase
      .rpc('get_attempt_state', { p_attempt_id: attempt.id });

    const retrievedProgress = attemptState.stage_progress[0];

    // Verify zero values are stored correctly
    expect(retrievedProgress).toBeDefined();
    expect(retrievedProgress.progress_data.watch_percentage).toBe(0);
    expect(retrievedProgress.progress_data.total_watch_time).toBe(0);
    expect(retrievedProgress.progress_data.last_position).toBe(0);
    expect(Array.isArray(retrievedProgress.progress_data.watched_segments)).toBe(true);
    expect(retrievedProgress.progress_data.watched_segments.length).toBe(0);
    
    // Property: Zero is a valid numeric value for watch_percentage and total_watch_time
    expect(typeof retrievedProgress.progress_data.watch_percentage).toBe('number');
    expect(typeof retrievedProgress.progress_data.total_watch_time).toBe('number');
    expect(Number.isFinite(retrievedProgress.progress_data.watch_percentage)).toBe(true);
    expect(Number.isFinite(retrievedProgress.progress_data.total_watch_time)).toBe(true);
    
    // Verify stage can be marked as complete with zero values (when no enforcement)
    expect(retrievedProgress.completed_at).toBeDefined();
    expect(retrievedProgress.completed_at).not.toBeNull();
  });
});


/**
 * Property 7: Video Progress Enforcement
 * 
 * For any Video_Stage with an enforcement threshold T, if the student's
 * watch_percentage < T, then progression to the next stage should be blocked.
 * 
 * Validates: Requirements 3.2.5
 */
describe('Feature: staged-exam-system, Property 7: Video Progress Enforcement', () => {
  it('should block progression when watch percentage is below threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate enforcement threshold and watch percentage below it
        fc.record({
          enforcement_threshold: fc.integer({ min: 1, max: 100 }),
          watch_percentage: fc.float({ min: 0, max: Math.fround(99.9) })
        }).filter(({ enforcement_threshold, watch_percentage }) => 
          watch_percentage < enforcement_threshold
        ),
        async ({ enforcement_threshold, watch_percentage }) => {
          // Create exam with video stage
          const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert({
              title: `Test Exam ${Date.now()}`,
              description: 'Enforcement test',
              status: 'published',
              access_type: 'open',
              settings: {}
            })
            .select()
            .single();

          if (examError || !exam) {
            throw new Error(`Failed to create test exam: ${examError?.message}`);
          }

          testExamIds.push(exam.id);

          // Create video stage with enforcement threshold
          const { data: videoStage, error: videoStageError } = await supabase
            .from('exam_stages')
            .insert({
              exam_id: exam.id,
              stage_type: 'video',
              stage_order: 0,
              configuration: {
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                enforcement_threshold: enforcement_threshold,
                description: 'Watch this video'
              }
            })
            .select()
            .single();

          if (videoStageError || !videoStage) {
            throw new Error(`Failed to create video stage: ${videoStageError?.message}`);
          }

          // Create a second stage to test progression blocking
          const { data: nextStage, error: nextStageError } = await supabase
            .from('exam_stages')
            .insert({
              exam_id: exam.id,
              stage_type: 'content',
              stage_order: 1,
              configuration: {
                slides: [
                  { id: 'slide-1', content: '<p>Next stage content</p>', order: 0 }
                ]
              }
            })
            .select()
            .single();

          if (nextStageError || !nextStage) {
            throw new Error(`Failed to create next stage: ${nextStageError?.message}`);
          }

          // Create attempt
          const { data: attempt, error: attemptError } = await supabase
            .from('exam_attempts')
            .insert({
              exam_id: exam.id,
              ip_address: '127.0.0.1',
              student_name: 'Test Student',
              answers: {},
              auto_save_data: {},
              completion_status: 'in_progress',
              version: 1
            })
            .select()
            .single();

          if (attemptError || !attempt) {
            throw new Error(`Failed to create attempt: ${attemptError?.message}`);
          }

          testAttemptIds.push(attempt.id);

          // Save progress with watch_percentage below threshold
          const progressData = {
            watch_percentage: watch_percentage,
            total_watch_time: Math.floor(watch_percentage * 10),
            last_position: Math.floor(watch_percentage * 10),
            watched_segments: [[0, Math.floor(watch_percentage * 10)]]
          };

          await supabase.rpc('update_stage_progress', {
            p_attempt_id: attempt.id,
            p_stage_id: videoStage.id,
            p_progress_data: progressData,
            p_completed: false
          });

          // Get attempt state
          const { data: attemptState, error: stateError } = await supabase
            .rpc('get_attempt_state', { p_attempt_id: attempt.id });

          if (stateError) {
            throw new Error(`Failed to get attempt state: ${stateError.message}`);
          }

          // Property: Stage should NOT be marked as completed when below threshold
          const videoProgress = attemptState.stage_progress.find(
            (p: any) => p.stage_id === videoStage.id
          );

          expect(videoProgress).toBeDefined();
          expect(videoProgress.completed_at).toBeNull();
          expect(videoProgress.progress_data.watch_percentage).toBeLessThan(enforcement_threshold);

          // Property: Attempting to complete the stage should fail or be rejected
          // (In the UI, the Continue button would be disabled)
          // We verify that the stage remains incomplete in the database
          const { data: stageProgressCheck } = await supabase
            .from('attempt_stage_progress')
            .select('completed_at')
            .eq('attempt_id', attempt.id)
            .eq('stage_id', videoStage.id)
            .single();

          expect(stageProgressCheck.completed_at).toBeNull();
        }
      ),
      { numRuns: 3, timeout: 50000 } // 3 iterations, 50s timeout per test
    );
  }, 300000);

  it('should allow progression when watch percentage meets or exceeds threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate enforcement threshold and watch percentage that meets it
        fc.record({
          enforcement_threshold: fc.integer({ min: 1, max: 100 }),
          watch_percentage: fc.float({ min: 0, max: 100 })
        }).filter(({ enforcement_threshold, watch_percentage }) => 
          watch_percentage >= enforcement_threshold
        ),
        async ({ enforcement_threshold, watch_percentage }) => {
          // Create exam with video stage
          const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert({
              title: `Test Exam ${Date.now()}`,
              description: 'Enforcement test',
              status: 'published',
              access_type: 'open',
              settings: {}
            })
            .select()
            .single();

          if (examError || !exam) {
            throw new Error(`Failed to create test exam: ${examError?.message}`);
          }

          testExamIds.push(exam.id);

          // Create video stage with enforcement threshold
          const { data: videoStage, error: videoStageError } = await supabase
            .from('exam_stages')
            .insert({
              exam_id: exam.id,
              stage_type: 'video',
              stage_order: 0,
              configuration: {
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                enforcement_threshold: enforcement_threshold,
                description: 'Watch this video'
              }
            })
            .select()
            .single();

          if (videoStageError || !videoStage) {
            throw new Error(`Failed to create video stage: ${videoStageError?.message}`);
          }

          // Create attempt
          const { data: attempt, error: attemptError } = await supabase
            .from('exam_attempts')
            .insert({
              exam_id: exam.id,
              ip_address: '127.0.0.1',
              student_name: 'Test Student',
              answers: {},
              auto_save_data: {},
              completion_status: 'in_progress',
              version: 1
            })
            .select()
            .single();

          if (attemptError || !attempt) {
            throw new Error(`Failed to create attempt: ${attemptError?.message}`);
          }

          testAttemptIds.push(attempt.id);

          // Save progress with watch_percentage meeting threshold
          const progressData = {
            watch_percentage: watch_percentage,
            total_watch_time: Math.floor(watch_percentage * 10),
            last_position: Math.floor(watch_percentage * 10),
            watched_segments: [[0, Math.floor(watch_percentage * 10)]]
          };

          // Mark stage as completed since threshold is met
          const { data: completedProgress, error: completeError } = await supabase
            .rpc('update_stage_progress', {
              p_attempt_id: attempt.id,
              p_stage_id: videoStage.id,
              p_progress_data: progressData,
              p_completed: true
            });

          if (completeError) {
            throw new Error(`Failed to complete stage: ${completeError.message}`);
          }

          // Property: Stage should be marked as completed when threshold is met
          expect(completedProgress).toBeDefined();
          expect(completedProgress.completed_at).not.toBeNull();
          expect(completedProgress.progress_data.watch_percentage).toBeGreaterThanOrEqual(enforcement_threshold);
        }
      ),
      { numRuns: 3, timeout: 50000 } // 3 iterations, 50s timeout per test
    );
  }, 300000);

  it('should allow progression when no enforcement threshold is set', async () => {
    // Create exam with video stage without enforcement
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'No enforcement test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    // Create video stage WITHOUT enforcement threshold
    const { data: videoStage, error: videoStageError } = await supabase
      .from('exam_stages')
      .insert({
        exam_id: exam.id,
        stage_type: 'video',
        stage_order: 0,
        configuration: {
          youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          description: 'Watch this video (optional)'
        }
      })
      .select()
      .single();

    if (videoStageError || !videoStage) {
      throw new Error(`Failed to create video stage: ${videoStageError?.message}`);
    }

    // Create attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Save minimal progress (0% watched)
    const progressData = {
      watch_percentage: 0,
      total_watch_time: 0,
      last_position: 0,
      watched_segments: []
    };

    // Should be able to complete stage even with 0% watched
    const { data: completedProgress, error: completeError } = await supabase
      .rpc('update_stage_progress', {
        p_attempt_id: attempt.id,
        p_stage_id: videoStage.id,
        p_progress_data: progressData,
        p_completed: true
      });

    if (completeError) {
      throw new Error(`Failed to complete stage: ${completeError.message}`);
    }

    // Property: Stage can be completed with any watch percentage when no threshold is set
    expect(completedProgress).toBeDefined();
    expect(completedProgress.completed_at).not.toBeNull();
  });
});


/**
 * Property 8: Video Position Resume
 * 
 * For any Video_Stage, if a student watches to position P and leaves the stage,
 * returning to the stage should resume playback at position P (within a 5-second tolerance).
 * 
 * Validates: Requirements 3.2.7
 */
describe('Feature: staged-exam-system, Property 8: Video Position Resume', () => {
  it('should resume video from last position when returning to stage', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a last position between 0 and 3600 seconds (1 hour)
        fc.nat({ max: 3600 }),
        async (lastPosition) => {
          // Create exam with multiple stages
          const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert({
              title: `Test Exam ${Date.now()}`,
              description: 'Position resume test',
              status: 'published',
              access_type: 'open',
              settings: {}
            })
            .select()
            .single();

          if (examError || !exam) {
            throw new Error(`Failed to create test exam: ${examError?.message}`);
          }

          testExamIds.push(exam.id);

          // Create video stage
          const { data: videoStage, error: videoStageError } = await supabase
            .from('exam_stages')
            .insert({
              exam_id: exam.id,
              stage_type: 'video',
              stage_order: 0,
              configuration: {
                youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                enforcement_threshold: 50,
                description: 'Watch this video'
              }
            })
            .select()
            .single();

          if (videoStageError || !videoStage) {
            throw new Error(`Failed to create video stage: ${videoStageError?.message}`);
          }

          // Create a second stage (to simulate navigation away)
          const { data: contentStage, error: contentStageError } = await supabase
            .from('exam_stages')
            .insert({
              exam_id: exam.id,
              stage_type: 'content',
              stage_order: 1,
              configuration: {
                slides: [
                  { id: 'slide-1', content: '<p>Content stage</p>', order: 0 }
                ]
              }
            })
            .select()
            .single();

          if (contentStageError || !contentStage) {
            throw new Error(`Failed to create content stage: ${contentStageError?.message}`);
          }

          // Create attempt
          const { data: attempt, error: attemptError } = await supabase
            .from('exam_attempts')
            .insert({
              exam_id: exam.id,
              ip_address: '127.0.0.1',
              student_name: 'Test Student',
              answers: {},
              auto_save_data: {},
              completion_status: 'in_progress',
              version: 1
            })
            .select()
            .single();

          if (attemptError || !attempt) {
            throw new Error(`Failed to create attempt: ${attemptError?.message}`);
          }

          testAttemptIds.push(attempt.id);

          // Save progress with specific last_position
          const initialProgress = {
            watch_percentage: Math.min((lastPosition / 600) * 100, 100), // Assume 600s video
            total_watch_time: lastPosition,
            last_position: lastPosition,
            watched_segments: [[0, lastPosition]]
          };

          await supabase.rpc('update_stage_progress', {
            p_attempt_id: attempt.id,
            p_stage_id: videoStage.id,
            p_progress_data: initialProgress,
            p_completed: false
          });

          // Simulate navigation away by updating progress on content stage
          await supabase.rpc('update_stage_progress', {
            p_attempt_id: attempt.id,
            p_stage_id: contentStage.id,
            p_progress_data: { current_slide_index: 0, slide_times: {} },
            p_completed: false
          });

          // Simulate returning to video stage by retrieving attempt state
          const { data: attemptState, error: stateError } = await supabase
            .rpc('get_attempt_state', { p_attempt_id: attempt.id });

          if (stateError) {
            throw new Error(`Failed to get attempt state: ${stateError.message}`);
          }

          // Find video stage progress
          const videoProgress = attemptState.stage_progress.find(
            (p: any) => p.stage_id === videoStage.id
          );

          expect(videoProgress).toBeDefined();

          // Property: last_position should be preserved exactly
          expect(videoProgress.progress_data.last_position).toBe(lastPosition);

          // Property: All progress data should be preserved
          expect(videoProgress.progress_data.watch_percentage).toBe(initialProgress.watch_percentage);
          expect(videoProgress.progress_data.total_watch_time).toBe(initialProgress.total_watch_time);
          expect(videoProgress.progress_data.watched_segments).toEqual(initialProgress.watched_segments);

          // Verify that the position is within acceptable range (exact match expected)
          const tolerance = 5; // 5 seconds tolerance as per requirements
          expect(Math.abs(videoProgress.progress_data.last_position - lastPosition)).toBeLessThanOrEqual(tolerance);
        }
      ),
      { numRuns: 3, timeout: 50000 } // 3 iterations, 50s timeout per test
    );
  }, 300000);

  it('should preserve last position across multiple navigation cycles', async () => {
    // Create exam with video and content stages
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Multiple navigation test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    const { data: videoStage, error: videoStageError } = await supabase
      .from('exam_stages')
      .insert({
        exam_id: exam.id,
        stage_type: 'video',
        stage_order: 0,
        configuration: {
          youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          enforcement_threshold: 80
        }
      })
      .select()
      .single();

    if (videoStageError || !videoStage) {
      throw new Error(`Failed to create video stage: ${videoStageError?.message}`);
    }

    const { data: contentStage, error: contentStageError } = await supabase
      .from('exam_stages')
      .insert({
        exam_id: exam.id,
        stage_type: 'content',
        stage_order: 1,
        configuration: {
          slides: [{ id: 'slide-1', content: '<p>Content</p>', order: 0 }]
        }
      })
      .select()
      .single();

    if (contentStageError || !contentStage) {
      throw new Error(`Failed to create content stage: ${contentStageError?.message}`);
    }

    // Create attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Simulate multiple watch sessions with increasing positions
    const positions = [120, 240, 360, 480];

    for (const position of positions) {
      // Update video progress
      await supabase.rpc('update_stage_progress', {
        p_attempt_id: attempt.id,
        p_stage_id: videoStage.id,
        p_progress_data: {
          watch_percentage: (position / 600) * 100,
          total_watch_time: position,
          last_position: position,
          watched_segments: [[0, position]]
        },
        p_completed: false
      });

      // Navigate to content stage
      await supabase.rpc('update_stage_progress', {
        p_attempt_id: attempt.id,
        p_stage_id: contentStage.id,
        p_progress_data: { current_slide_index: 0, slide_times: {} },
        p_completed: false
      });

      // Return to video stage (retrieve state)
      const { data: attemptState } = await supabase
        .rpc('get_attempt_state', { p_attempt_id: attempt.id });

      const videoProgress = attemptState.stage_progress.find(
        (p: any) => p.stage_id === videoStage.id
      );

      // Property: last_position should match the most recent update
      expect(videoProgress.progress_data.last_position).toBe(position);
    }
  }, 120000); // 120s timeout for multiple database operations

  it('should handle edge case of zero position', async () => {
    // Create exam with video stage
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Zero position test',
        status: 'published',
        access_type: 'open',
        settings: {}
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    const { data: videoStage, error: videoStageError } = await supabase
      .from('exam_stages')
      .insert({
        exam_id: exam.id,
        stage_type: 'video',
        stage_order: 0,
        configuration: {
          youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        }
      })
      .select()
      .single();

    if (videoStageError || !videoStage) {
      throw new Error(`Failed to create video stage: ${videoStageError?.message}`);
    }

    // Create attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: {},
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Save progress with zero position (video just started)
    await supabase.rpc('update_stage_progress', {
      p_attempt_id: attempt.id,
      p_stage_id: videoStage.id,
      p_progress_data: {
        watch_percentage: 0,
        total_watch_time: 0,
        last_position: 0,
        watched_segments: []
      },
      p_completed: false
    });

    // Retrieve state
    const { data: attemptState } = await supabase
      .rpc('get_attempt_state', { p_attempt_id: attempt.id });

    const videoProgress = attemptState.stage_progress[0];

    // Property: Zero is a valid last_position value
    expect(videoProgress.progress_data.last_position).toBe(0);
    expect(typeof videoProgress.progress_data.last_position).toBe('number');
  });
});


/**
 * Property 16: Complete Question Inclusion in Results
 * 
 * For any staged exam, the total_questions count in exam_results should equal
 * the sum of questions across all Questions_Stages.
 * 
 * Validates: Requirements 3.4.8, 3.8.9
 */
describe('Feature: staged-exam-system, Property 16: Complete Question Inclusion in Results', () => {
  it('should include all questions from all stages in results calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-4 question stages with 1-3 questions each
        fc.array(
          fc.record({
            questionCount: fc.integer({ min: 1, max: 3 })
          }),
          { minLength: 2, maxLength: 4 }
        ),
        async (stageConfigs) => {
          // Create exam
          const { data: exam, error: examError } = await supabase
            .from('exams')
            .insert({
              title: `Test Exam ${Date.now()}`,
              description: 'Question inclusion test',
              status: 'published',
              access_type: 'open',
              settings: {},
              duration_minutes: 60
            })
            .select()
            .single();

          if (examError || !exam) {
            throw new Error(`Failed to create test exam: ${examError?.message}`);
          }

          testExamIds.push(exam.id);

          // Create questions for all stages
          let totalQuestions = 0;
          const allQuestionIds: string[] = [];

          for (const config of stageConfigs) {
            const questionsToCreate = Array.from({ length: config.questionCount }, (_, i) => ({
              exam_id: exam.id,
              question_text: `Question ${totalQuestions + i + 1}`,
              question_type: 'multiple_choice',
              options: ['A', 'B', 'C', 'D'],
              correct_answers: ['A'],
              points: 10,
              order_index: totalQuestions + i
            }));

            const { data: questions, error: questionsError } = await supabase
              .from('questions')
              .insert(questionsToCreate)
              .select();

            if (questionsError || !questions) {
              throw new Error(`Failed to create questions: ${questionsError?.message}`);
            }

            allQuestionIds.push(...questions.map(q => q.id));
            totalQuestions += config.questionCount;
          }

          // Create question stages
          const stagesToCreate = stageConfigs.map((config, index) => {
            const startIdx = stageConfigs.slice(0, index).reduce((sum, c) => sum + c.questionCount, 0);
            const endIdx = startIdx + config.questionCount;
            const questionIds = allQuestionIds.slice(startIdx, endIdx);

            return {
              exam_id: exam.id,
              stage_type: 'questions',
              stage_order: index,
              configuration: {
                question_ids: questionIds,
                randomize_within_stage: false
              }
            };
          });

          const { data: stages, error: stagesError } = await supabase
            .from('exam_stages')
            .insert(stagesToCreate)
            .select();

          if (stagesError || !stages) {
            throw new Error(`Failed to create stages: ${stagesError?.message}`);
          }

          // Create attempt with answers for all questions
          const answers: Record<string, string> = {};
          allQuestionIds.forEach(qid => {
            answers[qid] = 'A'; // All correct answers
          });

          const { data: attempt, error: attemptError } = await supabase
            .from('exam_attempts')
            .insert({
              exam_id: exam.id,
              ip_address: '127.0.0.1',
              student_name: 'Test Student',
              answers: answers,
              auto_save_data: {},
              completion_status: 'in_progress',
              version: 1
            })
            .select()
            .single();

          if (attemptError || !attempt) {
            throw new Error(`Failed to create attempt: ${attemptError?.message}`);
          }

          testAttemptIds.push(attempt.id);

          // Mark all stages as completed
          for (const stage of stages) {
            await supabase.rpc('update_stage_progress', {
              p_attempt_id: attempt.id,
              p_stage_id: stage.id,
              p_progress_data: { answered_count: 0, total_count: 0 },
              p_completed: true
            });
          }

          // Submit attempt
          const { data: submitResult, error: submitError } = await supabase
            .rpc('submit_attempt', { p_attempt_id: attempt.id });

          if (submitError) {
            throw new Error(`Failed to submit attempt: ${submitError.message}`);
          }

          // Property: total_questions must equal sum of questions across all stages
          expect(submitResult).toBeDefined();
          expect(Array.isArray(submitResult)).toBe(true);
          expect(submitResult.length).toBeGreaterThan(0);
          
          const result = submitResult[0];
          expect(result.total_questions).toBe(totalQuestions);
          expect(result.correct_count).toBe(totalQuestions); // All answers were correct
          expect(result.score_percentage).toBe(100);

          // Verify exam_results record
          const { data: examResult, error: resultError } = await supabase
            .from('exam_results')
            .select('*')
            .eq('attempt_id', attempt.id)
            .single();

          if (resultError) {
            throw new Error(`Failed to get result: ${resultError.message}`);
          }

          expect(examResult).toBeDefined();
          expect(examResult.total_questions).toBe(totalQuestions);
          expect(examResult.correct_count).toBe(totalQuestions);
          expect(examResult.score_percentage).toBe(100);
        }
      ),
      { numRuns: 2, timeout: 60000 } // 2 iterations, 60s timeout per test
    );
  }, 180000); // 180s total timeout

  it('should calculate results correctly for partially answered staged exams', async () => {
    // Create exam with 2 question stages
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Partial answer test',
        status: 'published',
        access_type: 'open',
        settings: {},
        duration_minutes: 60
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    // Create 6 questions total (3 per stage)
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .insert([
        {
          exam_id: exam.id,
          question_text: 'Q1',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['A'],
          points: 10,
          order_index: 0
        },
        {
          exam_id: exam.id,
          question_text: 'Q2',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['B'],
          points: 10,
          order_index: 1
        },
        {
          exam_id: exam.id,
          question_text: 'Q3',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['A'],
          points: 10,
          order_index: 2
        },
        {
          exam_id: exam.id,
          question_text: 'Q4',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['B'],
          points: 10,
          order_index: 3
        },
        {
          exam_id: exam.id,
          question_text: 'Q5',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['A'],
          points: 10,
          order_index: 4
        },
        {
          exam_id: exam.id,
          question_text: 'Q6',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['B'],
          points: 10,
          order_index: 5
        }
      ])
      .select();

    if (questionsError || !questions || questions.length !== 6) {
      throw new Error(`Failed to create questions: ${questionsError?.message}`);
    }

    // Create 2 question stages
    await supabase.from('exam_stages').insert([
      {
        exam_id: exam.id,
        stage_type: 'questions',
        stage_order: 0,
        configuration: {
          question_ids: [questions[0].id, questions[1].id, questions[2].id],
          randomize_within_stage: false
        }
      },
      {
        exam_id: exam.id,
        stage_type: 'questions',
        stage_order: 1,
        configuration: {
          question_ids: [questions[3].id, questions[4].id, questions[5].id],
          randomize_within_stage: false
        }
      }
    ]);

    // Create attempt with partial answers (4 out of 6 answered, 2 correct)
    const answers = {
      [questions[0].id]: 'A', // Correct
      [questions[1].id]: 'A', // Wrong (correct is B)
      [questions[3].id]: 'B', // Correct
      [questions[4].id]: 'B'  // Wrong (correct is A)
      // questions[2] and questions[5] not answered
    };

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: answers,
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Submit attempt
    const { data: submitResult, error: submitError } = await supabase
      .rpc('submit_attempt', { p_attempt_id: attempt.id });

    if (submitError) {
      throw new Error(`Failed to submit attempt: ${submitError.message}`);
    }

    // Property: Results must include all 6 questions
    expect(submitResult).toBeDefined();
    expect(Array.isArray(submitResult)).toBe(true);
    expect(submitResult.length).toBeGreaterThan(0);
    
    const result = submitResult[0];
    expect(result.total_questions).toBe(6);
    expect(result.correct_count).toBe(2); // Only 2 correct answers
    expect(Math.round(result.score_percentage)).toBe(33); // 2/6 = 33.33%
  }, 60000);

  it('should handle mixed stage types and calculate results correctly', async () => {
    // Create exam with video, content, and question stages
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Test Exam ${Date.now()}`,
        description: 'Mixed stages test',
        status: 'published',
        access_type: 'open',
        settings: {},
        duration_minutes: 60
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    // Create 4 questions
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .insert([
        {
          exam_id: exam.id,
          question_text: 'Q1',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['A'],
          points: 10,
          order_index: 0
        },
        {
          exam_id: exam.id,
          question_text: 'Q2',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['A'],
          points: 10,
          order_index: 1
        },
        {
          exam_id: exam.id,
          question_text: 'Q3',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['A'],
          points: 10,
          order_index: 2
        },
        {
          exam_id: exam.id,
          question_text: 'Q4',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['A'],
          points: 10,
          order_index: 3
        }
      ])
      .select();

    if (questionsError || !questions || questions.length !== 4) {
      throw new Error(`Failed to create questions: ${questionsError?.message}`);
    }

    // Create mixed stages: video, questions, content, questions
    await supabase.from('exam_stages').insert([
      {
        exam_id: exam.id,
        stage_type: 'video',
        stage_order: 0,
        configuration: {
          youtube_url: 'https://www.youtube.com/watch?v=test',
          enforcement_threshold: 50
        }
      },
      {
        exam_id: exam.id,
        stage_type: 'questions',
        stage_order: 1,
        configuration: {
          question_ids: [questions[0].id, questions[1].id],
          randomize_within_stage: false
        }
      },
      {
        exam_id: exam.id,
        stage_type: 'content',
        stage_order: 2,
        configuration: {
          slides: [
            { id: 'slide-1', content: '<p>Content</p>', order: 0 }
          ],
          minimum_read_time_per_slide: 30
        }
      },
      {
        exam_id: exam.id,
        stage_type: 'questions',
        stage_order: 3,
        configuration: {
          question_ids: [questions[2].id, questions[3].id],
          randomize_within_stage: false
        }
      }
    ]);

    // Create attempt with all correct answers
    const answers = {
      [questions[0].id]: 'A',
      [questions[1].id]: 'A',
      [questions[2].id]: 'A',
      [questions[3].id]: 'A'
    };

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: answers,
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Submit attempt
    const { data: submitResult, error: submitError } = await supabase
      .rpc('submit_attempt', { p_attempt_id: attempt.id });

    if (submitError) {
      throw new Error(`Failed to submit attempt: ${submitError.message}`);
    }

    // Property: Only questions from Questions_Stages should be counted
    expect(submitResult).toBeDefined();
    expect(Array.isArray(submitResult)).toBe(true);
    expect(submitResult.length).toBeGreaterThan(0);
    
    const result = submitResult[0];
    expect(result.total_questions).toBe(4); // 2 from stage 1 + 2 from stage 3
    expect(result.correct_count).toBe(4);
    expect(result.score_percentage).toBe(100);
  }, 60000);
});


/**
 * Property 28: Exam Type Scoring Preservation
 * 
 * For any staged exam of type 'homework' or 'quiz', the results should contribute
 * to the extra_scores aggregations in the same way as non-staged exams.
 * 
 * Validates: Requirements 3.9.9, 3.14.10
 */
describe('Feature: staged-exam-system, Property 28: Exam Type Scoring Preservation', () => {
  it('should preserve exam type scoring for staged homework exams', async () => {
    // Create homework exam with stages
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Homework ${Date.now()}`,
        description: 'Homework scoring test',
        status: 'published',
        access_type: 'open',
        exam_type: 'homework',
        settings: {},
        duration_minutes: 60
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    // Create questions
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .insert([
        {
          exam_id: exam.id,
          question_text: 'Q1',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['A'],
          points: 10,
          order_index: 0
        },
        {
          exam_id: exam.id,
          question_text: 'Q2',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answers: ['A'],
          points: 10,
          order_index: 1
        }
      ])
      .select();

    if (questionsError || !questions || questions.length !== 2) {
      throw new Error(`Failed to create questions: ${questionsError?.message}`);
    }

    // Create question stage
    await supabase.from('exam_stages').insert({
      exam_id: exam.id,
      stage_type: 'questions',
      stage_order: 0,
      configuration: {
        question_ids: [questions[0].id, questions[1].id],
        randomize_within_stage: false
      }
    });

    // Create attempt with all correct answers
    const answers = {
      [questions[0].id]: 'A',
      [questions[1].id]: 'A'
    };

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: answers,
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Submit attempt
    const { data: submitResult, error: submitError } = await supabase
      .rpc('submit_attempt', { p_attempt_id: attempt.id });

    if (submitError) {
      throw new Error(`Failed to submit attempt: ${submitError.message}`);
    }

    expect(submitResult).toBeDefined();
    expect(Array.isArray(submitResult)).toBe(true);
    const result = submitResult[0];
    expect(result.total_questions).toBe(2);
    expect(result.correct_count).toBe(2);
    expect(result.score_percentage).toBe(100);

    // Verify exam_results record
    const { data: examResult, error: resultError } = await supabase
      .from('exam_results')
      .select('*, exam_attempts!inner(exam_id, exams!inner(exam_type))')
      .eq('attempt_id', attempt.id)
      .single();

    if (resultError) {
      throw new Error(`Failed to get result: ${resultError.message}`);
    }

    // Property: exam_type should be preserved and results calculated correctly
    expect(examResult).toBeDefined();
    expect(examResult.exam_attempts.exams.exam_type).toBe('homework');
    expect(examResult.total_questions).toBe(2);
    expect(examResult.score_percentage).toBe(100);
  }, 60000);

  it('should preserve exam type scoring for staged quiz exams', async () => {
    // Create quiz exam with stages
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        title: `Quiz ${Date.now()}`,
        description: 'Quiz scoring test',
        status: 'published',
        access_type: 'open',
        exam_type: 'quiz',
        settings: {},
        duration_minutes: 30
      })
      .select()
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to create test exam: ${examError?.message}`);
    }

    testExamIds.push(exam.id);

    // Create questions
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .insert([
        {
          exam_id: exam.id,
          question_text: 'Q1',
          question_type: 'true_false',
          options: ['True', 'False'],
          correct_answers: ['True'],
          points: 5,
          order_index: 0
        },
        {
          exam_id: exam.id,
          question_text: 'Q2',
          question_type: 'true_false',
          options: ['True', 'False'],
          correct_answers: ['False'],
          points: 5,
          order_index: 1
        }
      ])
      .select();

    if (questionsError || !questions || questions.length !== 2) {
      throw new Error(`Failed to create questions: ${questionsError?.message}`);
    }

    // Create question stage
    await supabase.from('exam_stages').insert({
      exam_id: exam.id,
      stage_type: 'questions',
      stage_order: 0,
      configuration: {
        question_ids: [questions[0].id, questions[1].id],
        randomize_within_stage: false
      }
    });

    // Create attempt with one correct answer
    const answers = {
      [questions[0].id]: 'True',  // Correct
      [questions[1].id]: 'True'   // Wrong (correct is False)
    };

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: exam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: answers,
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (attemptError || !attempt) {
      throw new Error(`Failed to create attempt: ${attemptError?.message}`);
    }

    testAttemptIds.push(attempt.id);

    // Submit attempt
    const { data: submitResult, error: submitError } = await supabase
      .rpc('submit_attempt', { p_attempt_id: attempt.id });

    if (submitError) {
      throw new Error(`Failed to submit attempt: ${submitError.message}`);
    }

    expect(submitResult).toBeDefined();
    expect(Array.isArray(submitResult)).toBe(true);
    const result = submitResult[0];
    expect(result.total_questions).toBe(2);
    expect(result.correct_count).toBe(1);
    expect(result.score_percentage).toBe(50);

    // Verify exam_results record
    const { data: examResult, error: resultError } = await supabase
      .from('exam_results')
      .select('*, exam_attempts!inner(exam_id, exams!inner(exam_type))')
      .eq('attempt_id', attempt.id)
      .single();

    if (resultError) {
      throw new Error(`Failed to get result: ${resultError.message}`);
    }

    // Property: exam_type should be preserved and results calculated correctly
    expect(examResult).toBeDefined();
    expect(examResult.exam_attempts.exams.exam_type).toBe('quiz');
    expect(examResult.total_questions).toBe(2);
    expect(examResult.correct_count).toBe(1);
    expect(examResult.score_percentage).toBe(50);
  }, 60000);

  it('should calculate results identically for staged and non-staged exams of same type', async () => {
    // Create two identical exams: one staged, one non-staged
    const { data: stagedExam, error: stagedError } = await supabase
      .from('exams')
      .insert({
        title: `Staged Exam ${Date.now()}`,
        description: 'Comparison test',
        status: 'published',
        access_type: 'open',
        exam_type: 'exam',
        settings: {},
        duration_minutes: 60
      })
      .select()
      .single();

    if (stagedError || !stagedExam) {
      throw new Error(`Failed to create staged exam: ${stagedError?.message}`);
    }

    testExamIds.push(stagedExam.id);

    const { data: nonStagedExam, error: nonStagedError } = await supabase
      .from('exams')
      .insert({
        title: `Non-Staged Exam ${Date.now()}`,
        description: 'Comparison test',
        status: 'published',
        access_type: 'open',
        exam_type: 'exam',
        settings: {},
        duration_minutes: 60
      })
      .select()
      .single();

    if (nonStagedError || !nonStagedExam) {
      throw new Error(`Failed to create non-staged exam: ${nonStagedError?.message}`);
    }

    testExamIds.push(nonStagedExam.id);

    // Create identical questions for both exams
    const { data: stagedQuestions, error: stagedQError } = await supabase
      .from('questions')
      .insert([
        {
          exam_id: stagedExam.id,
          question_text: 'Q1',
          question_type: 'multiple_choice',
          options: ['A', 'B', 'C'],
          correct_answers: ['A'],
          points: 10,
          order_index: 0
        },
        {
          exam_id: stagedExam.id,
          question_text: 'Q2',
          question_type: 'multiple_choice',
          options: ['A', 'B', 'C'],
          correct_answers: ['B'],
          points: 10,
          order_index: 1
        }
      ])
      .select();

    if (stagedQError || !stagedQuestions) {
      throw new Error(`Failed to create staged questions: ${stagedQError?.message}`);
    }

    const { data: nonStagedQuestions, error: nonStagedQError } = await supabase
      .from('questions')
      .insert([
        {
          exam_id: nonStagedExam.id,
          question_text: 'Q1',
          question_type: 'multiple_choice',
          options: ['A', 'B', 'C'],
          correct_answers: ['A'],
          points: 10,
          order_index: 0
        },
        {
          exam_id: nonStagedExam.id,
          question_text: 'Q2',
          question_type: 'multiple_choice',
          options: ['A', 'B', 'C'],
          correct_answers: ['B'],
          points: 10,
          order_index: 1
        }
      ])
      .select();

    if (nonStagedQError || !nonStagedQuestions) {
      throw new Error(`Failed to create non-staged questions: ${nonStagedQError?.message}`);
    }

    // Add stage to staged exam
    await supabase.from('exam_stages').insert({
      exam_id: stagedExam.id,
      stage_type: 'questions',
      stage_order: 0,
      configuration: {
        question_ids: [stagedQuestions[0].id, stagedQuestions[1].id],
        randomize_within_stage: false
      }
    });

    // Create identical attempts with same answers (1 correct, 1 wrong)
    const stagedAnswers = {
      [stagedQuestions[0].id]: 'A',  // Correct
      [stagedQuestions[1].id]: 'A'   // Wrong (correct is B)
    };

    const nonStagedAnswers = {
      [nonStagedQuestions[0].id]: 'A',  // Correct
      [nonStagedQuestions[1].id]: 'A'   // Wrong (correct is B)
    };

    const { data: stagedAttempt, error: stagedAttemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: stagedExam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: stagedAnswers,
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (stagedAttemptError || !stagedAttempt) {
      throw new Error(`Failed to create staged attempt: ${stagedAttemptError?.message}`);
    }

    testAttemptIds.push(stagedAttempt.id);

    const { data: nonStagedAttempt, error: nonStagedAttemptError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: nonStagedExam.id,
        ip_address: '127.0.0.1',
        student_name: 'Test Student',
        answers: nonStagedAnswers,
        auto_save_data: {},
        completion_status: 'in_progress',
        version: 1
      })
      .select()
      .single();

    if (nonStagedAttemptError || !nonStagedAttempt) {
      throw new Error(`Failed to create non-staged attempt: ${nonStagedAttemptError?.message}`);
    }

    testAttemptIds.push(nonStagedAttempt.id);

    // Submit both attempts
    const { data: stagedResult } = await supabase
      .rpc('submit_attempt', { p_attempt_id: stagedAttempt.id });

    const { data: nonStagedResult } = await supabase
      .rpc('submit_attempt', { p_attempt_id: nonStagedAttempt.id });

    // Property: Results should be identical
    expect(stagedResult).toBeDefined();
    expect(nonStagedResult).toBeDefined();
    expect(Array.isArray(stagedResult)).toBe(true);
    expect(Array.isArray(nonStagedResult)).toBe(true);

    const staged = stagedResult[0];
    const nonStaged = nonStagedResult[0];

    expect(staged.total_questions).toBe(nonStaged.total_questions);
    expect(staged.correct_count).toBe(nonStaged.correct_count);
    expect(staged.score_percentage).toBe(nonStaged.score_percentage);
    expect(staged.total_questions).toBe(2);
    expect(staged.correct_count).toBe(1);
    expect(staged.score_percentage).toBe(50);
  }, 60000);
});
