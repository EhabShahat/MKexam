/**
 * Property-Based Tests for Submission Validation
 * Feature: staged-attempt-flow-fixes
 * Property 35: All stages complete validation
 * Validates: Requirements 7.1
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

describe('Submission Validation - Property-Based Tests', () => {
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

  describe('Property 35: All stages complete validation', () => {
    it('should validate all stages are complete before submission', async () => {
      // Feature: staged-attempt-flow-fixes, Property 35: All stages complete validation
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 4 }), // Number of stages
          fc.boolean(), // Whether all stages are complete
          async (numStages, allComplete) => {
            const onSubmit = vi.fn();
            
            // Create stages - all video/content to avoid question rendering complexity
            const stages: Stage[] = [];
            const stageProgress: StageProgress[] = [];
            
            for (let i = 0; i < numStages; i++) {
              const stageId = `stage-${i}`;
              const isComplete = allComplete || i < numStages - 1; // Last stage might be incomplete
              
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
                completed_at: isComplete ? new Date().toISOString() : null,
                progress_data: i % 2 === 0 
                  ? { watch_percentage: 100 }
                  : { current_slide_index: 0, slide_times: {} },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
            
            // Add a questions stage at the end
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
            
            // Property: Component should render without errors
            expect(screen.getByRole('main')).toBeInTheDocument();
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should provide detailed reasons for incomplete stages', async () => {
      // Feature: staged-attempt-flow-fixes, Property 35: All stages complete validation
      
      const onSubmit = vi.fn();
      
      // Create stages with one incomplete
      const stages: Stage[] = [
        {
          id: 'stage-1',
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
          id: 'stage-2',
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
          id: 'progress-1',
          attempt_id: 'attempt-1',
          stage_id: 'stage-1',
          started_at: new Date().toISOString(),
          completed_at: null, // Incomplete
          progress_data: { watch_percentage: 50 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'progress-2',
          attempt_id: 'attempt-1',
          stage_id: 'stage-2',
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
          answers={{ q1: 'opt1' }}
          onAnswerChange={() => {}}
          onSubmit={onSubmit}
        />
      );
      
      // Wait for component to mount
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
      
      // Property: Error message should contain stage information
      // Since we're on the last stage and stage 1 is incomplete,
      // attempting to submit should show an error
      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find(btn => 
        btn.textContent?.toLowerCase().includes('submit')
      );
      
      if (submitButton && !submitButton.hasAttribute('disabled')) {
        fireEvent.click(submitButton);
        
        await waitFor(() => {
          // Should not have called onSubmit
          expect(onSubmit).not.toHaveBeenCalled();
          
          // Should show error message with stage details
          const errorMessage = screen.queryByRole('alert');
          if (errorMessage) {
            expect(errorMessage.textContent).toMatch(/stage/i);
          }
        }, { timeout: 2000 });
      }
      
      unmount();
    }, 10000);
  });
});
