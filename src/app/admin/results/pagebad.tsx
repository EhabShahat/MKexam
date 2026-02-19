/**
 * Results Page - Rebuilt Modular Implementation
 * 
 * This is the new modular implementation that replaces the old monolithic 2000+ line component.
 * The page now uses separate components for exam selection, individual view, and aggregated view.
 * 
 * Architecture:
 * - ExamSelector: Handles exam selection and filtering
 * - IndividualExamView: Shows attempts for a single exam
 * - AllExamsView: Shows aggregated scores across all exams
 * - ResultsErrorBoundary: Handles errors gracefully
 * 
 * Requirements: All requirements from requirements.md (1.1-20.10)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useExams } from '@/hooks/results/useExams';
import { ExamSelector } from '@/components/results/ExamSelector';
import { IndividualExamView } from '@/components/results/IndividualExamView';
import { AllExamsView } from '@/components/results/AllExamsView';
import { ResultsErrorBoundary } from '@/components/results/ResultsErrorBoundary';
import ActionButton from '@/components/admin/ActionButton';

/**
 * Main Results Page Container
 */
export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get exam ID from URL params
  const examIdFromUrl = searchParams.get('examId');
  const [selectedExamId, setSelectedExamId] = useState<string | null>(examIdFromUrl);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'completed'>('published');
  const [examSearch, setExamSearch] = useState('');

  // Fetch exams
  const { exams, isLoading, error } = useExams({
    statusFilter,
    searchTerm: examSearch,
  });

  // Sync selected exam with URL
  useEffect(() => {
    if (selectedExamId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('examId', selectedExamId);
      router.replace(`/admin/results?${params.toString()}`, { scroll: false });
    }
  }, [selectedExamId, router, searchParams]);

  // Handle exam selection
  const handleExamChange = (examId: string | null) => {
    setSelectedExamId(examId);
  };

  // Determine current view
  const isAllExamsView = selectedExamId === '__ALL__';
  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Exam Results
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/extra-scores">
                <ActionButton variant="secondary">Manage Extra Scores</ActionButton>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Exam Selection */}
        <ResultsErrorBoundary>
          <ExamSelector
            exams={exams}
            selectedExamId={selectedExamId}
            onExamChange={handleExamChange}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            searchTerm={examSearch}
            onSearchChange={setExamSearch}
          />
        </ResultsErrorBoundary>

        {/* Main Content */}
        {isAllExamsView ? (
          <ResultsErrorBoundary>
            <AllExamsView exams={exams} />
          </ResultsErrorBoundary>
        ) : selectedExam ? (
          <ResultsErrorBoundary>
            <IndividualExamView examId={selectedExam.id} exam={selectedExam} />
          </ResultsErrorBoundary>
        ) : (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Exam Selected</h3>
            <p className="text-gray-600">Please select an exam from the list above to view results.</p>
          </div>
        )}
      </div>
    </div>
  );
}
