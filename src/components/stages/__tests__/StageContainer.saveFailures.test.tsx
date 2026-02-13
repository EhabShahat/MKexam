/**
 * Unit Tests for Save Failure Scenarios
 * Feature: staged-attempt-flow-fixes
 * Validates: Requirements 1.4, 4.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('Save Failure Scenarios - Unit Tests', () => {
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

  const createTestProgress = (): StageProgress[] => [
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

  it('should handle network timeout', async () => {
    // Mock fetch to simulate timeout
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('stage-progress')) {
        return Promise.reject(new Error('Network timeout'));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onStageChange = vi.fn();

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
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
    onStageChange.mockClear();

    fireEvent.click(button);

    // Wait for error to appear
    await waitFor(
      () => {
        expect(screen.getByText(/Network timeout/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Stage should not have transitioned
    expect(onStageChange).not.toHaveBeenCalled();

    unmount();
  });

  it('should handle 500 server error', async () => {
    // Mock fetch to return 500 error
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('stage-progress')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal server error' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onStageChange = vi.fn();

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
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
    onStageChange.mockClear();

    fireEvent.click(button);

    // Wait for error to appear
    await waitFor(
      () => {
        expect(screen.getByText(/Internal server error/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Stage should not have transitioned
    expect(onStageChange).not.toHaveBeenCalled();

    unmount();
  });

  it('should handle 404 not found', async () => {
    // Mock fetch to return 404 error
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('stage-progress')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Attempt not found' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onStageChange = vi.fn();

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
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
    onStageChange.mockClear();

    fireEvent.click(button);

    // Wait for error to appear
    await waitFor(
      () => {
        expect(screen.getByText(/Attempt not found/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Stage should not have transitioned
    expect(onStageChange).not.toHaveBeenCalled();

    unmount();
  });

  it('should handle invalid response format', async () => {
    // Mock fetch to return invalid JSON
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('stage-progress')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onStageChange = vi.fn();

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
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
    onStageChange.mockClear();

    fireEvent.click(button);

    // Wait for error to appear (should show generic server error)
    await waitFor(
      () => {
        expect(screen.getByText(/Server error: 500/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Stage should not have transitioned
    expect(onStageChange).not.toHaveBeenCalled();

    unmount();
  });

  it('should display retry button on save failure', async () => {
    // Mock fetch to fail
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('stage-progress')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Save failed' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onStageChange = vi.fn();

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
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

    fireEvent.click(button);

    // Wait for error and retry button to appear
    await waitFor(
      () => {
        expect(screen.getByText(/Save failed/i)).toBeInTheDocument();
        expect(screen.getByText(/Retry/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    unmount();
  });

  it('should allow retry after save failure', async () => {
    let callCount = 0;

    // Mock fetch to fail first time, succeed second time
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('stage-progress')) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Save failed' }),
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

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onStageChange = vi.fn();

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={createTestProgress()}
        exam={createTestExam()}
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
    onStageChange.mockClear();

    // First attempt - should fail
    fireEvent.click(button);

    // Wait for error and retry button
    await waitFor(
      () => {
        expect(screen.getByText(/Save failed/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Click retry button
    const retryButton = screen.getByText(/Retry/i);
    fireEvent.click(retryButton);

    // Wait for successful transition
    await waitFor(
      () => {
        expect(onStageChange).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    unmount();
  });
});
