/**
 * Property-Based Tests for Parent Notification on Stage Transitions
 * Feature: staged-attempt-flow-fixes
 * Property 27: Parent notification on transition
 * Validates: Requirements 5.5, 5.6
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

describe('Parent Notification on Stage Transitions - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  describe('Property 27: Parent notification on transition', () => {
    it('should notify parent with new stage index after successful transition', async () => {
      // Feature: staged-attempt-flow-fixes, Property 27: Parent notification on transition
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // Number of stages
          async (numStages) => {
            // Create stages
            const stages: Stage[] = Array.from({ length: numStages }, (_, i) => ({
              id: `stage-${i + 1}`,
              exam_id: 'exam-1',
              stage_type: i % 3 === 0 ? 'video' : i % 3 === 1 ? 'content' : 'questions',
              stage_order: i + 1,
              configuration: 
                i % 3 === 0 
                  ? { video_url: 'https://example.com/video.mp4', enforcement_threshold: 0 }
                  : i % 3 === 1
                  ? { slides: [{ title: 'Slide 1', content: 'Content 1' }], minimum_read_time: 0 }
                  : { question_ids: ['q1'] },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }));

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

            // Initial notification should have been called with index 0
            expect(onStageChange).toHaveBeenCalledWith(0);
            
            const initialCallCount = onStageChange.mock.calls.length;
            onStageChange.mockClear();

            const button = screen.getAllByRole('button')[0];

            // Trigger transition
            fireEvent.click(button);

            // Wait for transition to complete
            await waitFor(
              () => {
                expect(onStageChange).toHaveBeenCalled();
              },
              { timeout: 2000 }
            );

            // Property: Parent should be notified with the new stage index (1)
            expect(onStageChange).toHaveBeenCalledWith(1);
            
            // Property: Notification should happen exactly once per transition
            expect(onStageChange).toHaveBeenCalledTimes(1);

            // Cleanup
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should include correct stage information in notification', async () => {
      // Feature: staged-attempt-flow-fixes, Property 27: Parent notification on transition
      
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
        {
          id: 'stage-3',
          exam_id: 'exam-1',
          stage_type: 'questions',
          stage_order: 3,
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

      onStageChange.mockClear();

      const button = screen.getAllByRole('button')[0];

      // Trigger first transition (stage 0 -> 1)
      fireEvent.click(button);

      await waitFor(
        () => {
          expect(onStageChange).toHaveBeenCalledWith(1);
        },
        { timeout: 2000 }
      );

      // Property: Notification should be called with correct index
      expect(onStageChange).toHaveBeenCalledWith(1);
      
      onStageChange.mockClear();

      // Wait for button to be enabled again
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      }, { timeout: 1000 });

      // Trigger second transition (stage 1 -> 2)
      fireEvent.click(button);

      await waitFor(
        () => {
          expect(onStageChange).toHaveBeenCalledWith(2);
        },
        { timeout: 2000 }
      );

      // Property: Notification should be called with correct index
      expect(onStageChange).toHaveBeenCalledWith(2);

      // Cleanup
      unmount();
    }, 10000);
  });
});
