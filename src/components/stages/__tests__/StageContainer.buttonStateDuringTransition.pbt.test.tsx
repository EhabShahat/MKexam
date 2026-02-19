/**
 * Property-Based Tests for Button State During Transition
 * Feature: staged-attempt-flow-fixes
 * Property 4: Button state during transition
 * Validates: Requirements 1.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('Button State During Transition - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  describe('Property 4: Button state during transition', () => {
    it('should disable continue button when transitionLock is true', async () => {
      // Feature: staged-attempt-flow-fixes, Property 4: Button state during transition
      
      // Mock fetch to introduce delay for transition
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('stage-progress')) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({}),
              });
            }, 200);
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

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
          stage_type: 'content',
          stage_order: 2,
          configuration: {
            slides: [{ title: 'Slide 1', content: 'Content 1' }],
            minimum_read_time: 0,
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
          completed_at: null,
          progress_data: { watch_percentage: 100 },
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

      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onStageChange = vi.fn();

      const { unmount } = render(
        <StageContainer
          attemptId="attempt-1"
          stages={stages}
          stageProgress={stageProgress}
          exam={exam}
          questions={[]}
          answers={{}}
          onAnswerChange={() => {}}
          onSubmit={onSubmit}
          onStageChange={onStageChange}
        />
      );

      // Wait for component to initialize
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      const button = screen.getAllByRole('button')[0];
      
      // Button should be enabled initially
      expect(button).not.toBeDisabled();

      // Click to start transition
      fireEvent.click(button);

      // Property: Button MUST be disabled during transition
      await waitFor(() => {
        expect(button).toBeDisabled();
      }, { timeout: 500 });

      // Wait for transition to complete
      await waitFor(
        () => {
          expect(button).not.toBeDisabled();
        },
        { timeout: 2000 }
      );
      
      // Cleanup
      unmount();
    }, 10000);

    it('should disable button when enforcement validation fails', async () => {
      // Feature: staged-attempt-flow-fixes, Property 4: Button state during transition
      
      const stages: Stage[] = [
        {
          id: 'stage-1',
          exam_id: 'exam-1',
          stage_type: 'video',
          stage_order: 1,
          configuration: {
            video_url: 'https://example.com/video.mp4',
            enforcement_threshold: 80, // Requires 80% watch
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'stage-2',
          exam_id: 'exam-1',
          stage_type: 'content',
          stage_order: 2,
          configuration: {
            slides: [{ title: 'Slide 1', content: 'Content 1' }],
            minimum_read_time: 0,
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
          completed_at: null,
          progress_data: { watch_percentage: 50 }, // Only 50% watched
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

      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onStageChange = vi.fn();

      const { unmount } = render(
        <StageContainer
          attemptId="attempt-1"
          stages={stages}
          stageProgress={stageProgress}
          exam={exam}
          questions={[]}
          answers={{}}
          onAnswerChange={() => {}}
          onSubmit={onSubmit}
          onStageChange={onStageChange}
        />
      );

      // Wait for component to initialize and enforcement to be validated
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      const button = screen.getAllByRole('button')[0];
      
      // Wait for enforcement validation to complete
      await waitFor(() => {
        expect(button).toBeDisabled();
      }, { timeout: 1000 });
      
      // Verify aria-label indicates why button is disabled
      const ariaLabel = button.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toContain('Cannot proceed');
      
      // Cleanup
      unmount();
    });

    it('should have proper aria-label for accessibility', async () => {
      // Feature: staged-attempt-flow-fixes, Property 4: Button state during transition
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100 }), // enforcement threshold
          fc.integer({ min: 0, max: 100 }), // watch percentage
          async (threshold, watchPercentage) => {
            const stages: Stage[] = [
              {
                id: 'stage-1',
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
            ];

            const stageProgress: StageProgress[] = [
              {
                id: 'progress-1',
                attempt_id: 'attempt-1',
                stage_id: 'stage-1',
                started_at: new Date().toISOString(),
                completed_at: null,
                progress_data: { watch_percentage: watchPercentage },
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

            const onSubmit = vi.fn().mockResolvedValue(undefined);
            const onStageChange = vi.fn();

            const { unmount } = render(
              <StageContainer
                attemptId="attempt-1"
                stages={stages}
                stageProgress={stageProgress}
                exam={exam}
                questions={[]}
                answers={{}}
                onAnswerChange={() => {}}
                onSubmit={onSubmit}
                onStageChange={onStageChange}
              />
            );

            try {
              await waitFor(() => {
                const buttons = screen.getAllByRole('button');
                expect(buttons.length).toBeGreaterThan(0);
              });

              const button = screen.getAllByRole('button')[0];
              
              // Property: Button MUST have aria-label
              const ariaLabel = button.getAttribute('aria-label');
              expect(ariaLabel).toBeTruthy();
              expect(typeof ariaLabel).toBe('string');
              expect(ariaLabel!.length).toBeGreaterThan(0);

              // If enforcement fails (threshold > 0 and watchPercentage < threshold), 
              // wait for button to be disabled and aria-label to update
              if (threshold > 0 && watchPercentage < threshold) {
                await waitFor(() => {
                  const updatedAriaLabel = button.getAttribute('aria-label');
                  expect(updatedAriaLabel).toContain('Cannot proceed');
                }, { timeout: 1000 });
              }
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);
  });
});
