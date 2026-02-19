"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import ModernCard from "@/components/admin/ModernCard";
import ActionButton from "@/components/admin/ActionButton";

interface StageAnalytics {
  stage_id: string;
  stage_type: string;
  stage_order: number;
  total_attempts: number;
  completed_attempts: number;
  completion_rate: number;
  avg_time_spent_seconds: number;
  avg_watch_percentage: number;
  avg_slide_time_seconds: number;
}

interface VideoStageAnalytics {
  stage_id: string;
  stage_order: number;
  youtube_url: string;
  enforcement_threshold: number | null;
  total_attempts: number;
  completed_attempts: number;
  avg_watch_percentage: number;
  avg_total_watch_time: number;
  min_watch_percentage: number;
  max_watch_percentage: number;
}

interface ContentStageAnalytics {
  stage_id: string;
  stage_order: number;
  total_slides: number;
  minimum_read_time_per_slide: number | null;
  total_attempts: number;
  completed_attempts: number;
  avg_time_per_slide: number;
  avg_total_time: number;
}

interface Exam {
  id: string;
  title: string;
}

export default function StageAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const examId = params.examId as string;
  
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  // Fetch exam details
  const examQuery = useQuery({
    queryKey: ["admin", "exams", examId],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch exam");
      }
      const data = await res.json();
      return data.exam as Exam;
    },
  });

  // Fetch overall stage analytics
  const analyticsQuery = useQuery({
    queryKey: ["admin", "exams", examId, "stage-analytics"],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/analytics`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch stage analytics");
      }
      const data = await res.json();
      return data.analytics as StageAnalytics[];
    },
  });

  // Fetch video stage analytics
  const videoAnalyticsQuery = useQuery({
    queryKey: ["admin", "exams", examId, "video-analytics"],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/analytics/video`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch video analytics");
      }
      const data = await res.json();
      return data.analytics as VideoStageAnalytics[];
    },
  });

  // Fetch content stage analytics
  const contentAnalyticsQuery = useQuery({
    queryKey: ["admin", "exams", examId, "content-analytics"],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/analytics/content`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch content analytics");
      }
      const data = await res.json();
      return data.analytics as ContentStageAnalytics[];
    },
  });

  const exam = examQuery.data;
  const analytics = analyticsQuery.data || [];
  const videoAnalytics = videoAnalyticsQuery.data || [];
  const contentAnalytics = contentAnalyticsQuery.data || [];

  const hasStages = analytics.length > 0;
  const isLoading = analyticsQuery.isLoading || videoAnalyticsQuery.isLoading || contentAnalyticsQuery.isLoading;

  // Filter analytics by date range (if needed in future)
  const filteredAnalytics = useMemo(() => {
    // For now, return all analytics
    // Date filtering would require backend support
    return analytics;
  }, [analytics]);

  // Format time in seconds to readable format
  const formatTime = (seconds: number | null) => {
    if (seconds === null || seconds === 0) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Format percentage
  const formatPercentage = (value: number | null) => {
    if (value === null) return "N/A";
    return `${Math.round(value)}%`;
  };

  // Get stage type label
  const getStageTypeLabel = (type: string) => {
    switch (type) {
      case "video":
        return "Video";
      case "content":
        return "Content";
      case "questions":
        return "Questions";
      default:
        return type;
    }
  };

  // Get stage type color
  const getStageTypeColor = (type: string) => {
    switch (type) {
      case "video":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "content":
        return "text-green-600 bg-green-50 border-green-200";
      case "questions":
        return "text-purple-600 bg-purple-50 border-purple-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back
          </button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Stage Analytics
        </h1>
        {exam && (
          <p className="text-gray-600 mt-1">
            {exam.title}
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <ModernCard>
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading analytics...</p>
          </div>
        </ModernCard>
      )}

      {/* No Stages State */}
      {!isLoading && !hasStages && (
        <ModernCard>
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              This exam does not have any stages configured.
            </p>
            <p className="text-gray-500 mt-2">
              Stages allow you to combine videos, content slides, and questions in a structured flow.
            </p>
          </div>
        </ModernCard>
      )}

      {/* Analytics Content */}
      {!isLoading && hasStages && (
        <div className="space-y-6">
          {/* Overall Statistics */}
          <ModernCard>
            <h2 className="text-xl font-semibold mb-4">Overall Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-600 font-medium">Total Stages</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">
                  {analytics.length}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-600 font-medium">Avg Completion Rate</p>
                <p className="text-3xl font-bold text-green-900 mt-1">
                  {formatPercentage(
                    analytics.length > 0
                      ? analytics.reduce((sum, a) => sum + a.completion_rate, 0) / analytics.length
                      : 0
                  )}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-600 font-medium">Total Attempts</p>
                <p className="text-3xl font-bold text-purple-900 mt-1">
                  {analytics.length > 0 ? Math.max(...analytics.map(a => a.total_attempts)) : 0}
                </p>
              </div>
            </div>
          </ModernCard>

          {/* Stage-by-Stage Analytics */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Stage Details</h2>
            
            {filteredAnalytics.map((stage) => {
              const videoData = videoAnalytics.find(v => v.stage_id === stage.stage_id);
              const contentData = contentAnalytics.find(c => c.stage_id === stage.stage_id);

              return (
                <ModernCard key={stage.stage_id} hover>
                  <div className="space-y-4">
                    {/* Stage Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStageTypeColor(stage.stage_type)}`}>
                          {getStageTypeLabel(stage.stage_type)}
                        </span>
                        <h3 className="text-lg font-semibold">
                          Stage {stage.stage_order + 1}
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Completion Rate</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatPercentage(stage.completion_rate)}
                        </p>
                      </div>
                    </div>

                    {/* Common Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Total Attempts</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {stage.total_attempts}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Completed</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {stage.completed_attempts}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Avg Time Spent</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {formatTime(stage.avg_time_spent_seconds)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Completion Rate</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {stage.completed_attempts}/{stage.total_attempts}
                        </p>
                      </div>
                    </div>

                    {/* Video-Specific Metrics */}
                    {stage.stage_type === "video" && videoData && (
                      <div className="pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Video Metrics</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Avg Watch %</p>
                            <p className="text-xl font-semibold text-blue-600">
                              {formatPercentage(videoData.avg_watch_percentage)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Min Watch %</p>
                            <p className="text-xl font-semibold text-gray-900">
                              {formatPercentage(videoData.min_watch_percentage)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Max Watch %</p>
                            <p className="text-xl font-semibold text-gray-900">
                              {formatPercentage(videoData.max_watch_percentage)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Avg Watch Time</p>
                            <p className="text-xl font-semibold text-gray-900">
                              {formatTime(videoData.avg_total_watch_time)}
                            </p>
                          </div>
                        </div>
                        {videoData.enforcement_threshold !== null && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-700">
                              <span className="font-semibold">Enforcement Threshold:</span> {videoData.enforcement_threshold}%
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content-Specific Metrics */}
                    {stage.stage_type === "content" && contentData && (
                      <div className="pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Content Metrics</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Total Slides</p>
                            <p className="text-xl font-semibold text-green-600">
                              {contentData.total_slides}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Avg Time/Slide</p>
                            <p className="text-xl font-semibold text-gray-900">
                              {formatTime(contentData.avg_time_per_slide)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Avg Total Time</p>
                            <p className="text-xl font-semibold text-gray-900">
                              {formatTime(contentData.avg_total_time)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Min Read Time/Slide</p>
                            <p className="text-xl font-semibold text-gray-900">
                              {contentData.minimum_read_time_per_slide 
                                ? formatTime(contentData.minimum_read_time_per_slide)
                                : "None"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Questions-Specific Info */}
                    {stage.stage_type === "questions" && (
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                          Question-level analytics are available in the main results view.
                        </p>
                      </div>
                    )}
                  </div>
                </ModernCard>
              );
            })}
          </div>

          {/* Date Range Filter (Future Enhancement) */}
          <ModernCard>
            <h3 className="text-lg font-semibold mb-4">Filter by Date Range</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="input w-full"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="input w-full"
                  disabled
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Date range filtering will be available in a future update.
            </p>
          </ModernCard>
        </div>
      )}
    </div>
  );
}