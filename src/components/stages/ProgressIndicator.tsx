'use client';

import React from 'react';
import type { Stage, StageProgress } from '@/lib/types';

interface ProgressIndicatorProps {
  stages: Stage[];
  currentStageIndex: number;
  stageProgress: StageProgress[];
}

const getStageTypeLabel = (stageType: string): string => {
  switch (stageType) {
    case 'video':
      return 'Video';
    case 'content':
      return 'Content';
    case 'questions':
      return 'Questions';
    default:
      return 'Stage';
  }
};

const getStageIcon = (stageType: string, isCompleted: boolean, isCurrent: boolean) => {
  if (isCompleted) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (isCurrent) {
    return (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }

  switch (stageType) {
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth={2} />
        </svg>
      );
  }
};

export default function ProgressIndicator({
  stages,
  currentStageIndex,
  stageProgress
}: ProgressIndicatorProps) {
  // Create a map for quick progress lookup
  const progressMap = new Map<string, StageProgress>();
  stageProgress.forEach(progress => {
    progressMap.set(progress.stage_id, progress);
  });

  return (
    <div className="stage-progress-indicator" role="navigation" aria-label="Stage progress">
      <div className="stage-progress-container">
        {stages.map((stage, index) => {
          const progress = progressMap.get(stage.id);
          const isCompleted = !!progress?.completed_at;
          const isCurrent = index === currentStageIndex;
          const isPending = index > currentStageIndex;

          return (
            <React.Fragment key={stage.id}>
              <div
                className={`stage-indicator ${
                  isCompleted ? 'stage-completed' : 
                  isCurrent ? 'stage-current' : 
                  'stage-pending'
                }`}
                role="listitem"
                aria-label={`${getStageTypeLabel(stage.stage_type)} stage ${index + 1} of ${stages.length}${
                  isCompleted ? ' - completed' : 
                  isCurrent ? ' - current' : 
                  ' - pending'
                }`}
              >
                <div className="stage-icon-wrapper">
                  <div className="stage-icon">
                    {getStageIcon(stage.stage_type, isCompleted, isCurrent)}
                  </div>
                </div>
                <div className="stage-label">
                  <div className="stage-type">{getStageTypeLabel(stage.stage_type)}</div>
                  <div className="stage-number">Stage {index + 1}</div>
                </div>
              </div>

              {/* Connector line between stages */}
              {index < stages.length - 1 && (
                <div
                  className={`stage-connector ${
                    index < currentStageIndex ? 'connector-completed' : 'connector-pending'
                  }`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <style jsx>{`
        .stage-progress-indicator {
          width: 100%;
          padding: 1.5rem 1rem;
          background: var(--bg-secondary, #f8f9fa);
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .stage-progress-container {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .stage-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          min-width: 80px;
          padding: 0.5rem;
          transition: all 0.3s ease;
        }

        .stage-icon-wrapper {
          position: relative;
        }

        .stage-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: bold;
          transition: all 0.3s ease;
          border: 3px solid;
        }

        .stage-completed .stage-icon {
          background: var(--success-color, #28a745);
          border-color: var(--success-color, #28a745);
          color: white;
        }

        .stage-current .stage-icon {
          background: var(--primary-color, #007bff);
          border-color: var(--primary-color, #007bff);
          color: white;
          animation: pulse 2s infinite;
        }

        .stage-pending .stage-icon {
          background: white;
          border-color: var(--border-color, #dee2e6);
          color: var(--text-muted, #6c757d);
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 0 10px rgba(0, 123, 255, 0);
          }
        }

        .stage-label {
          text-align: center;
          font-size: 0.75rem;
        }

        .stage-type {
          font-weight: 600;
          color: var(--text-primary, #212529);
          margin-bottom: 0.125rem;
        }

        .stage-number {
          color: var(--text-muted, #6c757d);
          font-size: 0.7rem;
        }

        .stage-completed .stage-type,
        .stage-completed .stage-number {
          color: var(--success-color, #28a745);
        }

        .stage-current .stage-type {
          color: var(--primary-color, #007bff);
          font-weight: 700;
        }

        .stage-connector {
          flex: 0 0 40px;
          height: 3px;
          position: relative;
          margin: 0 -0.5rem;
          margin-bottom: 2rem;
        }

        .connector-completed {
          background: var(--success-color, #28a745);
        }

        .connector-pending {
          background: var(--border-color, #dee2e6);
        }

        /* RTL Support */
        [dir="rtl"] .stage-progress-container {
          direction: rtl;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .stage-progress-indicator {
            padding: 1rem 0.5rem;
          }

          .stage-progress-container {
            overflow-x: auto;
            justify-content: flex-start;
            padding: 0.5rem;
            -webkit-overflow-scrolling: touch;
          }

          .stage-indicator {
            min-width: 70px;
          }

          .stage-icon {
            width: 40px;
            height: 40px;
            font-size: 1rem;
          }

          .stage-connector {
            flex: 0 0 30px;
          }

          .stage-label {
            font-size: 0.7rem;
          }

          .stage-number {
            font-size: 0.65rem;
          }
        }

        @media (max-width: 480px) {
          .stage-indicator {
            min-width: 60px;
          }

          .stage-icon {
            width: 36px;
            height: 36px;
            font-size: 0.9rem;
          }

          .stage-connector {
            flex: 0 0 20px;
          }
        }
      `}</style>
    </div>
  );
}
