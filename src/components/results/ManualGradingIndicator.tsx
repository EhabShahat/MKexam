/**
 * ManualGradingIndicator Component
 * 
 * Displays manual grading status for attempts with manually graded questions.
 * Shows pending count with warning icon or checkmark when completed.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

'use client';

export interface ManualGradingIndicatorProps {
  /** Total count of manually graded questions */
  manualTotalCount: number;
  /** Count of manually graded questions */
  manualGradedCount: number;
  /** Count of pending manual grading questions */
  manualPendingCount: number;
}

/**
 * ManualGradingIndicator component
 */
export function ManualGradingIndicator({
  manualTotalCount,
  manualGradedCount,
  manualPendingCount,
}: ManualGradingIndicatorProps) {
  // No indicator if no manual grading
  if (manualTotalCount === 0) {
    return null;
  }

  // Pending grading - show warning with count
  if (manualPendingCount > 0) {
    return (
      <div
        className="flex items-center gap-1 text-xs text-[var(--warning)]"
        role="status"
        aria-label={`${manualPendingCount} questions pending manual grading`}
      >
        <svg
          className="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <span>{manualPendingCount} pending</span>
      </div>
    );
  }

  // Grading completed - show checkmark
  return (
    <div
      className="flex items-center gap-1 text-xs text-[var(--success)]"
      role="status"
      aria-label="Manual grading completed"
    >
      <svg
        className="w-4 h-4"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span>Graded</span>
    </div>
  );
}
