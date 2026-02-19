/**
 * ScoreBreakdownOverlay Component
 * 
 * Displays detailed score calculation breakdown in an overlay positioned
 * to avoid viewport overflow. Shows exam component, extra component, and
 * final score calculation with pass/fail status.
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.10
 */

'use client';

import { useEffect, useRef } from 'react';
import type { CalculationResult } from '@/lib/results/types';

export interface ScoreBreakdownOverlayProps {
  /** Student name for display */
  studentName: string;
  /** Calculation result with all breakdown details */
  calculation: CalculationResult;
  /** Callback when overlay should close */
  onClose: () => void;
  /** Position for the overlay */
  position: { top: number; left: number };
}

/**
 * Format score as percentage with 1 decimal place
 */
function formatScore(score: number | null): string {
  if (score === null) return '-';
  return `${score.toFixed(1)}%`;
}

/**
 * ScoreBreakdownOverlay component
 */
export function ScoreBreakdownOverlay({
  studentName,
  calculation,
  onClose,
  position,
}: ScoreBreakdownOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Adjust position to avoid viewport overflow
  useEffect(() => {
    if (!overlayRef.current) return;

    const overlay = overlayRef.current;
    const rect = overlay.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedTop = position.top;
    let adjustedLeft = position.left;

    // Adjust horizontal position if overflowing right
    if (rect.right > viewportWidth) {
      adjustedLeft = viewportWidth - rect.width - 16; // 16px padding
    }

    // Adjust horizontal position if overflowing left
    if (adjustedLeft < 16) {
      adjustedLeft = 16;
    }

    // Adjust vertical position if overflowing bottom
    if (rect.bottom > viewportHeight) {
      adjustedTop = viewportHeight - rect.height - 16;
    }

    // Adjust vertical position if overflowing top
    if (adjustedTop < 16) {
      adjustedTop = 16;
    }

    overlay.style.top = `${adjustedTop}px`;
    overlay.style.left = `${adjustedLeft}px`;
  }, [position]);

  const { exam_component, extra_component, final_score, passed, failed_due_to_exam, pass_threshold } = calculation;

  return (
    <div
      ref={overlayRef}
      className="fixed z-50 bg-[var(--elevated-surface)] border border-[var(--border)] rounded-lg shadow-xl max-w-md w-full"
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-labelledby="breakdown-title"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--divider)]">
        <h3 id="breakdown-title" className="font-semibold text-lg">
          Score Breakdown: {studentName}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Close breakdown"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Exam Component Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-[var(--muted-foreground)]">
              Exam Component ({exam_component.mode === 'best' ? 'Best Score' : 'Average Score'})
            </h4>
            <span className="font-semibold">{formatScore(exam_component.score)}</span>
          </div>

          {/* Exam Details */}
          <div className="space-y-1 text-sm">
            {exam_component.details.map((detail) => (
              <div key={detail.exam_id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="truncate">{detail.exam_title}</span>
                  {detail.passed ? (
                    <span className="text-[var(--success)] text-xs">✓</span>
                  ) : (
                    <span className="text-[var(--error)] text-xs">✗</span>
                  )}
                </div>
                <span className={detail.score === null ? 'text-[var(--muted-foreground)]' : ''}>
                  {formatScore(detail.score)}
                </span>
              </div>
            ))}
          </div>

          <div className="text-xs text-[var(--muted-foreground)] pt-1">
            {exam_component.exams_passed} of {exam_component.exams_included} exams passed
          </div>
        </div>

        {/* Extra Component Section */}
        {extra_component.details.length > 0 && (
          <div className="space-y-2 border-t border-[var(--divider)] pt-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-[var(--muted-foreground)]">
                Extra Component
              </h4>
              <span className="font-semibold">{formatScore(extra_component.score)}</span>
            </div>

            {/* Extra Field Details */}
            <div className="space-y-1 text-sm">
              {extra_component.details.map((detail) => (
                <div key={detail.field_key} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{detail.field_label}</span>
                    <span>{formatScore(detail.normalized_score)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                    <span>Raw: {String(detail.raw_value)}</span>
                    <span>Weight: {(detail.weight * 100).toFixed(0)}% → {formatScore(detail.weighted_contribution)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-[var(--muted-foreground)] pt-1">
              Total weight: {(extra_component.total_weight * 100).toFixed(0)}%
            </div>
          </div>
        )}

        {/* Final Score Section */}
        <div className="space-y-2 border-t border-[var(--divider)] pt-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-[var(--muted-foreground)]">
              Final Score
            </h4>
            <span className="font-semibold text-lg">{formatScore(final_score)}</span>
          </div>

          {/* Pass/Fail Status */}
          <div className={`flex items-center gap-2 p-2 rounded ${
            passed ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--error-bg)] text-[var(--error)]'
          }`}>
            {passed ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span className="font-semibold">
              {passed ? 'PASSED' : 'FAILED'}
            </span>
          </div>

          {/* Pass Threshold */}
          <div className="text-xs text-[var(--muted-foreground)]">
            Pass threshold: {formatScore(pass_threshold)}
          </div>

          {/* Failure Reason */}
          {failed_due_to_exam && (
            <div className="text-xs text-[var(--error)] bg-[var(--error-bg)] p-2 rounded">
              Failed due to exam requirement: One or more required exams below passing threshold
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
