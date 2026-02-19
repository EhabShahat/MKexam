import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import type { Question, QuestionsStageConfig } from '@/lib/types';

// Set environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

// Import after setting env vars
const QuestionsStage = (await import('../QuestionsStage')).default;

describe('QuestionsStage', () => {
  const mockQuestions: Question[] = [
    {
      id: 'q1',
      question_text: 'Question 1',
      question_type: 'single_choice',
      options: ['A', 'B', 'C'],
      points: 10,
      required: true,
      order_index: 0,
    },
    {
      id: 'q2',
      question_text: 'Question 2',
      question_type: 'paragraph',
      points: 20,
      required: false,
      order_index: 1,
    },
    {
      id: 'q3',
      question_text: 'Question 3',
      question_type: 'true_false',
      points: 5,
      required: true,
      order_index: 2,
    },
  ];

  const mockStage = {
    id: 'stage-1',
    configuration: {
      question_ids: ['q1', 'q2'],
      randomize_within_stage: false,
    } as QuestionsStageConfig,
  };

  const mockAnswers = {
    q1: 'A',
  };

  const mockProps = {
    stage: mockStage,
    questions: mockQuestions,
    answers: mockAnswers,
    onAnswerChange: vi.fn(),
    onProgressUpdate: vi.fn(),
    onComplete: vi.fn(),
    disabled: false,
    displayMode: 'full' as const,
    attemptId: 'attempt-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter questions by question_ids from stage configuration', () => {
    render(<QuestionsStage {...mockProps} />);

    // Should render q1 and q2 text, but not q3
    expect(screen.getByText('Question 1')).toBeInTheDocument();
    expect(screen.getByText('Question 2')).toBeInTheDocument();
    expect(screen.queryByText('Question 3')).not.toBeInTheDocument();
  });

  it('should display progress indicator with answered count', () => {
    render(<QuestionsStage {...mockProps} />);

    // Should show 1 of 2 answered (q1 is answered)
    expect(screen.getByText('1 of 2 answered')).toBeInTheDocument();
  });

  it('should call onProgressUpdate with correct progress data', () => {
    render(<QuestionsStage {...mockProps} />);

    // Should have been called with progress data
    expect(mockProps.onProgressUpdate).toHaveBeenCalledWith({
      answered_count: 1,
      total_count: 2,
    });
  });

  it('should handle empty question list', () => {
    const emptyStage = {
      ...mockStage,
      configuration: {
        question_ids: [],
        randomize_within_stage: false,
      },
    };

    render(<QuestionsStage {...mockProps} stage={emptyStage} />);

    expect(screen.getByText('No questions available for this stage.')).toBeInTheDocument();
  });

  it('should update progress when answers change', () => {
    const { rerender } = render(<QuestionsStage {...mockProps} />);

    // Initially 1 answered
    expect(mockProps.onProgressUpdate).toHaveBeenLastCalledWith({
      answered_count: 1,
      total_count: 2,
    });

    // Add answer to q2
    const updatedAnswers = {
      q1: 'A',
      q2: 'Some paragraph answer',
    };

    rerender(<QuestionsStage {...mockProps} answers={updatedAnswers} />);

    // Now 2 answered
    expect(mockProps.onProgressUpdate).toHaveBeenLastCalledWith({
      answered_count: 2,
      total_count: 2,
    });
  });

  it('should display question counter for each question', () => {
    render(<QuestionsStage {...mockProps} />);

    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument();
  });
});
