"use client";

import { Stage, VideoStageConfig, ContentStageConfig, QuestionsStageConfig } from "@/lib/types";
import DOMPurify from 'isomorphic-dompurify';

interface StagePreviewProps {
  stages: Stage[];
  onClose: () => void;
}

export default function StagePreview({ stages, onClose }: StagePreviewProps) {
  const getStageTypeLabel = (type: string): string => {
    switch (type) {
      case 'video':
        return 'Video';
      case 'content':
        return 'Content';
      case 'questions':
        return 'Questions';
      default:
        return type;
    }
  };

  const getStageTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'content':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'questions':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
    }
  };

  const renderVideoStagePreview = (config: VideoStageConfig, index: number) => {
    return (
      <div className="space-y-4">
        {config.description && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700">{config.description}</p>
          </div>
        )}
        
        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm opacity-75">Video Preview</p>
              <p className="text-xs opacity-50 mt-1">{config.video_url}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {config.enforcement_threshold !== undefined ? (
            <span>Students must watch at least {config.enforcement_threshold}% to continue</span>
          ) : (
            <span>No watch requirement</span>
          )}
        </div>
      </div>
    );
  };

  const renderContentStagePreview = (config: ContentStageConfig, index: number) => {
    return (
      <div className="space-y-4">
        {config.minimum_read_time !== undefined && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Minimum {config.minimum_read_time} seconds reading time</span>
          </div>
        )}

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {config.title && (
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                {config.title}
              </h3>
            </div>
          )}
          <div className="p-6 bg-white">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(config.content, {
                  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'img', 'a', 'span', 'div', 'blockquote', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
                  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'style']
                })
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderQuestionsStagePreview = (config: QuestionsStageConfig, index: number) => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm font-medium text-gray-900">
              {config.question_ids.length} {config.question_ids.length === 1 ? 'Question' : 'Questions'}
            </span>
          </div>
          {config.randomize_within_stage && (
            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
              Randomized
            </span>
          )}
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-600">
            Students will answer {config.question_ids.length} question{config.question_ids.length !== 1 ? 's' : ''} in this stage.
            {config.randomize_within_stage && ' Questions will be shown in random order.'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Stage Preview</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Preview how students will experience this staged exam
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {stages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-gray-600">No stages to preview</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Progress Indicator */}
              <div className="flex items-center justify-center gap-2">
                {stages.map((stage, index) => (
                  <div key={stage.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                        {getStageTypeIcon(stage.stage_type)}
                      </div>
                      <span className="text-xs text-gray-600 mt-1">
                        {getStageTypeLabel(stage.stage_type)}
                      </span>
                    </div>
                    {index < stages.length - 1 && (
                      <div className="w-8 h-0.5 bg-gray-300 mx-2 mb-6" />
                    )}
                  </div>
                ))}
              </div>

              {/* Stage Details */}
              {stages.map((stage, index) => (
                <div key={stage.id} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                        {getStageTypeIcon(stage.stage_type)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">
                          Stage {index + 1}: {getStageTypeLabel(stage.stage_type)}
                        </h3>
                        <p className="text-sm text-white text-opacity-90">
                          {stage.stage_type === 'video' && 'Watch instructional video'}
                          {stage.stage_type === 'content' && 'Review content slides'}
                          {stage.stage_type === 'questions' && 'Answer assessment questions'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-white">
                    {stage.stage_type === 'video' && renderVideoStagePreview(stage.configuration as VideoStageConfig, index)}
                    {stage.stage_type === 'content' && renderContentStagePreview(stage.configuration as ContentStageConfig, index)}
                    {stage.stage_type === 'questions' && renderQuestionsStagePreview(stage.configuration as QuestionsStageConfig, index)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
