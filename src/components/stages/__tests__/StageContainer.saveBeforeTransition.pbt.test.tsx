/**
 * Property-Based Tests for Save Before Transition
 * Feature: staged-attempt-flow-fixes
 * Property 1: Save before transition
 * Validates: Requirements 1.2, 2.5
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

describe('Save Before Transition - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 1: Save before transition', () => {
    it('should save progress before updating stage index', async () => {
      // Feature: staged-attempt-flow-fixes, Property 1: Save before transition
      
      const saveCallOrder: string[] = [];
      let stageIndexUpdated = false;

      // Mock fetch to track save calls
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('stage-progress')) {
          saveCallOrder.push('save_called');
          return new Promise((resolve) => {
            setTimeout(() => {
              saveCallOrder.push('save_completed');
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
      const onStageChange = vi.fn((index: number) => {
        saveCallOrder.push(`stage_index_updated_to_${index}`);
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
      
      // Reset tracking after initialization
      saveCallOrder.length = 0;
      stageIndexUpdated = false;
      (global.fetch as any).mockClear();

      // Click to transition
      fireEvent.click(button);

      // Wait for transition to complete
      await waitFor(
        () => {
          expect(stageIndexUpdated).toBe(true);
        },
        { timeout: 3000 }
      );

      // Property: Save must complete BEFORE stage index is updated
      const saveCompletedIndex = saveCallOrder.indexOf('save_completed');
      const stageUpdateIndex = saveCallOrder.findIndex(item => item.startsWith('stage_index_updated'));
      
      expect(saveCompletedIndex).toBeGreaterThanOrEqual(0);
      expect(stageUpdateIndex).toBeGreaterThan(saveCompletedIndex);
      
      // Cleanup
      unmount();
    }, 10000);

    it('should not update stage index if save fails', async () => {
      // Feature: staged-attempt-flow-fixes, Property 1: Save before transition
      
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

      // Clear mock after initialization
      onStageChange.mockClear();

      // Click to transition
      fireEvent.click(button);

      // Wait for error to appear
      await waitFor(
        () => {
          expect(screen.getByText(/Server error/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      // Property: Stage index should NOT have been updated
      expect(onStageChange).not.toHaveBeenCalled();
      
      // Cleanup
      unmount();
    }, 10000);

    it('should handle network errors without updating stage index', async () => {
      // Feature: staged-attempt-flow-fixes, Property 1: Save before transition
      
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

      // Clear mock after initialization
      onStageChange.mockClear();

      // Click to transition
      fireEvent.click(button);

      // Wait for error to appear
      await waitFor(
        () => {
          expect(screen.getByText(/Network error/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      // Property: Stage index should NOT have been updated
      expect(onStageChange).not.toHaveBeenCalled();
      
      // Cleanup
      unmount();
    }, 10000);
  });
});
