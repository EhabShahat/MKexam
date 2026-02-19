"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import ModernCard from "@/components/admin/ModernCard";
import ModernTable from "@/components/admin/ModernTable";
import SearchInput from "@/components/admin/SearchInput";
import ActionButton from "@/components/admin/ActionButton";
import EnhancedStatusBadge from "@/components/admin/EnhancedStatusBadge";
import { getExamStatus, filterExamsByCategory } from "@/lib/examStatus";

interface Exam {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived' | 'done';
  access_type: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  question_count?: number;
  attempt_count?: number;
  scheduling_mode?: 'Auto' | 'Manual';
  is_manually_published?: boolean;
  is_archived?: boolean;
}

export default function AdminExamsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'ended' | 'archived'>('all');
  const toast = useToast();
  const queryClient = useQueryClient();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "exams", searchQuery],
    queryFn: async () => {
      const url = searchQuery ? `/api/admin/exams?q=${encodeURIComponent(searchQuery)}` : "/api/admin/exams";
      const res = await authFetch(url);
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to load exams");
      return result as { items: Exam[] };
    },
  });

  const allExams = data?.items ?? [];
  const exams = filterExamsByCategory(allExams, statusFilter);
  
  // Count exams by category
  const liveCount = filterExamsByCategory(allExams, 'live').length;
  const upcomingCount = filterExamsByCategory(allExams, 'upcoming').length;
  const endedCount = filterExamsByCategory(allExams, 'ended').length;
  const archivedCount = filterExamsByCategory(allExams, 'archived').length;

  // Duplicate exam mutation
  const duplicateMutation = useMutation({
    mutationFn: async (examId: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}/duplicate`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Duplicate failed");
      return result;
    },
    onSuccess: (result) => {
      const newId = result?.item?.id;
      if (newId) {
        toast.success({ title: "Exam Duplicated", message: "Opening editor..." });
        router.push(`/admin/exams/${newId}/edit`);
      }
    },
    onError: (error: any) => {
      toast.error({ title: "Duplicate Failed", message: error.message });
    },
  });

  // Delete exam mutation
  const deleteMutation = useMutation({
    mutationFn: async (examId: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}`, { method: "DELETE" });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result?.error || "Delete failed");
      }
      return examId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Exam Deleted", message: "Exam has been permanently deleted" });
    },
    onError: (error: any) => {
      toast.error({ title: "Delete Failed", message: error.message });
    },
  });

  // Publish exam mutation (manual publish or early publish)
  const publishMutation = useMutation({
    mutationFn: async (examId: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_manually_published: true }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result?.error || "Publish failed");
      }
      return examId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Exam Published", message: "Exam is now accessible to students" });
    },
    onError: (error: any) => {
      toast.error({ title: "Publish Failed", message: error.message });
    },
  });

  // Unpublish exam mutation
  const unpublishMutation = useMutation({
    mutationFn: async (examId: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_manually_published: false }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result?.error || "Unpublish failed");
      }
      return examId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Exam Unpublished", message: "Exam is no longer accessible to students" });
    },
    onError: (error: any) => {
      toast.error({ title: "Unpublish Failed", message: error.message });
    },
  });

  // Archive exam mutation
  const archiveMutation = useMutation({
    mutationFn: async (examId: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_archived: true }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result?.error || "Archive failed");
      }
      return examId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Exam Archived", message: "Exam has been archived and hidden from students" });
    },
    onError: (error: any) => {
      toast.error({ title: "Archive Failed", message: error.message });
    },
  });

  // Unarchive exam mutation
  const unarchiveMutation = useMutation({
    mutationFn: async (examId: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_archived: false }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result?.error || "Unarchive failed");
      }
      return examId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
      toast.success({ title: "Exam Unarchived", message: "Exam is no longer archived" });
    },
    onError: (error: any) => {
      toast.error({ title: "Unarchive Failed", message: error.message });
    },
  });

  const columns = [
    { key: "title", label: "Exam Title" },
    { key: "status_actions", label: "Actions", width: "550px" },
  ];

  const renderCell = (exam: Exam, column: any) => {
    switch (column.key) {
      case "title":
        return (
          <div>
            <div className="font-medium text-gray-900">{exam.title}</div>
            <div className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
              <span>ID: {exam.id.slice(0, 8)}...</span>
              <span>•</span>
              <span>Created: {exam.created_at ? new Date(exam.created_at).toLocaleDateString() : "-"}</span>
            </div>
          </div>
        );
      case "status_actions":
        const examStatus = getExamStatus(exam);
        
        // Smart contextual button logic
        let smartAction: { label: string; onClick: () => void; loading: boolean; variant: "primary" | "secondary" } | null = null;
        
        if (exam.is_archived) {
          smartAction = {
            label: "Unarchive",
            onClick: () => unarchiveMutation.mutate(exam.id),
            loading: unarchiveMutation.isPending,
            variant: "primary"
          };
        } else if (examStatus.canAccess) {
          // Live exam - offer unpublish
          smartAction = {
            label: "Unpublish",
            onClick: () => unpublishMutation.mutate(exam.id),
            loading: unpublishMutation.isPending,
            variant: "secondary"
          };
        } else if (examStatus.status === 'Done') {
          // Ended exam - offer archive
          smartAction = {
            label: "Archive",
            onClick: () => archiveMutation.mutate(exam.id),
            loading: archiveMutation.isPending,
            variant: "secondary"
          };
        } else {
          // Draft or scheduled - offer publish
          smartAction = {
            label: "Publish",
            onClick: () => publishMutation.mutate(exam.id),
            loading: publishMutation.isPending,
            variant: "primary"
          };
        }
        
        return (
          <div className="flex items-center gap-3 flex-wrap">
            {/* Ultra-minimal Status Badge */}
            <EnhancedStatusBadge exam={exam} size="sm" showTimeInfo />
            
            {/* Divider */}
            <div className="h-8 w-px bg-gray-300"></div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              
              
              {/* Smart Contextual Button */}
              {smartAction && (
                <ActionButton
                  variant={smartAction.variant}
                  size="sm"
                  onClick={smartAction.onClick}
                  loading={smartAction.loading}
                >
                  {smartAction.label}
                </ActionButton>
              )}
              
              {/* Delete button - always show */}
              <ActionButton
                variant="danger"
                size="sm"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete "${exam.title}"? This action cannot be undone.`)) {
                    deleteMutation.mutate(exam.id);
                  }
                }}
                loading={deleteMutation.isPending}
              >
                Delete
              </ActionButton>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Exams</h1>
        </div>
        <ModernCard>
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading exams</p>
            <p className="text-sm mt-1">{(error as any).message}</p>
          </div>
        </ModernCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exam Management</h1>
          <p className="text-gray-600 mt-1">Create, edit, and manage your exams</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/exams/new">
            <ActionButton
              variant="primary"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              }
            >
              Create New Exam
            </ActionButton>
          </Link>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <ModernCard>
        <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-4">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({allExams.length})
          </button>
          <button
            onClick={() => setStatusFilter('live')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'live'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Live ({liveCount})
          </button>
          <button
            onClick={() => setStatusFilter('upcoming')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'upcoming'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Upcoming ({upcomingCount})
          </button>
          <button
            onClick={() => setStatusFilter('ended')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'ended'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Ended ({endedCount})
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'archived'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Archived ({archivedCount})
          </button>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <SearchInput
            placeholder="Search exams by title..."
            value={searchQuery}
            onChange={setSearchQuery}
            loading={isLoading}
            className="lg:w-96"
          />
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>Showing: {exams.length} exams</span>
          </div>
        </div>
      </ModernCard>

      {/* Exams Table */}
      <ModernTable
        columns={columns}
        data={exams}
        renderCell={renderCell}
        onRowClick={(exam) => router.push(`/admin/exams/${exam.id}/edit`)}
        loading={isLoading}
        emptyMessage={
          searchQuery 
            ? `No exams found matching "${searchQuery}"` 
            : "No exams created yet. Create your first exam to get started."
        }
      />
    </div>
  );
}