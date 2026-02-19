/**
 * Unit tests for ManualGradingIndicator component
 * 
 * Tests pending state display, completed state display, and hidden state.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ManualGradingIndicator } from '../ManualGradingIndicator';

describe('ManualGradingIndicator', () => {
  describe('Pending State', () => {
    it('displays pending count with warning icon when pending > 0', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={5}
          manualGradedCount={2}
          manualPendingCount={3}
        />
      );

      expect(screen.getByText('3 pending')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        '3 questions pending manual grading'
      );
    });

    it('displays correct pending count for single question', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={1}
          manualGradedCount={0}
          manualPendingCount={1}
        />
      );

      expect(screen.getByText('1 pending')).toBeInTheDocument();
    });

    it('applies warning color class for pending state', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={3}
          manualGradedCount={0}
          manualPendingCount={3}
        />
      );

      const container = screen.getByRole('status');
      expect(container).toHaveClass('text-[var(--warning)]');
    });
  });

  describe('Completed State', () => {
    it('displays checkmark when all grading completed', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={5}
          manualGradedCount={5}
          manualPendingCount={0}
        />
      );

      expect(screen.getByText('Graded')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Manual grading completed'
      );
    });

    it('applies success color class for completed state', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={3}
          manualGradedCount={3}
          manualPendingCount={0}
        />
      );

      const container = screen.getByRole('status');
      expect(container).toHaveClass('text-[var(--success)]');
    });

    it('displays completed state when pending is 0 and total > 0', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={10}
          manualGradedCount={10}
          manualPendingCount={0}
        />
      );

      expect(screen.getByText('Graded')).toBeInTheDocument();
      expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
    });
  });

  describe('Hidden State', () => {
    it('renders nothing when manualTotalCount is 0', () => {
      const { container } = render(
        <ManualGradingIndicator
          manualTotalCount={0}
          manualGradedCount={0}
          manualPendingCount={0}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('does not display indicator when no manual grading questions', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={0}
          manualGradedCount={0}
          manualPendingCount={0}
        />
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles partial grading correctly', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={10}
          manualGradedCount={7}
          manualPendingCount={3}
        />
      );

      expect(screen.getByText('3 pending')).toBeInTheDocument();
    });

    it('prioritizes pending state over completed when pending > 0', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={5}
          manualGradedCount={4}
          manualPendingCount={1}
        />
      );

      expect(screen.getByText('1 pending')).toBeInTheDocument();
      expect(screen.queryByText('Graded')).not.toBeInTheDocument();
    });

    it('handles large pending counts', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={100}
          manualGradedCount={0}
          manualPendingCount={100}
        />
      );

      expect(screen.getByText('100 pending')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper role and aria-label for pending state', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={5}
          manualGradedCount={2}
          manualPendingCount={3}
        />
      );

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', '3 questions pending manual grading');
    });

    it('has proper role and aria-label for completed state', () => {
      render(
        <ManualGradingIndicator
          manualTotalCount={5}
          manualGradedCount={5}
          manualPendingCount={0}
        />
      );

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-label', 'Manual grading completed');
    });

    it('hides icons from screen readers with aria-hidden', () => {
      const { container } = render(
        <ManualGradingIndicator
          manualTotalCount={5}
          manualGradedCount={2}
          manualPendingCount={3}
        />
      );

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Visual Indicators', () => {
    it('displays warning icon for pending state', () => {
      const { container } = render(
        <ManualGradingIndicator
          manualTotalCount={5}
          manualGradedCount={2}
          manualPendingCount={3}
        />
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-4', 'h-4');
    });

    it('displays checkmark icon for completed state', () => {
      const { container } = render(
        <ManualGradingIndicator
          manualTotalCount={5}
          manualGradedCount={5}
          manualPendingCount={0}
        />
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-4', 'h-4');
    });
  });
});
