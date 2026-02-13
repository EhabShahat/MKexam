'use client';

import React, { useEffect, useRef, useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import type { ContentStageConfig, ContentStageProgress } from '@/lib/types';
import { useStudentLocale } from '@/components/public/PublicLocaleProvider';
import { t } from '@/i18n/student';

interface ContentStageProps {
  stage: { id: string; configuration: ContentStageConfig };
  progress: ContentStageProgress;
  onProgressUpdate: (progress: ContentStageProgress) => void;
  onComplete: () => void;
  disabled: boolean;
  logActivity?: (activity: string, details?: any) => void;
}

const ContentStage: React.FC<ContentStageProps> = ({
  stage,
  progress,
  onProgressUpdate,
  onComplete,
  disabled,
  logActivity
}) => {
  const { locale } = useStudentLocale();
  const [timeSpent, setTimeSpent] = useState(progress.time_spent || 0);
  const [canProgress, setCanProgress] = useState(progress.completed_reading || false);
  const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const minimumReadTime = stage.configuration.minimum_read_time;
  const hasMinimumTime = minimumReadTime !== undefined && minimumReadTime > 0;

  // Sanitize HTML content
  const sanitizedContent = DOMPurify.sanitize(stage.configuration.content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'img', 'a', 'span', 'div', 'blockquote', 'code', 'pre',
      'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'style']
  });

  // Track time spent reading
  useEffect(() => {
    timeIntervalRef.current = setInterval(() => {
      setTimeSpent((prev) => {
        const newTime = prev + 1;
        
        // Update progress
        const updatedProgress: ContentStageProgress = {
          time_spent: newTime,
          completed_reading: hasMinimumTime ? newTime >= minimumReadTime : true
        };
        onProgressUpdate(updatedProgress);

        return newTime;
      });
    }, 1000);

    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
    };
  }, [hasMinimumTime, minimumReadTime, onProgressUpdate]);

  // Check if can progress
  useEffect(() => {
    if (hasMinimumTime) {
      setCanProgress(timeSpent >= minimumReadTime);
    } else {
      setCanProgress(true);
    }
    
    // Auto-complete when requirements are met
    if (hasMinimumTime && timeSpent >= minimumReadTime && !progress.completed_reading) {
      onComplete();
    } else if (!hasMinimumTime) {
      onComplete();
    }
  }, [timeSpent, minimumReadTime, hasMinimumTime, onComplete, progress.completed_reading]);

  // Log content view on mount
  useEffect(() => {
    if (logActivity) {
      logActivity('content_viewed', {
        stage_id: stage.id,
        timestamp: Date.now()
      });
    }
  }, [logActivity, stage.id]);

  const remainingTime = hasMinimumTime ? Math.max(0, minimumReadTime - timeSpent) : 0;
  const progressPercentage = hasMinimumTime ? Math.min(100, (timeSpent / minimumReadTime) * 100) : 100;

  return (
    <div className="content-stage" role="region" aria-label="Content stage">
      {/* Title */}
      {stage.configuration.title && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {stage.configuration.title}
          </h2>
        </div>
      )}

      {/* Content container */}
      <div 
        ref={contentRef}
        className="content-container mb-6 p-8 bg-white border border-gray-200 rounded-lg shadow-sm"
        role="article"
        aria-label="Content"
      >
        <div 
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      </div>

      {/* Reading progress indicator */}
      {hasMinimumTime && (
        <div 
          className="reading-progress mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-blue-900">
                {canProgress ? t(locale, 'reading_complete') : t(locale, 'continue_reading')}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {canProgress 
                  ? `${timeSpent}s` 
                  : `${t(locale, 'seconds_remaining', { seconds: remainingTime })}`
                }
              </p>
            </div>
            <div className="text-right">
              {canProgress ? (
                <span 
                  className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-500 text-white shadow-sm"
                  role="status"
                  aria-label={t(locale, 'ready')}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t(locale, 'ready')}
                </span>
              ) : (
                <span 
                  className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 border border-yellow-300"
                  role="timer"
                  aria-label={`${remainingTime} ${t(locale, 'seconds_remaining', { seconds: remainingTime })}`}
                >
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {remainingTime}s
                </span>
              )}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercentage}%` }}
              role="progressbar"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Reading progress: ${Math.round(progressPercentage)}%`}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        .content-stage {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
        }

        .content-container {
          min-height: 300px;
          line-height: 1.8;
        }

        /* Enhanced prose styles */
        .content-container :global(.prose) {
          color: #374151;
        }

        .content-container :global(.prose h1) {
          font-size: 2rem;
          font-weight: 700;
          margin-top: 0;
          margin-bottom: 1.5rem;
          color: #111827;
        }

        .content-container :global(.prose h2) {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: #1f2937;
        }

        .content-container :global(.prose h3) {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #374151;
        }

        .content-container :global(.prose p) {
          margin-bottom: 1.25rem;
        }

        .content-container :global(.prose img) {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1.5rem 0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .content-container :global(.prose ul),
        .content-container :global(.prose ol) {
          margin: 1rem 0;
          padding-left: 1.5rem;
        }

        .content-container :global(.prose li) {
          margin: 0.5rem 0;
        }

        .content-container :global(.prose a) {
          color: #3b82f6;
          text-decoration: underline;
        }

        .content-container :global(.prose a:hover) {
          color: #2563eb;
        }

        .content-container :global(.prose blockquote) {
          border-left: 4px solid #3b82f6;
          padding-left: 1rem;
          margin: 1.5rem 0;
          font-style: italic;
          color: #6b7280;
        }

        .content-container :global(.prose code) {
          background: #f3f4f6;
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
          font-size: 0.9em;
          color: #dc2626;
        }

        .content-container :global(.prose pre) {
          background: #1f2937;
          color: #f9fafb;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1.5rem 0;
        }

        .content-container :global(.prose pre code) {
          background: transparent;
          color: inherit;
          padding: 0;
        }

        .content-container :global(.prose table) {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
        }

        .content-container :global(.prose th),
        .content-container :global(.prose td) {
          border: 1px solid #e5e7eb;
          padding: 0.75rem;
          text-align: left;
        }

        .content-container :global(.prose th) {
          background: #f9fafb;
          font-weight: 600;
        }

        /* RTL Support */
        [dir="rtl"] .content-stage {
          direction: rtl;
        }

        [dir="rtl"] .content-container :global(.prose) {
          text-align: right;
        }

        [dir="rtl"] .content-container :global(.prose ul),
        [dir="rtl"] .content-container :global(.prose ol) {
          padding-right: 1.5rem;
          padding-left: 0;
        }

        [dir="rtl"] .content-container :global(.prose blockquote) {
          border-left: none;
          border-right: 4px solid #3b82f6;
          padding-left: 0;
          padding-right: 1rem;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .content-container {
            padding: 1.5rem !important;
            min-height: 200px !important;
          }

          .content-container :global(.prose) {
            font-size: 0.95rem;
          }

          .content-container :global(.prose h1) {
            font-size: 1.5rem;
          }

          .content-container :global(.prose h2) {
            font-size: 1.25rem;
          }

          .reading-progress {
            padding: 0.75rem !important;
          }

          .reading-progress .flex {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 0.75rem;
          }

          .reading-progress .text-right {
            text-align: left;
            width: 100%;
          }

          [dir="rtl"] .reading-progress .text-right {
            text-align: right;
          }
        }

        @media (max-width: 480px) {
          .content-stage {
            padding: 0;
          }

          .content-container {
            padding: 1rem !important;
            border-radius: 0.375rem;
          }

          .content-container :global(.prose) {
            font-size: 0.9rem;
          }

          .reading-progress {
            padding: 0.5rem !important;
            font-size: 0.875rem;
          }

          .btn {
            width: 100%;
            justify-content: center;
          }
        }

        /* Animation for spinner */
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default ContentStage;
