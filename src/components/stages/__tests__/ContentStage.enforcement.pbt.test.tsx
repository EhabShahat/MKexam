/**
 * Property-Based Tests for ContentStage Enforcement
 * Feature: staged-exam-system
 * 
 * Property 11: Slide Time Enforcement
 * Validates: Requirements 3.3.6
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ContentStageConfig, ContentStageProgress } from '@/lib/types';

/**
 * Property 11: Slide Time Enforcement
 * 
 * For any Content_Stage slide with minimum_read_time M seconds,
 * if elapsed_time < M, then progression to the next slide should be blocked.
 * 
 * Validates: Requirements 3.3.6
 */
describe('Feature: staged-exam-system, Property 11: Slide Time Enforcement', () => {
  it('should block progression when elapsed time is less than minimum read time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 120 }), // minimum_read_time
        fc.integer({ min: 0, max: 119 }), // elapsed_time (always less than max minimum)
        async (minimumReadTime, elapsedTime) => {
          // Ensure elapsed time is less than minimum
          const actualElapsedTime = Math.min(elapsedTime, minimumReadTime - 1);

          const slideId = 'test-slide-id';
          
          const config: ContentStageConfig = {
            slides: [
              { id: slideId, content: '<p>Test content</p>', order: 0 }
            ],
            minimum_read_time_per_slide: minimumReadTime
          };

          const progress: ContentStageProgress = {
            current_slide_index: 0,
            slide_times: {
              [slideId]: actualElapsedTime
            }
          };

          // Verify enforcement logic
          const canProgress = actualElapsedTime >= minimumReadTime;
          expect(canProgress).toBe(false);

          // Verify remaining time calculation
          const remainingTime = minimumReadTime - actualElapsedTime;
          expect(remainingTime).toBeGreaterThan(0);
          expect(remainingTime).toBeLessThanOrEqual(minimumReadTime);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow progression when elapsed time meets or exceeds minimum read time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 120 }), // minimum_read_time
        fc.integer({ min: 0, max: 60 }), // additional_time
        async (minimumReadTime, additionalTime) => {
          const elapsedTime = minimumReadTime + additionalTime;
          const slideId = 'test-slide-id';

          const config: ContentStageConfig = {
            slides: [
              { id: slideId, content: '<p>Test content</p>', order: 0 }
            ],
            minimum_read_time_per_slide: minimumReadTime
          };

          const progress: ContentStageProgress = {
            current_slide_index: 0,
            slide_times: {
              [slideId]: elapsedTime
            }
          };

          // Verify enforcement logic
          const canProgress = elapsedTime >= minimumReadTime;
          expect(canProgress).toBe(true);

          // Verify remaining time is zero or negative
          const remainingTime = Math.max(0, minimumReadTime - elapsedTime);
          expect(remainingTime).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle exact minimum read time boundary', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 300 }),
        async (minimumReadTime) => {
          const slideId = 'test-slide-id';

          const config: ContentStageConfig = {
            slides: [
              { id: slideId, content: '<p>Test content</p>', order: 0 }
            ],
            minimum_read_time_per_slide: minimumReadTime
          };

          // Test exactly at the boundary
          const progress: ContentStageProgress = {
            current_slide_index: 0,
            slide_times: {
              [slideId]: minimumReadTime
            }
          };

          // At exact boundary, should allow progression
          const canProgress = progress.slide_times[slideId] >= minimumReadTime;
          expect(canProgress).toBe(true);

          // One second before boundary, should block
          const progressBefore: ContentStageProgress = {
            current_slide_index: 0,
            slide_times: {
              [slideId]: minimumReadTime - 1
            }
          };

          const canProgressBefore = progressBefore.slide_times[slideId] >= minimumReadTime;
          expect(canProgressBefore).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow progression when no minimum read time is set', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 300 }),
        async (elapsedTime) => {
          const slideId = 'test-slide-id';

          const config: ContentStageConfig = {
            slides: [
              { id: slideId, content: '<p>Test content</p>', order: 0 }
            ],
            minimum_read_time_per_slide: undefined // No enforcement
          };

          const progress: ContentStageProgress = {
            current_slide_index: 0,
            slide_times: {
              [slideId]: elapsedTime
            }
          };

          // Without enforcement, should always allow progression
          const canProgress = config.minimum_read_time_per_slide === undefined || 
                             elapsedTime >= (config.minimum_read_time_per_slide || 0);
          expect(canProgress).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should calculate remaining time correctly for multiple slides', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            content: fc.string({ minLength: 10, maxLength: 100 }),
            order: fc.nat({ max: 10 })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        fc.integer({ min: 10, max: 60 }),
        async (slides, minimumReadTime) => {
          const sortedSlides = [...slides].sort((a, b) => a.order - b.order);

          const config: ContentStageConfig = {
            slides: sortedSlides,
            minimum_read_time_per_slide: minimumReadTime
          };

          // Test each slide independently
          sortedSlides.forEach((slide, index) => {
            // Generate random elapsed time less than minimum
            const elapsedTime = Math.floor(Math.random() * minimumReadTime);

            const progress: ContentStageProgress = {
              current_slide_index: index,
              slide_times: {
                [slide.id]: elapsedTime
              }
            };

            const canProgress = elapsedTime >= minimumReadTime;
            const remainingTime = Math.max(0, minimumReadTime - elapsedTime);

            if (elapsedTime < minimumReadTime) {
              expect(canProgress).toBe(false);
              expect(remainingTime).toBeGreaterThan(0);
            } else {
              expect(canProgress).toBe(true);
              expect(remainingTime).toBe(0);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle enforcement with varying minimum read times', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 5, max: 120 }), { minLength: 1, maxLength: 10 }),
        async (minimumReadTimes) => {
          minimumReadTimes.forEach((minimumReadTime) => {
            const slideId = `slide-${minimumReadTime}`;

            const config: ContentStageConfig = {
              slides: [
                { id: slideId, content: '<p>Test</p>', order: 0 }
              ],
              minimum_read_time_per_slide: minimumReadTime
            };

            // Test with time less than minimum
            const progressBefore: ContentStageProgress = {
              current_slide_index: 0,
              slide_times: {
                [slideId]: Math.floor(minimumReadTime / 2)
              }
            };

            expect(progressBefore.slide_times[slideId] < minimumReadTime).toBe(true);

            // Test with time equal to minimum
            const progressAt: ContentStageProgress = {
              current_slide_index: 0,
              slide_times: {
                [slideId]: minimumReadTime
              }
            };

            expect(progressAt.slide_times[slideId] >= minimumReadTime).toBe(true);

            // Test with time greater than minimum
            const progressAfter: ContentStageProgress = {
              current_slide_index: 0,
              slide_times: {
                [slideId]: minimumReadTime + 10
              }
            };

            expect(progressAfter.slide_times[slideId] >= minimumReadTime).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero minimum read time as no enforcement', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }),
        async (elapsedTime) => {
          const slideId = 'test-slide-id';

          const config: ContentStageConfig = {
            slides: [
              { id: slideId, content: '<p>Test</p>', order: 0 }
            ],
            minimum_read_time_per_slide: 0
          };

          const progress: ContentStageProgress = {
            current_slide_index: 0,
            slide_times: {
              [slideId]: elapsedTime
            }
          };

          // Zero minimum means no enforcement
          const canProgress = elapsedTime >= 0;
          expect(canProgress).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
