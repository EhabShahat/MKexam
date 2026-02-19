/**
 * AllExamsView Component
 * 
 * Displays aggregated student scores across all exams with virtual scrolling,
 * pass/fail indicators, summary statistics, and expandable score breakdowns.
 * 
 * Requirements: 4.1-4.10, 6.3-6.8, 7.2-7.5, 13.1, 13.3, 18.1-18.10, 19.1-19.5
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSummaries } from '@/hooks/results/useSummaries';
import { useSettings } from '@/hooks/results/useSettings';
import { useExtraFields } from '@/hooks/results/useExtraFields';
import { useExams } from '@/hooks/results/useExams';
import { calculateExamComponent, calculateExtraComponent, calculateFinalScore } from '@/lib/results/scoreCalculator';
import { ScoreBreakdownOverlay } from './ScoreBreakdownOverlay';
import type { Exam, StudentSummary, CalculationResult, SortOrder } from '@/lib/results/types';

export interface AllExamsViewProps {
  /** List of exams to display */
  exams: Exam[];
}

/**
 * Format score as percentage with 1 decimal place
 */
function formatScore(score: number | null): string {
  if (score === null) return '-';
  return `${score.toFixed(1)}%`;
}

/**
 * Get exam type badge class
 */
function getExamTypeBadge(examType: string): string {
  switch (examType) {
    case 'exam':
      return 'badge-primary';
    case 'quiz':
      return 'badge-blue';
    case 'homework':
      return 'badge-green';
    default:
      return 'badge-outline';
  }
}

/**
 * AllExamsView component
 */
