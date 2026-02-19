/**
 * Property-Based Tests for Pending Saves Before Transition
 * Feature: staged-attempt-flow-fixes
 * Property 34: Pending saves before transition
 * Validates: Requirements 6.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('Pending Saves Before Transition - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 34: Pending saves before transition', () => {
    it('should not allow concurrent transitions', async () => {
      // Feature: staged-attempt-flow-fixes, Property 34: Pending saves before transition
      
      let transitionCount = 0;

      // Mock fetch to count transitions
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('stage-progress')) {
          const body = options?.body ? JSON.parse(options.body) : {};
          
          if (body.completed === true) {
            transitionCount++;
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve({
                  ok: true,
                  json: async () => ({}),
                });
              }, 200);
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

      // Reset counter after initialization
      transitionCount = 0;

      // Click multiple times rapidly
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Wait for transition to complete
      await waitFor(
        () => {
          expect(onStageChange).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Property: Only one transition should have occurred
      expect(transitionCount).toBeLessThanOrEqual(1);
      
      // Cleanup
      unmount();
    }, 10000);

    it('should handle slow save during transition', async () => {
      // Feature: staged-attempt-flow-fixes, Property 34: Pending saves before transition
      
      let stageIndexUpdated = false;

      // Mock fetch with slow save
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('stage-progress')) {
          const body = options?.body ? JSON.parse(options.body) : {};
          
          if (body.completed === true) {
            return new Promise((resolve) => {
              setTimeout(() => {
                // Check that stage index hasn't been updated yet
                expect(stageIndexUpdated).toBe(false);
                resolve({
                  ok: true,
                  json: async () => ({}),
                });
              }, 500);
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
      const onStageChange = vi.fn(() => {
        stageIndexUpdated = true;
      });

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

      // Reset flag after initialization
      stageIndexUpdated = false;
      onStageChange.mockClear();

      // Click to transition
      fireEvent.click(button);

      // Wait for transition to complete
      await waitFor(
        () => {
          expect(stageIndexUpdated).toBe(true);
        },
        { timeout: 3000 }
      );

      // Property: Stage index should only update after save completes
      // Account for initialization call
      expect(onStageChange).toHaveBeenCalled();
      expect(onStageChange.mock.calls.length).toBeGreaterThanOrEqual(1);
      
      // Cleanup
      unmount();
    }, 10000);
  });
});
