/**
 * Performance Tests for Staged Exam System
 * 
 * Validates performance requirements for staged exams including:
 * - get_attempt_state performance with stages (< 100ms target)
 * - Auto-save performance with stage progress
 * - Page load time for staged exams
 * 
 * Requirements Validated: 4.1.1, 4.1.2, 4.1.3
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Staged Exam System - Performance Tests', () => {
  let testExamId: string;
  let testStudentId: string;
  let testAttemptId: string;
  let stageIds: string[] = [];

  beforeAll(async () => {
    // Create test student
    const { data: student } = await supabase
      .from('students')
      .insert({
        name: 'Performance Test Student',
        code: `PERF-${Date.now()}`
      })
      .select()
      .single();

    testStudentId = student.id;

    // Create exam with multiple stages
    const { data: exam } = await supabase
      .from('exams')
      .insert({
        title: 'Performance Test Exam',
        exam_type: 'exam',
        duration_minutes: 30,
        published: true
      })
      .select()
      .single();

    testExamId = exam.id;

    // Add questions
    const { data: questions } = await supabase
      .from('questions')
      .insert([
        {
          exam_id: testExamId,
          question_text: 'Q1',
          question_type: 'multiple_choice',
          options: ['A', 'B', 'C', 'D'],
          correct_answer: 'A',
          points: 10,
          order: 0
        },
        {
          exam_id: testExamId,
          question_text: 'Q2',
          question_type: 'true_false',
          correct_answer: 'true',
          points: 10,
          order: 1
        },
        {
          exam_id: testExamId,
          question_text: 'Q3',
          question_type: 'short_answer',
          correct_answer: 'answer',
          points: 10,
          order: 2
        }
      ])
      .select();

    // Add multiple stages (5 stages to test performance)
    const { data: stages } = await supabase
      .from('exam_stages')
      .insert([
        {
          exam_id: testExamId,
          stage_type: 'video',
          stage_order: 0,
          configuration: {
            youtube_url: 'https://www.youtube.com/watch?v=test1',
            enforcement_threshold: 80
          }
        },
        {
          exam_id: testExamId,
          stage_type: 'content',
          stage_order: 1,
          configuration: {
            slides: [
              { id: 'slide-1', content: '<h2>Slide 1</h2><p>Content</p>', order: 0 },
              { id: 'slide-2', content: '<h2>Slide 2</h2><p>Content</p>', order: 1 },
              { id: 'slide-3', content: '<h2>Slide 3</h2><p>Content</p>', order: 2 }
            ],
            minimum_read_time_per_slide: 10
          }
        },
        {
          exam_id: testExamId,
          stage_type: 'questions',
          stage_order: 2,
          configuration: {
            question_ids: [questions[0].id],
            randomize_within_stage: false
          }
        },
        {
          exam_id: testExamId,
          stage_type: 'content',
          stage_order: 3,
          configuration: {
            slides: [
              { id: 'slide-4', content: '<h2>Slide 4</h2><p>More content</p>', order: 0 }
            ]
          }
        },
        {
          exam_id: testExamId,
          stage_type: 'questions',
          stage_order: 4,
          configuration: {
            question_ids: [questions[1].id, questions[2].id],
            randomize_within_stage: false
          }
        }
      ])
      .select();

    stageIds = stages.map(s => s.id);

    // Start attempt
    const { data: attempt } = await supabase
      .rpc('start_attempt', {
        p_exam_id: testExamId,
        p_student_id: testStudentId,
        p_device_info: {}
      });

    testAttemptId = attempt.attempt_id;
  });

  afterAll(async () => {
    // Cleanup
    if (testExamId) {
      await supabase.from('exams').delete().eq('id', testExamId);
    }
    if (testStudentId) {
      await supabase.from('students').delete().eq('id', testStudentId);
    }
  });

  describe('Requirement 4.1.1: get_attempt_state performance with stages', () => {
    it('should load attempt state with stages in < 100ms', async () => {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        const { data, error } = await supabase
          .rpc('get_attempt_state', {
            p_attempt_id: testAttemptId
          });

        const endTime = performance.now();
        const duration = endTime - startTime;

        times.push(duration);

        expect(error).toBeNull();
        expect(data).toBeTruthy();
        expect(data.stages).toBeDefined();
        expect(data.stages.length).toBe(5);
      }

      // Calculate average time
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(`get_attempt_state performance:`);
      console.log(`  Average: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxTime.toFixed(2)}ms`);

      // Target: < 100ms average
      expect(avgTime).toBeLessThan(100);

      // Max should be reasonable (< 200ms)
      expect(maxTime).toBeLessThan(200);
    });

    it('should return stages ordered by stage_order efficiently', async () => {
      const startTime = performance.now();

      const { data } = await supabase
        .rpc('get_attempt_state', {
          p_attempt_id: testAttemptId
        });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify ordering
      expect(data.stages[0].stage_order).toBe(0);
      expect(data.stages[1].stage_order).toBe(1);
      expect(data.stages[2].stage_order).toBe(2);
      expect(data.stages[3].stage_order).toBe(3);
      expect(data.stages[4].stage_order).toBe(4);

      // Should be fast even with ordering
      expect(duration).toBeLessThan(100);
    });

    it('should include stage progress without significant overhead', async () => {
      // Add some stage progress
      await supabase
        .from('attempt_stage_progress')
        .insert([
          {
            attempt_id: testAttemptId,
            stage_id: stageIds[0],
            started_at: new Date().toISOString(),
            progress_data: {
              watch_percentage: 50,
              total_watch_time: 60
            }
          },
          {
            attempt_id: testAttemptId,
            stage_id: stageIds[1],
            started_at: new Date().toISOString(),
            progress_data: {
              current_slide_index: 1,
              slide_times: { 'slide-1': 15 }
            }
          }
        ]);

      const startTime = performance.now();

      const { data } = await supabase
        .rpc('get_attempt_state', {
          p_attempt_id: testAttemptId
        });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify progress is included
      expect(data.stage_progress).toBeDefined();
      expect(data.stage_progress.length).toBeGreaterThan(0);

      // Should still be fast
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Requirement 4.1.2: Auto-save performance with stage progress', () => {
    it('should save stage progress quickly (< 50ms)', async () => {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const progressData = {
          watch_percentage: 50 + i,
          total_watch_time: 60 + i * 5,
          last_position: 70 + i * 5
        };

        const startTime = performance.now();

        const { error } = await supabase
          .from('attempt_stage_progress')
          .upsert({
            attempt_id: testAttemptId,
            stage_id: stageIds[0],
            progress_data: progressData,
            updated_at: new Date().toISOString()
          });

        const endTime = performance.now();
        const duration = endTime - startTime;

        times.push(duration);

        expect(error).toBeNull();
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      console.log(`Stage progress save performance:`);
      console.log(`  Average: ${avgTime.toFixed(2)}ms`);

      // Target: < 50ms average
      expect(avgTime).toBeLessThan(50);
    });

    it('should handle concurrent stage progress updates efficiently', async () => {
      const startTime = performance.now();

      // Simulate concurrent updates to multiple stages
      const updates = stageIds.slice(0, 3).map((stageId, index) =>
        supabase
          .from('attempt_stage_progress')
          .upsert({
            attempt_id: testAttemptId,
            stage_id: stageId,
            progress_data: {
              test_data: `concurrent-${index}`
            },
            updated_at: new Date().toISOString()
          })
      );

      await Promise.all(updates);

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Concurrent updates (3 stages): ${duration.toFixed(2)}ms`);

      // Should complete in reasonable time (< 150ms for 3 concurrent updates)
      expect(duration).toBeLessThan(150);
    });

    it('should save answers and stage progress together efficiently', async () => {
      const startTime = performance.now();

      // Save answers
      await supabase.rpc('save_attempt', {
        p_attempt_id: testAttemptId,
        p_answers: {
          'q1': 'A',
          'q2': 'true',
          'q3': 'answer'
        },
        p_auto_save_data: {
          current_stage: 2,
          timestamp: Date.now()
        },
        p_version: 0
      });

      // Save stage progress
      await supabase
        .from('attempt_stage_progress')
        .upsert({
          attempt_id: testAttemptId,
          stage_id: stageIds[2],
          progress_data: {
            answered_count: 1,
            total_count: 1
          },
          updated_at: new Date().toISOString()
        });

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Combined save (answers + progress): ${duration.toFixed(2)}ms`);

      // Target: < 100ms for combined save
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Requirement 4.1.3: Page load time for staged exams', () => {
    it('should load initial exam data quickly', async () => {
      const startTime = performance.now();

      // Simulate initial page load: get exam + attempt state
      const [examResult, attemptResult] = await Promise.all([
        supabase
          .from('exams')
          .select('*')
          .eq('id', testExamId)
          .single(),
        supabase
          .rpc('get_attempt_state', {
            p_attempt_id: testAttemptId
          })
      ]);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(examResult.error).toBeNull();
      expect(attemptResult.error).toBeNull();

      console.log(`Initial page load time: ${duration.toFixed(2)}ms`);

      // Target: < 200ms for initial load
      expect(duration).toBeLessThan(200);
    });

    it('should load questions for Questions_Stage efficiently', async () => {
      // Get stage configuration
      const { data: stage } = await supabase
        .from('exam_stages')
        .select('*')
        .eq('id', stageIds[2])
        .single();

      const questionIds = stage.configuration.question_ids;

      const startTime = performance.now();

      const { data: questions, error } = await supabase
        .from('questions')
        .select('*')
        .in('id', questionIds);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(error).toBeNull();
      expect(questions.length).toBeGreaterThan(0);

      console.log(`Questions load time: ${duration.toFixed(2)}ms`);

      // Should be very fast (< 50ms)
      expect(duration).toBeLessThan(50);
    });

    it('should handle stage transitions without lag', async () => {
      const startTime = performance.now();

      // Simulate stage transition: mark current complete, load next
      await supabase
        .from('attempt_stage_progress')
        .upsert({
          attempt_id: testAttemptId,
          stage_id: stageIds[0],
          completed_at: new Date().toISOString(),
          progress_data: {
            watch_percentage: 100,
            total_watch_time: 180
          },
          updated_at: new Date().toISOString()
        });

      // Load next stage data
      const { data: nextStage } = await supabase
        .from('exam_stages')
        .select('*')
        .eq('id', stageIds[1])
        .single();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(nextStage).toBeTruthy();

      console.log(`Stage transition time: ${duration.toFixed(2)}ms`);

      // Target: < 100ms for smooth transitions
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Performance comparison: Staged vs Non-Staged', () => {
    let nonStagedExamId: string;
    let nonStagedAttemptId: string;

    beforeAll(async () => {
      // Create non-staged exam with same questions
      const { data: exam } = await supabase
        .from('exams')
        .insert({
          title: 'Non-Staged Performance Test',
          exam_type: 'exam',
          duration_minutes: 30,
          published: true
        })
        .select()
        .single();

      nonStagedExamId = exam.id;

      // Add same questions
      await supabase
        .from('questions')
        .insert([
          {
            exam_id: nonStagedExamId,
            question_text: 'Q1',
            question_type: 'multiple_choice',
            options: ['A', 'B', 'C', 'D'],
            correct_answer: 'A',
            points: 10,
            order: 0
          },
          {
            exam_id: nonStagedExamId,
            question_text: 'Q2',
            question_type: 'true_false',
            correct_answer: 'true',
            points: 10,
            order: 1
          },
          {
            exam_id: nonStagedExamId,
            question_text: 'Q3',
            question_type: 'short_answer',
            correct_answer: 'answer',
            points: 10,
            order: 2
          }
        ]);

      // Start attempt
      const { data: attempt } = await supabase
        .rpc('start_attempt', {
          p_exam_id: nonStagedExamId,
          p_student_id: testStudentId,
          p_device_info: {}
        });

      nonStagedAttemptId = attempt.attempt_id;
    });

    afterAll(async () => {
      if (nonStagedExamId) {
        await supabase.from('exams').delete().eq('id', nonStagedExamId);
      }
    });

    it('should have comparable performance to non-staged exams', async () => {
      // Test staged exam
      const stagedStart = performance.now();
      await supabase.rpc('get_attempt_state', {
        p_attempt_id: testAttemptId
      });
      const stagedDuration = performance.now() - stagedStart;

      // Test non-staged exam
      const nonStagedStart = performance.now();
      await supabase.rpc('get_attempt_state', {
        p_attempt_id: nonStagedAttemptId
      });
      const nonStagedDuration = performance.now() - nonStagedStart;

      console.log(`Performance comparison:`);
      console.log(`  Staged: ${stagedDuration.toFixed(2)}ms`);
      console.log(`  Non-staged: ${nonStagedDuration.toFixed(2)}ms`);
      console.log(`  Overhead: ${(stagedDuration - nonStagedDuration).toFixed(2)}ms`);

      // Staged should not be more than 2x slower than non-staged
      expect(stagedDuration).toBeLessThan(nonStagedDuration * 2);

      // Both should be fast
      expect(stagedDuration).toBeLessThan(150);
      expect(nonStagedDuration).toBeLessThan(100);
    });
  });

  describe('Scalability tests', () => {
    it('should handle exam with many stages efficiently', async () => {
      // Create exam with 10 stages
      const { data: manyStagesExam } = await supabase
        .from('exams')
        .insert({
          title: 'Many Stages Test',
          exam_type: 'exam',
          duration_minutes: 60,
          published: true
        })
        .select()
        .single();

      // Add 10 stages
      const stages = Array.from({ length: 10 }, (_, i) => ({
        exam_id: manyStagesExam.id,
        stage_type: i % 2 === 0 ? 'video' : 'content',
        stage_order: i,
        configuration: i % 2 === 0
          ? { youtube_url: `https://www.youtube.com/watch?v=test${i}` }
          : { slides: [{ id: `slide-${i}`, content: `<p>Content ${i}</p>`, order: 0 }] }
      }));

      await supabase.from('exam_stages').insert(stages);

      // Start attempt
      const { data: attempt } = await supabase
        .rpc('start_attempt', {
          p_exam_id: manyStagesExam.id,
          p_student_id: testStudentId,
          p_device_info: {}
        });

      // Test performance
      const startTime = performance.now();

      const { data } = await supabase
        .rpc('get_attempt_state', {
          p_attempt_id: attempt.attempt_id
        });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(data.stages.length).toBe(10);

      console.log(`Load time with 10 stages: ${duration.toFixed(2)}ms`);

      // Should still be reasonable (< 150ms)
      expect(duration).toBeLessThan(150);

      // Cleanup
      await supabase.from('exams').delete().eq('id', manyStagesExam.id);
    });
  });
});
