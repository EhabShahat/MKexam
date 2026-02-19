/**
 * IndividualExamView Component
 * 
 * Displays attempts for a single exam with virtual scrolling, filtering,
 * sorting, and actions (delete, regrade).
 * 
 * Requirements: 3.1-3.10, 6.1-6.8, 7.1-7.5, 10.1, 11.1-11.2, 13.3, 13.5
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAttempts } from '@/hooks/results/useAttempts';
import { filterAttemptsByStudent, filterAttemptsByDateRange, sortAttemptsByScore } from '@/lib/results/filterSort';
import { DeviceInfoCell } from './DeviceInfoCell';
import { ManualGradingIndicator } from './ManualGradingIndicator';
import type { Exam, SortOrder } from '@/lib/results/types';

export interface IndividualExamViewProps {
  /** Exam ID to display attempts for */
  examId: string;
  /** Exam details */
  exam: Exam;
}

/**
 * Format duration in minutes
 */
function formatDuration(startedAt: string | null, submittedAt: string | null): string {
  if (!startedAt || !submittedAt) return '-';
  
  const start = new Date(startedAt).getTime();
  const end = new Date(submittedAt).getTime();
  const minutes = Math.round((end - start) / 60000);
  
  return `${minutes} min`;
}

/**
 * Format date/time for display
 */
function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Cairo',
  }).format(date);
}

/**
 * IndividualExamView component
 */
