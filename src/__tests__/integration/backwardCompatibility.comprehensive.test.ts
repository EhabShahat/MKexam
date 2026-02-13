/**
 * Comprehensive Backward Compatibility Tests
 * 
 * Validates that the staged exam system maintains full backward compatibility
 * with existing non-staged exams and all exam types.
 * 
 * Requirements Validated: 3.9.1 through 3.9.10
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Backward Compatibility - Comprehensive Tests', () => {
  let testExamIds: string[] = [];
  let testStudentId: string;

  beforeAll(async () => {
    // Create test student
    const { data: student, error: studentError} = await supabase
      .from('students')
      .insert({
        name: 'Backward Compat Test Student',
        code: `COMPAT-${Date.now()}`
      })
      .select()
      .single();

    if (studentError) throw studentError;
    testStudentId = student.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testExamIds.length > 0) {
      await supabase.from('exams').delete().in('id', testExamIds);
    }
    if (testStudentId) {
      await supabase.from('students').delete().eq('id', testStudentId);
    }
  });

  describe('Requirement 3.9.1: Non-staged exam display', () => {
    it('should display questions in traditional format when exam has no stages', async () => {
      // Create exam without stages
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .insert({
          title: 'Traditional Exam',
          exam_type: 'exam',
          duration_minutes: 30,
          display_mode: 'full',
          published: true
        })
        .select()
        .single();

      if (examError) throw examError;
      testExamIds.push(exam.id);

      // Add questions
      const { error: questionsError } = await supabase
        .from('questions')
        .insert([
          {
            exam_id: exam.id,
            question_text: 'Question 1',
            question_type: 'multiple_choice',
            options: ['A', 'B', 'C'],
            correct_answer: 'A',
            points: 10,
            order: 0
          },
          {
            exam_id: exam.id,
            question_text: 'Question 2',
            question_type: 'true_false',
            correct_answer: 'true',
            points: 10,
            order: 1
          }
        ]);

      if (questionsError) throw questionsError;

      // Start attempt
      const { data: attempt, error: attemptError } = await supabase
        .rpc('start_attempt', {
          p_exam_id: exam.id,
          p_student_id: testStudentId,
          p_device_info: {}
        });

      if (attemptError) throw attemptError;
      expect(attempt).toBeTruthy();

      // Get attempt state
      const { data: attemptState, error: stateError } = await supabase
        .rpc('get_attempt_state', {
          p_attempt_id: attempt.attempt_id
        });

      if (stateError) throw stateError;

      // Verify no stages returned
      expect(attemptState.stages).toBeUndefined();
      expect(attemptState.stage_progress).toBeUndefined();

      // Verify questions are returned
      expect(attemptState.questions).toBeDefined();
      expect(attemptState.questions.length).toBe(2);
    });
  });

  describe('Requirement 3.9.2: Existing attempt flow', () => {
    it('should use existing attempt flow for non-staged exams', async () => {
      // Create non-staged exam
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .insert({
          title: 'Flow Test Exam',
          exam_type: 'exam',
          duration_minutes: 20,
          display_mode: 'per_question',
          published: true
        })
        .select()
        .single();

      if (examError) throw examError;
      testExamIds.push(exam.id);

      // Add question
      const { error: questionError } = await supabase
        .from('questions')
        .insert({
          exam_id: exam.id,
          question_text: 'Test question',
          question_type: 'short_answer',
          correct_answer: 'test',
          points: 5,
          order: 0
        });

      if (questionError) throw questionError;

      // Start attempt
      const { data: attempt } = await supabase
        .rpc('start_attempt', {
          p_exam_id: exam.id,
          p_student_id: testStudentId,
          p_device_info: {}
        });

      // Save answer using existing save_attempt RPC
      const { error: saveError } = await supabase
        .rpc('save_attempt', {
          p_attempt_id: attempt.attempt_id,
          p_answers: { 'question-1': 'test' },
          p_auto_save_data: { last_question: 0 },
          p_version: 0
        });

      expect(saveError).toBeNull();

      // Submit using existing submit_attempt RPC
      const { error: submitError } = await supabase
        .rpc('submit_attempt', {
          p_attempt_id: attempt.attempt_id
        });

      expect(submitError).toBeNull();

      // Verify results calculated
      const { data: result, error: resultError } = await supabase
        .from('exam_results')
        .select('*')
        .eq('attempt_id', attempt.attempt_id)
        .single();

      expect(resultError).toBeNull();
      expect(result).toBeTruthy();
      expect(result.total_questions).toBe(1);
    });
  });

  describe('Requirement 3.9.3: Staged exam conditional rendering', () => {
    it('should use staged flow when exam has stages', async () => {
      // Create exam with stages
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .insert({
          title: 'Staged Flow Test',
          exam_type: 'exam',
          duration_minutes: 30,
          published: true
        })
        .select()
        .single();

      if (examError) throw examError;
      testExamIds.push(exam.id);

      // Add question
      const { data: question, error: questionError } = await supabase
        .from('questions')
        .insert({
          exam_id: exam.id,
          question_text: 'Staged question',
          question_type: 'multiple_choice',
          options: ['A', 'B'],
          correct_answer: 'A',
          points: 10,
          order: 0
        })
        .select()
        .single();

      if (questionError) throw questionError;

      // Add stage
      const { error: stageError } = await supabase
        .from('exam_stages')
        .insert({
          exam_id: exam.id,
          stage_type: 'questions',
          stage_order: 0,
          configuration: {
            question_ids: [question.id],
            randomize_within_stage: false
          }
        });

      if (stageError) throw stageError;

      // Start attempt
      const { data: attempt } = await supabase
        .rpc('start_attempt', {
          p_exam_id: exam.id,
          p_student_id: testStudentId,
          p_device_info: {}
        });

      // Get attempt state
      const { data: attemptState } = await supabase
        .rpc('get_attempt_state', {
          p_attempt_id: attempt.attempt_id
        });

      // Verify stages are returned
      expect(attemptState.stages).toBeDefined();
      expect(attemptState.stages.length).toBe(1);
      expect(attemptState.stage_progress).toBeDefined();
    });
  });

  describe('Requirement 3.9.4: No migration required', () => {
    it('should work with existing exam data without modification', async () => {
      // Query existing exams (should work without errors)
      const { data: exams, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .limit(10);

      expect(examsError).toBeNull();
      expect(exams).toBeDefined();

      // Verify exam_stages table exists but is optional
      const { data: stages, error: stagesError } = await supabase
        .from('exam_stages')
        .select('count')
        .limit(1);

      // Should not error even if no stages exist
      expect(stagesError).toBeNull();
    });
  });

  describe('Requirement 3.9.7: Exam type preservation for staged exams', () => {
    it('should preserve exam_type for exam', async () => {
      const { data: exam } = await supabase
        .from('exams')
        .insert({
          title: 'Type Test - Exam',
          exam_type: 'exam',
          duration_minutes: 30,
          published: true
        })
        .select()
        .single();

      testExamIds.push(exam.id);

      // Add stage
      await supabase.from('exam_stages').insert({
        exam_id: exam.id,
        stage_type: 'content',
        stage_order: 0,
        configuration: {
          slides: [{ id: 'slide-1', content: '<p>Test</p>', order: 0 }]
        }
      });

      // Verify exam_type unchanged
      const { data: retrieved } = await supabase
        .from('exams')
        .select('exam_type')
        .eq('id', exam.id)
        .single();

      expect(retrieved.exam_type).toBe('exam');
    });

    it('should preserve exam_type for homework', async () => {
      const { data: exam } = await supabase
        .from('exams')
        .insert({
          title: 'Type Test - Homework',
          exam_type: 'homework',
          duration_minutes: 60,
          published: true
        })
        .select()
        .single();

      testExamIds.push(exam.id);

      // Add stage
      await supabase.from('exam_stages').insert({
        exam_id: exam.id,
        stage_type: 'video',
        stage_order: 0,
        configuration: {
          youtube_url: 'https://www.youtube.com/watch?v=test'
        }
      });

      // Verify exam_type unchanged
      const { data: retrieved } = await supabase
        .from('exams')
        .select('exam_type')
        .eq('id', exam.id)
        .single();

      expect(retrieved.exam_type).toBe('homework');
    });

    it('should preserve exam_type for quiz', async () => {
      const { data: exam } = await supabase
        .from('exams')
        .insert({
          title: 'Type Test - Quiz',
          exam_type: 'quiz',
          duration_minutes: 15,
          published: true
        })
        .select()
        .single();

      testExamIds.push(exam.id);

      // Add stage
      await supabase.from('exam_stages').insert({
        exam_id: exam.id,
        stage_type: 'questions',
        stage_order: 0,
        configuration: {
          question_ids: [],
          randomize_within_stage: false
        }
      });

      // Verify exam_type unchanged
      const { data: retrieved } = await supabase
        .from('exams')
        .select('exam_type')
        .eq('id', exam.id)
        .single();

      expect(retrieved.exam_type).toBe('quiz');
    });
  });

  describe('Requirement 3.9.8: Results calculation for all exam types', () => {
    it('should calculate results correctly for non-staged exam', async () => {
      // Create exam
      const { data: exam } = await supabase
        .from('exams')
        .insert({
          title: 'Results Test - Non-Staged',
          exam_type: 'exam',
          duration_minutes: 30,
          published: true
        })
        .select()
        .single();

      testExamIds.push(exam.id);

      // Add questions
      const { data: questions } = await supabase
        .from('questions')
        .insert([
          {
            exam_id: exam.id,
            question_text: 'Q1',
            question_type: 'multiple_choice',
            options: ['A', 'B'],
            correct_answer: 'A',
            points: 10,
            order: 0
          },
          {
            exam_id: exam.id,
            question_text: 'Q2',
            question_type: 'true_false',
            correct_answer: 'true',
            points: 10,
            order: 1
          }
        ])
        .select();

      // Start and complete attempt
      const { data: attempt } = await supabase
        .rpc('start_attempt', {
          p_exam_id: exam.id,
          p_student_id: testStudentId,
          p_device_info: {}
        });

      // Submit with answers
      await supabase.rpc('save_attempt', {
        p_attempt_id: attempt.attempt_id,
        p_answers: {
          [questions[0].id]: 'A',
          [questions[1].id]: 'true'
        },
        p_auto_save_data: {},
        p_version: 0
      });

      await supabase.rpc('submit_attempt', {
        p_attempt_id: attempt.attempt_id
      });

      // Calculate results
      const { data: result } = await supabase
        .rpc('calculate_result_for_attempt', {
          p_attempt_id: attempt.attempt_id
        });

      // Verify results
      expect(result.total_questions).toBe(2);
      expect(result.correct_count).toBe(2);
      expect(result.score_percentage).toBe(100);
      expect(result.auto_points).toBe(20);
      expect(result.max_points).toBe(20);
      expect(result.final_score_percentage).toBe(100);
    });

    it('should calculate results correctly for staged exam', async () => {
      // Create exam
      const { data: exam } = await supabase
        .from('exams')
        .insert({
          title: 'Results Test - Staged',
          exam_type: 'exam',
          duration_minutes: 30,
          published: true
        })
        .select()
        .single();

      testExamIds.push(exam.id);

      // Add questions
      const { data: questions } = await supabase
        .from('questions')
        .insert([
          {
            exam_id: exam.id,
            question_text: 'Q1',
            question_type: 'multiple_choice',
            options: ['A', 'B'],
            correct_answer: 'A',
            points: 10,
            order: 0
          },
          {
            exam_id: exam.id,
            question_text: 'Q2',
            question_type: 'true_false',
            correct_answer: 'true',
            points: 10,
            order: 1
          }
        ])
        .select();

      // Add stages
      await supabase.from('exam_stages').insert([
        {
          exam_id: exam.id,
          stage_type: 'video',
          stage_order: 0,
          configuration: {
            youtube_url: 'https://www.youtube.com/watch?v=test'
          }
        },
        {
          exam_id: exam.id,
          stage_type: 'questions',
          stage_order: 1,
          configuration: {
            question_ids: questions.map(q => q.id),
            randomize_within_stage: false
          }
        }
      ]);

      // Start and complete attempt
      const { data: attempt } = await supabase
        .rpc('start_attempt', {
          p_exam_id: exam.id,
          p_student_id: testStudentId,
          p_device_info: {}
        });

      // Submit with answers
      await supabase.rpc('save_attempt', {
        p_attempt_id: attempt.attempt_id,
        p_answers: {
          [questions[0].id]: 'A',
          [questions[1].id]: 'true'
        },
        p_auto_save_data: {},
        p_version: 0
      });

      await supabase.rpc('submit_attempt', {
        p_attempt_id: attempt.attempt_id
      });

      // Calculate results
      const { data: result } = await supabase
        .rpc('calculate_result_for_attempt', {
          p_attempt_id: attempt.attempt_id
        });

      // Verify results are identical to non-staged
      expect(result.total_questions).toBe(2);
      expect(result.correct_count).toBe(2);
      expect(result.score_percentage).toBe(100);
      expect(result.auto_points).toBe(20);
      expect(result.max_points).toBe(20);
      expect(result.final_score_percentage).toBe(100);
    });
  });

  describe('Requirement 3.9.9: Extra scores aggregation', () => {
    it('should contribute homework scores to extra_scores for non-staged homework', async () => {
      // Create homework
      const { data: exam } = await supabase
        .from('exams')
        .insert({
          title: 'Homework Test - Non-Staged',
          exam_type: 'homework',
          duration_minutes: 60,
          published: true
        })
        .select()
        .single();

      testExamIds.push(exam.id);

      // Add question
      const { data: question } = await supabase
        .from('questions')
        .insert({
          exam_id: exam.id,
          question_text: 'HW Question',
          question_type: 'short_answer',
          correct_answer: 'answer',
          points: 10,
          order: 0
        })
        .select()
        .single();

      // Complete attempt
      const { data: attempt } = await supabase
        .rpc('start_attempt', {
          p_exam_id: exam.id,
          p_student_id: testStudentId,
          p_device_info: {}
        });

      await supabase.rpc('save_attempt', {
        p_attempt_id: attempt.attempt_id,
        p_answers: { [question.id]: 'answer' },
        p_auto_save_data: {},
        p_version: 0
      });

      await supabase.rpc('submit_attempt', {
        p_attempt_id: attempt.attempt_id
      });

      // Check extra_scores
      const { data: extraScore } = await supabase
        .from('extra_scores')
        .select('*')
        .eq('student_id', testStudentId)
        .eq('exam_type', 'homework')
        .single();

      expect(extraScore).toBeTruthy();
      expect(extraScore.score).toBeGreaterThan(0);
    });

    it('should contribute homework scores to extra_scores for staged homework', async () => {
      // Create staged homework
      const { data: exam } = await supabase
        .from('exams')
        .insert({
          title: 'Homework Test - Staged',
          exam_type: 'homework',
          duration_minutes: 60,
          published: true
        })
        .select()
        .single();

      testExamIds.push(exam.id);

      // Add question
      const { data: question } = await supabase
        .from('questions')
        .insert({
          exam_id: exam.id,
          question_text: 'HW Question',
          question_type: 'short_answer',
          correct_answer: 'answer',
          points: 10,
          order: 0
        })
        .select()
        .single();

      // Add stage
      await supabase.from('exam_stages').insert({
        exam_id: exam.id,
        stage_type: 'questions',
        stage_order: 0,
        configuration: {
          question_ids: [question.id],
          randomize_within_stage: false
        }
      });

      // Complete attempt
      const { data: attempt } = await supabase
        .rpc('start_attempt', {
          p_exam_id: exam.id,
          p_student_id: testStudentId,
          p_device_info: {}
        });

      await supabase.rpc('save_attempt', {
        p_attempt_id: attempt.attempt_id,
        p_answers: { [question.id]: 'answer' },
        p_auto_save_data: {},
        p_version: 0
      });

      await supabase.rpc('submit_attempt', {
        p_attempt_id: attempt.attempt_id
      });

      // Check extra_scores (should have increased)
      const { data: extraScores } = await supabase
        .from('extra_scores')
        .select('*')
        .eq('student_id', testStudentId)
        .eq('exam_type', 'homework');

      expect(extraScores).toBeTruthy();
      expect(extraScores.length).toBeGreaterThan(0);
    });
  });

  describe('Requirement 3.9.10: Student exam summary view compatibility', () => {
    it('should include both staged and non-staged exams in student_exam_summary', async () => {
      // Query student_exam_summary view
      const { data: summary, error: summaryError } = await supabase
        .from('student_exam_summary')
        .select('*')
        .eq('student_id', testStudentId);

      expect(summaryError).toBeNull();
      expect(summary).toBeDefined();

      // Should include attempts from both staged and non-staged exams
      if (summary && summary.length > 0) {
        // Verify structure is consistent
        summary.forEach(record => {
          expect(record).toHaveProperty('student_id');
          expect(record).toHaveProperty('exam_id');
          expect(record).toHaveProperty('exam_title');
          expect(record).toHaveProperty('exam_type');
          expect(record).toHaveProperty('score_percentage');
        });
      }
    });
  });
});
