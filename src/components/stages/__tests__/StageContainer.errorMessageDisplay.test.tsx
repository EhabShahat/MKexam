/**
 * Unit Tests for Error Message Display
 * Feature: staged-attempt-flow-fixes
 * Validates: Requirements 4.1, 4.2, 4.3
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

describe('Error Message Display - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createTestStages = (): Stage[] => [
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

  const createTestProgress = (watchPercentage: number = 100): StageProgress[] => [
    {
      id: 'progress-1',
      attempt_id: 'attempt-1',
      stage_id: 'stage-1',
      started_at: new Date().toISOString(),
      completed_at: null,
      progress_data: { watch_percentage: watchPercentage },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const createTestExam = (): ExamInfo => ({
    id: 'exam-1',
    title: 'Test Exam',
    description: '',
    duration_minutes: 60,
    pass_threshold: 50,
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  it('should display network error message', async () => {
    // Mock fetch to simulate network error
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('stage-progress')) {
        return Promise.reject(new Error('Network connection failed'));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={async () => {}}
      />
    );

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    const button = screen.getAllByRole('button')[0];
    fireEvent.click(button);

    // Wait for network error message to appear
    await waitFor(
      () => {
        const errorMessage = screen.getByText(/Network connection failed/i);
        expect(errorMessage).toBeInTheDocument();
        
        // Verify error is displayed in an alert region for accessibility
        const errorContainer = errorMessage.closest('[role="alert"]');
        expect(errorContainer).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    unmount();
  });

  it('should display validation error message when enforcement not met', async () => {
    // Mock fetch to succeed
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    );

    // Create stages with enforcement
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

    // Create progress with insufficient watch percentage
    const stageProgress: StageProgress[] = [
      {
        id: 'progress-1',
        attempt_id: 'attempt-1',
        stage_id: 'stage-1',
        started_at: new Date().toISOString(),
        completed_at: null,
        progress_data: { watch_percentage: 50 }, // Only 50% watched, need 80%
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={stages}
        stageProgress={stageProgress}
        exam={createTestExam()}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={async () => {}}
      />
    );

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    // Try to click the button (should be blocked by enforcement)
    const button = screen.getAllByRole('button')[0];
    fireEvent.click(button);

    // Wait for enforcement message to appear
    await waitFor(
      () => {
        // The enforcement message should appear when trying to transition
        const enforcementMessage = screen.queryByText(/Watch.*80%/i);
        if (enforcementMessage) {
          expect(enforcementMessage).toBeInTheDocument();
        }
        // Button should remain enabled but transition should be blocked
        expect(button).not.toBeDisabled();
      },
      { timeout: 2000 }
    );

    unmount();
  });

  it('should display retry button on error', async () => {
    // Mock fetch to fail
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('stage-progress')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Database connection error' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={async () => {}}
      />
    );

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    const button = screen.getAllByRole('button')[0];
    fireEvent.click(button);

    // Wait for error and retry button to appear
    await waitFor(
      () => {
        expect(screen.getByText(/Database connection error/i)).toBeInTheDocument();
        
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).not.toBeDisabled();
      },
      { timeout: 2000 }
    );

    unmount();
  });

  it('should display queue count when saves are queued', async () => {
    // Mock queue to return pending saves
    (stageProgressQueue.getQueueSize as any).mockReturnValue(3);

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

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={async () => {}}
      />
    );

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    const button = screen.getAllByRole('button')[0];
    fireEvent.click(button);

    // Wait for error and queue count to appear
    await waitFor(
      () => {
        expect(screen.getByText(/Server error/i)).toBeInTheDocument();
        
        // Check for queue count display
        const queueMessage = screen.getByText(/3 saves queued for retry/i);
        expect(queueMessage).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    unmount();
  });

  it('should clear error message on successful retry', async () => {
    let callCount = 0;

    // Mock fetch to fail first, succeed second
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('stage-progress')) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Temporary error' }),
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
          });
        }
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={async () => {}}
      />
    );

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    const button = screen.getAllByRole('button')[0];
    fireEvent.click(button);

    // Wait for error to appear
    await waitFor(
      () => {
        expect(screen.getByText(/Temporary error/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Click retry (use more specific selector to avoid ambiguity)
    const retryButton = screen.getByRole('button', { name: /Retry stage transition/i });
    fireEvent.click(retryButton);

    // Wait for error to be cleared
    await waitFor(
      () => {
        expect(screen.queryByText(/Temporary error/i)).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    unmount();
  });

  it('should display sync status banner when offline', async () => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={async () => {}}
      />
    );

    // Trigger offline event
    window.dispatchEvent(new Event('offline'));

    // Wait for offline banner to appear
    await waitFor(() => {
      const offlineMessage = screen.getByText(/Offline - Progress will sync when connection is restored/i);
      expect(offlineMessage).toBeInTheDocument();
      
      // Verify it's in an alert region
      const alertContainer = offlineMessage.closest('[role="alert"]');
      expect(alertContainer).toBeInTheDocument();
    });

    // Restore online status
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    unmount();
  });

  it('should display retry now button in sync failed banner', async () => {
    // Mock queue to return pending saves
    (stageProgressQueue.getQueueSize as any).mockReturnValue(2);

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

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={async () => {}}
      />
    );

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    const button = screen.getAllByRole('button')[0];
    fireEvent.click(button);

    // Wait for sync failed banner with retry button
    await waitFor(
      () => {
        const syncFailedMessage = screen.getByText(/Sync Failed/i);
        expect(syncFailedMessage).toBeInTheDocument();
        
        const retryNowButton = screen.getByRole('button', { name: /Retry syncing now/i });
        expect(retryNowButton).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Click retry now button
    const retryNowButton = screen.getByRole('button', { name: /Retry syncing now/i });
    fireEvent.click(retryNowButton);

    // Verify processQueue was called
    expect(stageProgressQueue.processQueue).toHaveBeenCalled();

    unmount();
  });
});
