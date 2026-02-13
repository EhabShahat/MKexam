/**
 * Unit Tests for Data Integrity Edge Cases
 * Feature: staged-attempt-flow-fixes
 * Task: 13.4
 * Validates: Requirements 8.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StageContainer from '../StageContainer';
import type { Stage, StageProgress, ExamInfo } from '@/lib/types';

vi.mock('@/lib/stageProgressQueue', () => ({
  stageProgressQueue: {
    enqueue: vi.fn(),
    processQueue: vi.fn(),
    getQueueSize: vi.fn(() => 0),
  },
  setupQueueProcessing: vi.fn(),
}));

vi.mock('@/components/public/PublicLocaleProvider', () => ({
  useStudentLocale: () => ({ locale: 'en' }),
}));

global.fetch = vi.fn();

describe('StageContainer - Data Integrity Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  const createTestStages = (): Stage[] => [
    {
      id: 'stage-1',
      exam_id: 'exam-1',
      stage_type: 'content',
      stage_order: 1,
      configuration: {
        slides: [{ title: 'Slide 1', content: 'Content 1' }],
        minimum_read_time: 0,
      },
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

  it('should preserve nested objects through save/load cycle', async () => {
    const savedData: any[] = [];

    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes('stage-progress') && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        savedData.push(body);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const nestedProgress: StageProgress[] = [
      {
        id: 'progress-1',
        attempt_id: 'attempt-1',
        stage_id: 'stage-1',
        started_at: new Date().toISOString(),
        completed_at: null,
        progress_data: {
          level1: {
            level2: {
              level3: { value: 'deeply nested', count: 42 },
            },
            array: [1, 2, 3],
          },
          metadata: {
            tags: ['tag1', 'tag2'],
            settings: { enabled: true },
          },
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={nestedProgress}
        exam={createTestExam()}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(savedData.length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    const saved = savedData[0];
    expect(saved.progress_data.level1.level2.level3.value).toBe('deeply nested');
    expect(saved.progress_data.level1.level2.level3.count).toBe(42);
    expect(saved.progress_data.level1.array).toEqual([1, 2, 3]);
    expect(saved.progress_data.metadata.tags).toEqual(['tag1', 'tag2']);
    expect(saved.progress_data.metadata.settings.enabled).toBe(true);

    unmount();
  });

  it('should preserve array order through save/load cycle', async () => {
    const savedData: any[] = [];

    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes('stage-progress') && options?.method === 'POST') {
        savedData.push(JSON.parse(options.body));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const arrayProgress: StageProgress[] = [
      {
        id: 'progress-1',
        attempt_id: 'attempt-1',
        stage_id: 'stage-1',
        started_at: new Date().toISOString(),
        completed_at: null,
        progress_data: {
          answers: ['first', 'second', 'third', 'fourth', 'fifth'],
          scores: [10, 20, 15, 30, 25],
          timestamps: [1000, 2000, 3000, 4000, 5000],
          mixed: [1, 'two', 3, 'four', 5],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={arrayProgress}
        exam={createTestExam()}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(savedData.length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    const saved = savedData[0];
    expect(saved.progress_data.answers).toEqual(['first', 'second', 'third', 'fourth', 'fifth']);
    expect(saved.progress_data.scores).toEqual([10, 20, 15, 30, 25]);
    expect(saved.progress_data.timestamps).toEqual([1000, 2000, 3000, 4000, 5000]);
    expect(saved.progress_data.mixed).toEqual([1, 'two', 3, 'four', 5]);
    expect(saved.progress_data.answers[0]).toBe('first');
    expect(saved.progress_data.answers[4]).toBe('fifth');
    expect(saved.progress_data.scores[2]).toBe(15);

    unmount();
  });

  it('should preserve timestamp precision (milliseconds)', async () => {
    const savedData: any[] = [];
    const preciseTimestamp = Date.now();

    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes('stage-progress') && options?.method === 'POST') {
        savedData.push(JSON.parse(options.body));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const timestampProgress: StageProgress[] = [
      {
        id: 'progress-1',
        attempt_id: 'attempt-1',
        stage_id: 'stage-1',
        started_at: new Date().toISOString(),
        completed_at: null,
        progress_data: {
          started_at: preciseTimestamp,
          events: [
            { timestamp: preciseTimestamp + 100, action: 'view' },
            { timestamp: preciseTimestamp + 250, action: 'interact' },
            { timestamp: preciseTimestamp + 1337, action: 'complete' },
          ],
          last_activity: preciseTimestamp + 2000,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={timestampProgress}
        exam={createTestExam()}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(savedData.length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    const saved = savedData[0];
    expect(saved.progress_data.started_at).toBe(preciseTimestamp);
    expect(saved.progress_data.events[0].timestamp).toBe(preciseTimestamp + 100);
    expect(saved.progress_data.events[1].timestamp).toBe(preciseTimestamp + 250);
    expect(saved.progress_data.events[2].timestamp).toBe(preciseTimestamp + 1337);
    expect(saved.progress_data.last_activity).toBe(preciseTimestamp + 2000);

    const timeDiff = saved.progress_data.events[2].timestamp - saved.progress_data.events[0].timestamp;
    expect(timeDiff).toBe(1237);

    unmount();
  });

  it('should handle empty progress data', async () => {
    const savedData: any[] = [];

    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes('stage-progress') && options?.method === 'POST') {
        savedData.push(JSON.parse(options.body));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const emptyProgress: StageProgress[] = [
      {
        id: 'progress-1',
        attempt_id: 'attempt-1',
        stage_id: 'stage-1',
        started_at: new Date().toISOString(),
        completed_at: null,
        progress_data: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={createTestStages()}
        stageProgress={emptyProgress}
        exam={createTestExam()}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(savedData.length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    const saved = savedData[0];
    expect(saved.progress_data).toBeDefined();
    expect(typeof saved.progress_data).toBe('object');
    expect(Object.keys(saved.progress_data).length).toBe(0);

    unmount();
  });
});
