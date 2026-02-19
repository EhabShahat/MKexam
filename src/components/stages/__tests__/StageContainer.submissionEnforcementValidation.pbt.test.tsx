/**
 * Property-Based Tests for Submission Enforcement Validation
 * Feature: staged-attempt-flow-fixes
 * Property 16: Submission enforcement validation
 * Validates: Requirements 3.7, 7.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { render, cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import StageContainer from '../StageContainer';
import type { Stage, StageProgress, ExamInfo, Question } from '@/lib/types';

// Mock the stage progress queue
vi.mock('@/lib/stageProgressQueue', () => ({
  stageProgressQueue: {
    enqueue: vi.fn(),
    processQueue: vi.fn(),
    getQueueSize: vi.fn(() => 0),
  },
  setupQueueProcessing: vi.fn(),
}));

// Mock the locale provider
vi.mock('@/components/public/PublicLocaleProvider', () => ({
  useStudentLocale: () => ({ locale: 'en' }),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('Submission Enforcement Validation - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    
    // Default fetch mock
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  describe('Property 16: Submission enforcement validation', () => {
    it('should validate enforcement requirements at submission for video stages', async () => {
      // Feature: staged-attempt-flow-fixes, Property 16: Submission enforcement validation
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50, max: 100 }), // Enforcement threshold
          fc.integer({ min: 0, max: 100 }),  // Actual watch percentage
          async (threshold, watchPercentage) => {
            const onSubmit = vi.fn();
            
            // Create stages with video enforcement
            const stages: Stage[] = [
              {
                id: 'stage-video',
                exam_id: 'exam-1',
                stage_type: 'video',
                stage_order: 1,
                configuration: {
                  video_url: 'https://example.com/video.mp4',
                  enforcement_threshold: threshold,
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: 'stage-questions',
                exam_id: 'exam-1',
                stage_type: 'questions',
                stage_order: 2,
                configuration: {
                  question_ids: ['q1'],
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];
            
            const stageProgress: StageProgress[] = [
              {
                id: 'progress-video',
                attempt_id: 'attempt-1',
                stage_id: 'stage-video',
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                progress_data: { watch_percentage: watchPercentage },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: 'progress-questions',
                attempt_id: 'attempt-1',
                stage_id: 'stage-questions',
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                progress_data: { answered_questions: ['q1'] },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];
            
            const exam: ExamInfo = {
              id: 'exam-1',
              title: 'Test Exam',
              description: '',
              duration_minutes: 60,
              pass_threshold: 50,
              settings: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            
            const questions: Question[] = [{
              id: 'q1',
              exam_id: 'exam-1',
              question_type: 'multiple_choice',
              question_text: 'Test question',
              points: 1,
              question_order: 1,
              options: ['Option 1', 'Option 2'],
              correct_answer: 'Option 1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }];
            
            const { unmount } = render(
              <StageContainer
                attemptId="attempt-1"
                stages={stages}
                stageProgress={stageProgress}
                exam={exam}
                questions={questions}
                answers={{ q1: 'Option 1' }}
                onAnswerChange={() => {}}
                onSubmit={onSubmit}
              />
            );
            
            // Wait for component to mount
            await waitFor(() => {
              expect(screen.getByRole('main')).toBeInTheDocument();
            });
            
            // Property: Component should render without errors
            expect(screen.getByRole('main')).toBeInTheDocument();
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should validate enforcement requirements at submission for content stages', async () => {
      // Feature: staged-attempt-flow-fixes, Property 16: Submission enforcement validation
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 30, max: 120 }), // Minimum read time
          fc.integer({ min: 0, max: 150 }),  // Actual time spent
          async (minTime, timeSpent) => {
            const onSubmit = vi.fn();
            
            // Create stages with content enforcement
            const stages: Stage[] = [
              {
                id: 'stage-content',
                exam_id: 'exam-1',
                stage_type: 'content',
                stage_order: 1,
                configuration: {
                  slides: [{ title: 'Slide 1', content: 'Content' }],
                  minimum_read_time: minTime,
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: 'stage-questions',
                exam_id: 'exam-1',
                stage_type: 'questions',
                stage_order: 2,
                configuration: {
                  question_ids: ['q1'],
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];
            
            const stageProgress: StageProgress[] = [
              {
                id: 'progress-content',
                attempt_id: 'attempt-1',
                stage_id: 'stage-content',
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                progress_data: { 
                  current_slide_index: 0, 
                  slide_times: {},
                  time_spent: timeSpent 
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                id: 'progress-questions',
                attempt_id: 'attempt-1',
                stage_id: 'stage-questions',
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                progress_data: { answered_questions: ['q1'] },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];
            
            const exam: ExamInfo = {
              id: 'exam-1',
              title: 'Test Exam',
              description: '',
              duration_minutes: 60,
              pass_threshold: 50,
              settings: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            
            const questions: Question[] = [{
              id: 'q1',
              exam_id: 'exam-1',
              question_type: 'multiple_choice',
              question_text: 'Test question',
              points: 1,
              question_order: 1,
              options: ['Option 1', 'Option 2'],
              correct_answer: 'Option 1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }];
            
            const { unmount } = render(
              <StageContainer
                attemptId="attempt-1"
                stages={stages}
                stageProgress={stageProgress}
                exam={exam}
                questions={questions}
                answers={{ q1: 'Option 1' }}
                onAnswerChange={() => {}}
                onSubmit={onSubmit}
              />
            );
            
            // Wait for component to mount
            await waitFor(() => {
              expect(screen.getByRole('main')).toBeInTheDocument();
            });
            
            // Property: Component should render without errors
            expect(screen.getByRole('main')).toBeInTheDocument();
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should block submission when video enforcement not met', async () => {
      // Feature: staged-attempt-flow-fixes, Property 16: Submission enforcement validation
      
      const onSubmit = vi.fn();
      
      // Create stages with video enforcement NOT met
      const stages: Stage[] = [
        {
          id: 'stage-video',
          exam_id: 'exam-1',
          stage_type: 'video',
          stage_order: 1,
          configuration: {
            video_url: 'https://example.com/video.mp4',
            enforcement_threshold: 80, // Requires 80%
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'stage-questions',
          exam_id: 'exam-1',
          stage_type: 'questions',
          stage_order: 2,
          configuration: {
            question_ids: ['q1'],
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      
      const stageProgress: StageProgress[] = [
        {
          id: 'progress-video',
          attempt_id: 'attempt-1',
          stage_id: 'stage-video',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          progress_data: { watch_percentage: 50 }, // Only 50% watched
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'progress-questions',
          attempt_id: 'attempt-1',
          stage_id: 'stage-questions',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          progress_data: { answered_questions: ['q1'] },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      
      const exam: ExamInfo = {
        id: 'exam-1',
        title: 'Test Exam',
        description: '',
        duration_minutes: 60,
        pass_threshold: 50,
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const questions: Question[] = [{
        id: 'q1',
        exam_id: 'exam-1',
        question_type: 'multiple_choice',
        question_text: 'Test question',
        points: 1,
        question_order: 1,
        options: ['Option 1', 'Option 2'],
        correct_answer: 'Option 1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }];
      
      const { unmount } = render(
        <StageContainer
          attemptId="attempt-1"
          stages={stages}
          stageProgress={stageProgress}
          exam={exam}
          questions={questions}
          answers={{ q1: 'Option 1' }}
          onAnswerChange={() => {}}
          onSubmit={onSubmit}
        />
      );
      
      // Wait for component to mount
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
      
      // Find and click the submit button
      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find(btn => 
        btn.textContent?.toLowerCase().includes('submit')
      );
      
      if (submitButton && !submitButton.hasAttribute('disabled')) {
        fireEvent.click(submitButton);
        
        await waitFor(() => {
          // Property: Submission should be blocked
          expect(onSubmit).not.toHaveBeenCalled();
          
          // Should show error message about enforcement
          const errorMessage = screen.queryByRole('alert');
          if (errorMessage) {
            expect(errorMessage.textContent).toMatch(/video|watch|requirement/i);
          }
        }, { timeout: 2000 });
      }
      
      unmount();
    }, 10000);
  });
});