export function IndividualExamView({ examId, exam }: IndividualExamViewProps) {
  const [studentFilter, setStudentFilter] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('none');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isRegrading, setIsRegrading] = useState(false);

  // Fetch attempts data
  const { attempts, isLoading, error, refetch, deviceUsageMap } = useAttempts(examId);

  // Debounced student filter (300ms)
  const debouncedStudentFilter = useMemo(() => {
    const timer = setTimeout(() => studentFilter, 300);
    return () => clearTimeout(timer);
  }, [studentFilter]);

  // Apply filters and sorting
  const filteredAndSortedAttempts = useMemo(() => {
    let result = attempts;

    // Filter by student name/code
    if (studentFilter.trim()) {
      result = filterAttemptsByStudent(result, studentFilter);
    }

    // Filter by date range
    if (startDate || endDate) {
      result = filterAttemptsByDateRange(result, startDate || null, endDate || null);
    }

    // Sort by score
    if (sortOrder !== 'none') {
      result = sortAttemptsByScore(result, sortOrder);
    }

    return result;
  }, [attempts, studentFilter, startDate, endDate, sortOrder]);

  // Virtual scrolling setup (threshold: 50 rows)
  const [parentRef, setParentRef] = useState<HTMLDivElement | null>(null);
  const useVirtualScrolling = filteredAndSortedAttempts.length > 50;

  const virtualizer = useVirtualizer({
    count: filteredAndSortedAttempts.length,
    getScrollElement: () => parentRef,
    estimateSize: () => 80,
    enabled: useVirtualScrolling,
  });

  // Handle delete attempt
  const handleDelete = useCallback(async (attemptId: string) => {
    try {
      const response = await fetch(`/api/admin/attempts/${attemptId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete attempt');
      }

      // Refetch data
      await refetch();
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting attempt:', err);
      alert('Failed to delete attempt. Please try again.');
    }
  }, [refetch]);

  // Handle regrade all
  const handleRegradeAll = useCallback(async () => {
    if (isRegrading) return;

    setIsRegrading(true);
    try {
      const response = await fetch(`/api/admin/exams/${examId}/regrade`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to regrade attempts');
      }

      const data = await response.json();
      alert(`Successfully regraded ${data.result.regraded_count} attempts`);

      // Refetch data
      await refetch();
    } catch (err) {
      console.error('Error regrading attempts:', err);
      alert('Failed to regrade attempts. Please try again.');
    } finally {
      setIsRegrading(false);
    }
  }, [examId, refetch, isRegrading]);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setStudentFilter('');
    setStartDate('');
    setEndDate('');
    setSortOrder('none');
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[var(--muted-foreground)]">Loading attempts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[var(--error)]">Error loading attempts: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Student Filter */}
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="student-filter" className="block text-sm font-medium mb-1">
            Search Student
          </label>
          <input
            id="student-filter"
            type="text"
            className="input"
            placeholder="Name or code..."
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            aria-label="Filter by student name or code"
          />
        </div>

        {/* Date Range Filters */}
        <div className="flex gap-2">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium mb-1">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Filter by start date"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium mb-1">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="Filter by end date"
            />
          </div>
        </div>

        {/* Sort Controls */}
        <div>
          <label htmlFor="sort-order" className="block text-sm font-medium mb-1">
            Sort by Score
          </label>
          <select
            id="sort-order"
            className="input"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            aria-label="Sort by score"
          >
            <option value="none">None</option>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        {/* Clear Filters */}
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleClearFilters}
          aria-label="Clear all filters"
        >
          Clear Filters
        </button>

        {/* Regrade All */}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleRegradeAll}
          disabled={isRegrading || attempts.length === 0}
          aria-label="Regrade all attempts"
        >
          {isRegrading ? 'Regrading...' : 'Regrade All'}
        </button>
      </div>

      {/* Result Count */}
      <div className="text-sm text-[var(--muted-foreground)]">
        Showing {filteredAndSortedAttempts.length} of {attempts.length} attempts
      </div>

      {/* Attempts Table */}
      {filteredAndSortedAttempts.length === 0 ? (
        <div className="text-center p-8 text-[var(--muted-foreground)]">
          No attempts found
        </div>
      ) : (
        <div
          ref={setParentRef}
          className="border border-[var(--border)] rounded-lg overflow-auto"
          style={{ height: useVirtualScrolling ? '600px' : 'auto' }}
        >
          <table className="w-full">
            <thead className="bg-[var(--elevated-surface)] sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Student</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Submitted</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Duration</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Score</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Device</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {useVirtualScrolling
                ? virtualizer.getVirtualItems().map((virtualRow) => {
                    const attempt = filteredAndSortedAttempts[virtualRow.index];
                    return (
                      <tr
                        key={attempt.id}
                        className="border-t border-[var(--divider)] hover:bg-[var(--hover-overlay)]"
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {/* Row content - extracted to avoid duplication */}
                        <AttemptRow
                          attempt={attempt}
                          deviceUsageMap={deviceUsageMap}
                          onDelete={() => setDeleteConfirmId(attempt.id)}
                          deleteConfirmId={deleteConfirmId}
                          onConfirmDelete={handleDelete}
                          onCancelDelete={() => setDeleteConfirmId(null)}
                        />
                      </tr>
                    );
                  })
                : filteredAndSortedAttempts.map((attempt) => (
                    <tr
                      key={attempt.id}
                      className="border-t border-[var(--divider)] hover:bg-[var(--hover-overlay)]"
                    >
                      <AttemptRow
                        attempt={attempt}
                        deviceUsageMap={deviceUsageMap}
                        onDelete={() => setDeleteConfirmId(attempt.id)}
                        deleteConfirmId={deleteConfirmId}
                        onConfirmDelete={handleDelete}
                        onCancelDelete={() => setDeleteConfirmId(null)}
                      />
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * AttemptRow component - extracted to avoid duplication
 */
function AttemptRow({
  attempt,
  deviceUsageMap,
  onDelete,
  deleteConfirmId,
  onConfirmDelete,
  onCancelDelete,
}: {
  attempt: any;
  deviceUsageMap: Map<string, number>;
  onDelete: () => void;
  deleteConfirmId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}) {
  const displayScore = attempt.manual_pending_count > 0
    ? attempt.score_percentage
    : attempt.final_score_percentage ?? attempt.score_percentage;

  return (
    <>
      <td className="px-4 py-3">
        <div className="font-medium">{attempt.student_name || 'Anonymous'}</div>
        {attempt.code && (
          <div className="text-sm text-[var(--muted-foreground)]">{attempt.code}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm">{formatDateTime(attempt.submitted_at)}</td>
      <td className="px-4 py-3 text-sm">
        {formatDuration(attempt.started_at, attempt.submitted_at)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {displayScore !== null ? `${displayScore.toFixed(1)}%` : '-'}
          </span>
          <ManualGradingIndicator
            manualTotalCount={attempt.manual_total_count}
            manualGradedCount={attempt.manual_graded_count}
            manualPendingCount={attempt.manual_pending_count}
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <DeviceInfoCell
          deviceInfo={attempt.device_info}
          ipAddress={attempt.ip_address}
          deviceUsageMap={deviceUsageMap}
        />
      </td>
      <td className="px-4 py-3">
        <span
          className={`badge ${
            attempt.completion_status === 'completed'
              ? 'badge-green'
              : attempt.completion_status === 'in_progress'
              ? 'badge-primary'
              : 'badge-outline'
          }`}
        >
          {attempt.completion_status}
        </span>
      </td>
      <td className="px-4 py-3">
        {deleteConfirmId === attempt.id ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-error"
              onClick={() => onConfirmDelete(attempt.id)}
              aria-label="Confirm delete"
            >
              Confirm
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={onCancelDelete}
              aria-label="Cancel delete"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={onDelete}
            aria-label="Delete attempt"
          >
            Delete
          </button>
        )}
      </td>
    </>
  );
}
