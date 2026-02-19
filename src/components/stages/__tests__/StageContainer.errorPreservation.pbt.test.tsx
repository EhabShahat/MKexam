/**
 * Property-Based Tests for Error Preservation
 * Feature: staged-attempt-flow-fixes
 * Property 5: Error preservation on failure
 * Validates: Requirements 1.4, 4.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StageContainer from '../StageContainer';
import type { Stage, StageProgress, ExamInfo } from '@/lib/types';
import { stageProgressQueue } from '@/lib/stageProgressQueue';

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

describe('Error Preservation - Property-Based Tests', () => {
  let localStorageMock: { [key: string]: string } = {};

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock = {};

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      length: 0,
      key: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Property 5: Error preservation on failure', () => {
    it('should preserve progress in memory when save fails', async () => {
      // Feature: staged-attempt-flow-fixes, Property 5: Error preservation on failure

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            attemptId: fc.constantFrom('attempt-1'), // Use constant for simpler testing
            stageId: fc.constantFrom('stage-1'),
            progressData: fc.record({
              watch_percentage: fc.integer({ min: 0, max: 100 }),
              total_watch_time: fc.integer({ min: 0, max: 1000 }),
            }),
          }),
          async ({ attemptId, stageId, progressData }) => {
            // Mock fetch to fail
            (global.fetch as any).mockImplementation((url: string) => {
              if (url.includes('stage-progress')) {
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

            const stages: Stage[] = [
              {
                id: stageId,
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
                attempt_id: attemptId,
                stage_id: stageId,
                started_at: new Date().toISOString(),
                completed_at: null,
                progress_data: progressData,
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

            const { unmount } = render(
              <StageContainer
                attemptId={attemptId}
                stages={stages}
                stageProgress={stageProgress}
                exam={exam}
                questions={[]}
                answers={{}}
                onAnswerChange={() => {}}
                onSubmit={async () => {}}
              />
            );

            // Wait for component to initialize
            await waitFor(() => {
              const buttons = screen.getAllByRole('button');
              expect(buttons.length).toBeGreaterThan(0);
            });

            const button = screen.getAllByRole('button')[0];

            // Click to transition (which will trigger save)
            fireEvent.click(button);

            // Wait for save to complete and queue to be called
            await waitFor(
              () => {
                expect(stageProgressQueue.enqueue).toHaveBeenCalled();
              },
              { timeout: 3000 }
            );

            // Property: Progress data should be preserved in localStorage
            const backupKey = `stage_backup_${attemptId}_${stageId}`;
            const backup = localStorageMock[backupKey];
            expect(backup).toBeDefined();

            const parsedBackup = JSON.parse(backup);
            expect(parsedBackup.progress_data).toEqual(progressData);
            expect(parsedBackup.completed).toBe(true);
            expect(parsedBackup.timestamp).toBeGreaterThan(0);

            // Property: Progress should be added to retry queue
            expect(stageProgressQueue.enqueue).toHaveBeenCalledWith(
              attemptId,
              stageId,
              progressData,
              true
            );

            // Cleanup
            unmount();
          }
        ),
        { numRuns: 5, timeout: 10000 }
      );
    });

    it('should preserve progress in localStorage when network error occurs', async () => {
      // Feature: staged-attempt-flow-fixes, Property 5: Error preservation on failure

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            attemptId: fc.constantFrom('attempt-1'),
            stageId: fc.constantFrom('stage-1'),
            progressData: fc.record({
              watch_percentage: fc.integer({ min: 0, max: 100 }),
            }),
          }),
          async ({ attemptId, stageId, progressData }) => {
            // Mock fetch to throw network error
            (global.fetch as any).mockImplementation((url: string) => {
              if (url.includes('stage-progress')) {
                return Promise.reject(new Error('Network error'));
              }
              return Promise.resolve({
                ok: true,
                json: async () => ({}),
              });
            });

            const stages: Stage[] = [
              {
                id: stageId,
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
                attempt_id: attemptId,
                stage_id: stageId,
                started_at: new Date().toISOString(),
                completed_at: null,
                progress_data: progressData,
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

            const { unmount } = render(
              <StageContainer
                attemptId={attemptId}
                stages={stages}
                stageProgress={stageProgress}
                exam={exam}
                questions={[]}
                answers={{}}
                onAnswerChange={() => {}}
                onSubmit={async () => {}}
              />
            );

            // Wait for component to initialize
            await waitFor(() => {
              const buttons = screen.getAllByRole('button');
              expect(buttons.length).toBeGreaterThan(0);
            });

            const button = screen.getAllByRole('button')[0];

            // Click to transition
            fireEvent.click(button);

            // Wait for queue to be called (don't wait for UI)
            await waitFor(
              () => {
                expect(stageProgressQueue.enqueue).toHaveBeenCalled();
              },
              { timeout: 3000 }
            );

            // Property: Progress data should be preserved in localStorage
            const backupKey = `stage_backup_${attemptId}_${stageId}`;
            const backup = localStorageMock[backupKey];
            expect(backup).toBeDefined();

            const parsedBackup = JSON.parse(backup);
            expect(parsedBackup.progress_data).toEqual(progressData);

            // Property: Progress should be added to retry queue
            expect(stageProgressQueue.enqueue).toHaveBeenCalled();

            // Cleanup
            unmount();
          }
        ),
        { numRuns: 5, timeout: 10000 }
      );
    });

    it('should update sync status to failed on save error', async () => {
      // Feature: staged-attempt-flow-fixes, Property 5: Error preservation on failure

      // Mock queue to return 1 pending save
      (stageProgressQueue.getQueueSize as any).mockReturnValue(1);

      // Mock fetch to fail
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('stage-progress')) {
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

      const { unmount } = render(
        <StageContainer
          attemptId="attempt-1"
          stages={stages}
          stageProgress={stageProgress}
          exam={exam}
          questions={[]}
          answers={{}}
          onAnswerChange={() => {}}
          onSubmit={async () => {}}
        />
      );

      // Wait for component to initialize
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      const button = screen.getAllByRole('button')[0];

      // Click to transition
      fireEvent.click(button);

      // Wait for queue to be called (don't wait for specific UI text)
      await waitFor(
        () => {
          expect(stageProgressQueue.enqueue).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Property: Sync status banner should show failed state with queued saves
      await waitFor(() => {
        const syncBanner = screen.queryByText(/Sync Failed/i);
        expect(syncBanner).toBeInTheDocument();
      }, { timeout: 2000 });

      // Cleanup
      unmount();
    });
  });
});
