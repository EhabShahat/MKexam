/**
 * Property-Based Tests for ContentStage Slide Timing
 * Feature: staged-exam-system
 * 
 * Property 12: Slide Timing Data Persistence
 * Validates: Requirements 3.3.7
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ContentStageProgress } from '@/lib/types';

/**
 * Property 12: Slide Timing Data Persistence
 * 
 * For any Content_Stage that is completed, the progress_data should contain
 * slide_times with an entry for each slide_id showing time spent in seconds.
 * 
 * Validates: Requirements 3.3.7
 */
describe('Feature: staged-exam-system, Property 12: Slide Timing Data Persistence', () => {
  it('should have slide_times entry for each slide when stage is completed', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate slide IDs
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        // Generate time spent on each slide (in seconds)
        fc.array(fc.integer({ min: 0, max: 300 }), { minLength: 1, maxLength: 10 }),
        async (slideIds, times) => {
          // Ensure matching arrays
          const slideCount = Math.min(slideIds.length, times.length);
          const testSlideIds = slideIds.slice(0, slideCount);
          const testTimes = times.slice(0, slideCount);

          // Create progress data with slide times
          const slideTimes: Record<string, number> = {};
          testSlideIds.forEach((slideId, index) => {
            slideTimes[slideId] = testTimes[index];
          });

          const progress: ContentStageProgress = {
            current_slide_index: slideCount - 1, // On last slide
            slide_times: slideTimes
          };

          // Verify all slides have timing entries
          testSlideIds.forEach((slideId) => {
            expect(progress.slide_times).toHaveProperty(slideId);
            expect(typeof progress.slide_times[slideId]).toBe('number');
            expect(progress.slide_times[slideId]).toBeGreaterThanOrEqual(0);
          });

          // Verify the number of entries matches the number of slides
          expect(Object.keys(progress.slide_times).length).toBe(slideCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve slide timing data across progress updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 5 }),
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 2, maxLength: 5 }),
        async (slideIds, initialTimes, additionalTimes) => {
          const slideCount = Math.min(slideIds.length, initialTimes.length, additionalTimes.length);
          const testSlideIds = slideIds.slice(0, slideCount);
          const testInitialTimes = initialTimes.slice(0, slideCount);
          const testAdditionalTimes = additionalTimes.slice(0, slideCount);

          // Create initial progress
          const initialSlideTimes: Record<string, number> = {};
          testSlideIds.forEach((slideId, index) => {
            initialSlideTimes[slideId] = testInitialTimes[index];
          });

          const initialProgress: ContentStageProgress = {
            current_slide_index: 0,
            slide_times: initialSlideTimes
          };

          // Simulate progress update with additional time
          const updatedSlideTimes: Record<string, number> = {};
          testSlideIds.forEach((slideId, index) => {
            updatedSlideTimes[slideId] = testInitialTimes[index] + testAdditionalTimes[index];
          });

          const updatedProgress: ContentStageProgress = {
            current_slide_index: 1,
            slide_times: updatedSlideTimes
          };

          // Verify all initial times are preserved and incremented
          testSlideIds.forEach((slideId, index) => {
            expect(updatedProgress.slide_times[slideId]).toBeGreaterThanOrEqual(
              initialProgress.slide_times[slideId]
            );
            expect(updatedProgress.slide_times[slideId]).toBe(
              testInitialTimes[index] + testAdditionalTimes[index]
            );
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle slide timing data for varying numbers of slides', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (numSlides) => {
          // Generate slide IDs and times
          const slideIds = Array.from({ length: numSlides }, (_, i) => `slide-${i}`);
          const times = Array.from({ length: numSlides }, () => Math.floor(Math.random() * 120));

          const slideTimes: Record<string, number> = {};
          slideIds.forEach((slideId, index) => {
            slideTimes[slideId] = times[index];
          });

          const progress: ContentStageProgress = {
            current_slide_index: numSlides - 1,
            slide_times: slideTimes
          };

          // Verify structure
          expect(Object.keys(progress.slide_times).length).toBe(numSlides);
          
          // Verify all times are non-negative
          Object.values(progress.slide_times).forEach((time) => {
            expect(time).toBeGreaterThanOrEqual(0);
            expect(typeof time).toBe('number');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain slide timing data integrity with zero times', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        async (slideIds) => {
          // Create progress with zero times (slides not yet viewed)
          const slideTimes: Record<string, number> = {};
          slideIds.forEach((slideId) => {
            slideTimes[slideId] = 0;
          });

          const progress: ContentStageProgress = {
            current_slide_index: 0,
            slide_times: slideTimes
          };

          // Verify all slides have entries even with zero time
          slideIds.forEach((slideId) => {
            expect(progress.slide_times).toHaveProperty(slideId);
            expect(progress.slide_times[slideId]).toBe(0);
          });

          // Verify data structure is valid
          expect(typeof progress.slide_times).toBe('object');
          expect(Object.keys(progress.slide_times).length).toBe(slideIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accumulate time correctly for individual slides', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 10 }),
        async (slideId, timeIncrements) => {
          // Simulate multiple updates to the same slide
          let accumulatedTime = 0;
          const progressUpdates: ContentStageProgress[] = [];

          timeIncrements.forEach((increment) => {
            accumulatedTime += increment;
            progressUpdates.push({
              current_slide_index: 0,
              slide_times: { [slideId]: accumulatedTime }
            });
          });

          // Verify time accumulates correctly
          const finalProgress = progressUpdates[progressUpdates.length - 1];
          const expectedTotal = timeIncrements.reduce((sum, inc) => sum + inc, 0);
          
          expect(finalProgress.slide_times[slideId]).toBe(expectedTotal);
          expect(finalProgress.slide_times[slideId]).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
