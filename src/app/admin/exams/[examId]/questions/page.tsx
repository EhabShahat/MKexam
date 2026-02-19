"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useCallback, use } from "react";
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
// Note: ReactQuill removed due to React 18 compatibility issues
// Using simple textarea with HTML formatting support instead

interface QuestionRow {
  id: string;
  exam_id: string;
  question_text: string;
  question_type: "true_false" | "single_choice" | "multiple_choice" | "multi_select" | "paragraph";
  options: string[] | null;
  correct_answers: unknown;
  required: boolean;
  points: number;
  order_index: number | null;
}

export default function AdminQuestionsPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  const qc = useQueryClient();
  const toast = useToast();
  
  // Modal states
  const [editingQuestion, setEditingQuestion] = useState<QuestionRow | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "questions", examId],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/questions`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return (j.items as QuestionRow[]).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    },
  });

  // Local working list to support drag-and-drop without flicker
  const [rows, setRows] = useState<QuestionRow[] | null>(null);
  useEffect(() => {
    setRows(data ?? null);
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

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
        await authFetch(`/api/admin/exams/${examId}/questions/reorder`, {
          method: "PATCH",
          body: JSON.stringify({ items: newRows.map((r: QuestionRow, idx: number) => ({ id: r.id, order_index: idx + 1 })) }),
        });
        qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
        toast.success({ title: "Questions reordered", message: "Order updated successfully" });
      } catch (e: unknown) {
        toast.error({ title: "Reorder failed", message: (e as Error)?.message || "Unknown error" });
      } finally {
        setReordering(false);
      }
    },
    [rows, examId, qc, toast]
  );

  const updateQ = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<QuestionRow> }) => {
      const res = await authFetch(`/api/admin/exams/${examId}/questions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Update failed");
      return j.item as QuestionRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
      setEditingQuestion(null);
      toast.success({ title: "Question updated", message: "Changes saved successfully" });
    },
    onError: (e: unknown) => toast.error({ title: "Update failed", message: (e as Error)?.message || "Unknown error" }),
  });

  const deleteQ = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/admin/exams/${examId}/questions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error || "Delete failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
      toast.success({ title: "Question deleted", message: "Removed successfully" });
    },
    onError: (e: unknown) => toast.error({ title: "Delete failed", message: (e as Error)?.message || "Unknown error" }),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Questions</h1>
          <p className="text-muted-foreground mt-1">
            {rows?.length || 0} question{(rows?.length || 0) !== 1 ? 's' : ''} in this exam
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowImportModal(true)}
            className="btn btn-outline"
          >
            📁 Import
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
          >
            ➕ Add Question
          </button>
        </div>
      </div>

      {/* Reordering indicator */}
      {reordering && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2 text-blue-700">
            <span className="spinner" />
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
        <EmptyState onAddQuestion={() => setShowAddModal(true)} />
      )}

      {/* Modals */}
      {showAddModal && (
        <AddQuestionModal
          examId={examId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            qc.invalidateQueries({ queryKey: ["admin", "questions", examId] });
          }}
        />
      )}

      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSave={(patch) => updateQ.mutate({ id: editingQuestion.id, patch })}
          isSaving={updateQ.isPending}
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
    </div>
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

  const getQuestionTypeLabel = (type: string) => {
    const labels = {
      true_false: "True/False",
      single_choice: "Single Choice",
      multiple_choice: "Multiple Choice", 
      multi_select: "Multi Select",
      paragraph: "Essay/Paragraph"
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getQuestionTypeColor = (type: string) => {
    const colors = {
      true_false: "bg-blue-100 text-blue-800 border-blue-200",
      single_choice: "bg-green-100 text-green-800 border-green-200",
      multiple_choice: "bg-purple-100 text-purple-800 border-purple-200",
      multi_select: "bg-orange-100 text-orange-800 border-orange-200",
      paragraph: "bg-gray-100 text-gray-800 border-gray-200"
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        {/* Drag Handle */}
        <div 
          {...attributes} 
          {...listeners}
          className="drag-handle mt-1 p-2 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          ⠿
        </div>

        {/* Question Number */}
        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm">
          {index + 1}
        </div>

        {/* Question Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <div 
                className="text-foreground font-medium leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: question.question_text.length > 150 
                    ? question.question_text.substring(0, 150) + "..." 
                    : question.question_text 
                }}
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`badge ${getQuestionTypeColor(question.question_type)}`}>
                {getQuestionTypeLabel(question.question_type)}
              </span>
              {question.required && (
                <span className="badge badge-red">Required</span>
              )}
              <span className="text-sm text-muted-foreground">
                {question.points} pt{question.points !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Options Preview */}
          {(question.options?.length ?? 0) > 0 && (
            <div className="mb-3">
              <div className="text-sm text-muted-foreground mb-1">Options:</div>
              <div className="flex flex-wrap gap-2">
                {(question.options ?? []).slice(0, 4).map((option, idx) => (
                  <span key={idx} className="badge badge-outline text-xs">
                    {option.length > 20 ? option.substring(0, 20) + "..." : option}
                  </span>
                ))}
                {(question.options ?? []).length > 4 && (
                  <span className="badge badge-outline text-xs">
                    +{(question.options ?? []).length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Correct Answer Preview */}
          {question.correct_answers != null && (
            <div className="mb-3">
              <div className="text-sm text-muted-foreground mb-1">Correct answer:</div>
              <span className="badge badge-green text-xs">
                {formatCorrectAnswer(question)}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onEdit}
            className="btn btn-sm btn-outline"
            title="Edit question"
          >
            ✏️ Edit
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="btn btn-sm btn-destructive"
            title="Delete question"
          >
            {isDeleting ? <span className="spinner" /> : "🗑️"}
          </button>
        </div>
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

// Loading State Component
function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-48 mt-2 animate-pulse"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-10 bg-gray-200 rounded w-20 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mt-2 animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Error State Component
function ErrorState({ message }: { message: string }) {
  return (
    <div className="card bg-red-50 border-red-200">
      <div className="text-center py-8">
        <div className="text-red-600 text-lg font-semibold mb-2">
          Failed to load questions
        </div>
        <div className="text-red-500 text-sm">{message}</div>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ onAddQuestion }: { onAddQuestion: () => void }) {
  return (
    <div className="card bg-gray-50 border-dashed border-2">
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No questions yet
        </h3>
        <p className="text-muted-foreground mb-6">
          Get started by adding your first question or importing from a file.
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={onAddQuestion} className="btn btn-primary">
            ➕ Add First Question
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Question Modal Component
function AddQuestionModal({ 
  examId, 
  onClose, 
  onSuccess 
}: { 
  examId: string; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const toast = useToast();
  const [formData, setFormData] = useState<Partial<QuestionRow>>({
    question_text: "",
    question_type: "single_choice",
    options: [],
    correct_answers: null,
    required: true,
    points: 1,
  });

  const saveNew = useMutation({
    mutationFn: async (payload: Partial<QuestionRow>) => {
      const res = await authFetch(`/api/admin/exams/${examId}/questions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Create failed");
      return j.item as QuestionRow;
    },
    onSuccess: () => {
      toast.success({ title: "Question added", message: "Question created successfully" });
      onSuccess();
    },
    onError: (e: unknown) => toast.error({ title: "Add failed", message: (e as Error)?.message || "Unknown error" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question_text?.trim()) {
      toast.error({ title: "Validation error", message: "Question text is required" });
      return;
    }
    saveNew.mutate(formData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <Modal title="Add New Question" onClose={onClose}>
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
        <QuestionForm 
          formData={formData} 
          setFormData={setFormData}
        />
        
        <div className="flex justify-between items-center gap-3 pt-6 border-t-2">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Press Ctrl+Enter to save quickly
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saveNew.isPending || !formData.question_text?.trim()}
              className="btn btn-primary shadow-md hover:shadow-lg transition-shadow"
            >
              {saveNew.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="spinner" />
                  Adding Question...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Question
                </span>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// Edit Question Modal Component
function EditQuestionModal({ 
  question, 
  onClose, 
  onSave, 
  isSaving 
}: { 
  question: QuestionRow; 
  onClose: () => void; 
  onSave: (patch: Partial<QuestionRow>) => void;
  isSaving: boolean;
}) {
  const toast = useToast();
  const [formData, setFormData] = useState<Partial<QuestionRow>>({
    question_text: question.question_text,
    question_type: question.question_type,
    options: question.options || [],
    correct_answers: question.correct_answers,
    required: question.required,
    points: question.points,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question_text?.trim()) {
      toast.error({ title: "Validation error", message: "Question text is required" });
      return;
    }
    onSave(formData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <Modal title="Edit Question" onClose={onClose}>
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
        <QuestionForm 
          formData={formData} 
          setFormData={setFormData}
        />
        
        <div className="flex justify-between items-center gap-3 pt-6 border-t-2">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Press Ctrl+Enter to save quickly
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving || !formData.question_text?.trim()}
              className="btn btn-primary shadow-md hover:shadow-lg transition-shadow"
            >
              {isSaving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="spinner" />
                  Saving Changes...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </span>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// Question Form Component (shared between Add and Edit)
function QuestionForm({ 
  formData, 
  setFormData 
}: { 
  formData: Partial<QuestionRow>; 
  setFormData: (data: Partial<QuestionRow>) => void; 
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: keyof QuestionRow, value: unknown) => {
    setFormData({ ...formData, [field]: value });
    // Clear error for this field when user makes changes
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const addOption = () => {
    const options = formData.options || [];
    updateField('options', [...options, '']);
  };

  const updateOption = (index: number, value: string) => {
    const options = [...(formData.options || [])];
    options[index] = value;
    updateField('options', options);
  };

  const removeOption = (index: number) => {
    const options = [...(formData.options || [])];
    options.splice(index, 1);
    updateField('options', options);
    // Update correct answers if needed
    if (formData.question_type === 'single_choice' && formData.correct_answers === options[index]) {
      updateField('correct_answers', null);
    } else if (Array.isArray(formData.correct_answers)) {
      updateField('correct_answers', formData.correct_answers.filter(a => a !== options[index]));
    }
  };

  const moveOption = (fromIndex: number, toIndex: number) => {
    const options = [...(formData.options || [])];
    const [moved] = options.splice(fromIndex, 1);
    options.splice(toIndex, 0, moved);
    updateField('options', options);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      moveOption(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addOption();
    }
  };

  const needsOptions = ['single_choice', 'multiple_choice', 'multi_select'].includes(formData.question_type || '');
  
  const questionTypeInfo = {
    true_false: { icon: '✓✗', color: 'bg-blue-50 border-blue-200 text-blue-700', description: 'Simple true or false question' },
    single_choice: { icon: '◉', color: 'bg-green-50 border-green-200 text-green-700', description: 'Students select one option, only one is correct' },
    multiple_choice: { icon: '◉', color: 'bg-purple-50 border-purple-200 text-purple-700', description: 'Students select one option, multiple can be correct' },
    multi_select: { icon: '☑', color: 'bg-orange-50 border-orange-200 text-orange-700', description: 'Students can select multiple options' },
    paragraph: { icon: '📝', color: 'bg-gray-50 border-gray-200 text-gray-700', description: 'Open-ended text response' }
  };

  const charCount = formData.question_text?.length || 0;
  const optionCount = formData.options?.length || 0;
  const hasCorrectAnswer = formData.correct_answers != null && (
    Array.isArray(formData.correct_answers) ? formData.correct_answers.length > 0 : true
  );

  return (
    <div className="space-y-6">
      {/* Question Type Selection - Visual Cards */}
      <div>
        <label className="label mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          Question Type
          <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(questionTypeInfo).map(([type, info]) => (
            <button
              key={type}
              type="button"
              onClick={() => updateField('question_type', type)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                formData.question_type === type
                  ? `${info.color} border-current shadow-md scale-105`
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{info.icon}</span>
                <span className="font-semibold text-sm">
                  {type === 'true_false' && 'True/False'}
                  {type === 'single_choice' && 'Single Choice'}
                  {type === 'multiple_choice' && 'Multiple Choice'}
                  {type === 'multi_select' && 'Multi Select'}
                  {type === 'paragraph' && 'Essay/Paragraph'}
                </span>
              </div>
              <p className="text-xs opacity-75">{info.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Question Text */}
      <div>
        <label className="label mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Question Text
            <span className="text-red-500">*</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {charCount} character{charCount !== 1 ? 's' : ''}
          </span>
        </label>
        <textarea
          className={`textarea ${errors.question_text ? 'border-red-500' : ''}`}
          rows={4}
          placeholder="Enter your question... (HTML formatting supported: <b>bold</b>, <i>italic</i>, <u>underline</u>)"
          value={formData.question_text || ""}
          onChange={(e) => updateField('question_text', e.target.value)}
        />
        {errors.question_text && (
          <p className="text-xs text-red-600 mt-1">{errors.question_text}</p>
        )}
        {formData.question_text && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
            <div className="text-xs text-muted-foreground mb-1">Preview:</div>
            <div 
              className="text-sm"
              dangerouslySetInnerHTML={{ __html: formData.question_text }} 
            />
          </div>
        )}
      </div>

      {/* Question Image Upload */}
      <div>
        <label className="label mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Question Image (optional)
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            id="question-image"
            onChange={(e) => {
              // Handle image upload
              const file = e.target.files?.[0];
              if (file) {
                // TODO: Implement image upload
                console.log('Image upload:', file);
              }
            }}
          />
          <label htmlFor="question-image" className="cursor-pointer">
            <div className="text-4xl mb-2">🖼️</div>
            <div className="text-sm text-muted-foreground mb-2">
              Click to upload or drag and drop
            </div>
            <div className="text-xs text-muted-foreground">
              PNG, JPG, GIF up to 5MB
            </div>
          </label>
        </div>
      </div>

      {/* Options (for choice questions) */}
      {needsOptions && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="label flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Answer Options
              <span className="text-red-500">*</span>
              <span className="badge badge-outline text-xs ml-2">
                {optionCount} option{optionCount !== 1 ? 's' : ''}
              </span>
            </label>
            <button 
              type="button" 
              onClick={addOption}
              className="btn btn-sm btn-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Option
            </button>
          </div>
          
          {(formData.options || []).length > 0 ? (
            <div className="space-y-2">
              {(formData.options || []).map((option, index) => (
                <div 
                  key={index} 
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex gap-3 items-center p-3 bg-white border-2 rounded-lg transition-all ${
                    draggedIndex === index ? 'opacity-50 scale-95' : 'hover:border-primary hover:shadow-sm'
                  }`}
                >
                  <div 
                    className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                    title="Drag to reorder"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold shadow-sm">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <input
                    className="input flex-1"
                    placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="btn btn-sm btn-ghost text-red-600 hover:bg-red-50"
                    title="Remove option"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-gray-50">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-muted-foreground mb-4">No options yet</p>
              <button 
                type="button" 
                onClick={addOption}
                className="btn btn-primary"
              >
                Add First Option
              </button>
            </div>
          )}
          
          {(formData.options || []).length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tip: Press Enter to quickly add another option, or drag to reorder
            </div>
          )}
        </div>
      )}

      {/* Correct Answer */}
      <div>
        <label className="label mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Correct Answer
          <span className="text-xs text-muted-foreground font-normal">(Optional for manual grading)</span>
          {hasCorrectAnswer && (
            <span className="badge badge-green text-xs ml-2">
              <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Set
            </span>
          )}
        </label>
        
        {formData.question_type === "true_false" ? (
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
        ) : needsOptions ? (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2 text-sm text-blue-800">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  {formData.question_type === "single_choice" && "Select the one correct option"}
                  {formData.question_type === "multiple_choice" && "Select one or more correct options (students will only choose one)"}
                  {formData.question_type === "multi_select" && "Select all correct options (students can choose multiple)"}
                </div>
              </div>
            </div>
            
            {(formData.options || []).length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                {(formData.options || []).map((option, index) => {
                  const isCorrect = formData.question_type === "single_choice" 
                    ? formData.correct_answers === option
                    : Array.isArray(formData.correct_answers) && formData.correct_answers.includes(option);
                  
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
                        type={formData.question_type === "single_choice" ? "radio" : "checkbox"}
                        name="correct_answer"
                        checked={isCorrect}
                        onChange={(e) => {
                          if (formData.question_type === "single_choice") {
                            updateField('correct_answers', e.target.checked ? option : null);
                          } else {
                            const current = Array.isArray(formData.correct_answers) ? formData.correct_answers : [];
                            if (e.target.checked) {
                              updateField('correct_answers', [...current, option]);
                            } else {
                              updateField('correct_answers', current.filter(a => a !== option));
                            }
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
                <p className="text-muted-foreground text-sm">Add options first to select correct answers</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <input
              className="input"
              placeholder="Enter the correct answer (for reference/manual grading)..."
              value={String(formData.correct_answers || "")}
              onChange={(e) => updateField('correct_answers', e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              This will be used as a reference for manual grading of essay questions
            </p>
          </div>
        )}
      </div>

      {/* Settings Row */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Question Settings
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Points */}
          <div>
            <label className="label mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Points
              <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="input flex-1"
                value={formData.points || 1}
                onChange={(e) => updateField('points', Number(e.target.value))}
              />
              <div className="flex gap-1">
                {[1, 2, 5, 10].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateField('points', preset)}
                    className={`btn btn-sm ${formData.points === preset ? 'btn-primary' : 'btn-outline'}`}
                    title={`Set to ${preset} point${preset !== 1 ? 's' : ''}`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Quick presets: 1, 2, 5, or 10 points
            </p>
          </div>

          {/* Required Toggle */}
          <div>
            <label className="label mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Question Status
            </label>
            <label className="flex items-center gap-3 p-4 bg-white border-2 rounded-lg cursor-pointer hover:border-primary transition-all">
              <input
                type="checkbox"
                checked={formData.required ?? true}
                onChange={(e) => updateField('required', e.target.checked)}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Required Question</div>
                <div className="text-xs text-muted-foreground">Students must answer this question</div>
              </div>
              {formData.required && (
                <span className="badge badge-red text-xs">Required</span>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Validation Summary */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
        <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Question Checklist
        </h4>
        <div className="space-y-2 text-sm">
          <div className={`flex items-center gap-2 ${formData.question_text?.trim() ? 'text-green-700' : 'text-gray-500'}`}>
            {formData.question_text?.trim() ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            Question text entered
          </div>
          {needsOptions && (
            <div className={`flex items-center gap-2 ${(formData.options?.length || 0) >= 2 ? 'text-green-700' : 'text-gray-500'}`}>
              {(formData.options?.length || 0) >= 2 ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              At least 2 options added ({formData.options?.length || 0})
            </div>
          )}
          <div className={`flex items-center gap-2 ${hasCorrectAnswer ? 'text-green-700' : 'text-yellow-600'}`}>
            {hasCorrectAnswer ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            Correct answer set (optional)
          </div>
          <div className={`flex items-center gap-2 ${(formData.points || 0) > 0 ? 'text-green-700' : 'text-gray-500'}`}>
            {(formData.points || 0) > 0 ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            Points assigned ({formData.points || 0} pt{(formData.points || 0) !== 1 ? 's' : ''})
          </div>
        </div>
      </div>
    </div>
  );
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
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<QuestionRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const templateCsv = useMemo(() => (
    "question_text,question_type,options,correct_answers,required,points\n" +
    "What is 2+2?,single_choice,2|3|4|5,4,true,1\n" +
    "Sky is blue?,true_false,,true,true,1\n" +
    "Select primes,multi_select,2|3|4|5,2|3|5,true,2\n"
  ), []);

  async function handleFile(file: File) {
    setImportErrors([]);
    setPreview([]);
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".csv")) {
        const txt = await file.text();
        const rows = await parseCsv(txt);
        const mapped = mapRows(rows);
        setPreview(mapped);
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const rows = await parseXlsx(buf);
        const mapped = mapRows(rows);
        setPreview(mapped);
      } else {
        setImportErrors(["Unsupported file type. Use CSV or XLSX."]);
      }
    } catch (e: unknown) {
      setImportErrors([(e as Error)?.message || "Import failed"]);
      toast.error({ title: "Import failed", message: (e as Error)?.message || "Unknown error" });
    }
  }

  async function commitImport() {
    if (!preview.length) return;
    setIsImporting(true);
    try {
      const payload = preview.map(({ id: _id, exam_id: _examId, ...rest }) => ({ ...rest, exam_id: examId }));
      const res = await authFetch(`/api/admin/exams/${examId}/questions`, {
        method: "POST",
        body: JSON.stringify({ items: payload }),
      });
      const j = await res.json();
      if (!res.ok) {
        setImportErrors([j?.error || "Bulk import failed"]);
        return;
      }
      const n = j.items?.length ?? 0;
      toast.success({ title: "Import complete", message: `Imported ${n} questions` });
      onSuccess();
    } catch (e: unknown) {
      setImportErrors([(e as Error)?.message || "Import failed"]);
    } finally {
      setIsImporting(false);
    }
  }

  function downloadTemplate() {
    try {
      const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "questions-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore errors
    }
  }

  function onDropZone(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  function onDragOverZone(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeaveZone(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
  }

  function mapRows(rows: unknown[][]): QuestionRow[] {
    const [header, ...dataRows] = rows;
    if (!header) throw new Error("Empty file");
    const idx = (name: string) => header.findIndex((h: unknown) => String(h).trim().toLowerCase() === name);
    const qi = idx("question_text");
    const ti = idx("question_type");
    const oi = idx("options");
    const ci = idx("correct_answers");
    const ri = idx("required");
    const pi = idx("points");
    if (qi < 0 || ti < 0) throw new Error("Missing required headers: question_text, question_type");

    const out: QuestionRow[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const question_text = String(r[qi] ?? "").trim();
      const question_type = String(r[ti] ?? "").trim() as QuestionRow["question_type"];
      if (!question_text || !question_type) continue;
      let options: string[] | null = null;
      if (oi >= 0 && r[oi]) options = String(r[oi]).split("|").map((s) => String(s).trim()).filter(Boolean);
      let correct: unknown = null;
      if (ci >= 0 && r[ci] != null) {
        const raw = String(r[ci]);
        if (question_type === "multiple_choice" || question_type === "multi_select") correct = raw.split("|").map((s) => s.trim());
        else if (question_type === "true_false") correct = raw.toLowerCase() === "true";
        else correct = raw;
      }
      const required = ri >= 0 ? String(r[ri]).toLowerCase() !== "false" : true;
      const points = pi >= 0 ? Number(r[pi]) || 1 : 1;
      // Generate UUID using browser's crypto API or fallback to a simple random string
      const generateUUID = () => {
        try {
          return window.crypto.randomUUID();
        } catch (e) {
          // Simple fallback for browsers without randomUUID support
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }
      };
      
      out.push({
        id: generateUUID(),
        exam_id: examId,
        question_text,
        question_type,
        options,
        correct_answers: correct,
        required,
        points,
        order_index: out.length + 1,
      });
    }
    return out;
  }

  async function parseCsv(text: string): Promise<unknown[][]> {
    try {
      const Papa = (await import("papaparse")).default as { parse: (text: string, options: { skipEmptyLines: boolean }) => { data: unknown[][] } };
      const res = Papa.parse(text.trim(), { skipEmptyLines: true });
      return [res.data[0] as unknown[], ...res.data.slice(1)];
    } catch {
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines.map((l) => l.split(","));
      return rows;
    }
  }

  async function parseXlsx(buf: ArrayBuffer): Promise<unknown[][]> {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
      return rows;
    } catch (e) {
      throw new Error("Install 'xlsx' to import Excel files");
    }
  }

  return (
    <Modal title="Import Questions" onClose={onClose} size="large">
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Import Instructions</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Upload a CSV or Excel file with your questions</li>
            <li>• Required columns: question_text, question_type</li>
            <li>• Optional columns: options, correct_answers, required, points</li>
            <li>• For options and multiple correct answers, separate with | (pipe)</li>
          </ul>
        </div>

        {/* File Upload */}
        <div>
          <div 
            className={`dropzone ${dragOver ? "dragover" : ""}`} 
            onDrop={onDropZone} 
            onDragOver={onDragOverZone} 
            onDragLeave={onDragLeaveZone}
          >
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📁</div>
              <div className="text-lg font-semibold mb-2">Drop your file here</div>
              <div className="text-muted-foreground mb-4">or click to browse</div>
              <input 
                type="file" 
                accept=".csv,.xlsx,.xls" 
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="btn btn-outline">
                Choose File
              </label>
            </div>
          </div>
        </div>

        {/* Template Download */}
        <div className="flex justify-center">
          <button onClick={downloadTemplate} className="btn btn-outline btn-sm">
            📥 Download Template CSV
          </button>
        </div>

        {/* Errors */}
        {importErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">Import Errors</h3>
            <ul className="text-sm text-red-800 space-y-1">
              {importErrors.map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-green-900">
                Preview: {preview.length} question{preview.length !== 1 ? 's' : ''} ready to import
              </h3>
              <button 
                onClick={commitImport}
                disabled={isImporting}
                className="btn btn-primary"
              >
                {isImporting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="spinner" />
                    Importing...
                  </span>
                ) : (
                  `Import ${preview.length} Questions`
                )}
              </button>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              <div className="space-y-2">
                {preview.slice(0, 5).map((q, i) => (
                  <div key={i} className="bg-white border rounded p-3 text-sm">
                    <div className="font-medium mb-1">{q.question_text}</div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Type: {q.question_type}</span>
                      <span>Points: {q.points}</span>
                      {q.options && <span>Options: {q.options.length}</span>}
                    </div>
                  </div>
                ))}
                {preview.length > 5 && (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    ... and {preview.length - 5} more questions
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button onClick={onClose} className="btn btn-outline">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Modal Component
function Modal({ 
  title, 
  children, 
  onClose, 
  size = "default" 
}: { 
  title: string; 
  children: React.ReactNode; 
  onClose: () => void;
  size?: "default" | "large";
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const sizeClasses = {
    default: "max-w-3xl",
    large: "max-w-5xl"
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden animate-slideUp`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b-2 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <span className="bg-primary text-white p-2 rounded-lg shadow-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            {title}
          </h2>
          <button 
            onClick={onClose}
            className="btn btn-ghost btn-sm hover:bg-red-50 hover:text-red-600 transition-colors rounded-full w-10 h-10 flex items-center justify-center"
            title="Close (Esc)"
            aria-label="Close dialog"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

// Rich Text Editor Component with React 18 compatibility
function RichTextEditor({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder?: string; 
}) {
  const [isClient, setIsClient] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
    // Add a small delay to ensure ReactQuill loads properly
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Fallback to textarea for better compatibility
  const renderTextarea = () => (
    <textarea
      className="textarea"
      rows={5}
      placeholder={placeholder || "Enter your question..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  if (!isClient || isLoading) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="animate-pulse text-muted-foreground">Loading rich text editor...</div>
      </div>
    );
  }

  if (hasError) {
    return renderTextarea();
  }

  // Use a simple textarea with formatting hints for better compatibility
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        You can use basic HTML tags: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;, &lt;u&gt;underline&lt;/u&gt;, &lt;br&gt; for line breaks
      </div>
      <textarea
        className="textarea"
        rows={6}
        placeholder={placeholder || "Enter your question... (HTML formatting supported)"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="text-xs text-muted-foreground">
        Preview: <span dangerouslySetInnerHTML={{ __html: value || "Your formatted text will appear here..." }} />
      </div>
    </div>
  );

  /* 
  // Uncomment this when ReactQuill is fully React 18 compatible
  try {
    return (
      <div className="border rounded-lg overflow-hidden">
        <ReactQuill 
          theme="snow" 
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          modules={{
            toolbar: [
              [{ 'header': [1, 2, 3, false] }],
              ['bold', 'italic', 'underline'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ['link'],
              ['clean']
            ],
          }}
          formats={[
            'header', 'bold', 'italic', 'underline',
            'list', 'bullet', 'link'
          ]}
        />
      </div>
    );
  } catch (error) {
    console.error('ReactQuill error:', error);
    setHasError(true);
    return renderTextarea();
  }
  */
}