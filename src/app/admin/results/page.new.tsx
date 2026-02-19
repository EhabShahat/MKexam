"use client";

/**
 * Results Page - Modular Implementation
 * Feature: results-page-rebuild
 * 
 * This is the new modular implementation that will replace the monolithic page.tsx
 * after testing and validation.
 */

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import { ResultsErrorBoundary } from "@/components/results/ResultsErrorBoundary";
import { ExamSelector } from "@/components/results/ExamSelector";
import { IndividualExamView } from "@/components/results/IndividualExamView";
import { AllExamsView } from "@/components/results/AllExamsView";
import { useExams } from "@/hooks/results/useExams";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import type { StatusFilterValue } from "@/components/admin/StatusFilter";

type ViewMode = "individual" | "all" | "matrix";

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Get initial exam ID from URL params
  const initialExamId = searchParams.get("exam") || "";
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("published");
  const [examSearch, setExamSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Load status filter from sessionStorage on mount
  useEffect(() => {
    try {
      const savedFilter = sessionStorage.getItem("results-status-filter");
      if (savedFilter === "all" || savedFilter === "published" || savedFilter === "completed") {
        setStatusFilter(savedFilter as StatusFilterValue);
      }
    } catch (error) {
      console.warn("Failed to load filter from sessionStorage:", error);
    }
  }, []);

  // Save status filter to sessionStorage when it changes
  useEffect(() => {
    try {
      sessionStorage.setItem("results-status-filter", statusFilter);
    } catch (error) {
      console.warn("Failed to save filter to sessionStorage:", error);
    }
  }, [statusFilter]);

  // Fetch exams with status filtering
  const { exams, isLoading: examsLoading, error: examsError, refetch: refetchExams } = useExams({
    statusFilter,
    searchTerm: examSearch,
  });

  // Determine view mode based on selected exam
  const viewMode: ViewMode = useMemo(() => {
    if (!selectedExamId) return "all";
    if (selectedExamId === "__ALL__") return "all";
    return "individual";
  }, [selectedExamId]);

  // Find selected exam object
  const selectedExam = useMemo(() => {
    if (!selectedExamId || selectedExamId === "__ALL__") return null;
    return exams.find((e) => e.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  // Handle exam selection
  const handleExamChange = (examId: string) => {
    setSelectedExamId(examId);
    
    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    if (examId && examId !== "__ALL__") {
      params.set("exam", examId);
    } else {
      params.delete("exam");
    }
    router.push(`/admin/results?${params.toString()}`, { scroll: false });
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Invalidate all results-related queries
      await queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "attempts"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "results"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "summaries"] });
      
      toast.success({
        title: "Refreshed",
        message: "Data refreshed successfully",
      });
    } catch (error) {
      toast.error({
        title: "Refresh Failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-select first published exam if none selected
  useEffect(() => {
    if (!selectedExamId && exams.length > 0 && !examsLoading) {
      const firstPublished = exams.find((e) => {
        // Check if exam is published based on scheduling mode
        if (e.scheduling_mode === "Manual") {
          return e.is_manually_published === true;
        } else {
          // Auto mode - check if current time is between start and end
          const now = new Date();
          const start = e.start_time ? new Date(e.start_time) : null;
          const end = e.end_time ? new Date(e.end_time) : null;
          return start && now >= start && (!end || now <= end);
        }
      });
      
      if (firstPublished) {
        handleExamChange(firstPublished.id);
      }
    }
  }, [selectedExamId, exams, examsLoading]);

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-card/80 backdrop-blur-sm border-b border-border/50">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Exam Results
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  View and analyze exam attempts and scores
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="btn btn-secondary flex items-center gap-2"
                  aria-label="Refresh data"
                >
                  <svg
                    className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Exam Selector */}
          <ResultsErrorBoundary>
            <ExamSelector
              exams={exams}
              selectedExamId={selectedExamId}
              onExamChange={handleExamChange}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              searchTerm={examSearch}
              onSearchChange={setExamSearch}
              isLoading={examsLoading}
            />
          </ResultsErrorBoundary>

          {/* Error State */}
          {examsError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-medium">Failed to load exams</span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                {examsError instanceof Error ? examsError.message : "Unknown error"}
              </p>
              <button
                onClick={() => refetchExams()}
                className="mt-2 text-sm text-red-700 underline hover:text-red-800"
              >
                Try again
              </button>
            </div>
          )}

          {/* View Content */}
          {!examsError && (
            <ResultsErrorBoundary>
              {viewMode === "individual" && selectedExam && (
                <IndividualExamView
                  examId={selectedExam.id}
                  exam={selectedExam}
                />
              )}

              {viewMode === "all" && (
                <AllExamsView exams={exams} />
              )}
            </ResultsErrorBoundary>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}
