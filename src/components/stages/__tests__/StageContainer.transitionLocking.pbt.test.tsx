/**
 * Property-Based Tests for Stage Transition Locking
 * Feature: staged-attempt-flow-fixes
 * Property 3: Transition atomicity
 * Validates: Requirements 1.5, 6.1
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

describe('Stage Transition Locking - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  describe('Property 3: Transition atomicity', () => {
    it('should block concurrent transition attempts', async () => {
      // Feature: staged-attempt-flow-fixes, Property 3: Transition atomicity
      
      let transitionStartCount = 0;

      // Mock fetch to track transition starts
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('stage-progress')) {
          transitionStartCount++;
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({}),
              });
            }, 100);
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
      
      // Reset counter after initialization
      transitionStartCount = 0;
      (global.fetch as any).mockClear();

      // Simulate multiple rapid clicks (5 clicks)
      for (let i = 0; i < 5; i++) {
        fireEvent.click(button);
      }

      // Wait for any pending transitions
      await waitFor(
        () => {
          expect(button).not.toBeDisabled();
        },
        { timeout: 3000 }
      );

      // Property: Only ONE transition should have started despite multiple clicks
      expect(transitionStartCount).toBeLessThanOrEqual(1);
      
      // Cleanup
      unmount();
    }, 10000);

    it('should prevent transition while another is in progress', async () => {
      // Feature: staged-attempt-flow-fixes, Property 3: Transition atomicity
      
      let transitionStartCount = 0;

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('stage-progress')) {
          transitionStartCount++;
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({}),
              });
            }, 300);
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

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      const button = screen.getAllByRole('button')[0];
      
      // Reset counter after initialization
      transitionStartCount = 0;
      (global.fetch as any).mockClear();

      // First click - starts transition
      fireEvent.click(button);

      // Button should be disabled during transition
      await waitFor(() => {
        expect(button).toBeDisabled();
      }, { timeout: 1000 });

      // Try to click again while transition is in progress
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Wait for transition to complete
      await waitFor(
        () => {
          expect(button).not.toBeDisabled();
        },
        { timeout: 2000 }
      );

      // Property: Only one transition should have occurred
      expect(transitionStartCount).toBeLessThanOrEqual(1);
      
      // Cleanup
      unmount();
    }, 10000);
  });
});
