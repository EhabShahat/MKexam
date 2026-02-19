"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from "react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ActionButton from "./ActionButton";
import ModernCard from "./ModernCard";
import { downloadArabicCSV, getBilingualHeader, getBilingualValue, formatArabicNumber, formatArabicBoolean } from "@/lib/exportUtils";
import { useOptimisticListItemRemove, useOptimisticListItemUpdate, useOptimisticListItemAdd, useOptimisticListReorder } from "@/hooks/useOptimisticMutation";

interface QuestionRow {
  id: string;
  exam_id: string;
  question_text: string;
  question_type: "true_false" | "single_choice" | "multiple_choice" | "multi_select" | "paragraph" | "photo_upload";
  options: string[] | null;
  correct_answers: unknown;
  required: boolean;
  points: number;
  order_index: number | null;
  // Image support
  question_image_url?: string | null;
  option_image_urls?: (string | null)[] | null;
  // Auto-grading for paragraph/photo_upload
  auto_grade_on_answer?: boolean;
}

interface QuestionsSectionProps {
  examId: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function QuestionsSection({ examId, isCollapsed = true, onToggle }: QuestionsSectionProps) {
  const qc = useQueryClient();
  const toast = useToast();
  
  // Modal states
  const [editingQuestion, setEditingQuestion] = useState<QuestionRow | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "questions", examId],
    enabled: !!examId && !isCollapsed,
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/questions`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return (j.items as QuestionRow[]).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    },
  });

  // Local working list for drag-and-drop
  const [rows, setRows] = useState<QuestionRow[] | null>(null);
  useEffect(() => {
    setRows(data ?? null);
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const reorderMutation = useOptimisticListReorder<QuestionRow>({
    mutationFn: async (newOrder: string[]) => {
      await authFetch(`/api/admin/exams/${examId}/questions/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ items: newOrder.map((id, idx) => ({ id, order_index: idx + 1 })) }),
      });
    },
    queryKey: ["admin", "questions", examId],
    getItemId: (item) => item.id,
    onSuccess: () => {
      toast.success({ title: "Questions reordered", message: "Order updated successfully" });
    },
    onError: (e: Error) => {
      toast.error({ title: "Reorder failed", message: e.message || "Unknown error" });
    },
  });

  const [reordering, setReordering] = useState(false);
  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (!rows) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = rows.findIndex((r) => r.id === active.id);
      const newIndex = rows.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const newRows = arrayMove(rows, oldIndex, newIndex);
      setRows(newRows);
      setReordering(true);
      try {
        const newOrder = newRows.map((r) => r.id);
        reorderMutation.mutate(newOrder);
      } finally {
        setReordering(false);
      }
    },
    [rows, reorderMutation]
  );

  const deleteQ = useOptimisticListItemRemove<QuestionRow, string>({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}/questions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error || "Delete failed");
      }
    },
    queryKey: ["admin", "questions", examId],
    itemMatcher: (item, id) => item.id === id,
    onSuccess: () => {
      toast.success({ title: "Question deleted", message: "Removed successfully" });
    },
    onError: (e: Error) => toast.error({ title: "Delete failed", message: e.message || "Unknown error" }),
  });

  const exportQuestions = useCallback(async () => {
    try {
      if (!rows || rows.length === 0) {
        toast.error({ title: "فشل التصدير / Export failed", message: "لا توجد أسئلة للتصدير / No questions to export" });
        return;
      }

      // Create bilingual headers
      const headers = [
        getBilingualHeader("Question #"),
        getBilingualHeader("Type"), 
        getBilingualHeader("Question Text"),
        getBilingualHeader("Options"),
        getBilingualHeader("Correct Answer"),
        getBilingualHeader("Points"),
        getBilingualHeader("Required")
      ];

      // Prepare data with Arabic support
      const data = rows.map((q, index) => [
        formatArabicNumber(index + 1),
        getBilingualValue(q.question_type),
        q.question_text, // Keep original text (may contain Arabic)
        q.options ? q.options.join(' | ') : "",
        Array.isArray(q.correct_answers) 
          ? q.correct_answers.join(' | ')
          : String(q.correct_answers || ""),
        formatArabicNumber(q.points || 1),
        formatArabicBoolean(q.required)
      ]);

      // Use Arabic-compatible export
      downloadArabicCSV({
        filename: `exam-questions-${examId}`,
        headers,
        data,
        includeTimestamp: true,
        rtlSupport: true
      });

      toast.success({ 
        title: "تم التصدير بنجاح / Export successful", 
        message: "تم تصدير الأسئلة إلى CSV / Questions exported to CSV" 
      });
    } catch (e: unknown) {
      toast.error({ 
        title: "فشل التصدير / Export failed", 
        message: (e as Error)?.message || "خطأ غير معروف / Unknown error" 
      });
    }
  }, [rows, examId, toast]);

  if (isCollapsed) {
    return (
      <ModernCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Questions</h3>
              <p className="text-sm text-gray-600">Manage exam questions and answers</p>
            </div>
          </div>
          <ActionButton
            variant="secondary"
            size="sm"
            onClick={onToggle}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Expand
          </ActionButton>
        </div>
      </ModernCard>
    );
  }

  return (
    <ModernCard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Questions</h3>
              <p className="text-sm text-gray-600">
                {rows?.length || 0} question{(rows?.length || 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* First row */}
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={onToggle}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Collapse
            </ActionButton>
            {rows && rows.length > 0 ? (
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={exportQuestions}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </ActionButton>
            ) : (
              <div></div>
            )}
            
            {/* Second row */}
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => setShowImportModal(true)}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Import
            </ActionButton>
            <ActionButton
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Question
            </ActionButton>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-600">Loading questions...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-center text-red-600">
              <p className="font-semibold">Error loading questions</p>
              <p className="text-sm mt-1">{(error as Error).message}</p>
            </div>
          </div>
        )}

        {/* Reordering indicator */}
        {reordering && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              Reordering questions...
            </div>
          </div>
        )}

        {/* Questions List */}
        {rows && rows.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {rows.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    onEdit={() => setEditingQuestion(question)}
                    onDelete={() => {
                      if (confirm("Delete this question? This cannot be undone.")) {
                        deleteQ.mutate(question.id);
                      }
                    }}
                    isDeleting={deleteQ.isPending}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          !isLoading && !error && (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8">
              <div className="text-center">
                <div className="text-4lx mb-4">📝</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No questions yet</h3>
                <p className="text-gray-600 mb-6">
                  Get started by adding your first question or importing from a file.
                </p>
                <div className="flex justify-center gap-3">
                  <ActionButton
                    variant="primary"
                    onClick={() => setShowAddModal(true)}
                  >
                    Add First Question
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    onClick={() => setShowImportModal(true)}
                  >
                    Import Questions
                  </ActionButton>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <QuestionModal
          title="Add New Question"
          examId={examId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
          }}
        />
      )}

      {editingQuestion && (
        <QuestionModal
          title="Edit Question"
          examId={examId}
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSuccess={() => {
            setEditingQuestion(null);
            qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
          }}
        />
      )}

      {showImportModal && (
        <ImportQuestionsModal
          examId={examId}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
          }}
        />
      )}
    </ModernCard>
  );
}

