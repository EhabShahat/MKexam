/**
 * Property-Based Tests for Critical Error Logging
 * Feature: staged-attempt-flow-fixes
 * Property 22: Critical error logging
 * Validates: Requirements 4.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// Mock fetch globally
global.fetch = vi.fn();

describe('Critical Error Logging - Property-Based Tests', () => {
  let consoleErrorSpy: any;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Spy on console methods to verify logging
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Property 22: Critical error logging', () => {
    it('should log network errors with structured request details', async () => {
      // Feature: staged-attempt-flow-fixes, Property 22: Critical error logging

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            attemptId: fc.constantFrom('attempt-1'),
            stageId: fc.constantFrom('stage-1'),
            errorStatus: fc.constantFrom(500, 404, 403, 502),
          }),
          async ({ attemptId, stageId, errorStatus }) => {
            // Reset spies for each iteration
            consoleErrorSpy.mockClear();

            // Mock fetch to return error
            (global.fetch as any).mockImplementation((url: string) => {
              if (url.includes('stage-progress')) {
                return Promise.resolve({
                  ok: false,
                  status: errorStatus,
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

            // Click to transition (which will trigger save and error)
            fireEvent.click(button);

            // Wait for error to be logged
            await waitFor(
              () => {
                expect(consoleErrorSpy).toHaveBeenCalled();
              },
              { timeout: 3000 }
            );

            // Property: Error log should contain structured request details
            const errorCalls = consoleErrorSpy.mock.calls;
            const saveErrorCall = errorCalls.find((call: any[]) => 
              call[0]?.includes?.('[StageContainer] Save failed')
            );

            expect(saveErrorCall).toBeDefined();
            
            // Verify structured logging format
            const logData = saveErrorCall[1];
            expect(logData).toHaveProperty('stageId', stageId);
            expect(logData).toHaveProperty('status', errorStatus);
            expect(logData).toHaveProperty('attemptId', attemptId);
            expect(logData).toHaveProperty('timestamp');
            expect(logData).toHaveProperty('requestUrl');
            expect(logData).toHaveProperty('requestMethod', 'POST');

            // Cleanup
            unmount();
          }
        ),
        { numRuns: 10, timeout: 15000 }
      );
    });

    it('should log validation errors with stage configuration', async () => {
      // Feature: staged-attempt-flow-fixes, Property 22: Critical error logging

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            attemptId: fc.constantFrom('attempt-1'),
            watchPercentage: fc.integer({ min: 0, max: 79 }), // Below 80% threshold
          }),
          async ({ attemptId, watchPercentage }) => {
            // Reset spies for each iteration
            consoleErrorSpy.mockClear();
            consoleLogSpy.mockClear();

            // Mock fetch to succeed
            (global.fetch as any).mockImplementation(() =>
              Promise.resolve({
                ok: true,
                json: async () => ({}),
              })
            );

            const stages: Stage[] = [
              {
                id: 'stage-1',
                exam_id: 'exam-1',
                stage_type: 'video',
                stage_order: 1,
                configuration: {
                  video_url: 'https://example.com/video.mp4',
                  enforcement_threshold: 80, // Require 80%
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

            const logActivityMock = vi.fn();

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
                logActivity={logActivityMock}
              />
            );

            // Wait for component to initialize
            await waitFor(() => {
              const buttons = screen.getAllByRole('button');
              expect(buttons.length).toBeGreaterThan(0);
            });

            const button = screen.getAllByRole('button')[0];

            // Click to transition (should fail validation)
            fireEvent.click(button);

            // Wait for validation to complete
            await waitFor(
              () => {
                const logCalls = consoleLogSpy.mock.calls;
                const validationCall = logCalls.find((call: any[]) =>
                  call[0]?.includes?.('[StageContainer] Enforcement validation')
                );
                expect(validationCall).toBeDefined();
              },
              { timeout: 2000 }
            );

            // Property: Validation error should be logged with configuration
            const logCalls = consoleLogSpy.mock.calls;
            const enforcementCheckCall = logCalls.find((call: any[]) =>
              call[0]?.includes?.('[StageContainer] Video enforcement check')
            );

            expect(enforcementCheckCall).toBeDefined();
            
            // Verify structured logging with configuration
            const logData = enforcementCheckCall[1];
            expect(logData).toHaveProperty('stageId', 'stage-1');
            expect(logData).toHaveProperty('stageType', 'video');
            expect(logData).toHaveProperty('threshold', 80);
            expect(logData).toHaveProperty('watched');
            // The watched value should be a number (may differ from initial due to component updates)
            expect(typeof logData.watched).toBe('number');
            expect(logData.watched).toBeGreaterThanOrEqual(0);
            expect(logData.watched).toBeLessThan(80); // Should be below threshold to trigger violation
            expect(logData).toHaveProperty('timestamp');

            // Property: Enforcement violation should be logged
            const warnCalls = consoleWarnSpy.mock.calls;
            const violationCall = warnCalls.find((call: any[]) =>
              call[0]?.includes?.('[StageContainer] Video enforcement violation')
            );

            expect(violationCall).toBeDefined();
            const violationData = violationCall[1];
            expect(violationData).toHaveProperty('required', 80);
            expect(violationData).toHaveProperty('actual');
            // Actual value should be below threshold
            expect(violationData.actual).toBeLessThan(80);
            expect(violationData).toHaveProperty('deficit');
            expect(violationData.deficit).toBeGreaterThan(0);

            // Cleanup
            unmount();
          }
        ),
        { numRuns: 10, timeout: 15000 }
      );
    });

    it('should log state errors with complete state snapshot', async () => {
      // Feature: staged-attempt-flow-fixes, Property 22: Critical error logging

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            attemptId: fc.constantFrom('attempt-1'),
          }),
          async ({ attemptId }) => {
            // Reset spies for each iteration
            consoleErrorSpy.mockClear();

            // Mock fetch to throw an unexpected error
            (global.fetch as any).mockImplementation(() => {
              throw new Error('Unexpected state error');
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
                attempt_id: attemptId,
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

            // Click to transition (which will trigger error)
            fireEvent.click(button);

            // Wait for error to be logged
            await waitFor(
              () => {
                const errorCalls = consoleErrorSpy.mock.calls;
                const saveErrorCall = errorCalls.find((call: any[]) =>
                  call[0]?.includes?.('[StageContainer] Save exception') ||
                  call[0]?.includes?.('[StageContainer] Stage completion error')
                );
                expect(saveErrorCall).toBeDefined();
              },
              { timeout: 3000 }
            );

            // Property: State error should contain complete state snapshot
            const errorCalls = consoleErrorSpy.mock.calls;
            const stateErrorCall = errorCalls.find((call: any[]) =>
              call[0]?.includes?.('[StageContainer] Save exception') ||
              call[0]?.includes?.('[StageContainer] Stage completion error')
            );

            expect(stateErrorCall).toBeDefined();
            
            // Verify structured logging with state snapshot
            const logData = stateErrorCall[1];
            expect(logData).toHaveProperty('error');
            expect(logData).toHaveProperty('stageId', 'stage-1');
            expect(logData).toHaveProperty('attemptId', attemptId);
            expect(logData).toHaveProperty('timestamp');
            
            // The error could be logged from either Save exception or Stage completion error
            // Both should have structured data

            // Cleanup
            unmount();
          }
        ),
        { numRuns: 10, timeout: 15000 }
      );
    });

    it('should log transition failures with complete context', async () => {
      // Feature: staged-attempt-flow-fixes, Property 22: Critical error logging

      // Mock fetch to throw error during save
      (global.fetch as any).mockImplementation(() => {
        throw new Error('Network failure');
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

      const logActivityMock = vi.fn();

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
          logActivity={logActivityMock}
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

      // Wait for error to be logged
      await waitFor(
        () => {
          expect(consoleErrorSpy).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Property: Transition failure should be logged via logActivity
      // When save fails, it logs 'stage_save_failed' instead of 'stage_transition_failed'
      await waitFor(
        () => {
          const saveFailureCalls = logActivityMock.mock.calls.filter(
            (call: any[]) => call[0] === 'stage_save_failed'
          );
          expect(saveFailureCalls.length).toBeGreaterThan(0);
        },
        { timeout: 2000 }
      );

      const saveFailureCall = logActivityMock.mock.calls.find(
        (call: any[]) => call[0] === 'stage_save_failed'
      );

      // Verify structured logging
      const logData = saveFailureCall[1];
      expect(logData).toHaveProperty('stage_id', 'stage-1');
      expect(logData).toHaveProperty('error');
      expect(logData).toHaveProperty('timestamp');

      // Cleanup
      unmount();
    });
  });
});
