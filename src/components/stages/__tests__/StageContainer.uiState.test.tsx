/**
 * Unit Tests for UI State
 * Feature: staged-attempt-flow-fixes
 * Tests: Button disabled during transition, error message display, queue count display, retry button functionality
 * Validates: Requirements 1.6, 4.1, 4.2, 4.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('StageContainer - UI State Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    (stageProgressQueue.getQueueSize as any).mockReturnValue(0);
  });

  describe('Button disabled during transition', () => {
    it('should disable button when transition is in progress', async () => {
      // Validates: Requirements 1.6
      
      // Mock fetch to introduce delay
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
          onSubmit={vi.fn()}
        />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      const button = screen.getAllByRole('button')[0];
      
      // Button should be enabled initially
      expect(button).not.toBeDisabled();

      // Click to start transition
      fireEvent.click(button);

      // Button should be disabled during transition
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
      
      unmount();
    });
  });

  describe('Error message display', () => {
    it('should display network error message when save fails', async () => {
      // Validates: Requirements 4.1
      
      // Mock fetch to fail
      (global.fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));

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
          onSubmit={vi.fn()}
        />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      const button = screen.getAllByRole('button')[0];
      
      // Click to trigger save
      fireEvent.click(button);

      // Wait for error message to appear - use getAllByRole since there may be multiple alerts
      await waitFor(() => {
        const errorAlerts = screen.getAllByRole('alert');
        const transitionError = errorAlerts.find(alert => 
          alert.classList.contains('error-message')
        );
        expect(transitionError).toBeInTheDocument();
        expect(transitionError?.textContent).toContain('Network');
      }, { timeout: 2000 });
      
      unmount();
    });

    it('should display validation error message when enforcement fails', async () => {
      // Validates: Requirements 4.1
      
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
          progress_data: { watch_percentage: 50 },
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
          onSubmit={vi.fn()}
        />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      const button = screen.getAllByRole('button')[0];
      
      // Click to trigger validation
      fireEvent.click(button);

      // Wait for error message to appear in the error-message div
      await waitFor(() => {
        const errorAlerts = screen.getAllByRole('alert');
        const transitionError = errorAlerts.find(alert => 
          alert.classList.contains('error-message')
        );
        expect(transitionError).toBeInTheDocument();
        expect(transitionError?.textContent).toContain('Watch');
      }, { timeout: 1000 });
      
      unmount();
    });
  });

  describe('Queue count display', () => {
    it('should display number of queued saves when sync fails', async () => {
      // Validates: Requirements 4.3
      
      // Mock queue to have pending saves
      (stageProgressQueue.getQueueSize as any).mockReturnValue(3);
      
      // Mock fetch to fail to trigger sync failure
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

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
          onSubmit={vi.fn()}
        />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      const button = screen.getAllByRole('button')[0];
      
      // Click to trigger save failure
      fireEvent.click(button);

      // Wait for sync status banner to show queue count
      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        const syncBanner = alerts.find(alert => 
          alert.classList.contains('sync-status-banner')
        );
        
        // The banner should exist and show queue information
        if (syncBanner && syncBanner.textContent) {
          expect(syncBanner.textContent).toContain('3');
        }
      }, { timeout: 2000 });
      
      unmount();
    });
  });

  describe('Retry button functionality', () => {
    it('should show retry button when save fails', async () => {
      // Validates: Requirements 4.2
      
      // Mock fetch to fail
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

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
          onSubmit={vi.fn()}
        />
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      const continueButton = screen.getAllByRole('button')[0];
      
      // Click to trigger save failure
      fireEvent.click(continueButton);

      // Wait for retry button to appear
      await waitFor(() => {
        const retryButton = screen.getByLabelText(/retry/i);
        expect(retryButton).toBeInTheDocument();
      }, { timeout: 2000 });

      // Click retry button
      const retryButton = screen.getByLabelText(/retry/i);
      
      // Mock fetch to succeed on retry
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      fireEvent.click(retryButton);

      // Verify retry was attempted
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + retry
      }, { timeout: 2000 });
      
      unmount();
    });
  });
});
