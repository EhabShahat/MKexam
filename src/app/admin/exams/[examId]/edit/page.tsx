"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import QuestionsSection from "@/components/admin/QuestionsSection";

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

export default function AdminEditExamPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { examId } = useParams<{ examId: string }>();
  
  const isNewExam = examId === "new";

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "exam", examId],
    enabled: !!examId && !isNewExam,
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Load failed");
      const item = result.item as any;
      // Set default access_type to code_based if not set
      if (!item.access_type) {
        item.access_type = 'code_based';
      }
      return item;
    },
  });

  const [localChanges, setLocalChanges] = useState<any>(isNewExam ? {
    title: "",
    description: "",
    exam_type: "exam",
    start_time: null,
    end_time: null,
    duration_minutes: 60,
    status: "draft",
    access_type: "code_based",
    scheduling_mode: "Auto",
    settings: {
      attempt_limit: 1,
      ip_restriction: "",
      randomize_questions: false,
      randomize_options: false,
      display_mode: "full",
      auto_save_interval: 10,
      pass_percentage: 60,
    },
  } : null);
  const [questionsCollapsed, setQuestionsCollapsed] = useState(true);
  const [createdExamId, setCreatedExamId] = useState<string | null>(null);
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
      if (!exam.title?.trim()) {
        throw new Error("Title is required");
      }

      if (isNewExam) {
        // Create new exam
        const payload = {
          title: exam.title.trim(),
          description: exam.description?.trim() || null,
          exam_type: exam.exam_type,
          start_time: exam.start_time ? new Date(exam.start_time).toISOString() : null,
          end_time: exam.end_time ? new Date(exam.end_time).toISOString() : null,
          duration_minutes: Number(exam.duration_minutes) || null,
          status: exam.status,
          access_type: exam.access_type,
          scheduling_mode: exam.scheduling_mode,
          settings: exam.settings,
        };
        
        const res = await authFetch("/api/admin/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error || "Failed to create exam");
        return result.item;
      } else {
        // Update existing exam
        const res = await authFetch(`/api/admin/exams/${examId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exam),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error || "Save failed");
        return result.item;
      }
    },
    onSuccess: (item) => {
      if (isNewExam) {
        setCreatedExamId(item.id);
        toast.success({ title: "Exam Created!", message: "You can now add questions below" });
        // Redirect to the edit page for the newly created exam
        router.push(`/admin/exams/${item.id}/edit`);
      } else {
        setLocalChanges(item);
        queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
        toast.success({ title: "Changes Saved", message: "Exam has been updated successfully" });
      }
    },
    onError: (error: any) => {
      toast.error({ 
        title: isNewExam ? "Create Failed" : "Save Failed", 
        message: error.message || "Unknown error" 
      });
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

  if (!examId || (isLoading && !isNewExam)) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !isNewExam) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-red-600 font-semibold">Error loading exam</p>
            <p className="text-sm text-gray-600 mt-1">{(error as any).message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!exam && !isNewExam) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-4xl mb-4">❓</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Exam Not Found</h3>
            <p className="text-gray-600">The exam you're looking for doesn't exist or has been deleted.</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusInfo = () => {
    const now = new Date();
    const start = exam.start_time ? new Date(exam.start_time) : null;
    const end = exam.end_time ? new Date(exam.end_time) : null;
    
    let statusText = '';
    let statusClass = '';
    
    if (exam.status === 'published') {
      statusText = 'Published';
      statusClass = 'bg-green-100 text-green-800';
    } else if (exam.status === 'draft') {
      statusText = 'Draft';
      statusClass = 'bg-gray-100 text-gray-800';
    } else if (exam.status === 'done') {
      statusText = 'Done';
      statusClass = 'bg-blue-100 text-blue-800';
    } else if (exam.status === 'archived') {
      statusText = 'Archived';
      statusClass = 'bg-red-100 text-red-800';
    }
    
    if (start && end) {
      if (now < start) {
        statusText = 'Ended';
      } else if (now >= start && now <= end) {
        statusText = 'Ended';
      } else {
        statusText = 'Ended';
      }
    }
    
    return { text: statusText, className: statusClass };
  };

  const status = getStatusInfo();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
          <Link href="/admin" className="hover:text-gray-700 transition-colors">
            Dashboard
          </Link>
          <span>›</span>
          <Link href="/admin/exams" className="hover:text-gray-700 transition-colors">
            Exams
          </Link>
          <span>›</span>
          <span className="text-gray-900">{isNewExam ? "Create New" : "Edit"}</span>
        </nav>
        
        {/* Header Card */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isNewExam ? 'bg-green-600' : 'bg-blue-600'}`}>
                {isNewExam ? (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {isNewExam ? "Create New Exam" : (exam?.title || 'Untitled')}
                </h1>
                {!isNewExam && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${status.className}`}>
                      {status.text} • {status.text} 4h ago
                    </span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                      {exam?.exam_type || 'Exam'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/exams">
                <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Exams
                </button>
              </Link>
              <button 
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !exam?.title?.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isNewExam ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Exam
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow">
          <div className="bg-blue-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-base font-semibold text-gray-900">Basic Information</h2>
            </div>
          </div>
          
          <div className="p-6 space-y-5">
            {/* Exam Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Exam Title *
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="tesssssf"
                value={exam.title || ""}
                onChange={(e) => updateExam({ title: e.target.value })}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Description
              </label>
              <textarea
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
                placeholder="Provide instructions, context, or additional information for students..."
                value={exam.description || ""}
                onChange={(e) => updateExam({ description: e.target.value })}
              />
            </div>

            {/* Assessment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Assessment Type *
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => updateExam({ exam_type: 'exam' })}
                  className={`relative px-4 py-3 rounded-lg border-2 transition-all ${
                    exam.exam_type === 'exam'
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {exam.exam_type === 'exam' && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="text-center font-medium text-gray-900">Exam</div>
                </button>

                <button
                  type="button"
                  onClick={() => updateExam({ exam_type: 'homework' })}
                  className={`relative px-4 py-3 rounded-lg border-2 transition-all ${
                    exam.exam_type === 'homework'
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {exam.exam_type === 'homework' && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="text-center font-medium text-gray-900">Homework</div>
                </button>

                <button
                  type="button"
                  onClick={() => updateExam({ exam_type: 'quiz' })}
                  className={`relative px-4 py-3 rounded-lg border-2 transition-all ${
                    exam.exam_type === 'quiz'
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {exam.exam_type === 'quiz' && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="text-center font-medium text-gray-900">Quiz</div>
                </button>
              </div>
            </div>

            {/* Scheduling Mode & Status */}
            <div className="grid grid-cols-2 gap-6">
              {/* Scheduling Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Scheduling Mode *
                </label>
                <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => updateExam({ scheduling_mode: 'Auto' })}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                      exam.scheduling_mode === 'Auto'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => updateExam({ scheduling_mode: 'Manual' })}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                      exam.scheduling_mode === 'Manual'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {/* Current Status - Only shown in Manual mode */}
              {exam.scheduling_mode === 'Manual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Current Status *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateExam({ status: 'draft' })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        exam.status === 'draft'
                          ? 'bg-gray-100 text-gray-900 border-2 border-gray-400'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => updateExam({ status: 'published' })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        exam.status === 'published'
                          ? 'bg-green-100 text-green-900 border-2 border-green-400'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Published
                    </button>
                    <button
                      type="button"
                      onClick={() => updateExam({ status: 'done' })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        exam.status === 'done'
                          ? 'bg-blue-100 text-blue-900 border-2 border-blue-400'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => updateExam({ status: 'archived' })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        exam.status === 'archived'
                          ? 'bg-red-100 text-red-900 border-2 border-red-400'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Archived
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Advanced Settings</h3>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={toInputDate(exam.start_time)}
                    onChange={(e) => updateExam({ start_time: fromInputDate(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={toInputDate(exam.end_time)}
                    onChange={(e) => updateExam({ end_time: fromInputDate(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={exam.duration_minutes || ""}
                    onChange={(e) => updateExam({ duration_minutes: Number(e.target.value) || null })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Display Mode</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={exam.settings?.display_mode || "full"}
                    onChange={(e) => updateSetting("display_mode", e.target.value)}
                  >
                    <option value="full">Full Exam</option>
                    <option value="per_question">Per Question</option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Randomization</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateSetting("randomize_questions", !exam.settings?.randomize_questions)}
                    className={`relative px-4 py-3 rounded-lg border-2 transition-all ${
                      exam.settings?.randomize_questions
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {exam.settings?.randomize_questions && (
                      <div className="absolute top-2 right-2">
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="font-medium text-gray-900">Randomize Questions</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSetting("randomize_options", !exam.settings?.randomize_options)}
                    className={`relative px-4 py-3 rounded-lg border-2 transition-all ${
                      exam.settings?.randomize_options
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {exam.settings?.randomize_options && (
                      <div className="absolute top-2 right-2">
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="font-medium text-gray-900">Randomize Options</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Questions Section - Only show for existing exams */}
        {!isNewExam && (
          <QuestionsSection
            examId={examId}
            isCollapsed={questionsCollapsed}
            onToggle={() => setQuestionsCollapsed(!questionsCollapsed)}
          />
        )}
      </div>
    </div>
  );
}