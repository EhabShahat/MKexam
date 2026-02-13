"use client";

import { useState, useEffect } from "react";
import { VideoStageConfig, ContentStageConfig, QuestionsStageConfig } from "@/lib/types";
import { validateVideoUrl } from "@/lib/stageValidation";
import 'react-quill-new/dist/quill.snow.css';

interface VideoStageConfigFormProps {
  config: VideoStageConfig;
  onChange: (config: VideoStageConfig) => void;
}

export function VideoStageConfigForm({ config, onChange }: VideoStageConfigFormProps) {
  const [urlError, setUrlError] = useState<string>("");

  const handleUrlChange = (url: string) => {
    if (url && !validateVideoUrl(url)) {
      setUrlError("Please enter a valid video URL");
    } else {
      setUrlError("");
    }
    onChange({ ...config, video_url: url });
  };

  const handleThresholdChange = (value: number | undefined) => {
    onChange({ ...config, enforcement_threshold: value });
  };

  const handleDescriptionChange = (description: string | undefined) => {
    onChange({ ...config, description });
  };

  return (
    <div className="space-y-4">
      {/* Video URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Video URL *
        </label>
        <input
          type="url"
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
            urlError ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="https://example.com/video.mp4 or YouTube URL"
          value={config.video_url}
          onChange={(e) => handleUrlChange(e.target.value)}
        />
        {urlError && (
          <p className="mt-1 text-sm text-red-600">{urlError}</p>
        )}
        <div className="mt-2 space-y-1">
          <p className="text-sm text-gray-600">
            <strong>Recommended:</strong> Direct video files (MP4, WebM, Ogg) for full progress tracking
          </p>
          <p className="text-sm text-gray-500">
            Also supports: YouTube URLs (limited tracking), HLS streams (.m3u8), DASH (.mpd)
          </p>
        </div>
      </div>

      {/* Enforcement Threshold */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Watch Requirement (Optional)
          </label>
          {config.enforcement_threshold !== undefined && (
            <span className="text-sm font-medium text-purple-600">
              {config.enforcement_threshold}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            className="flex-1"
            value={config.enforcement_threshold ?? 0}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              handleThresholdChange(value > 0 ? value : undefined);
            }}
          />
          <button
            type="button"
            onClick={() => handleThresholdChange(undefined)}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {config.enforcement_threshold !== undefined
            ? `Students must watch at least ${config.enforcement_threshold}% of the video to continue`
            : 'No watch requirement - students can skip the video'}
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description (Optional)
        </label>
        <textarea
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
          rows={3}
          placeholder="Add instructions or context for this video..."
          value={config.description ?? ''}
          onChange={(e) => handleDescriptionChange(e.target.value || undefined)}
        />
      </div>
    </div>
  );
}

interface ContentStageConfigFormProps {
  config: ContentStageConfig;
  onChange: (config: ContentStageConfig) => void;
}

export function ContentStageConfigForm({ config, onChange }: ContentStageConfigFormProps) {
  const [ReactQuill, setReactQuill] = useState<any>(null);

  // Dynamically import React Quill (client-side only)
  useEffect(() => {
    import('react-quill-new').then((mod) => {
      setReactQuill(() => mod.default);
    });
  }, []);

  const handleContentChange = (content: string) => {
    onChange({
      ...config,
      content,
    });
  };

  const handleTitleChange = (title: string) => {
    onChange({
      ...config,
      title: title || undefined,
    });
  };

  const handleMinimumReadTimeChange = (value: string) => {
    const numValue = parseInt(value);
    onChange({
      ...config,
      minimum_read_time: numValue > 0 ? numValue : undefined,
    });
  };

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['blockquote', 'code-block'],
      [{ align: [] }],
      ['clean'],
    ],
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Title (Optional)
        </label>
        <input
          type="text"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          placeholder="e.g., Instructions, Important Information, etc."
          value={config.title ?? ''}
          onChange={(e) => handleTitleChange(e.target.value)}
        />
        <p className="mt-1 text-sm text-gray-500">
          Optional heading to display above the content
        </p>
      </div>

      {/* Minimum Read Time */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Minimum Read Time (Optional)
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            step="5"
            className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="0"
            value={config.minimum_read_time ?? ''}
            onChange={(e) => handleMinimumReadTimeChange(e.target.value)}
          />
          <span className="text-sm text-gray-600">seconds</span>
          {config.minimum_read_time !== undefined && (
            <button
              type="button"
              onClick={() => onChange({ ...config, minimum_read_time: undefined })}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {config.minimum_read_time
            ? `Students must spend at least ${config.minimum_read_time} seconds reading before continuing`
            : 'No minimum read time - students can continue immediately'}
        </p>
      </div>

      {/* Content Editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Content *
        </label>
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          {ReactQuill ? (
            <ReactQuill
              theme="snow"
              value={config.content || ''}
              onChange={handleContentChange}
              modules={quillModules}
              className="bg-white"
              placeholder="Enter your content here... You can format text, add images, lists, and more."
              style={{ minHeight: '400px' }}
            />
          ) : (
            <div className="text-center py-16 text-gray-500 bg-gray-50">
              <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3"></div>
              <p className="text-sm">Loading editor...</p>
            </div>
          )}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Use the rich text editor to format your content. You can add headings, lists, images, links, and more.
        </p>
      </div>

      {/* Preview */}
      {config.content && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Preview
          </label>
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            {config.title && (
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {config.title}
              </h2>
            )}
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: config.content }}
            />
          </div>
        </div>
      )}

      {!config.content && (
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Content is required</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                Add content using the editor above to create this stage
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface QuestionsStageConfigFormProps {
  config: QuestionsStageConfig;
  onChange: (config: QuestionsStageConfig) => void;
  examId?: string;
}

export function QuestionsStageConfigForm({ config, onChange, examId }: QuestionsStageConfigFormProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch questions for the exam
  useEffect(() => {
    if (!examId) {
      setLoading(false);
      return;
    }

    const fetchQuestions = async () => {
      try {
        const res = await fetch(`/api/admin/exams/${examId}/questions`);
        if (!res.ok) {
          throw new Error('Failed to load questions');
        }
        const data = await res.json();
        setQuestions(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load questions');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [examId]);

  const handleToggleQuestion = (questionId: string) => {
    const isSelected = config.question_ids.includes(questionId);
    const updatedIds = isSelected
      ? config.question_ids.filter((id) => id !== questionId)
      : [...config.question_ids, questionId];
    
    onChange({
      ...config,
      question_ids: updatedIds,
    });
  };

  const handleToggleRandomization = () => {
    onChange({
      ...config,
      randomize_within_stage: !config.randomize_within_stage,
    });
  };

  const handleSelectAll = () => {
    onChange({
      ...config,
      question_ids: questions.map((q) => q.id),
    });
  };

  const handleDeselectAll = () => {
    onChange({
      ...config,
      question_ids: [],
    });
  };

  const getQuestionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      true_false: 'True/False',
      single_choice: 'Single Choice',
      multiple_choice: 'Multiple Choice',
      multi_select: 'Multi Select',
      short_answer: 'Short Answer',
      paragraph: 'Paragraph',
      photo_upload: 'Photo Upload',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        <p className="mt-3 text-sm text-gray-600">Loading questions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm text-gray-600 mb-3">No questions available</p>
        <p className="text-xs text-gray-500">Add questions to this exam first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Randomization Toggle */}
      <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
        <div>
          <label className="text-sm font-medium text-gray-900">
            Randomize Questions
          </label>
          <p className="text-xs text-gray-600 mt-0.5">
            Shuffle question order within this stage for each student
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleRandomization}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            config.randomize_within_stage ? 'bg-purple-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.randomize_within_stage ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Question Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Select Questions ({config.question_ids.length} of {questions.length} selected)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-1 text-xs font-medium text-purple-600 hover:text-purple-700 border border-purple-300 rounded hover:bg-purple-50"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
          {questions.map((question, index) => {
            const isSelected = config.question_ids.includes(question.id);
            return (
              <div
                key={question.id}
                className={`border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors ${
                  isSelected ? 'bg-purple-50' : ''
                }`}
              >
                <label className="flex items-start gap-3 p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleQuestion(question.id)}
                    className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500">
                        Q{index + 1}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                        {getQuestionTypeLabel(question.question_type)}
                      </span>
                      {question.points > 0 && (
                        <span className="text-xs text-gray-500">
                          {question.points} {question.points === 1 ? 'point' : 'points'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 line-clamp-2">
                      {question.question_text}
                    </p>
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {config.question_ids.length === 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">No questions selected</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                Select at least one question for this stage
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  points: number;
}
