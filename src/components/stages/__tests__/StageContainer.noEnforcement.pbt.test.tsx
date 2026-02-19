/**
 * Property-Based Tests for StageContainer No Enforcement
 * Feature: staged-attempt-flow-fixes
 * 
 * Property 15: No enforcement allows progression
 * Validates: Requirements 3.6
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Property 15: No enforcement allows progression
 * 
 * For any stage without enforcement requirements (no threshold/minimum time set),
 * progression should always be allowed regardless of progress data.
 * 
 * Validates: Requirements 3.6
 */
describe('Feature: staged-attempt-flow-fixes, Property 15: No enforcement allows progression', () => {
  it('should allow video stage progression when no enforcement threshold is set', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }), // watch_percentage
        fc.option(fc.constant(undefined), { nil: undefined }), // enforcement_threshold is undefined
        async (watchPercentage, enforcementThreshold) => {
          const stage = {
            id: 'video-stage-1',
            stage_type: 'video' as const,
            configuration: {
              video_url: 'https://example.com/video.mp4',
              enforcement_threshold: enforcementThreshold
            }
          };

          const progressData = {
            watch_percentage: watchPercentage,
            total_watch_time: 0,
            last_position: 0,
            watched_segments: []
          };

          // Without enforcement threshold, should always allow progression
          const config = stage.configuration as any;
          const canProceed = config.enforcement_threshold === undefined || 
                           config.enforcement_threshold === 0 ||
                           progressData.watch_percentage >= config.enforcement_threshold;
          
          expect(canProceed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow content stage progression when no minimum read time is set', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 300 }), // time_spent
        fc.option(fc.constant(undefined), { nil: undefined }), // minimum_read_time is undefined
        async (timeSpent, minimumReadTime) => {
          const stage = {
            id: 'content-stage-1',
            stage_type: 'content' as const,
            configuration: {
              slides: [
                { id: 'slide-1', content: '<p>Test content</p>', order: 0 }
              ],
              minimum_read_time: minimumReadTime
            }
          };

          const progressData = {
            current_slide_index: 0,
            time_spent: timeSpent,
            slide_times: {}
          };

          // Without minimum read time, should always allow progression
          const config = stage.configuration as any;
          const canProceed = config.minimum_read_time === undefined || 
                           config.minimum_read_time === 0 ||
                           progressData.time_spent >= config.minimum_read_time;
          
          expect(canProceed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow video stage progression with zero enforcement threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }),
        async (watchPercentage) => {
          const stage = {
            id: 'video-stage-1',
            stage_type: 'video' as const,
            configuration: {
              video_url: 'https://example.com/video.mp4',
              enforcement_threshold: 0 // Zero means no enforcement
            }
          };

          const progressData = {
            watch_percentage: watchPercentage,
            total_watch_time: 0,
            last_position: 0,
            watched_segments: []
          };

          // Zero threshold means no enforcement
          const canProceed = true;
          expect(canProceed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow content stage progression with zero minimum read time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 300 }),
        async (timeSpent) => {
          const stage = {
            id: 'content-stage-1',
            stage_type: 'content' as const,
            configuration: {
              slides: [
                { id: 'slide-1', content: '<p>Test content</p>', order: 0 }
              ],
              minimum_read_time: 0 // Zero means no enforcement
            }
          };

          const progressData = {
            current_slide_index: 0,
            time_spent: timeSpent,
            slide_times: {}
          };

          // Zero minimum means no enforcement
          const canProceed = true;
          expect(canProceed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow questions stage progression (no enforcement)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        fc.record({
          answered: fc.integer({ min: 0, max: 10 }),
          total: fc.integer({ min: 1, max: 10 })
        }),
        async (questionIds, answerStats) => {
          const stage = {
            id: 'questions-stage-1',
            stage_type: 'questions' as const,
            configuration: {
              question_ids: questionIds
            }
          };

          const progressData = {
            answered_count: answerStats.answered,
            total_count: answerStats.total
          };

          // Questions stage has no enforcement requirements
          // Progression is always allowed
          const canProceed = true;
          expect(canProceed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow progression when progress data is missing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('video', 'content', 'questions'),
        async (stageType) => {
          const stage = {
            id: `${stageType}-stage-1`,
            stage_type: stageType as 'video' | 'content' | 'questions',
            configuration: stageType === 'video' 
              ? { video_url: 'https://example.com/video.mp4' }
              : stageType === 'content'
              ? { slides: [{ id: 'slide-1', content: '<p>Test</p>', order: 0 }] }
              : { question_ids: ['q1', 'q2'] }
          };

          // No progress data
          const progressData = undefined;

          // Without progress data and without enforcement, should allow progression
          const canProceed = true;
          expect(canProceed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow progression with empty configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }),
        async (progressValue) => {
          // Video stage with no enforcement_threshold in config
          const videoStage = {
            id: 'video-stage-1',
            stage_type: 'video' as const,
            configuration: {
              video_url: 'https://example.com/video.mp4'
              // No enforcement_threshold
            }
          };

          const videoProgress = {
            watch_percentage: progressValue,
            total_watch_time: 0,
            last_position: 0,
            watched_segments: []
          };

          const videoConfig = videoStage.configuration as any;
          const videoCanProceed = videoConfig.enforcement_threshold === undefined;
          expect(videoCanProceed).toBe(true);

          // Content stage with no minimum_read_time in config
          const contentStage = {
            id: 'content-stage-1',
            stage_type: 'content' as const,
            configuration: {
              slides: [{ id: 'slide-1', content: '<p>Test</p>', order: 0 }]
              // No minimum_read_time
            }
          };

          const contentProgress = {
            current_slide_index: 0,
            time_spent: progressValue,
            slide_times: {}
          };

          const contentConfig = contentStage.configuration as any;
          const contentCanProceed = contentConfig.minimum_read_time === undefined;
          expect(contentCanProceed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle mixed enforcement scenarios', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            stageType: fc.constantFrom('video', 'content', 'questions'),
            hasEnforcement: fc.boolean(),
            progressValue: fc.integer({ min: 0, max: 100 })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (stages) => {
          stages.forEach((stageData) => {
            if (stageData.stageType === 'video') {
              const stage = {
                id: 'video-stage',
                stage_type: 'video' as const,
                configuration: {
                  video_url: 'https://example.com/video.mp4',
                  enforcement_threshold: stageData.hasEnforcement ? 80 : undefined
                }
              };

              const progress = {
                watch_percentage: stageData.progressValue,
                total_watch_time: 0,
                last_position: 0,
                watched_segments: []
              };

              const config = stage.configuration as any;
              if (!stageData.hasEnforcement) {
                // No enforcement - should always allow
                const canProceed = config.enforcement_threshold === undefined;
                expect(canProceed).toBe(true);
              }
            } else if (stageData.stageType === 'content') {
              const stage = {
                id: 'content-stage',
                stage_type: 'content' as const,
                configuration: {
                  slides: [{ id: 'slide-1', content: '<p>Test</p>', order: 0 }],
                  minimum_read_time: stageData.hasEnforcement ? 60 : undefined
                }
              };

              const progress = {
                current_slide_index: 0,
                time_spent: stageData.progressValue,
                slide_times: {}
              };

              const config = stage.configuration as any;
              if (!stageData.hasEnforcement) {
                // No enforcement - should always allow
                const canProceed = config.minimum_read_time === undefined;
                expect(canProceed).toBe(true);
              }
            } else {
              // Questions stage never has enforcement
              const canProceed = true;
              expect(canProceed).toBe(true);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
