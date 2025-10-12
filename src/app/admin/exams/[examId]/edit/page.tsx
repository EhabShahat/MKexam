"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import ModernCard from "@/components/admin/ModernCard";
import ActionButton from "@/components/admin/ActionButton";
import StatusBadge from "@/components/admin/StatusBadge";
import ExamTypeSelector, { ExamTypeBadge } from "@/components/admin/ExamTypeSelector";
import QuestionsSection from "@/components/admin/QuestionsSection";

export default function AdminEditExamPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { examId } = useParams<{ examId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "exam", examId],
    enabled: !!examId,
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Load failed");
      return result.item as any;
    },
  });

  const [localChanges, setLocalChanges] = useState<any>(null);
  const [questionsCollapsed, setQuestionsCollapsed] = useState(true);
  const exam = localChanges ?? data;

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/publish`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Publish failed");
      return result.item;
    },
    onSuccess: (item) => {
      setLocalChanges(item);
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Exam Published", message: "Students can now access this exam" });
    },
    onError: (error: any) => {
      toast.error({ title: "Publish Failed", message: error.message || "Unknown error" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/archive`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Archive failed");
      return result.item;
    },
    onSuccess: (item) => {
      setLocalChanges(item);
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Exam Archived", message: "Exam is no longer available to students" });
    },
    onError: (error: any) => {
      toast.error({ title: "Archive Failed", message: error.message || "Unknown error" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exam),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Save failed");
      return result.item;
    },
    onSuccess: (item) => {
      setLocalChanges(item);
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Changes Saved", message: "Exam has been updated successfully" });
    },
    onError: (error: any) => {
      toast.error({ title: "Save Failed", message: error.message || "Unknown error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}`, { method: "DELETE" });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result?.error || "Delete failed");
      }
      return true;
    },
    onSuccess: () => {
      toast.success({ title: "Exam Deleted", message: "Returning to exam list" });
      router.replace("/admin/exams");
    },
    onError: (error: any) => {
      toast.error({ title: "Delete Failed", message: error.message || "Unknown error" });
    },
  });

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${exam?.title}"? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const updateExam = (updates: any) => {
    setLocalChanges({ ...(exam || data), ...updates });
  };

  const updateSetting = (key: string, value: any) => {
    setLocalChanges({
      ...(exam || data),
      settings: { ...((exam || data)?.settings || {}), [key]: value }
    });
  };

  if (!examId || isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48"></div>
        <div className="skeleton h-64 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Exam</h1>
        <ModernCard>
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading exam</p>
            <p className="text-sm mt-1">{(error as any).message}</p>
          </div>
        </ModernCard>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Exam</h1>
        <ModernCard>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">❓</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Exam Not Found</h3>
            <p className="text-gray-600">The exam you're looking for doesn't exist or has been deleted.</p>
          </div>
        </ModernCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className=" mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Enhanced Header with Breadcrumbs - Mobile Optimized */}
        <div className="mb-6 sm:mb-8">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
            <Link href="/admin" className="hover:text-gray-700 transition-colors">
              Dashboard
            </Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Link href="/admin/exams" className="hover:text-gray-700 transition-colors">
              Exams
            </Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900 font-medium">Edit</span>
          </nav>
          
          {/* Main Header */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                      {exam.title || 'Untitled Exam'}
                    </h1>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={exam.status} />
                      <ExamTypeBadge type={exam.exam_type || "exam"} />
                    </div>
                  </div>
                </div>
                
                {/* Enhanced Meta Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Access</p>
                      <p className="text-sm font-medium text-gray-900 capitalize">{exam.access_type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  
                  {exam.duration_minutes && (
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Duration</p>
                        <p className="text-sm font-medium text-gray-900">{exam.duration_minutes} minutes</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-4 8a2 2 0 100-4 2 2 0 000 4zm6 3a2 2 0 100-4 2 2 0 000 4zm-6 0a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Questions</p>
                      <p className="text-sm font-medium text-gray-900">Loading...</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-4 8a2 2 0 100-4 2 2 0 000 4zm6 3a2 2 0 100-4 2 2 0 000 4zm-6 0a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Last Modified</p>
                      <p className="text-sm font-medium text-gray-900">
                        {exam.updated_at ? new Date(exam.updated_at).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
        
              {/* Enhanced Action Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                <Link href="/admin/exams">
                  <ActionButton variant="secondary" size="sm" className="shadow-md hover:shadow-lg transition-all duration-200">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Exams
                  </ActionButton>
                </Link>
                
                {exam.status === "draft" && (
                  <ActionButton
                    variant="success"
                    size="sm"
                    onClick={() => publishMutation.mutate()}
                    loading={publishMutation.isPending}
                    className="shadow-md hover:shadow-lg transition-all duration-200 animate-pulse"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Publish Exam
                  </ActionButton>
                )}
                
                {exam.status === "published" && (
                  <ActionButton
                    variant="warning"
                    size="sm"
                    onClick={() => archiveMutation.mutate()}
                    loading={archiveMutation.isPending}
                    className="shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4 4m0-4l-4 4m9-4h6M9 20h6" />
                    </svg>
                    Archive Exam
                  </ActionButton>
                )}
                
                {/* Quick Save Button */}
                <ActionButton
                  variant="primary"
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  loading={saveMutation.isPending}
                  className="shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Enhanced Single Column Layout */}
        <div className="mx-auto space-y-6 lg:space-y-8">
            {/* Enhanced Basic Information Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Card Header - Mobile Optimized */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Basic Information</h2>
                    <p className="text-gray-600 text-xs sm:text-sm">Configure the essential details of your assessment</p>
                  </div>
                </div>
              </div>
              
              {/* Card Content - Mobile Optimized */}
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Enhanced Title Field */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Exam Title *
                    </span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md"
                    placeholder="Enter a descriptive title for your exam..."
                    value={exam.title || ""}
                    onChange={(e) => updateExam({ title: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">This will be displayed to students when they access the exam</p>
                </div>

                {/* Enhanced Description Field */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                      Description
                    </span>
                  </label>
                  <textarea
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md resize-none"
                    rows={3}
                    placeholder="Provide instructions, context, or additional information for students..."
                    value={exam.description || ""}
                    onChange={(e) => updateExam({ description: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional: Add context or instructions that students will see before starting</p>
                </div>

                {/* Enhanced Grid Layout - Mobile Optimized */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* Enhanced Exam Type */}
                  <div className="group">
                    <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                        </svg>
                        Assessment Type *
                      </span>
                    </label>
                    <ExamTypeSelector
                      value={exam.exam_type || "exam"}
                      onChange={(type) => updateExam({ exam_type: type })}
                    />
                  </div>
                  
                  {/* Enhanced Access Type */}
                  <div className="group">
                    <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Access Control *
                      </span>
                    </label>
                    <select
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md appearance-none cursor-pointer"
                      value={exam.access_type}
                      onChange={(e) => updateExam({ access_type: e.target.value })}
                    >
                      <option value="open">🌐 Open Access - Anyone with link</option>
                      <option value="code_based">🔑 Code Based - Requires access code</option>
                      <option value="ip_restricted">🏢 IP Restricted - Specific networks only</option>
                    </select>
                  </div>
                </div>

                {/* Quick Actions Section moved here */}
                <div className="border-t border-gray-200 pt-4 sm:pt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 sm:mb-4">Quick Actions</h3>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    <ActionButton
                      variant="primary"
                      onClick={() => saveMutation.mutate()}
                      loading={saveMutation.isPending}
                      size="sm"
                      className="flex-1 sm:flex-none justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      onClick={handleDelete}
                      loading={deleteMutation.isPending}
                      size="sm"
                      className="flex-1 sm:flex-none justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Exam
                    </ActionButton>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Schedule & Duration Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Card Header - Mobile Optimized */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Schedule & Duration</h2>
                    <p className="text-gray-600 text-xs sm:text-sm">Set when your assessment is available and time limits</p>
                  </div>
                </div>
              </div>
              
              {/* Card Content - Mobile Optimized */}
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="group">
                    <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Start Time
                      </span>
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md"
                      value={toInputDate(exam.start_time)}
                      onChange={(e) => updateExam({ start_time: fromInputDate(e.target.value) })}
                    />
                    <p className="text-xs text-gray-500 mt-1">When students can start taking the exam</p>
                  </div>

                  <div className="group">
                    <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        End Time
                      </span>
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md"
                      value={toInputDate(exam.end_time)}
                      onChange={(e) => updateExam({ end_time: fromInputDate(e.target.value) })}
                    />
                    <p className="text-xs text-gray-500 mt-1">When the exam becomes unavailable</p>
                  </div>

                  <div className="group">
                    <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Duration (minutes)
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="600"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md"
                      value={exam.duration_minutes || ""}
                      onChange={(e) => updateExam({ duration_minutes: Number(e.target.value) || null })}
                    />
                    <p className="text-xs text-gray-500 mt-1">How long each student has to complete the exam</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Settings Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-indigo-100 rounded-lg">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Advanced Settings</h2>
                    <p className="text-gray-600 text-xs sm:text-sm">Configure exam behavior and restrictions</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="group">
                    <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m5 0h2a2 2 0 002-2V7a2 2 0 00-2-2h-2m-5 4h4" />
                        </svg>
                        Attempt Limit
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md"
                      value={exam.settings?.attempt_limit || 1}
                      onChange={(e) => updateSetting("attempt_limit", Number(e.target.value))}
                    />
                    <p className="text-xs text-gray-500 mt-1">How many times a student can attempt the exam</p>
                  </div>

                  <div className="group">
                    <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        Display Mode
                      </span>
                    </label>
                    <select
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md appearance-none cursor-pointer"
                      value={exam.settings?.display_mode || "full"}
                      onChange={(e) => updateSetting("display_mode", e.target.value)}
                    >
                      <option value="full">Full Exam - Show all questions at once</option>
                      <option value="per_question">Per Question - Show one question at a time</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">How questions are presented to students</p>
                  </div>

                  <div className="group">
                    <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        IP Restrictions
                      </span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md"
                      placeholder="e.g. 10.0.0.0/8, 192.168.1.0/24"
                      value={exam.settings?.ip_restriction || ""}
                      onChange={(e) => updateSetting("ip_restriction", e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Comma-separated IP addresses or CIDR ranges</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 sm:pt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 sm:mb-4">Randomization Options</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="randomize-questions"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={exam.settings?.randomize_questions || false}
                        onChange={(e) => updateSetting("randomize_questions", e.target.checked)}
                      />
                      <label htmlFor="randomize-questions" className="text-sm font-medium text-gray-700">
                        Randomize Questions
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">Shuffle the order of questions for each student</p>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="randomize-options"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={exam.settings?.randomize_options || false}
                        onChange={(e) => updateSetting("randomize_options", e.target.checked)}
                      />
                      <label htmlFor="randomize-options" className="text-sm font-medium text-gray-700">
                        Randomize Options
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">Shuffle the order of multiple choice options</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status & Quick Actions Card - Single Column Layout */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Status & Actions</h2>
                    <p className="text-gray-600 text-xs sm:text-sm">Manage exam status and perform quick actions</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Status Section */}
                  <div className="space-y-4">
                    <div className="group">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Status
                      </label>
                      <select
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md appearance-none cursor-pointer"
                        value={exam.status}
                        onChange={(e) => updateExam({ status: e.target.value })}
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="done">Done</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">
                        <p className="font-medium mb-2">Status Guide:</p>
                        <ul className="space-y-1 text-xs">
                          <li><strong>Draft:</strong> Editing mode</li>
                          <li><strong>Published:</strong> Available to students</li>
                          <li><strong>Done:</strong> Completed assessment</li>
                          <li><strong>Archived:</strong> No longer accessible</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions moved to Basic Information card */}
                </div>
              </div>
            </div>

            {/* Questions Management Section */}
            <QuestionsSection
              examId={examId}
              isCollapsed={questionsCollapsed}
              onToggle={() => setQuestionsCollapsed(!questionsCollapsed)}
            />
          </div>
        </div>
      );

}

function toInputDate(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromInputDate(s: string) {
  if (!s) return null;
  return new Date(s).toISOString();
}