// Question Card Component
function QuestionCard({ 
  question, 
  index, 
  onEdit, 
  onDelete, 
  isDeleting 
}: { 
  question: QuestionRow; 
  index: number; 
  onEdit: () => void; 
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: question.id 
  });
  
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };
  // English labels only
  const ui = {
    options: "Options",
    correct: "Correct answer",
    required: "Required",
    points: "pts",
  };

  const getQuestionTypeLabel = (type: string) => {
    const labels = {
      true_false: "True/False",
      single_choice: "Single Choice",
      multiple_choice: "Multiple Choice", 
      multi_select: "Multi Select",
      paragraph: "Essay/Paragraph",
      photo_upload: "Photo Upload",
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getQuestionTypeColor = (type: string) => {
    const colors = {
      true_false: "bg-blue-100 text-blue-800 border-blue-200",
      single_choice: "bg-green-100 text-green-800 border-green-200",
      multiple_choice: "bg-purple-100 text-purple-800 border-purple-200",
      multi_select: "bg-orange-100 text-orange-800 border-orange-200",
      paragraph: "bg-gray-100 text-gray-800 border-gray-200",
      photo_upload: "bg-pink-100 text-pink-800 border-pink-200",
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200";
  };
  // Normalize and prepare options/correct for highlighting
  const normalize = (v: unknown) => String(v).trim().toLowerCase();
  const optionsList = question.question_type === "true_false" 
    ? ["True", "False"] 
    : (question.options ?? []);
  const correctArr = Array.isArray(question.correct_answers) 
    ? question.correct_answers 
    : (question.correct_answers != null ? [question.correct_answers] : []);
  const correctSet = new Set(correctArr.map(normalize));
  const isCorrectOption = (label: string, idx: number) => {
    const normLabel = normalize(label);
    if (correctSet.has(normLabel)) return true;
    // handle boolean true/false stored as booleans rather than strings
    if (normLabel === 'true' && correctSet.has('true')) return true;
    if (normLabel === 'false' && correctSet.has('false')) return true;
    // handle numeric indexes (0-based or 1-based) stored as numbers or numeric strings
    const zeroBased = idx;
    const oneBased = idx + 1;
    for (const c of correctArr) {
      const s = String(c).trim();
      if (/^\d+$/.test(s)) {
        const n = parseInt(s, 10);
        if (n === zeroBased || n === oneBased) return true;
      }
    }
    return false;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow" 
    >
      <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
        {/* Top row: handler, number, actions all inline */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            {...attributes}
            {...listeners}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            ⠿
          </div>
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center font-semibold text-base sm:text-lg">
            {index + 1}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <ActionButton variant="secondary" size="sm" onClick={onEdit}>Edit</ActionButton>
            <ActionButton variant="danger" size="sm" onClick={onDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </ActionButton>
          </div>
        </div>

        {/* Meta row: type, points, required */}
        <div className="flex items-center gap-2 sm:gap-3 whitespace-nowrap overflow-x-auto">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${getQuestionTypeColor(question.question_type)}`}>
            {getQuestionTypeLabel(question.question_type)}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 text-xs">
            {question.points} {ui.points}
          </span>
          {question.required && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 text-xs">
              {ui.required}
            </span>
          )}
        </div>

        {/* Question text row */}
        <div>
          <div
            className="text-gray-900 font-medium leading-relaxed break-words whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: question.question_text }}
          />
          {/* Image preview removed from list view to keep list compact */}
        </div>

        {/* Combined row: options with correct highlighted */}
        {(optionsList.length > 0 || question.question_type === "true_false") && (
          <div className="flex items-center gap-3 sm:gap-4 whitespace-nowrap overflow-x-auto">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{ui.options}</div>
              {optionsList.map((option, idx) => {
                const label = String(option);
                const correct = isCorrectOption(label, idx);
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center px-3 py-1 text-xs rounded-full border ${correct ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}
                    title={correct ? 'Correct' : undefined}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to format correct answers
function formatCorrectAnswer(question: QuestionRow): string {
  if (question.question_type === "true_false") {
    return String(question.correct_answers);
  }
  if (Array.isArray(question.correct_answers)) {
    return question.correct_answers.join(", ");
  }
  return String(question.correct_answers || "");
}

// Question Modal Component (full-featured with image support)
function QuestionModal({ 
  title, 
  examId, 
  question, 
  onClose, 
  onSuccess 
}: { 
  title: string;
  examId: string;
  question?: QuestionRow;
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<QuestionRow>>({
    question_text: question?.question_text || "",
    question_type: question?.question_type || "single_choice",
    options: question?.options || [],
    correct_answers: question?.correct_answers || null,
    required: question?.required ?? true,
    points: question?.points || 1,
    question_image_url: question?.question_image_url || null,
    option_image_urls: question?.option_image_urls || [],
    auto_grade_on_answer: question?.auto_grade_on_answer ?? false,
  });
  
  // Image upload states
  const [uploadingQuestionImage, setUploadingQuestionImage] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  
  // Image upload helper
  async function uploadImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/admin/upload/question-image', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || 'Upload failed');
    return j.url as string;
  }
  
  const updateField = (key: keyof QuestionRow, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };
  
  const updateOption = (index: number, value: string) => {
    setFormData(prev => {
      const options = [...(prev.options || [])];
      options[index] = value;
      return { ...prev, options };
    });
  };
  
  const addOption = () => {
    setFormData(prev => {
      const prevOpts = prev.options || [];
      const nextOpts = [...prevOpts, ""];
      const prevImgs = (prev.option_image_urls || []) as (string | null)[];
      const nextImgs = [...prevImgs, null];
      return { ...prev, options: nextOpts, option_image_urls: nextImgs };
    });
  };
  
  const removeOption = (index: number) => {
    setFormData(prev => {
      const nextOpts = [...(prev.options || [])];
      if (index >= 0 && index < nextOpts.length) nextOpts.splice(index, 1);
      const nextImgs = [...((prev.option_image_urls || []) as (string | null)[])];
      if (index >= 0 && index < nextImgs.length) nextImgs.splice(index, 1);
      return { ...prev, options: nextOpts, option_image_urls: nextImgs };
    });
  };
  
  const needsOptions = ['single_choice', 'multiple_choice', 'multi_select'].includes(formData.question_type || '');

  const saveMutation = question 
    ? useOptimisticListItemUpdate<QuestionRow, Partial<QuestionRow> & { id: string }>({
        mutationFn: async (payload: Partial<QuestionRow> & { id: string }) => {
          const res = await authFetch(`/api/admin/exams/${examId}/questions/${payload.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j?.error || "Save failed");
          return j.item as QuestionRow;
        },
        queryKey: ["admin", "questions", examId],
        itemMatcher: (item, variables) => item.id === variables.id,
        onSuccess: () => {
          toast.success({ 
            title: "Question updated", 
            message: "Changes saved successfully" 
          });
          onSuccess();
        },
        onError: (e: Error) => toast.error({ 
          title: "Save failed", 
          message: e.message || "Unknown error" 
        }),
      })
    : useOptimisticListItemAdd<QuestionRow, Partial<QuestionRow>>({
        mutationFn: async (payload: Partial<QuestionRow>) => {
          const res = await authFetch(`/api/admin/exams/${examId}/questions`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j?.error || "Save failed");
          return j.item as QuestionRow;
        },
        queryKey: ["admin", "questions", examId],
        generateTempId: () => `temp-${Date.now()}`,
        onSuccess: () => {
          toast.success({ 
            title: "Question added", 
            message: "Changes saved successfully" 
          });
          onSuccess();
        },
        onError: (e: Error) => toast.error({ 
          title: "Save failed", 
          message: e.message || "Unknown error" 
        }),
      });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question_text?.trim()) {
      toast.error({ title: "Validation error", message: "Question text is required" });
      return;
    }
    if (question) {
      saveMutation.mutate({ ...formData, id: question.id });
    } else {
      // For new questions, cast to the expected type since we know it's the create mutation
      (saveMutation as any).mutate(formData);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b-2 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <span className="bg-blue-600 text-white p-2 rounded-lg shadow-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            {title}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-red-50 rounded-full transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
            {/* Question Type - Visual Cards */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Question Type
                <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { value: 'true_false', icon: '✓✗', label: 'True/False', color: 'bg-blue-50 border-blue-200 text-blue-700', desc: 'Simple true or false question' },
                  { value: 'single_choice', icon: '◉', label: 'Single Choice', color: 'bg-green-50 border-green-200 text-green-700', desc: 'One correct answer' },
                  { value: 'multiple_choice', icon: '◉', label: 'Multiple Choice', color: 'bg-purple-50 border-purple-200 text-purple-700', desc: 'Multiple can be correct' },
                  { value: 'multi_select', icon: '☑', label: 'Multi Select', color: 'bg-orange-50 border-orange-200 text-orange-700', desc: 'Select multiple options' },
                  { value: 'paragraph', icon: '📝', label: 'Essay/Paragraph', color: 'bg-gray-50 border-gray-200 text-gray-700', desc: 'Text response' },
                  { value: 'photo_upload', icon: '📷', label: 'Photo Upload', color: 'bg-pink-50 border-pink-200 text-pink-700', desc: 'Upload image answer' },
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateField('question_type', type.value)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.question_type === type.value
                        ? `${type.color} border-current shadow-md scale-105`
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{type.icon}</span>
                      <span className="font-semibold text-sm">{type.label}</span>
                    </div>
                    <p className="text-xs opacity-75">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Question Text with Character Counter and Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Question Text
                  <span className="text-red-500">*</span>
                </span>
                <span className="text-xs text-gray-500">
                  {(formData.question_text || '').length} characters
                </span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Enter your question... (HTML formatting supported: <b>bold</b>, <i>italic</i>, <u>underline</u>)"
                value={formData.question_text || ""}
                onChange={(e) => updateField('question_text', e.target.value)}
              />
            </div>

            {/* Question Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Question Image (optional)</label>
              {formData.question_image_url ? (
                <div className="flex items-start gap-3">
                  <img src={formData.question_image_url} alt="Question" className="max-h-40 rounded border" />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      disabled={uploadingQuestionImage}
                      onClick={() => updateField('question_image_url', null)}
                    >
                      Remove Image
                    </button>
                    <label className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 cursor-pointer">
                      {uploadingQuestionImage ? 'Uploading...' : 'Replace Image'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            setUploadingQuestionImage(true);
                            const url = await uploadImage(f);
                            updateField('question_image_url', url);
                          } catch (err: any) {
                            toast.error({ title: "Upload failed", message: err.message });
                          } finally {
                            setUploadingQuestionImage(false);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100">
                  {uploadingQuestionImage ? 'Uploading...' : 'Upload Image'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        setUploadingQuestionImage(true);
                        const url = await uploadImage(f);
                        updateField('question_image_url', url);
                      } catch (err: any) {
                        toast.error({ title: "Upload failed", message: err.message });
                      } finally {
                        setUploadingQuestionImage(false);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            {/* Options for choice questions - Enhanced */}
            {needsOptions && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Answer Options
                    <span className="text-red-500">*</span>
                    <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                      {(formData.options || []).length} option{(formData.options || []).length !== 1 ? 's' : ''}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                    onClick={addOption}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Option
                  </button>
                </div>
                
                {(formData.options || []).length > 0 ? (
                  <div className="space-y-2">
                    {(formData.options || []).map((option, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-all">
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold shadow-sm">
                          {String.fromCharCode(65 + index)}
                        </div>
                        <input
                          type="text"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={`Option ${String.fromCharCode(65 + index)}`}
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              addOption();
                            }
                          }}
                        />
                        {/* Option image controls */}
                        <div className="flex items-center gap-2">
                          {(formData.option_image_urls?.[index] ?? null) ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={formData.option_image_urls?.[index] as string}
                                alt={`Option ${index + 1}`}
                                className="w-10 h-10 rounded border object-cover"
                              />
                              <button
                                type="button"
                                className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                onClick={() => {
                                  const newImages = [...((formData.option_image_urls || []) as (string | null)[])];
                                  newImages[index] = null;
                                  updateField('option_image_urls', newImages);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 cursor-pointer whitespace-nowrap">
                              {uploadingIdx === index ? 'Uploading...' : '+ Image'}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const f = e.target.files?.[0];
                                  if (!f) return;
                                  try {
                                    setUploadingIdx(index);
                                    const url = await uploadImage(f);
                                    const newImages = [...((formData.option_image_urls || []) as (string | null)[])];
                                    newImages[index] = url;
                                    updateField('option_image_urls', newImages);
                                  } catch (err: any) {
                                    toast.error({ title: "Upload failed", message: err.message });
                                  } finally {
                                    setUploadingIdx(null);
                                  }
                                }}
                              />
                            </label>
                          )}
                          <button
                            type="button"
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            onClick={() => removeOption(index)}
                            title="Remove option"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Tip: Press Enter to quickly add another option
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <div className="text-4xl mb-3">📝</div>
                    <p className="text-gray-600 mb-4">No options yet</p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      onClick={addOption}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add First Option
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Correct Answer - Enhanced Visual Selection */}
            {formData.question_type === "true_false" && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Correct Answer
                  <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateField('correct_answers', true)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.correct_answers === true
                        ? 'bg-green-50 border-green-500 text-green-700 shadow-md'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-semibold">True</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('correct_answers', false)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.correct_answers === false
                        ? 'bg-red-50 border-red-500 text-red-700 shadow-md'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="font-semibold">False</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {(formData.question_type === "single_choice" || formData.question_type === "multiple_choice") && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Correct Answer
                  <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                </label>
                {(formData.options || []).length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                    {(formData.options || []).map((option, index) => {
                      const isCorrect = formData.correct_answers === option;
                      return (
                        <label 
                          key={index} 
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            isCorrect
                              ? 'bg-green-50 border-green-500 shadow-sm'
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <input
                            type="radio"
                            name="correct_answer"
                            checked={isCorrect}
                            onChange={() => updateField('correct_answers', option)}
                            className="w-5 h-5"
                          />
                          <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-sm">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1 font-medium">{option || `Option ${String.fromCharCode(65 + index)}`}</span>
                          {isCorrect && (
                            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg bg-gray-50">
                    <p className="text-gray-500 text-sm">Add options first to select correct answer</p>
                  </div>
                )}
              </div>
            )}

            {formData.question_type === "multi_select" && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Correct Answers
                  <span className="text-xs text-gray-500 font-normal">(Select multiple - Optional)</span>
                </label>
                {(formData.options || []).length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                    {(formData.options || []).map((option, index) => {
                      const isCorrect = Array.isArray(formData.correct_answers) && formData.correct_answers.includes(option);
                      return (
                        <label 
                          key={index} 
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            isCorrect
                              ? 'bg-green-50 border-green-500 shadow-sm'
                              : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isCorrect}
                            onChange={(e) => {
                              const current = Array.isArray(formData.correct_answers) ? formData.correct_answers : [];
                              if (e.target.checked) {
                                updateField('correct_answers', [...current, option]);
                              } else {
                                updateField('correct_answers', current.filter((a: string) => a !== option));
                              }
                            }}
                            className="w-5 h-5"
                          />
                          <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-sm">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1 font-medium">{option || `Option ${String.fromCharCode(65 + index)}`}</span>
                          {isCorrect && (
                            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg bg-gray-50">
                    <p className="text-gray-500 text-sm">Add options first to select correct answers</p>
                  </div>
                )}
              </div>
            )}

            {/* Auto-grading option for paragraph/photo_upload */}
            {(formData.question_type === "paragraph" || formData.question_type === "photo_upload") && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={formData.auto_grade_on_answer ?? false}
                    onChange={(e) => updateField('auto_grade_on_answer', e.target.checked)}
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Auto-grade if answer provided</span>
                    <p className="text-xs text-gray-600 mt-1">
                      Automatically award full points if the student provides any answer (text or photo).
                      If disabled, manual grading will be required.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Points and Required - Enhanced */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Question Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Points with Presets */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Points
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={formData.points || 1}
                      onChange={(e) => updateField('points', parseInt(e.target.value) || 1)}
                    />
                    <div className="flex gap-1">
                      {[1, 2, 5, 10].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => updateField('points', preset)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                            formData.points === preset
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                          title={`Set to ${preset} point${preset !== 1 ? 's' : ''}`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Quick presets: 1, 2, 5, or 10 points
                  </p>
                </div>

                {/* Required Toggle */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Question Status
                  </label>
                  <label className="flex items-center gap-3 p-4 bg-white border-2 rounded-lg cursor-pointer hover:border-blue-300 transition-all">
                    <input
                      type="checkbox"
                      checked={formData.required ?? true}
                      onChange={(e) => updateField('required', e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">Required Question</div>
                      <div className="text-xs text-gray-500">Students must answer this question</div>
                    </div>
                    {formData.required && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">Required</span>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center gap-3 pt-6 border-t-2">
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Press Ctrl+Enter to save quickly
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending || uploadingQuestionImage || uploadingIdx !== null || !formData.question_text?.trim()}
                  className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                >
                  {saveMutation.isPending ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {question ? "Updating..." : "Adding..."}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={question ? "M5 13l4 4L19 7" : "M12 4v16m8-8H4"} />
                      </svg>
                      {question ? "Update Question" : "Add Question"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Add keyboard shortcut handler to the form
function QuestionModalWithKeyboard(props: Parameters<typeof QuestionModal>[0]) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      form.requestSubmit();
    }
  };

  return <QuestionModal {...props} />;
}

// Import Questions Modal Component 
function ImportQuestionsModal({ 
  examId, 
  onClose, 
  onSuccess 
}: { 
  examId: string; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const toast = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error({ title: "Invalid file", message: "Please upload a CSV file" });
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const [header, ...dataRows] = lines;
      
      if (!header || dataRows.length === 0) {
        throw new Error("Empty or invalid CSV file");
      }

      // Simple CSV parsing 
      const questions = dataRows.map((row, index) => {
        const [question_text, question_type, options, correct_answers, required, points] = row.split(',');
        return {
          question_text: question_text?.replace(/"/g, '') || `Question ${index + 1}`,
          question_type: (question_type?.trim() || 'single_choice') as QuestionRow['question_type'],
          options: options ? options.split('|').map(o => o.trim()) : null,
          correct_answers: correct_answers?.trim() || null,
          required: required?.toLowerCase() !== 'false',
          points: Number(points) || 1,
        };
      });

      const res = await authFetch(`/api/admin/exams/${examId}/questions`, {
        method: "POST",
        body: JSON.stringify({ items: questions }),
      });

      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error || "Import failed");
      }

      toast.success({ title: "Import successful", message: `Imported ${questions.length} questions` });
      onSuccess();
    } catch (e: unknown) {
      toast.error({ title: "Import failed", message: (e as Error)?.message || "Unknown error" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Import Questions</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6">
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer?.files?.[0];
              if (file) handleFile(file);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
          >
            <div className="text-4xl mb-4">📁</div>
            <div className="text-lg font-semibold mb-2">Drop CSV file here</div>
            <div className="text-gray-600 mb-4">or click to browse</div>
            <input 
              type="file" 
              accept=".csv" 
              onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
              Choose File
            </label>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p className="font-semibold mb-2">CSV Format:</p>
            <p>question_text,question_type,options,correct_answers,required,points</p>
            <p className="mt-1 text-xs">Separate multiple options with | (pipe character)</p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
