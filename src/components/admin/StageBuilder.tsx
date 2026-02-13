"use client";

import { useState } from "react";
import { Stage, StageType } from "@/lib/types";
import { validateStage } from "@/lib/stageValidation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { VideoStageConfigForm, ContentStageConfigForm, QuestionsStageConfigForm } from './StageConfigForms';
import StagePreview from './StagePreview';

interface StageBuilderProps {
  examId: string;
  stages: Stage[];
  onStagesChange: (stages: Stage[]) => void;
}

interface SortableStageItemProps {
  stage: Stage;
  index: number;
  onEdit: (stage: Stage) => void;
  onDelete: (stageId: string) => void;
}

function SortableStageItem({ stage, index, onEdit, onDelete }: SortableStageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStageTypeLabel = (type: StageType): string => {
    switch (type) {
      case 'video':
        return 'Video';
      case 'content':
        return 'Content';
      case 'questions':
        return 'Questions';
    }
  };

  const getStageTypeIcon = (type: StageType) => {
    switch (type) {
      case 'video':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'content':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'questions':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors bg-white"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <button
            className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 transition-colors"
            {...attributes}
            {...listeners}
            title="Drag to reorder"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
            {getStageTypeIcon(stage.stage_type)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                Stage {index + 1}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800">
                {getStageTypeLabel(stage.stage_type)}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              {stage.stage_type === 'video' && 'YouTube video stage'}
              {stage.stage_type === 'content' && 'Single-page rich text content'}
              {stage.stage_type === 'questions' && 'Assessment questions stage'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(stage)}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Edit stage"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(stage.id)}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete stage"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StageBuilder({ examId, stages, onStagesChange }: StageBuilderProps) {
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = stages.findIndex((stage) => stage.id === active.id);
      const newIndex = stages.findIndex((stage) => stage.id === over.id);

      const reorderedStages = arrayMove(stages, oldIndex, newIndex);
      
      // Update stage_order for all stages
      const updatedStages = reorderedStages.map((stage, index) => ({
        ...stage,
        stage_order: index,
      }));

      onStagesChange(updatedStages);
    }
  };

  const handleEditStage = (stage: Stage) => {
    setEditingStage(stage);
  };

  const handleSaveStage = (updatedStage: Stage) => {
    // Validate the stage before saving
    const validationResult = validateStage(updatedStage);
    
    if (!validationResult.isValid) {
      // Show validation errors
      const errorMessages = validationResult.errors.map((err) => err.message);
      setValidationErrors(errorMessages);
      return;
    }

    // Clear validation errors
    setValidationErrors([]);

    // Save the stage
    const updatedStages = stages.map((s) =>
      s.id === updatedStage.id ? updatedStage : s
    );
    onStagesChange(updatedStages);
    setEditingStage(null);
  };

  const handleCancelEdit = () => {
    setEditingStage(null);
    setValidationErrors([]);
  };

  const handleDeleteStage = (stageId: string) => {
    if (confirm('Are you sure you want to delete this stage?')) {
      const updatedStages = stages
        .filter((stage) => stage.id !== stageId)
        .map((stage, index) => ({
          ...stage,
          stage_order: index,
        }));
      onStagesChange(updatedStages);
    }
  };

  const getDefaultConfiguration = (stageType: StageType) => {
    switch (stageType) {
      case 'video':
        return {
          video_url: '',
          enforcement_threshold: undefined,
          description: undefined,
        };
      case 'content':
        return {
          content: '',
          title: undefined,
          minimum_read_time: undefined,
        };
      case 'questions':
        return {
          question_ids: [],
          randomize_within_stage: false,
        };
    }
  };

  const handleAddStage = (stageType: StageType) => {
    const newStage: Stage = {
      id: `temp-${Date.now()}`, // Temporary ID until saved to database
      exam_id: examId,
      stage_type: stageType,
      stage_order: stages.length,
      configuration: getDefaultConfiguration(stageType),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onStagesChange([...stages, newStage]);
    setIsAddingStage(false);
  };

  const getStageTypeLabel = (type: StageType): string => {
    switch (type) {
      case 'video':
        return 'Video';
      case 'content':
        return 'Content';
      case 'questions':
        return 'Questions';
    }
  };

  const getStageTypeIcon = (type: StageType) => {
    switch (type) {
      case 'video':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'content':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'questions':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow mt-8">
      <div className="bg-purple-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h2 className="text-base font-semibold text-gray-900">Stages</h2>
            <span className="text-sm text-gray-500">({stages.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {stages.length > 0 && (
              <button
                onClick={() => setShowPreview(true)}
                className="px-4 py-2 text-sm font-medium text-purple-600 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </button>
            )}
            <button
              onClick={() => setIsAddingStage(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Stage
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {stages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Stages Yet</h3>
            <p className="text-gray-600 mb-6">
              Create a multi-stage exam by adding video, content, or question stages.
            </p>
            <button
              onClick={() => setIsAddingStage(true)}
              className="px-6 py-3 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Your First Stage
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={stages.map((stage) => stage.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <SortableStageItem
                    key={stage.id}
                    stage={stage}
                    index={index}
                    onEdit={handleEditStage}
                    onDelete={handleDeleteStage}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add Stage Modal */}
        {isAddingStage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Add Stage</h3>
                  <button
                    onClick={() => setIsAddingStage(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                  Select the type of stage you want to add:
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => handleAddStage('video')}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                        {getStageTypeIcon('video')}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Video Stage</div>
                        <div className="text-sm text-gray-600">Embed a video</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleAddStage('content')}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                        {getStageTypeIcon('content')}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Content Stage</div>
                        <div className="text-sm text-gray-600">Single-page rich text content</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleAddStage('questions')}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                        {getStageTypeIcon('questions')}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Questions Stage</div>
                        <div className="text-sm text-gray-600">Add assessment questions</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Stage Modal */}
      {editingStage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit {editingStage.stage_type.charAt(0).toUpperCase() + editingStage.stage_type.slice(1)} Stage
                </h3>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              {validationErrors.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800 mb-1">Please fix the following errors:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {validationErrors.map((error, index) => (
                          <li key={index} className="text-sm text-red-700">{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              {editingStage.stage_type === 'video' && (
                <VideoStageConfigForm
                  config={editingStage.configuration as any}
                  onChange={(config) => {
                    setEditingStage({
                      ...editingStage,
                      configuration: config,
                    });
                  }}
                />
              )}
              {editingStage.stage_type === 'content' && (
                <ContentStageConfigForm
                  config={editingStage.configuration as any}
                  onChange={(config) => {
                    setEditingStage({
                      ...editingStage,
                      configuration: config,
                    });
                  }}
                />
              )}
              {editingStage.stage_type === 'questions' && (
                <QuestionsStageConfigForm
                  config={editingStage.configuration as any}
                  examId={examId}
                  onChange={(config) => {
                    setEditingStage({
                      ...editingStage,
                      configuration: config,
                    });
                  }}
                />
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveStage(editingStage)}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <StagePreview
          stages={stages}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
