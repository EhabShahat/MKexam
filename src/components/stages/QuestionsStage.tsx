"use client";

import React, { useMemo, useEffect } from "react";
import ExamQuestion, { type AnswerValue } from "@/components/ExamQuestion";
import type { Question, QuestionsStageConfig, QuestionsStageProgress } from "@/lib/types";
import { shuffle } from "@/lib/randomization";

interface QuestionsStageProps {
  stage: {
    id: string;
    configuration: QuestionsStageConfig;
  };
  questions: Question[];
  answers: Record<string, AnswerValue>;
  onAnswerChange: (questionId: string, value: AnswerValue) => void;
  onProgressUpdate: (progress: QuestionsStageProgress) => void;
  onComplete: () => void;
  disabled: boolean;
  displayMode: 'full' | 'per_question';
  attemptId: string;
}

export default function QuestionsStage({
  stage,
  questions,
  answers,
  onAnswerChange,
  onProgressUpdate,
  onComplete,
  disabled,
  displayMode,
  attemptId,
}: QuestionsStageProps) {
  const config = stage.configuration;

  // Filter questions by question_ids from stage configuration
  const stageQuestions = useMemo(() => {
    const filteredQuestions = questions.filter(q => 
      config.question_ids.includes(q.id)
    );

    // Apply randomization if enabled (within stage only)
    if (config.randomize_within_stage) {
      // Use seed: attemptId:stageId for deterministic randomization
      const seed = `${attemptId}:${stage.id}`;
      return shuffle(filteredQuestions, seed);
    }

    // Otherwise, maintain the order specified in question_ids
    return filteredQuestions.sort((a, b) => 
      config.question_ids.indexOf(a.id) - config.question_ids.indexOf(b.id)
    );
  }, [questions, config.question_ids, config.randomize_within_stage, attemptId, stage.id]);

  // Track answered count for progress indicator
  const answeredCount = useMemo(() => {
    return stageQuestions.filter(q => {
      const answer = answers[q.id];
      
      // Check if question is answered based on type
      if (q.question_type === "paragraph") {
        return typeof answer === "string" && answer.trim().length > 0;
      } else if (q.question_type === "true_false") {
        return typeof answer === "boolean";
      } else if (Array.isArray(answer)) {
        return answer.length > 0;
      } else if (typeof answer === "string") {
        return answer.length > 0;
      }
      
      return false;
    }).length;
  }, [stageQuestions, answers]);

  // Update progress when answered count changes
  useEffect(() => {
    const progress: QuestionsStageProgress = {
      answered_count: answeredCount,
      total_count: stageQuestions.length,
    };
    
    onProgressUpdate(progress);
  }, [answeredCount, stageQuestions.length, onProgressUpdate]);

  // Mark stage complete when all required questions answered (or allow partial)
  // For now, we'll allow partial completion - the stage can be completed even if not all questions are answered
  // This matches the existing exam behavior where students can submit with unanswered questions
  useEffect(() => {
    // Stage is considered "completable" if at least one question is answered
    // or if there are no questions (edge case)
    if (stageQuestions.length === 0 || answeredCount > 0) {
      // Don't auto-complete, let the user click "Continue" button
      // The parent StageContainer will handle the completion logic
    }
  }, [answeredCount, stageQuestions.length]);

  if (stageQuestions.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--muted-foreground)]">
        No questions available for this stage.
      </div>
    );
  }

  return (
    <div className="space-y-8" role="region" aria-label="Questions stage">
      {/* Progress indicator */}
      <div 
        className="bg-[var(--muted)] p-4 rounded-lg"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex items-center justify-between text-sm flex-wrap gap-2">
          <span className="font-medium text-[var(--foreground)]">
            Questions Progress
          </span>
          <span className="text-[var(--muted-foreground)]">
            {answeredCount} of {stageQuestions.length} answered
          </span>
        </div>
        <div 
          className="mt-2 h-2 bg-[var(--background)] rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={stageQuestions.length}
          aria-label={`${answeredCount} of ${stageQuestions.length} questions answered`}
        >
          <div 
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(answeredCount / stageQuestions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Render questions */}
      {displayMode === 'full' ? (
        // Full display mode: show all questions at once
        <div className="space-y-8" role="list" aria-label="Exam questions">
          {stageQuestions.map((question, index) => (
            <div 
              key={question.id} 
              className="card p-6 mobile-card"
              role="listitem"
              aria-label={`Question ${index + 1} of ${stageQuestions.length}`}
            >
              <div className="mb-2 text-sm font-medium text-[var(--muted-foreground)]">
                Question {index + 1} of {stageQuestions.length}
              </div>
              <ExamQuestion
                q={question}
                value={answers[question.id] ?? null}
                onChange={(value) => onAnswerChange(question.id, value)}
                disabled={disabled}
                attemptId={attemptId}
              />
            </div>
          ))}
        </div>
      ) : (
        // Per-question display mode: show one question at a time
        // This would require additional state management for current question index
        // For now, we'll implement full mode only as per the existing exam behavior
        <div className="space-y-8" role="list" aria-label="Exam questions">
          {stageQuestions.map((question, index) => (
            <div 
              key={question.id} 
              className="card p-6 mobile-card"
              role="listitem"
              aria-label={`Question ${index + 1} of ${stageQuestions.length}`}
            >
              <div className="mb-2 text-sm font-medium text-[var(--muted-foreground)]">
                Question {index + 1} of {stageQuestions.length}
              </div>
              <ExamQuestion
                q={question}
                value={answers[question.id] ?? null}
                onChange={(value) => onAnswerChange(question.id, value)}
                disabled={disabled}
                attemptId={attemptId}
              />
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
          .mobile-card {
            padding: 1rem !important;
          }

          .bg-\\[var\\(--muted\\)\\] {
            padding: 0.75rem !important;
          }
        }

        @media (max-width: 480px) {
          .mobile-card {
            padding: 0.75rem !important;
          }

          .bg-\\[var\\(--muted\\)\\] {
            padding: 0.5rem !important;
          }
        }

        /* RTL Support */
        [dir="rtl"] .space-y-8 {
          direction: rtl;
        }
      `}</style>
    </div>
  );
}
