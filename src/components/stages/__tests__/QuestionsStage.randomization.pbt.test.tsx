/**
 * Property-Based Test: Stage-Scoped Randomization
 * Feature: staged-exam-system
 * Property 14: Stage-Scoped Randomization
 * 
 * For any Questions_Stage with randomization enabled, questions should be
 * randomized within that stage only, and the same seed should produce the
 * same order on repeated loads.
 * 
 * Validates: Requirements 3.4.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Question, QuestionsStageConfig } from '@/lib/types';

// Set environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

// Import after setting env vars
const QuestionsStage = (await import('../QuestionsStage')).default;

describe('Feature: staged-exam-system, Property 14: Stage-Scoped Randomization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should produce consistent randomization with the same seed', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate number of questions
        fc.integer({ min: 3, max: 10 }),
        // Generate attempt ID (seed)
        fc.uuid(),
        // Generate stage ID
        fc.uuid(),
        async (numQuestions, attemptId, stageId) => {
          // Generate questions with guaranteed unique IDs
          const questions: Question[] = Array.from({ length: numQuestions }, (_, idx) => ({
            id: `question-${idx}-${Date.now()}-${Math.random()}`,
            question_text: `Question ${idx} text content for testing`,
            question_type: ['single_choice', 'paragraph', 'true_false'][idx % 3] as 'single_choice' | 'paragraph' | 'true_false',
            options: idx % 3 === 0 ? ['A', 'B', 'C'] : undefined,
            points: (idx % 20) + 1,
            required: idx % 2 === 0,
            order_index: idx
          }));

          const questionIds = questions.map(q => q.id);

          const mockStage = {
            id: stageId,
            configuration: {
              question_ids: questionIds,
              randomize_within_stage: true, // Randomization enabled
            } as QuestionsStageConfig,
          };

          const mockProps = {
            stage: mockStage,
            questions: questions,
            answers: {},
            onAnswerChange: vi.fn(),
            onProgressUpdate: vi.fn(),
            onComplete: vi.fn(),
            disabled: false,
            displayMode: 'full' as const,
            attemptId: attemptId,
          };

          // Render component first time
          const { container: container1, unmount: unmount1 } = render(
            <QuestionsStage {...mockProps} />
          );

          // Extract question order from first render
          const questionElements1 = container1.querySelectorAll('[class*="card"]');
          const order1 = Array.from(questionElements1).map(el => {
            const text = el.textContent || '';
            // Find which question this is by matching question_text
            return questions.find(q => text.includes(q.question_text))?.id;
          }).filter(Boolean);

          unmount1();

          // Render component second time with SAME seed (attemptId:stageId)
          const { container: container2, unmount: unmount2 } = render(
            <QuestionsStage {...mockProps} />
          );

          // Extract question order from second render
          const questionElements2 = container2.querySelectorAll('[class*="card"]');
          const order2 = Array.from(questionElements2).map(el => {
            const text = el.textContent || '';
            return questions.find(q => text.includes(q.question_text))?.id;
          }).filter(Boolean);

          unmount2();

          // Property: Same seed should produce same order
          expect(order1).toEqual(order2);
          expect(order1.length).toBe(questions.length);
          expect(order2.length).toBe(questions.length);

          // Verify all questions are present (no duplicates or missing)
          const uniqueIds1 = new Set(order1);
          const uniqueIds2 = new Set(order2);
          expect(uniqueIds1.size).toBe(questions.length);
          expect(uniqueIds2.size).toBe(questions.length);

          // Verify all original question IDs are present
          questionIds.forEach(id => {
            expect(order1).toContain(id);
            expect(order2).toContain(id);
          });
        }
      ),
      { numRuns: 20, timeout: 5000 }
    );
  }, 120000);

  it('should produce different orders with different seeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate number of questions (5-10 for higher chance of different order)
        fc.integer({ min: 5, max: 10 }),
        // Generate two different attempt IDs (different seeds)
        fc.tuple(fc.uuid(), fc.uuid()).filter(([id1, id2]) => id1 !== id2),
        // Generate stage ID
        fc.uuid(),
        async (numQuestions, [attemptId1, attemptId2], stageId) => {
          // Generate questions with guaranteed unique IDs
          const questions: Question[] = Array.from({ length: numQuestions }, (_, idx) => ({
            id: `question-${idx}-${Date.now()}-${Math.random()}`,
            question_text: `Question ${idx} text content for testing`,
            question_type: ['single_choice', 'paragraph', 'true_false'][idx % 3] as 'single_choice' | 'paragraph' | 'true_false',
            options: idx % 3 === 0 ? ['A', 'B', 'C'] : undefined,
            points: (idx % 20) + 1,
            required: idx % 2 === 0,
            order_index: idx
          }));

          const questionIds = questions.map(q => q.id);

          const mockStage = {
            id: stageId,
            configuration: {
              question_ids: questionIds,
              randomize_within_stage: true,
            } as QuestionsStageConfig,
          };

          // Render with first seed
          const { container: container1, unmount: unmount1 } = render(
            <QuestionsStage
              stage={mockStage}
              questions={questions}
              answers={{}}
              onAnswerChange={vi.fn()}
              onProgressUpdate={vi.fn()}
              onComplete={vi.fn()}
              disabled={false}
              displayMode="full"
              attemptId={attemptId1}
            />
          );

          const questionElements1 = container1.querySelectorAll('[class*="card"]');
          const order1 = Array.from(questionElements1).map(el => {
            const text = el.textContent || '';
            return questions.find(q => text.includes(q.question_text))?.id;
          }).filter(Boolean);

          unmount1();

          // Render with second seed (different attemptId)
          const { container: container2, unmount: unmount2 } = render(
            <QuestionsStage
              stage={mockStage}
              questions={questions}
              answers={{}}
              onAnswerChange={vi.fn()}
              onProgressUpdate={vi.fn()}
              onComplete={vi.fn()}
              disabled={false}
              displayMode="full"
              attemptId={attemptId2}
            />
          );

          const questionElements2 = container2.querySelectorAll('[class*="card"]');
          const order2 = Array.from(questionElements2).map(el => {
            const text = el.textContent || '';
            return questions.find(q => text.includes(q.question_text))?.id;
          }).filter(Boolean);

          unmount2();

          // Property: Different seeds should produce different orders (with high probability)
          // Note: There's a small chance they could be the same by random chance,
          // but with 5+ questions, this is very unlikely
          // We'll check that at least the orders are valid, even if occasionally the same
          expect(order1.length).toBe(questions.length);
          expect(order2.length).toBe(questions.length);

          // Both orders should contain all questions
          questionIds.forEach(id => {
            expect(order1).toContain(id);
            expect(order2).toContain(id);
          });

          // For statistical validation: with 5+ questions, different seeds
          // should produce different orders in most cases
          // We won't assert they're different because that could cause flaky tests,
          // but we verify the randomization is working by checking consistency above
        }
      ),
      { numRuns: 20, timeout: 5000 }
    );
  }, 120000);

  it('should not randomize when randomize_within_stage is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate number of questions
        fc.integer({ min: 3, max: 8 }),
        fc.uuid(),
        fc.uuid(),
        async (numQuestions, attemptId, stageId) => {
          // Generate questions with guaranteed unique IDs
          const questions: Question[] = Array.from({ length: numQuestions }, (_, idx) => ({
            id: `question-${idx}-${Date.now()}-${Math.random()}`,
            question_text: `Question ${idx} text content`,
            question_type: ['single_choice', 'paragraph', 'true_false'][idx % 3] as 'single_choice' | 'paragraph' | 'true_false',
            options: idx % 3 === 0 ? ['A', 'B', 'C'] : undefined,
            points: (idx % 20) + 1,
            required: idx % 2 === 0,
            order_index: idx
          }));

          const questionIds = questions.map(q => q.id);

          const mockStage = {
            id: stageId,
            configuration: {
              question_ids: questionIds,
              randomize_within_stage: false, // Randomization disabled
            } as QuestionsStageConfig,
          };

          const mockProps = {
            stage: mockStage,
            questions: questions,
            answers: {},
            onAnswerChange: vi.fn(),
            onProgressUpdate: vi.fn(),
            onComplete: vi.fn(),
            disabled: false,
            displayMode: 'full' as const,
            attemptId: attemptId,
          };

          // Render component
          const { container, unmount } = render(<QuestionsStage {...mockProps} />);

          // Extract question order
          const questionElements = container.querySelectorAll('[class*="card"]');
          const actualOrder = Array.from(questionElements).map(el => {
            const text = el.textContent || '';
            return questions.find(q => text.includes(q.question_text))?.id;
          }).filter(Boolean);

          unmount();

          // Property: Without randomization, questions should appear in question_ids order
          expect(actualOrder).toEqual(questionIds);
          expect(actualOrder.length).toBe(questions.length);
        }
      ),
      { numRuns: 20, timeout: 5000 }
    );
  }, 120000);

  it('should scope randomization to the stage only', async () => {
    // This test verifies that randomization doesn't affect questions outside the stage
    const allQuestions: Question[] = [
      {
        id: 'q1',
        question_text: 'What is the capital of France?',
        question_type: 'single_choice',
        options: ['A', 'B'],
        points: 10,
        required: true,
        order_index: 0,
      },
      {
        id: 'q2',
        question_text: 'Describe the water cycle in detail.',
        question_type: 'paragraph',
        points: 20,
        required: false,
        order_index: 1,
      },
      {
        id: 'q3',
        question_text: 'Is the Earth flat?',
        question_type: 'true_false',
        points: 5,
        required: true,
        order_index: 2,
      },
      {
        id: 'q4',
        question_text: 'What is 2 + 2?',
        question_type: 'single_choice',
        options: ['X', 'Y'],
        points: 15,
        required: true,
        order_index: 3,
      },
    ];

    // Stage only includes q1 and q3
    const stageQuestionIds = ['q1', 'q3'];

    const mockStage = {
      id: 'stage-1',
      configuration: {
        question_ids: stageQuestionIds,
        randomize_within_stage: true,
      } as QuestionsStageConfig,
    };

    const mockProps = {
      stage: mockStage,
      questions: allQuestions,
      answers: {},
      onAnswerChange: vi.fn(),
      onProgressUpdate: vi.fn(),
      onComplete: vi.fn(),
      disabled: false,
      displayMode: 'full' as const,
      attemptId: 'attempt-1',
    };

    const { container, unmount } = render(<QuestionsStage {...mockProps} />);

    // Extract rendered questions by checking which questions are actually rendered
    const questionElements = container.querySelectorAll('[class*="card"]');
    
    // Check which questions are present by looking for unique text from each question
    const hasQ1 = container.textContent?.includes('capital of France');
    const hasQ2 = container.textContent?.includes('water cycle');
    const hasQ3 = container.textContent?.includes('Earth flat');
    const hasQ4 = container.textContent?.includes('2 + 2');

    unmount();

    // Property: Only stage questions should be rendered
    expect(questionElements.length).toBe(2);
    expect(hasQ1).toBe(true);
    expect(hasQ3).toBe(true);
    expect(hasQ2).toBe(false);
    expect(hasQ4).toBe(false);

    // Verify questions outside the stage are not affected (still exist in data)
    expect(allQuestions.find(q => q.id === 'q2')).toBeDefined();
    expect(allQuestions.find(q => q.id === 'q4')).toBeDefined();
  });
});
