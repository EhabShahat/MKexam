/**
 * ExamSelector Component
 * 
 * Dropdown component for selecting exams with search, filtering, and status badges.
 * Supports "All Exams" and "Matrix View" special options.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.10
 */

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { Exam, StatusFilterValue } from '@/lib/results/types';

export interface ExamSelectorProps {
  /** List of exams to display */
  exams: Exam[];
  /** Currently selected exam ID (null for "All Exams", "matrix" for Matrix View) */
  selectedExamId: string | null;
  /** Callback when exam selection changes */
  onExamChange: (examId: string | null) => void;
  /** Current status filter */
  statusFilter: StatusFilterValue;
  /** Callback when status filter changes */
  onStatusFilterChange: (filter: StatusFilterValue) => void;
  /** Search term for filtering exams */
  searchTerm: string;
  /** Callback when search term changes */
  onSearchChange: (term: string) => void;
}

/**
 * Get exam type badge color classes
 */
function getExamTypeBadge(examType: 'exam' | 'homework' | 'quiz'): string {
  switch (examType) {
    case 'exam':
      return 'badge-primary';
    case 'homework':
      return 'badge-green';
    case 'quiz':
      return 'badge-red';
    default:
      return 'badge';
  }
}

/**
 * Get exam type display label
 */
function getExamTypeLabel(examType: 'exam' | 'homework' | 'quiz'): string {
  switch (examType) {
    case 'exam':
      return 'Exam';
    case 'homework':
      return 'Homework';
    case 'quiz':
      return 'Quiz';
    default:
      return examType;
  }
}

/**
 * Determine exam status based on scheduling mode
 */
function getExamStatus(exam: Exam): string {
  if (exam.scheduling_mode === 'Manual') {
    return exam.is_manually_published ? 'published' : 'draft';
  }
  
  const now = new Date();
  const startTime = exam.start_time ? new Date(exam.start_time) : null;
  const endTime = exam.end_time ? new Date(exam.end_time) : null;
  
  if (endTime && now > endTime) {
    return 'completed';
  }
  
  if (startTime && now >= startTime) {
    return 'published';
  }
  
  return 'draft';
}

/**
 * ExamSelector component
 */
export function ExamSelector({
  exams,
  selectedExamId,
  onExamChange,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
}: ExamSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get selected exam details
  const selectedExam = useMemo(() => {
    if (selectedExamId === null) return null;
    if (selectedExamId === 'matrix') return null;
    return exams.find((e) => e.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  // Filter exams by status
  const filteredExams = useMemo(() => {
    if (statusFilter === 'all') return exams;
    return exams.filter((exam) => getExamStatus(exam) === statusFilter);
  }, [exams, statusFilter]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle exam selection
  const handleSelectExam = (examId: string | null) => {
    onExamChange(examId);
    setIsOpen(false);
    onSearchChange(''); // Clear search when selecting
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Status Filter */}
      <div className="flex gap-2" role="tablist" aria-label="Exam status filter">
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'all'}
          aria-controls="exam-list"
          className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onStatusFilterChange('all')}
        >
          All
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'published'}
          aria-controls="exam-list"
          className={`btn btn-sm ${statusFilter === 'published' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onStatusFilterChange('published')}
        >
          Published
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'completed'}
          aria-controls="exam-list"
          className={`btn btn-sm ${statusFilter === 'completed' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onStatusFilterChange('completed')}
        >
          Completed
        </button>
      </div>

      {/* Exam Selector Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          className="btn w-full justify-between"
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Select exam"
        >
          <span className="flex items-center gap-2">
            {selectedExamId === null && <span>All Exams</span>}
            {selectedExamId === 'matrix' && <span>Matrix View</span>}
            {selectedExam && (
              <>
                <span>{selectedExam.title}</span>
                <span className={`badge ${getExamTypeBadge(selectedExam.exam_type)}`}>
                  {getExamTypeLabel(selectedExam.exam_type)}
                </span>
              </>
            )}
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute z-50 w-full mt-2 bg-[var(--elevated-surface)] border border-[var(--border)] rounded-lg shadow-lg max-h-96 overflow-hidden"
            role="listbox"
            id="exam-list"
          >
            {/* Search Input */}
            <div className="p-3 border-b border-[var(--border)]">
              <input
                ref={searchInputRef}
                type="text"
                className="input"
                placeholder="Search exams..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Search exams"
              />
            </div>

            {/* Options List */}
            <div className="overflow-y-auto max-h-80">
              {/* Special Options */}
              <button
                type="button"
                role="option"
                aria-selected={selectedExamId === null}
                className={`w-full text-left px-4 py-3 hover:bg-[var(--hover-overlay)] transition-colors ${
                  selectedExamId === null ? 'bg-[var(--hover-overlay)] font-semibold' : ''
                }`}
                onClick={() => handleSelectExam(null)}
              >
                All Exams
              </button>
              <button
                type="button"
                role="option"
                aria-selected={selectedExamId === 'matrix'}
                className={`w-full text-left px-4 py-3 hover:bg-[var(--hover-overlay)] transition-colors ${
                  selectedExamId === 'matrix' ? 'bg-[var(--hover-overlay)] font-semibold' : ''
                }`}
                onClick={() => handleSelectExam('matrix')}
              >
                Matrix View
              </button>

              {/* Divider */}
              {filteredExams.length > 0 && (
                <div className="border-t border-[var(--divider)] my-1" />
              )}

              {/* Exam List */}
              {filteredExams.length === 0 ? (
                <div className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  No exams found
                </div>
              ) : (
                filteredExams.map((exam) => (
                  <button
                    key={exam.id}
                    type="button"
                    role="option"
                    aria-selected={selectedExamId === exam.id}
                    className={`w-full text-left px-4 py-3 hover:bg-[var(--hover-overlay)] transition-colors ${
                      selectedExamId === exam.id ? 'bg-[var(--hover-overlay)] font-semibold' : ''
                    }`}
                    onClick={() => handleSelectExam(exam.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex-1 truncate">{exam.title}</span>
                      <span className={`badge ${getExamTypeBadge(exam.exam_type)}`}>
                        {getExamTypeLabel(exam.exam_type)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