export function AllExamsView({ exams }: AllExamsViewProps) {
  const [studentSearch, setStudentSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'none' | 'finalAsc' | 'finalDesc'>('none');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [breakdownPosition, setBreakdownPosition] = useState({ top: 0, left: 0 });

  // Fetch data
  const { summaries, isLoading: summariesLoading, error: summariesError } = useSummaries();
  const { settings, isLoading: settingsLoading, error: settingsError } = useSettings();
  const { visibleFields, isLoading: fieldsLoading } = useExtraFields();

  const isLoading = summariesLoading || settingsLoading || fieldsLoading;
  const error = summariesError || settingsError;

  // Filter non-archived exams
  const activeExams = useMemo(() => {
    return exams.filter(exam => !exam.is_archived);
  }, [exams]);

  // Calculate final scores for all students
  const calculations = useMemo(() => {
    if (!settings) return new Map<string, CalculationResult>();

    const calcMap = new Map<string, CalculationResult>();

    for (const summary of summaries) {
      const examComponent = calculateExamComponent(
        summary.scores,
        activeExams,
        settings.result_pass_calc_mode
      );

      const extraComponent = calculateExtraComponent(
        summary.extra_data || {},
        visibleFields
      );

      const calculation = calculateFinalScore(
        examComponent,
        extraComponent,
        settings
      );

      calcMap.set(summary.student_id, calculation);
    }

    return calcMap;
  }, [summaries, activeExams, visibleFields, settings]);

  // Filter by student search
  const filteredSummaries = useMemo(() => {
    if (!studentSearch.trim()) return summaries;

    const searchLower = studentSearch.toLowerCase();
    return summaries.filter(summary => {
      const nameMatch = summary.student_name?.toLowerCase().includes(searchLower);
      const codeMatch = summary.code?.toLowerCase().includes(searchLower);
      return nameMatch || codeMatch;
    });
  }, [summaries, studentSearch]);

  // Sort by final score
  const sortedSummaries = useMemo(() => {
    if (sortOrder === 'none') return filteredSummaries;

    return [...filteredSummaries].sort((a, b) => {
      const calcA = calculations.get(a.student_id);
      const calcB = calculations.get(b.student_id);

      const scoreA = calcA?.final_score ?? -1;
      const scoreB = calcB?.final_score ?? -1;

      if (sortOrder === 'finalAsc') {
        return scoreA - scoreB;
      } else {
        return scoreB - scoreA;
      }
    });
  }, [filteredSummaries, sortOrder, calculations]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    let passCount = 0;
    let totalCount = sortedSummaries.length;

    for (const summary of sortedSummaries) {
      const calc = calculations.get(summary.student_id);
      if (calc?.passed) {
        passCount++;
      }
    }

    const passRate = totalCount > 0 ? (passCount / totalCount) * 100 : 0;

    return { passCount, totalCount, passRate };
  }, [sortedSummaries, calculations]);

  // Virtual scrolling setup (threshold: 50 rows)
  const [parentRef, setParentRef] = useState<HTMLDivElement | null>(null);
  const useVirtualScrolling = sortedSummaries.length > 50;

  const virtualizer = useVirtualizer({
    count: sortedSummaries.length,
    getScrollElement: () => parentRef,
    estimateSize: () => 60,
    enabled: useVirtualScrolling,
  });

  // Handle breakdown toggle
  const handleBreakdownToggle = useCallback((studentId: string, event: React.MouseEvent) => {
    if (expandedStudentId === studentId) {
      setExpandedStudentId(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setBreakdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
      });
      setExpandedStudentId(studentId);
    }
  }, [expandedStudentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[var(--muted-foreground)]">Loading aggregated data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[var(--error)]">Error loading data: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Statistics */}
      <div className="flex gap-4 items-center p-4 bg-[var(--elevated-surface)] rounded-lg border border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted-foreground)]">Pass Count:</span>
          <span className="font-semibold text-lg">{summaryStats.passCount}</span>
        </div>
        <div className="text-[var(--divider)]">|</div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted-foreground)]">Total Students:</span>
          <span className="font-semibold text-lg">{summaryStats.totalCount}</span>
        </div>
        <div className="text-[var(--divider)]">|</div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted-foreground)]">Pass Rate:</span>
          <span className="font-semibold text-lg">{summaryStats.passRate.toFixed(1)}%</span>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Student Search */}
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="student-search" className="block text-sm font-medium mb-1">
            Search Student
          </label>
          <input
            id="student-search"
            type="text"
            className="input"
            placeholder="Name or code..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            aria-label="Search by student name or code"
          />
        </div>

        {/* Sort Controls */}
        <div>
          <label htmlFor="sort-order" className="block text-sm font-medium mb-1">
            Sort by Final Score
          </label>
          <select
            id="sort-order"
            className="input"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
            aria-label="Sort by final score"
          >
            <option value="none">None</option>
            <option value="finalAsc">Ascending</option>
            <option value="finalDesc">Descending</option>
          </select>
        </div>
      </div>

      {/* Result Count */}
      <div className="text-sm text-[var(--muted-foreground)]">
        Showing {sortedSummaries.length} of {summaries.length} students
      </div>

      {/* Aggregated Table */}
      {sortedSummaries.length === 0 ? (
        <div className="text-center p-8 text-[var(--muted-foreground)]">
          No students found
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
                {activeExams.map(exam => (
                  <th key={exam.id} className="px-4 py-3 text-left text-sm font-semibold">
                    <div className="flex flex-col gap-1">
                      <span className="truncate max-w-[150px]" title={exam.title}>
                        {exam.title}
                      </span>
                      <span className={`badge badge-sm ${getExamTypeBadge(exam.exam_type)}`}>
                        {exam.exam_type}
                      </span>
                    </div>
                  </th>
                ))}
                {visibleFields.map(field => (
                  <th key={field.key} className="px-4 py-3 text-left text-sm font-semibold">
                    {field.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-sm font-semibold">Exam Component</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Extra Component</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Final Score</th>
              </tr>
            </thead>
            <tbody>
              {useVirtualScrolling
                ? virtualizer.getVirtualItems().map((virtualRow) => {
                    const summary = sortedSummaries[virtualRow.index];
                    const calculation = calculations.get(summary.student_id);
                    return (
                      <tr
                        key={summary.student_id}
                        className="border-t border-[var(--divider)] hover:bg-[var(--hover-overlay)]"
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <StudentRow
                          summary={summary}
                          calculation={calculation}
                          activeExams={activeExams}
                          visibleFields={visibleFields}
                          onBreakdownToggle={handleBreakdownToggle}
                        />
                      </tr>
                    );
                  })
                : sortedSummaries.map((summary) => {
                    const calculation = calculations.get(summary.student_id);
                    return (
                      <tr
                        key={summary.student_id}
                        className="border-t border-[var(--divider)] hover:bg-[var(--hover-overlay)]"
                      >
                        <StudentRow
                          summary={summary}
                          calculation={calculation}
                          activeExams={activeExams}
                          visibleFields={visibleFields}
                          onBreakdownToggle={handleBreakdownToggle}
                        />
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {/* Score Breakdown Overlay */}
      {expandedStudentId && (() => {
        const summary = sortedSummaries.find(s => s.student_id === expandedStudentId);
        const calculation = calculations.get(expandedStudentId);
        
        if (summary && calculation) {
          return (
            <ScoreBreakdownOverlay
              studentName={summary.student_name}
              calculation={calculation}
              onClose={() => setExpandedStudentId(null)}
              position={breakdownPosition}
            />
          );
        }
        return null;
      })()}
    </div>
  );
}

/**
 * StudentRow component - extracted to avoid duplication
 */
function StudentRow({
  summary,
  calculation,
  activeExams,
  visibleFields,
  onBreakdownToggle,
}: {
  summary: StudentSummary;
  calculation: CalculationResult | undefined;
  activeExams: Exam[];
  visibleFields: any[];
  onBreakdownToggle: (studentId: string, event: React.MouseEvent) => void;
}) {
  return (
    <>
      {/* Student Info */}
      <td className="px-4 py-3">
        <div className="font-medium">{summary.student_name}</div>
        {summary.code && (
          <div className="text-sm text-[var(--muted-foreground)]">{summary.code}</div>
        )}
      </td>

      {/* Exam Scores */}
      {activeExams.map(exam => {
        const score = summary.scores[exam.id];
        return (
          <td key={exam.id} className="px-4 py-3 text-sm">
            {formatScore(score)}
          </td>
        );
      })}

      {/* Extra Fields */}
      {visibleFields.map(field => {
        const value = summary.extra_data?.[field.key];
        return (
          <td key={field.key} className="px-4 py-3 text-sm">
            {value !== null && value !== undefined ? String(value) : '-'}
          </td>
        );
      })}

      {/* Exam Component */}
      <td className="px-4 py-3 text-sm font-semibold">
        {calculation ? formatScore(calculation.exam_component.score) : '-'}
      </td>

      {/* Extra Component */}
      <td className="px-4 py-3 text-sm font-semibold">
        {calculation ? formatScore(calculation.extra_component.score) : '-'}
      </td>

      {/* Final Score with Pass/Fail */}
      <td className="px-4 py-3">
        <button
          type="button"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          onClick={(e) => onBreakdownToggle(summary.student_id, e)}
          aria-label="View score breakdown"
        >
          <span className="font-semibold text-lg">
            {calculation ? formatScore(calculation.final_score) : '-'}
          </span>
          {calculation && (
            <span className={calculation.passed ? 'text-[var(--success)]' : 'text-[var(--error)]'}>
              {calculation.passed ? '✓' : '✗'}
            </span>
          )}
        </button>
      </td>
    </>
  );
}
