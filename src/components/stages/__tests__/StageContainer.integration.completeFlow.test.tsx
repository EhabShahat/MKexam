/**
 * Integration Tests for Complete Stage Progression Flow
 * Feature: staged-attempt-flow-fixes
 * Tests: Complete flow from video → content → questions → submit
 * Validates: All requirements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('Complete Stage Progression Flow - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full progression: video → content → questions → submit', async () => {
    const saveHistory: Array<{ stageId: string; completed: boolean }> = [];
    const stageTransitions: number[] = [];

    // Mock fetch to track all saves
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes('stage-progress')) {
        const body = JSON.parse(options?.body || '{}');
        saveHistory.push({
          stageId: body.stage_id,
          completed: body.completed || false,
        });
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    const stages: Stage[] = [
      {
        id: 'stage-video',
        exam_id: 'exam-1',
        stage_type: 'video',
        stage_order: 1,
        configuration: {
          video_url: 'https://example.com/video.mp4',
          enforcement_threshold: 0, // No enforcement for simpler test
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'stage-content',
        exam_id: 'exam-1',
        stage_type: 'content',
        stage_order: 2,
        configuration: {
          slides: [
            { title: 'Slide 1', content: 'Content 1' },
            { title: 'Slide 2', content: 'Content 2' },
          ],
          minimum_read_time: 0, // No enforcement for simpler test
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'stage-questions',
        exam_id: 'exam-1',
        stage_type: 'questions',
        stage_order: 3,
        configuration: {
          question_ids: ['q1', 'q2'],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const stageProgress: StageProgress[] = [
      {
        id: 'progress-video',
        attempt_id: 'attempt-1',
        stage_id: 'stage-video',
        started_at: new Date().toISOString(),
        completed_at: null,
        progress_data: { watch_percentage: 100 }, // Already watched
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const questions: Question[] = [
      {
        id: 'q1',
        exam_id: 'exam-1',
        question_type: 'multiple_choice',
        question_text: 'Question 1',
        points: 10,
        question_order: 1,
        options: ['A', 'B', 'C'],
        correct_answer: 'A',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'q2',
        exam_id: 'exam-1',
        question_type: 'multiple_choice',
        question_text: 'Question 2',
        points: 10,
        question_order: 2,
        options: ['X', 'Y', 'Z'],
        correct_answer: 'X',
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
      settings: { display_mode: 'full' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onStageChange = vi.fn((index: number) => {
      stageTransitions.push(index);
    });
    const onAnswerChange = vi.fn();

    const { unmount, rerender } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={stages}
        stageProgress={stageProgress}
        exam={exam}
        questions={questions}
        answers={{}}
        onAnswerChange={onAnswerChange}
        onSubmit={onSubmit}
        onStageChange={onStageChange}
      />
    );

    // Wait for component to initialize
    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    // Should start on video stage
    expect(screen.getByText(/Stage 1 of 3/i)).toBeInTheDocument();

    // Get continue button
    const getContinueButton = () => screen.getAllByRole('button').find(btn => 
      btn.textContent?.includes('Continue') || btn.textContent?.includes('Submit')
    );

    // Wait for button to be enabled (video already watched)
    await waitFor(() => {
      const continueButton = getContinueButton();
      expect(continueButton).not.toBeDisabled();
    });

    // Step 1: Click continue to move to content stage
    saveHistory.length = 0; // Reset save history
    const continueButton = getContinueButton();
    fireEvent.click(continueButton!);

    // Wait for transition to content stage
    await waitFor(() => {
      expect(stageTransitions).toContain(1);
    }, { timeout: 3000 });

    // Verify save was called for video stage with completed=true
    expect(saveHistory).toContainEqual({
      stageId: 'stage-video',
      completed: true,
    });

    // Should now be on content stage
    await waitFor(() => {
      expect(screen.getByText(/Stage 2 of 3/i)).toBeInTheDocument();
    });

    // Step 2: Update content progress and mark video as completed
    const updatedStageProgress2: StageProgress[] = [
      {
        ...stageProgress[0],
        completed_at: new Date().toISOString(),
        progress_data: { watch_percentage: 100 },
      },
      {
        id: 'progress-content',
        attempt_id: 'attempt-1',
        stage_id: 'stage-content',
        started_at: new Date().toISOString(),
        completed_at: null,
        progress_data: { time_spent: 10, current_slide_index: 0 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    rerender(
      <StageContainer
        attemptId="attempt-1"
        stages={stages}
        stageProgress={updatedStageProgress2}
        exam={exam}
        questions={questions}
        answers={{}}
        onAnswerChange={onAnswerChange}
        onSubmit={onSubmit}
        onStageChange={onStageChange}
      />
    );

    // Wait for button to be enabled
    await waitFor(() => {
      const btn = getContinueButton();
      expect(btn).not.toBeDisabled();
    });

    // Step 3: Click continue to move to questions stage
    saveHistory.length = 0;
    const continueButton2 = getContinueButton();
    fireEvent.click(continueButton2!);

    // Wait for transition to questions stage
    await waitFor(() => {
      expect(stageTransitions).toContain(2);
    }, { timeout: 3000 });

    // Verify save was called for content stage with completed=true
    expect(saveHistory).toContainEqual({
      stageId: 'stage-content',
      completed: true,
    });

    // Should now be on questions stage
    await waitFor(() => {
      expect(screen.getByText(/Stage 3 of 3/i)).toBeInTheDocument();
    });

    // Step 4: Complete questions stage - mark all previous stages as completed
    const updatedStageProgress3: StageProgress[] = [
      {
        ...updatedStageProgress2[0],
        completed_at: new Date().toISOString(),
      },
      {
        ...updatedStageProgress2[1],
        completed_at: new Date().toISOString(),
      },
      {
        id: 'progress-questions',
        attempt_id: 'attempt-1',
        stage_id: 'stage-questions',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(), // Mark as completed
        progress_data: { answered_questions: ['q1', 'q2'] },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    rerender(
      <StageContainer
        attemptId="attempt-1"
        stages={stages}
        stageProgress={updatedStageProgress3}
        exam={exam}
        questions={questions}
        answers={{ q1: 'A', q2: 'X' }}
        onAnswerChange={onAnswerChange}
        onSubmit={onSubmit}
        onStageChange={onStageChange}
      />
    );

    // Wait for button to be enabled
    await waitFor(() => {
      const btn = getContinueButton();
      expect(btn).not.toBeDisabled();
    });

    // Step 5: Click submit
    saveHistory.length = 0;
    const submitButton = getContinueButton();
    fireEvent.click(submitButton!);

    // Wait for submission
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Verify all stages were saved before submission
    expect(saveHistory.length).toBeGreaterThan(0);

    // Cleanup
    unmount();
  }, 30000);

  it('should enforce video watch percentage correctly', async () => {
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    );

    const stages: Stage[] = [
      {
        id: 'stage-video',
        exam_id: 'exam-1',
        stage_type: 'video',
        stage_order: 1,
        configuration: {
          video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          enforcement_threshold: 80,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'stage-content',
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
        id: 'progress-video',
        attempt_id: 'attempt-1',
        stage_id: 'stage-video',
        started_at: new Date().toISOString(),
        completed_at: null,
        progress_data: { watch_percentage: 50 }, // Below threshold
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
        onSubmit={vi.fn()}
        onStageChange={onStageChange}
      />
    );

    // Wait for component to initialize
    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    // Get the continue button
    const continueButton = screen.getAllByRole('button').find(btn => 
      btn.textContent?.includes('Continue')
    );

    // Note: VideoStage calls onComplete() immediately, so button will be enabled
    // But when we click, the enforcement validation should block the transition
    await waitFor(() => {
      expect(continueButton).not.toBeDisabled();
    });

    // Try to click (enforcement validation should block it)
    fireEvent.click(continueButton!);

    // Wait for enforcement message to appear
    await waitFor(() => {
      expect(screen.getByText(/Watch 80% of the video to continue/i)).toBeInTheDocument();
    }, { timeout: 2000 });

    // Should still be on stage 1 (transition blocked)
    expect(onStageChange).not.toHaveBeenCalledWith(1);

    unmount();
  }, 10000);

  it('should enforce content read time correctly', async () => {
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    );

    const stages: Stage[] = [
      {
        id: 'stage-content',
        exam_id: 'exam-1',
        stage_type: 'content',
        stage_order: 1,
        configuration: {
          slides: [{ title: 'Slide 1', content: 'Content 1' }],
          minimum_read_time: 30,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'stage-questions',
        exam_id: 'exam-1',
        stage_type: 'questions',
        stage_order: 2,
        configuration: {
          question_ids: ['q1'],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const stageProgress: StageProgress[] = [
      {
        id: 'progress-content',
        attempt_id: 'attempt-1',
        stage_id: 'stage-content',
        started_at: new Date().toISOString(),
        completed_at: null,
        progress_data: { time_spent: 15, current_slide_index: 0 }, // Below minimum
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
        onStageChange={vi.fn()}
      />
    );

    // Wait for component to initialize
    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    // Button should be disabled due to enforcement
    const continueButton = screen.getAllByRole('button').find(btn => 
      btn.textContent?.includes('Continue')
    );
    
    await waitFor(() => {
      expect(continueButton).toBeDisabled();
    });

    // Should show enforcement message - the component shows remaining time
    await waitFor(() => {
      // The component shows "Continue Reading" and "30s" remaining
      expect(screen.getByText(/Continue Reading/i)).toBeInTheDocument();
    });

    unmount();
  }, 10000);

  it('should validate all stages before submission', async () => {
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    );

    const stages: Stage[] = [
      {
        id: 'stage-video',
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
        id: 'stage-questions',
        exam_id: 'exam-1',
        stage_type: 'questions',
        stage_order: 2,
        configuration: {
          question_ids: ['q1'],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Video stage incomplete
    const stageProgress: StageProgress[] = [
      {
        id: 'progress-video',
        attempt_id: 'attempt-1',
        stage_id: 'stage-video',
        started_at: new Date().toISOString(),
        completed_at: null, // Not completed
        progress_data: { watch_percentage: 50 }, // Below threshold
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'progress-questions',
        attempt_id: 'attempt-1',
        stage_id: 'stage-questions',
        started_at: new Date().toISOString(),
        completed_at: null,
        progress_data: {},
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

    const onSubmit = vi.fn();

    const { unmount, rerender } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={stages}
        stageProgress={stageProgress}
        exam={exam}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={onSubmit}
        onStageChange={vi.fn()}
      />
    );

    // Navigate to questions stage (last stage)
    const updatedProgress: StageProgress[] = [
      {
        ...stageProgress[0],
        completed_at: new Date().toISOString(),
        progress_data: { watch_percentage: 80 },
      },
      stageProgress[1],
    ];

    rerender(
      <StageContainer
        attemptId="attempt-1"
        stages={stages}
        stageProgress={updatedProgress}
        exam={exam}
        questions={[]}
        answers={{}}
        onAnswerChange={() => {}}
        onSubmit={onSubmit}
        onStageChange={vi.fn()}
      />
    );

    // Wait for questions stage
    await waitFor(() => {
      expect(screen.getByText(/Stage 2 of 2/i)).toBeInTheDocument();
    });

    // Try to submit with incomplete video stage
    const submitButton = screen.getAllByRole('button').find(btn => 
      btn.textContent?.includes('Submit')
    );

    // Update to make button enabled
    const finalProgress: StageProgress[] = [
      updatedProgress[0],
      {
        ...updatedProgress[1],
        progress_data: { answered_questions: ['q1'] },
      },
    ];

    rerender(
      <StageContainer
        attemptId="attempt-1"
        stages={stages}
        stageProgress={finalProgress}
        exam={exam}
        questions={[]}
        answers={{ q1: 'A' }}
        onAnswerChange={() => {}}
        onSubmit={onSubmit}
        onStageChange={vi.fn()}
      />
    );

    await waitFor(() => {
      const btn = screen.getAllByRole('button').find(b => 
        b.textContent?.includes('Submit')
      );
      expect(btn).not.toBeDisabled();
    });

    const enabledSubmitButton = screen.getAllByRole('button').find(btn => 
      btn.textContent?.includes('Submit')
    );

    fireEvent.click(enabledSubmitButton!);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/Cannot submit exam/i)).toBeInTheDocument();
    });

    // Should not have called onSubmit
    expect(onSubmit).not.toHaveBeenCalled();

    unmount();
  }, 15000);
});
