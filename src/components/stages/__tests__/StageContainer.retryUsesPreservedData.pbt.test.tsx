/**
 * Property-Based Tests for Retry Uses Preserved Data
 * Feature: staged-attempt-flow-fixes
 * Property 21: Retry uses preserved data
 * Validates: Requirements 4.6
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

describe('Retry Uses Preserved Data - Property-Based Tests', () => {
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

  describe('Property 21: Retry uses preserved data', () => {
    it('should use preserved progress data when retrying after failure', async () => {
      // Feature: staged-attempt-flow-fixes, Property 21: Retry uses preserved data

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            attemptId: fc.constantFrom('attempt-1'),
            stageId: fc.constantFrom('stage-1'),
            progressData: fc.record({
              watch_percentage: fc.integer({ min: 80, max: 100 }),
              total_watch_time: fc.integer({ min: 100, max: 1000 }),
              last_position: fc.integer({ min: 0, max: 1000 }),
            }),
          }),
          async ({ attemptId, stageId, progressData }) => {
            let fetchCallCount = 0;

            // Mock fetch to fail first, then succeed
            (global.fetch as any).mockImplementation((url: string, options?: any) => {
              if (url.includes('stage-progress')) {
                fetchCallCount++;
                
                if (fetchCallCount === 1) {
                  // First call fails
                  return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: async () => ({ error: 'Server error' }),
                  });
                } else {
                  // Second call (retry) succeeds
                  // Verify that the same progress data is being sent
                  const body = JSON.parse(options?.body || '{}');
                  expect(body.progress_data).toEqual(progressData);
                  expect(body.completed).toBe(true);
                  
                  return Promise.resolve({
                    ok: true,
                    json: async () => ({ success: true }),
                  });
                }
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

            const continueButton = screen.getAllByRole('button')[0];

            // Click to transition (which will trigger save and fail)
            fireEvent.click(continueButton);

            // Wait for first save to complete (enqueue should be called)
            await waitFor(
              () => {
                expect(stageProgressQueue.enqueue).toHaveBeenCalled();
              },
              { timeout: 3000 }
            );

            // Property: Retry button should be present
            const retryButton = await screen.findByRole('button', { name: /retry/i }, { timeout: 2000 });
            expect(retryButton).toBeInTheDocument();

            // Click retry button
            fireEvent.click(retryButton);

            // Wait for retry to complete successfully (second fetch call)
            await waitFor(
              () => {
                expect(fetchCallCount).toBe(2);
              },
              { timeout: 3000 }
            );

            // Cleanup
            unmount();
          }
        ),
        { numRuns: 5, timeout: 10000 }
      );
    });

    it('should preserve progress data in state across retry attempts', async () => {
      // Feature: staged-attempt-flow-fixes, Property 21: Retry uses preserved data

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            attemptId: fc.constantFrom('attempt-1'),
            stageId: fc.constantFrom('stage-1'),
            progressData: fc.record({
              watch_percentage: fc.integer({ min: 90, max: 100 }),
              total_watch_time: fc.integer({ min: 200, max: 500 }),
            }),
          }),
          async ({ attemptId, stageId, progressData }) => {
            const fetchCalls: any[] = [];

            // Mock fetch to fail multiple times
            (global.fetch as any).mockImplementation((url: string, options?: any) => {
              if (url.includes('stage-progress')) {
                const body = JSON.parse(options?.body || '{}');
                fetchCalls.push(body);
                
                // Always fail to test multiple retries
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

            const continueButton = screen.getAllByRole('button')[0];

            // First attempt
            fireEvent.click(continueButton);

            await waitFor(
              () => {
                expect(fetchCalls.length).toBeGreaterThan(0);
              },
              { timeout: 3000 }
            );
            const retryButton = await screen.findByRole('button', { name: /retry/i }, { timeout: 2000 });

            // Second attempt (retry)
            fireEvent.click(retryButton);

            await waitFor(
              () => {
                expect(fetchCalls.length).toBeGreaterThanOrEqual(2);
              },
              { timeout: 3000 }
            );

            // Property: All fetch calls should use the same preserved progress data
            for (const call of fetchCalls) {
              expect(call.progress_data).toEqual(progressData);
              expect(call.completed).toBe(true);
            }

            // Cleanup
            unmount();
          }
        ),
        { numRuns: 5, timeout: 10000 }
      );
    });
  });
});
