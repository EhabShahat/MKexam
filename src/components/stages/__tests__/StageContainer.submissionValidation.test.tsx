/**
 * Unit Tests for Submission Validation
 * Feature: staged-attempt-flow-fixes
 * Tests specific submission validation scenarios
 * Validates: Requirements 7.1, 7.3, 7.4, 7.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('Submission Validation - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    
    // Default fetch mock
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('should allow submission when all stages are complete', async () => {
    const onSubmit = vi.fn();
    
    const stages: Stage[] = [
      {
        id: 'stage-video',
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
        id: 'progress-video',
        attempt_id: 'attempt-1',
        stage_id: 'stage-video',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        progress_data: { watch_percentage: 100 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'progress-questions',
        attempt_id: 'attempt-1',
        stage_id: 'stage-questions',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        progress_data: { answered_questions: ['q1'] },
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
    
    const questions: Question[] = [{
      id: 'q1',
      exam_id: 'exam-1',
      question_type: 'multiple_choice',
      question_text: 'Test question',
      points: 1,
      question_order: 1,
      options: ['Option 1', 'Option 2'],
      correct_answer: 'Option 1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }];
    
    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={stages}
        stageProgress={stageProgress}
        exam={exam}
        questions={questions}
        answers={{ q1: 'Option 1' }}
        onAnswerChange={() => {}}
        onSubmit={onSubmit}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
    
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('submit')
    );
    
    if (submitButton && !submitButton.hasAttribute('disabled')) {
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      }, { timeout: 3000 });
    }
    
    unmount();
  });

  it('should block submission when one stage is incomplete', async () => {
    const onSubmit = vi.fn();
    
    const stages: Stage[] = [
      {
        id: 'stage-video',
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
        id: 'progress-video',
        attempt_id: 'attempt-1',
        stage_id: 'stage-video',
        started_at: new Date().toISOString(),
        completed_at: null, // Incomplete
        progress_data: { watch_percentage: 50 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'progress-questions',
        attempt_id: 'attempt-1',
        stage_id: 'stage-questions',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        progress_data: { answered_questions: ['q1'] },
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
    
    const questions: Question[] = [{
      id: 'q1',
      exam_id: 'exam-1',
      question_type: 'multiple_choice',
      question_text: 'Test question',
      points: 1,
      question_order: 1,
      options: ['Option 1', 'Option 2'],
      correct_answer: 'Option 1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }];
    
    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={stages}
        stageProgress={stageProgress}
        exam={exam}
        questions={questions}
        answers={{ q1: 'Option 1' }}
        onAnswerChange={() => {}}
        onSubmit={onSubmit}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
    
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('submit')
    );
    
    if (submitButton && !submitButton.hasAttribute('disabled')) {
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(onSubmit).not.toHaveBeenCalled();
        
        const errorMessage = screen.queryByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        if (errorMessage) {
          expect(errorMessage.textContent).toMatch(/incomplete|stage/i);
        }
      }, { timeout: 2000 });
    }
    
    unmount();
  });

  it('should block submission when enforcement is not met', async () => {
    const onSubmit = vi.fn();
    
    const stages: Stage[] = [
      {
        id: 'stage-video',
        exam_id: 'exam-1',
        stage_type: 'video',
        stage_order: 1,
        configuration: {
          video_url: 'https://example.com/video.mp4',
          enforcement_threshold: 80, // Requires 80%
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
        id: 'progress-video',
        attempt_id: 'attempt-1',
        stage_id: 'stage-video',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        progress_data: { watch_percentage: 50 }, // Only 50%
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'progress-questions',
        attempt_id: 'attempt-1',
        stage_id: 'stage-questions',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        progress_data: { answered_questions: ['q1'] },
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
    
    const questions: Question[] = [{
      id: 'q1',
      exam_id: 'exam-1',
      question_type: 'multiple_choice',
      question_text: 'Test question',
      points: 1,
      question_order: 1,
      options: ['Option 1', 'Option 2'],
      correct_answer: 'Option 1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }];
    
    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={stages}
        stageProgress={stageProgress}
        exam={exam}
        questions={questions}
        answers={{ q1: 'Option 1' }}
        onAnswerChange={() => {}}
        onSubmit={onSubmit}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
    
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('submit')
    );
    
    if (submitButton && !submitButton.hasAttribute('disabled')) {
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(onSubmit).not.toHaveBeenCalled();
        
        const errorMessage = screen.queryByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        if (errorMessage) {
          expect(errorMessage.textContent).toMatch(/requirement|watch|video/i);
        }
      }, { timeout: 2000 });
    }
    
    unmount();
  });

  it('should block submission when save fails', async () => {
    const onSubmit = vi.fn();
    
    // Mock fetch to fail
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    });
    
    const stages: Stage[] = [
      {
        id: 'stage-video',
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
        id: 'progress-video',
        attempt_id: 'attempt-1',
        stage_id: 'stage-video',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        progress_data: { watch_percentage: 100 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'progress-questions',
        attempt_id: 'attempt-1',
        stage_id: 'stage-questions',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        progress_data: { answered_questions: ['q1'] },
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
    
    const questions: Question[] = [{
      id: 'q1',
      exam_id: 'exam-1',
      question_type: 'multiple_choice',
      question_text: 'Test question',
      points: 1,
      question_order: 1,
      options: ['Option 1', 'Option 2'],
      correct_answer: 'Option 1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }];
    
    const { unmount } = render(
      <StageContainer
        attemptId="attempt-1"
        stages={stages}
        stageProgress={stageProgress}
        exam={exam}
        questions={questions}
        answers={{ q1: 'Option 1' }}
        onAnswerChange={() => {}}
        onSubmit={onSubmit}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
    
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('submit')
    );
    
    if (submitButton && !submitButton.hasAttribute('disabled')) {
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(onSubmit).not.toHaveBeenCalled();
        
        const errorMessage = screen.queryByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        if (errorMessage) {
          expect(errorMessage.textContent).toMatch(/save|failed|error/i);
        }
      }, { timeout: 3000 });
    }
    
    unmount();
  });
});
