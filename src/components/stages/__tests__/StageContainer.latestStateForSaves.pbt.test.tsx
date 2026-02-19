/**
 * Property-Based Tests for Latest State Usage in Saves
 * Feature: staged-attempt-flow-fixes
 * Property 31: Latest state for saves
 * Validates: Requirements 6.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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
    (window as any).__testVideoProgressUpdate = onProgressUpdate;
    return <div data-testid="video-stage">Video Stage</div>;
  },
}));

// Mock ContentStage
vi.mock('../ContentStage', () => ({
  default: () => <div data-testid="content-stage">Content Stage</div>,
}));

// Mock QuestionsStage
vi.mock('../QuestionsStage', () => ({
  default: () => <div data-testid="questions-stage">Questions Stage</div>,
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('Latest State for Saves - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    delete (window as any).__testVideoProgressUpdate;
  });

  describe('Property 31: Latest state for saves', () => {
    it('should use latest progress data when saving during transition', async () => {
      // Feature: staged-attempt-flow-fixes, Property 31: Latest state for saves
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 80, max: 100 }), // Final watch percentage
          async (finalWatchPercentage) => {
            let savedProgressData: any = null;

            // Mock fetch to capture what data is being saved
            (global.fetch as any).mockImplementation(async (url: string, options?: any) => {
              if (url.includes('stage-progress')) {
                const body = JSON.parse(options?.body || '{}');
                savedProgressData = body.progress_data;
                
                return {
                  ok: true,
                  json: async () => ({}),
                };
              }
              return {
                ok: true,
                json: async () => ({}),
              };
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

            // Update progress to the final value
            act(() => {
              progressUpdate({
                watch_percentage: finalWatchPercentage,
                total_watch_time: 100,
                last_position: 50,
                watched_segments: [],
              });
            });

            // Wait for debounce to settle
            await new Promise(resolve => setTimeout(resolve, 700));

            // Reset saved data
            savedProgressData = null;

            // Trigger transition
            await waitFor(() => {
              const buttons = screen.getAllByRole('button');
              expect(buttons.length).toBeGreaterThan(0);
            });

            const button = screen.getAllByRole('button')[0];
            
            act(() => {
              fireEvent.click(button);
            });

            // Wait for save to complete
            await waitFor(() => {
              expect(savedProgressData).not.toBeNull();
            }, { timeout: 2000 });

            // Property: The saved data should reflect the LATEST progress update
            expect(savedProgressData).toBeDefined();
            expect(savedProgressData.watch_percentage).toBe(finalWatchPercentage);

            // Cleanup
            unmount();
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    it('should not capture stale progress data in closures', async () => {
      // Feature: staged-attempt-flow-fixes, Property 31: Latest state for saves
      
      const savedProgressValues: number[] = [];

      // Mock fetch to capture saved values
      (global.fetch as any).mockImplementation(async (url: string, options?: any) => {
        if (url.includes('stage-progress')) {
          const body = JSON.parse(options?.body || '{}');
          if (body.progress_data?.watch_percentage !== undefined) {
            savedProgressValues.push(body.progress_data.watch_percentage);
          }
          
          return {
            ok: true,
            json: async () => ({}),
          };
        }
        return {
          ok: true,
          json: async () => ({}),
        };
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

      // Make multiple progress updates
      act(() => {
        progressUpdate({
          watch_percentage: 25,
          total_watch_time: 25,
          last_position: 10,
          watched_segments: [],
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      act(() => {
        progressUpdate({
          watch_percentage: 50,
          total_watch_time: 50,
          last_position: 25,
          watched_segments: [],
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Final update
      act(() => {
        progressUpdate({
          watch_percentage: 90,
          total_watch_time: 90,
          last_position: 45,
          watched_segments: [],
        });
      });

      // Wait for debounce to settle
      await new Promise(resolve => setTimeout(resolve, 700));

      // Trigger transition
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      const button = screen.getAllByRole('button')[0];
      
      act(() => {
        fireEvent.click(button);
      });

      // Wait for save to complete
      await waitFor(() => {
        expect(savedProgressValues.length).toBeGreaterThan(0);
      }, { timeout: 2000 });

      // Property: The saved value should be the LATEST (90), not any intermediate value
      const lastSavedValue = savedProgressValues[savedProgressValues.length - 1];
      expect(lastSavedValue).toBe(90);

      // Cleanup
      unmount();
    }, 10000);

    it('should use functional state updates to access latest state', async () => {
      // Feature: staged-attempt-flow-fixes, Property 31: Latest state for saves
      
      let savedCompletedFlag: boolean | undefined;

      // Mock fetch to capture completed flag
      (global.fetch as any).mockImplementation(async (url: string, options?: any) => {
        if (url.includes('stage-progress')) {
          const body = JSON.parse(options?.body || '{}');
          savedCompletedFlag = body.completed;
          
          return {
            ok: true,
            json: async () => ({}),
          };
        }
        return {
          ok: true,
          json: async () => ({}),
        };
      });

      const stages: Stage[] = [
        {
          id: 'stage-1',
          exam_id: 'exam-1',
          stage_type: 'video',
          stage_order: 1,
          configuration: {
            video_url: 'https://example.com/video.mp4',
            enforcement_threshold: 0, // No enforcement
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

      // Update progress to 100%
      act(() => {
        progressUpdate({
          watch_percentage: 100,
          total_watch_time: 100,
          last_position: 50,
          watched_segments: [],
        });
      });

      // Wait for debounce to settle
      await new Promise(resolve => setTimeout(resolve, 700));

      // Wait for button to be enabled
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
        expect(buttons[0]).not.toBeDisabled();
      }, { timeout: 2000 });

      const button = screen.getAllByRole('button')[0];
      
      // Trigger transition - this should mark stage as completed and save
      act(() => {
        fireEvent.click(button);
      });

      // Wait for save to complete
      await waitFor(() => {
        expect(savedCompletedFlag).toBe(true);
      }, { timeout: 2000 });

      // Property: The completed flag should be true when saving during transition
      expect(savedCompletedFlag).toBe(true);

      // Cleanup
      unmount();
    }, 10000);
  });
});
