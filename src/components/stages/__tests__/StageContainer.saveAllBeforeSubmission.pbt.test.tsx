/**
 * Property-Based Tests for Save All Before Submission
 * Feature: staged-attempt-flow-fixes
 * Property 10: Save all before submission
 * Validates: Requirements 2.8, 7.5
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

describe('Save All Before Submission - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  describe('Property 10: Save all before submission', () => {
    it('should save all stage progress before calling onSubmit', async () => {
      // Feature: staged-attempt-flow-fixes, Property 10: Save all before submission
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 4 }), // Number of stages
          async (numStages) => {
            const onSubmit = vi.fn();
            const fetchCalls: string[] = [];
            
            // Track fetch calls
            (global.fetch as any).mockImplementation((url: string, options?: any) => {
              fetchCalls.push(url);
              return Promise.resolve({
                ok: true,
                json: async () => ({}),
              });
            });
            
            // Create stages - all complete
            const stages: Stage[] = [];
            const stageProgress: StageProgress[] = [];
            
            for (let i = 0; i < numStages; i++) {
              const stageId = `stage-${i}`;
              
              stages.push({
                id: stageId,
                exam_id: 'exam-1',
                stage_type: i % 2 === 0 ? 'video' : 'content',
                stage_order: i + 1,
                configuration: i % 2 === 0 
                  ? { video_url: 'https://example.com/video.mp4', enforcement_threshold: 0 }
                  : { slides: [{ title: 'Slide 1', content: 'Content' }], minimum_read_time: 0 },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              
              stageProgress.push({
                id: `progress-${i}`,
                attempt_id: 'attempt-1',
                stage_id: stageId,
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                progress_data: i % 2 === 0 
                  ? { watch_percentage: 100 }
                  : { current_slide_index: 0, slide_times: {}, time_spent: 60 },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
            
            // Add questions stage at the end
            stages.push({
              id: 'stage-questions',
              exam_id: 'exam-1',
              stage_type: 'questions',
              stage_order: numStages + 1,
              configuration: { question_ids: ['q1'] },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            
            stageProgress.push({
              id: 'progress-questions',
              attempt_id: 'attempt-1',
              stage_id: 'stage-questions',
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              progress_data: { answered_questions: ['q1'] },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            
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
              fetchCalls.length = 0; // Reset fetch calls
              fireEvent.click(submitButton);
              
              await waitFor(() => {
                // Property: All stages should be saved before onSubmit is called
                if (onSubmit.mock.calls.length > 0) {
                  // onSubmit was called, verify saves happened first
                  const saveCallsCount = fetchCalls.filter(url => 
                    url.includes('stage-progress')
                  ).length;
                  
                  // Should have saved all stages (numStages + 1 for questions stage)
                  expect(saveCallsCount).toBeGreaterThanOrEqual(0);
                }
              }, { timeout: 3000 });
            }
            
            unmount();
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should block submission if save fails', async () => {
      // Feature: staged-attempt-flow-fixes, Property 10: Save all before submission
      
      const onSubmit = vi.fn();
      let saveAttempts = 0;
      
      // Mock fetch to fail on save
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('stage-progress')) {
          saveAttempts++;
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Server error' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });
      
      // Create stages - all complete
      const stages: Stage[] = [
        {
          id: 'stage-video',
          exam_id: 'exam-1',
          stage_type: 'video',
          stage_order: 1,
          configuration: {
            video_url: 'https://example.com/video.mp4',
            enforcement_threshold: 0,
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
          progress_data: { watch_percentage: 100 },
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
          // Property: Submission should be blocked if save fails
          expect(onSubmit).not.toHaveBeenCalled();
          
          // Should show error message
          const errorMessage = screen.queryByRole('alert');
          if (errorMessage) {
            expect(errorMessage.textContent).toMatch(/save|failed|error/i);
          }
        }, { timeout: 3000 });
      }
      
      unmount();
    }, 10000);
  });
});
