/**
 * Unit tests for ScoreBreakdownOverlay component
 * 
 * Tests breakdown display, close functionality, and positioning logic.
 * Requirements: 20.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoreBreakdownOverlay } from '../ScoreBreakdownOverlay';
import type { CalculationResult } from '@/lib/results/types';

describe('ScoreBreakdownOverlay', () => {
  const mockCalculation: CalculationResult = {
    exam_component: {
      mode: 'best',
      score: 85.5,
      exams_included: 3,
      exams_total: 3,
      exams_passed: 2,
      details: [
        {
          exam_id: 'exam1',
          exam_title: 'Midterm Exam',
          score: 85.5,
          passed: true,
          pass_threshold: 60,
        },
        {
          exam_id: 'exam2',
          exam_title: 'Final Exam',
          score: 75.0,
          passed: true,
          pass_threshold: 60,
        },
        {
          exam_id: 'exam3',
          exam_title: 'Quiz 1',
          score: 55.0,
          passed: false,
          pass_threshold: 60,
        },
      ],
    },
    extra_component: {
      score: 90.0,
      total_weight: 0.2,
      details: [
        {
          field_key: 'attendance',
          field_label: 'Attendance',
          raw_value: 18,
          normalized_score: 90.0,
          weight: 0.15,
          weighted_contribution: 13.5,
        },
        {
          field_key: 'participation',
          field_label: 'Participation',
          raw_value: 10,
          normalized_score: 100.0,
          weight: 0.05,
          weighted_contribution: 5.0,
        },
      ],
    },
    final_score: 86.4,
    passed: true,
    failed_due_to_exam: false,
    pass_threshold: 70,
  };

  const mockOnClose = vi.fn();
  const defaultPosition = { top: 100, left: 200 };

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  describe('Rendering', () => {
    it('should render student name in title', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByText(/Score Breakdown: John Doe/)).toBeInTheDocument();
    });

    it('should display exam component with mode', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByText(/Exam Component \(Best Score\)/)).toBeInTheDocument();
      expect(screen.getAllByText('85.5%').length).toBeGreaterThan(0);
    });

    it('should display average mode when mode is avg', () => {
      const avgCalculation = {
        ...mockCalculation,
        exam_component: {
          ...mockCalculation.exam_component,
          mode: 'avg' as const,
        },
      };

      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={avgCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByText(/Exam Component \(Average Score\)/)).toBeInTheDocument();
    });

    it('should display all exam details with pass/fail indicators', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByText('Midterm Exam')).toBeInTheDocument();
      expect(screen.getByText('Final Exam')).toBeInTheDocument();
      expect(screen.getByText('Quiz 1')).toBeInTheDocument();
      expect(screen.getByText('2 of 3 exams passed')).toBeInTheDocument();
    });

    it('should display extra component section when extra fields exist', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByText('Extra Component')).toBeInTheDocument();
      expect(screen.getByText('Attendance')).toBeInTheDocument();
      expect(screen.getByText('Participation')).toBeInTheDocument();
      expect(screen.getAllByText('90.0%').length).toBeGreaterThan(0);
    });

    it('should not display extra component section when no extra fields', () => {
      const noExtraCalculation = {
        ...mockCalculation,
        extra_component: {
          score: 0,
          total_weight: 0,
          details: [],
        },
      };

      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={noExtraCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.queryByText('Extra Component')).not.toBeInTheDocument();
    });

    it('should display extra field raw values and weights', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByText('Raw: 18')).toBeInTheDocument();
      expect(screen.getByText(/Weight: 15%/)).toBeInTheDocument();
    });

    it('should display final score section', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByText('Final Score')).toBeInTheDocument();
      expect(screen.getByText('86.4%')).toBeInTheDocument();
    });

    it('should display PASSED status when passed is true', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByText('PASSED')).toBeInTheDocument();
    });

    it('should display FAILED status when passed is false', () => {
      const failedCalculation = {
        ...mockCalculation,
        passed: false,
      };

      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={failedCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });

    it('should display pass threshold', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByText('Pass threshold: 70.0%')).toBeInTheDocument();
    });

    it('should display failure reason when failed_due_to_exam is true', () => {
      const failedDueToExamCalculation = {
        ...mockCalculation,
        passed: false,
        failed_due_to_exam: true,
      };

      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={failedDueToExamCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByText(/Failed due to exam requirement/)).toBeInTheDocument();
    });

    it('should not display failure reason when failed_due_to_exam is false', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.queryByText(/Failed due to exam requirement/)).not.toBeInTheDocument();
    });

    it('should display "-" for null exam scores', () => {
      const nullScoreCalculation = {
        ...mockCalculation,
        exam_component: {
          ...mockCalculation.exam_component,
          details: [
            {
              exam_id: 'exam1',
              exam_title: 'Not Attempted',
              score: null,
              passed: false,
              pass_threshold: 60,
            },
          ],
        },
      };

      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={nullScoreCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      const notAttemptedRow = screen.getByText('Not Attempted').closest('div');
      expect(notAttemptedRow).toContainHTML('-');
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      const closeButton = screen.getByLabelText('Close breakdown');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Escape key is pressed', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking outside overlay', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      fireEvent.mouseDown(document.body);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when clicking inside overlay', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      const overlay = screen.getByRole('dialog');
      fireEvent.mouseDown(overlay);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'breakdown-title');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should have accessible close button', () => {
      render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      );

      expect(screen.getByLabelText('Close breakdown')).toBeInTheDocument();
    });
  });

  describe('Positioning', () => {
    it('should apply initial position from props', () => {
      const { container } = render(
        <ScoreBreakdownOverlay
          studentName="John Doe"
          calculation={mockCalculation}
          onClose={mockOnClose}
          position={{ top: 150, left: 250 }}
        />
      );

      const overlay = container.querySelector('[role="dialog"]') as HTMLElement;
      expect(overlay.style.top).toBe('150px');
      expect(overlay.style.left).toBe('250px');
    });
  });
});
