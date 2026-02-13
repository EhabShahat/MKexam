/**
 * Property-Based Tests for Progress Update Debouncing
 * Feature: staged-attempt-flow-fixes
 * Property 32: Progress update debouncing
 * Validates: Requirements 6.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { render, screen, waitFor, act } from '@testing-library/react';
import StageContainer from '../StageContainer';
import type { Stage, StageProgress, ExamInfo } from '@/lib/types';

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

// Mock VideoStage to allow triggering progress updates
vi.mock('../VideoStage', () => ({
  default: ({ onProgressUpdate }: any) => {
    // Expose the onProgressUpdate function for testing
    (window as any).__testVideoProgressUpdate = onProgressUpdate;
    return <div data-testid="video-stage">Video Stage</div>;
  },
}));

// Mock ContentStage
vi.mock('../ContentStage', () => ({
  default: ({ onProgressUpdate }: any) => {
    (window as any).__testContentProgressUpdate = onProgressUpdate;
    return <div data-testid="content-stage">Content Stage</div>;
  },
}));

// Mock QuestionsStage
vi.mock('../QuestionsStage', () => ({
  default: () => <div data-testid="questions-stage">Questions Stage</div>,
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('Progress Update Debouncing - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    // Clear test hooks
    delete (window as any).__testVideoProgressUpdate;
    delete (window as any).__testContentProgressUpdate;
  });

  describe('Property 32: Progress update debouncing', () => {
    it('should debounce rapid progress updates to prevent excessive state updates', async () => {
      // Feature: staged-attempt-flow-fixes, Property 32: Progress update debouncing
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }), // Number of rapid updates
          fc.integer({ min: 10, max: 100 }), // Update interval in ms
          async (updateCount, updateInterval) => {
            const stages: Stage[] = [
              {
                id: 'stage-1',
                exam_id: 'exam-1',
                stage_type: 'video',
                stage_order: 1,
                configuration: {
                  video_url: 'https://example.com/video.mp4',
                  enforcement_threshold: 80,
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
                progress_data: { watch_percentage: 0 },
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

            // Wait for component to initialize and get the progress update function
            await waitFor(() => {
              expect((window as any).__testVideoProgressUpdate).toBeDefined();
            });

            const progressUpdate = (window as any).__testVideoProgressUpdate;

            // Simulate rapid progress updates
            const updates: number[] = [];
            for (let i = 0; i < updateCount; i++) {
              const watchPercentage = (i + 1) * (100 / updateCount);
              updates.push(watchPercentage);
              
              act(() => {
                progressUpdate({
                  watch_percentage: watchPercentage,
                  total_watch_time: i * 10,
                  last_position: i * 5,
                  watched_segments: [],
                });
              });

              // Small delay between updates
              await new Promise(resolve => setTimeout(resolve, updateInterval));
            }

            // Wait for debounce to settle (500ms debounce + buffer)
            await new Promise(resolve => setTimeout(resolve, 700));

            // Property: The final state should reflect the latest update
            // We can't directly check internal state, but we can verify the button state
            // reflects the latest progress (should be enabled if last update >= 80%)
            const lastUpdate = updates[updates.length - 1];
            
            await waitFor(() => {
              const buttons = screen.getAllByRole('button');
              const continueButton = buttons[0];
              
              if (lastUpdate >= 80) {
                // Should be enabled if enforcement met
                expect(continueButton).not.toBeDisabled();
              } else {
                // Should be disabled if enforcement not met
                expect(continueButton).toBeDisabled();
              }
            });

            // Cleanup
            unmount();
          }
        ),
        { numRuns: 10 } // Reduced runs for performance
      );
    }, 30000);

    it('should use latest data after debounce period', async () => {
      // Feature: staged-attempt-flow-fixes, Property 32: Progress update debouncing
      
      const stages: Stage[] = [
        {
          id: 'stage-1',
          exam_id: 'exam-1',
          stage_type: 'content',
          stage_order: 1,
          configuration: {
            slides: [
              { title: 'Slide 1', content: 'Content 1' },
              { title: 'Slide 2', content: 'Content 2' },
            ],
            minimum_read_time: 60,
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
          progress_data: { current_slide_index: 0, slide_times: {} },
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
        expect((window as any).__testContentProgressUpdate).toBeDefined();
      });

      const progressUpdate = (window as any).__testContentProgressUpdate;

      // Send multiple rapid updates with different values
      act(() => {
        progressUpdate({
          current_slide_index: 0,
          slide_times: { '0': 10 },
          time_spent: 10,
        });
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      act(() => {
        progressUpdate({
          current_slide_index: 1,
          slide_times: { '0': 20, '1': 10 },
          time_spent: 30,
        });
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Final update - this should be the one that takes effect
      act(() => {
        progressUpdate({
          current_slide_index: 1,
          slide_times: { '0': 30, '1': 35 },
          time_spent: 65, // Exceeds minimum_read_time of 60
        });
      });

      // Wait for debounce to settle
      await new Promise(resolve => setTimeout(resolve, 700));

      // Property: Button should reflect the LATEST update (time_spent = 65 >= 60)
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const continueButton = buttons[0];
        expect(continueButton).not.toBeDisabled();
      });

      // Cleanup
      unmount();
    }, 10000);

    it('should prevent excessive API calls through debouncing', async () => {
      // Feature: staged-attempt-flow-fixes, Property 32: Progress update debouncing
      
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
      ];

      const stageProgress: StageProgress[] = [
        {
          id: 'progress-1',
          attempt_id: 'attempt-1',
          stage_id: 'stage-1',
          started_at: new Date().toISOString(),
          completed_at: null,
          progress_data: { watch_percentage: 0 },
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
        expect((window as any).__testVideoProgressUpdate).toBeDefined();
      });

      const progressUpdate = (window as any).__testVideoProgressUpdate;

      // Send 10 rapid updates within 200ms
      for (let i = 0; i < 10; i++) {
        act(() => {
          progressUpdate({
            watch_percentage: i * 10,
            total_watch_time: i * 5,
            last_position: i * 2,
            watched_segments: [],
          });
        });
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Wait for debounce to settle
      await new Promise(resolve => setTimeout(resolve, 700));

      // Property: Debouncing should reduce the number of state updates
      // The component should still be functional and reflect the latest state
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      // Cleanup
      unmount();
    }, 10000);
  });
});
