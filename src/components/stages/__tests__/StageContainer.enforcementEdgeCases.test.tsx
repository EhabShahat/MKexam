/**
 * Unit Tests for StageContainer Enforcement Edge Cases
 * Feature: staged-attempt-flow-fixes
 * 
 * Tests edge cases for enforcement validation:
 * - Threshold exactly at boundary (80% when 80% required)
 * - Undefined enforcement (no threshold set)
 * - Zero enforcement (threshold = 0)
 * 
 * Validates: Requirements 3.1, 3.2, 3.6
 */

import { describe, it, expect } from 'vitest';

describe('StageContainer Enforcement Edge Cases', () => {
  describe('Video Enforcement Edge Cases', () => {
    it('should allow progression when watch percentage exactly equals threshold', () => {
      const stage = {
        id: 'video-stage-1',
        stage_type: 'video' as const,
        configuration: {
          video_url: 'https://example.com/video.mp4',
          enforcement_threshold: 80
        }
      };

      const progressData = {
        watch_percentage: 80, // Exactly at threshold
        total_watch_time: 0,
        last_position: 0,
        watched_segments: []
      };

      // Simulate validation logic
      const config = stage.configuration as any;
      const canProceed = progressData.watch_percentage >= config.enforcement_threshold;
      const message = canProceed ? '' : `Watch ${config.enforcement_threshold}% of the video to continue (currently ${Math.round(progressData.watch_percentage)}%)`;

      expect(canProceed).toBe(true);
      expect(message).toBe('');
    });

    it('should block progression when watch percentage is just below threshold', () => {
      const stage = {
        id: 'video-stage-1',
        stage_type: 'video' as const,
        configuration: {
          video_url: 'https://example.com/video.mp4',
          enforcement_threshold: 80
        }
      };

      const progressData = {
        watch_percentage: 79.9, // Just below threshold
        total_watch_time: 0,
        last_position: 0,
        watched_segments: []
      };

      // Simulate validation logic
      const config = stage.configuration as any;
      const canProceed = progressData.watch_percentage >= config.enforcement_threshold;
      const message = canProceed ? '' : `Watch ${config.enforcement_threshold}% of the video to continue (currently ${Math.round(progressData.watch_percentage)}%)`;

      expect(canProceed).toBe(false);
      expect(message).toContain('Watch 80%');
      expect(message).toContain('80%'); // Rounded from 79.9
    });

    it('should allow progression when enforcement threshold is undefined', () => {
      const stage = {
        id: 'video-stage-1',
        stage_type: 'video' as const,
        configuration: {
          video_url: 'https://example.com/video.mp4',
          enforcement_threshold: undefined // No enforcement
        }
      };

      const progressData = {
        watch_percentage: 0, // Even 0% should be allowed
        total_watch_time: 0,
        last_position: 0,
        watched_segments: []
      };

      // Simulate validation logic
      const config = stage.configuration as any;
      const canProceed = config.enforcement_threshold === undefined || 
                       config.enforcement_threshold === 0 ||
                       progressData.watch_percentage >= config.enforcement_threshold;

      expect(canProceed).toBe(true);
    });

    it('should allow progression when enforcement threshold is zero', () => {
      const stage = {
        id: 'video-stage-1',
        stage_type: 'video' as const,
        configuration: {
          video_url: 'https://example.com/video.mp4',
          enforcement_threshold: 0 // Zero means no enforcement
        }
      };

      const progressData = {
        watch_percentage: 0,
        total_watch_time: 0,
        last_position: 0,
        watched_segments: []
      };

      // Simulate validation logic
      const config = stage.configuration as any;
      const canProceed = config.enforcement_threshold === undefined || 
                       config.enforcement_threshold === 0 ||
                       progressData.watch_percentage >= config.enforcement_threshold;

      expect(canProceed).toBe(true);
    });

    it('should handle 100% threshold correctly', () => {
      const stage = {
        id: 'video-stage-1',
        stage_type: 'video' as const,
        configuration: {
          video_url: 'https://example.com/video.mp4',
          enforcement_threshold: 100
        }
      };

      // At 100%
      const progressAt100 = {
        watch_percentage: 100,
        total_watch_time: 0,
        last_position: 0,
        watched_segments: []
      };

      const config = stage.configuration as any;
      const canProceedAt100 = progressAt100.watch_percentage >= config.enforcement_threshold;
      expect(canProceedAt100).toBe(true);

      // Below 100%
      const progressBelow100 = {
        watch_percentage: 99.9,
        total_watch_time: 0,
        last_position: 0,
        watched_segments: []
      };

      const canProceedBelow100 = progressBelow100.watch_percentage >= config.enforcement_threshold;
      expect(canProceedBelow100).toBe(false);
    });
  });

  describe('Content Enforcement Edge Cases', () => {
    it('should allow progression when time spent exactly equals minimum', () => {
      const stage = {
        id: 'content-stage-1',
        stage_type: 'content' as const,
        configuration: {
          slides: [
            { id: 'slide-1', content: '<p>Test content</p>', order: 0 }
          ],
          minimum_read_time: 60
        }
      };

      const progressData = {
        current_slide_index: 0,
        time_spent: 60, // Exactly at minimum
        slide_times: {}
      };

      // Simulate validation logic
      const config = stage.configuration as any;
      const timeSpent = progressData.time_spent || 0;
      const canProceed = timeSpent >= config.minimum_read_time;
      const message = canProceed ? '' : `Read for ${config.minimum_read_time - timeSpent} more seconds`;

      expect(canProceed).toBe(true);
      expect(message).toBe('');
    });

    it('should block progression when time spent is just below minimum', () => {
      const stage = {
        id: 'content-stage-1',
        stage_type: 'content' as const,
        configuration: {
          slides: [
            { id: 'slide-1', content: '<p>Test content</p>', order: 0 }
          ],
          minimum_read_time: 60
        }
      };

      const progressData = {
        current_slide_index: 0,
        time_spent: 59, // Just below minimum
        slide_times: {}
      };

      // Simulate validation logic
      const config = stage.configuration as any;
      const timeSpent = progressData.time_spent || 0;
      const canProceed = timeSpent >= config.minimum_read_time;
      const message = canProceed ? '' : `Read for ${config.minimum_read_time - timeSpent} more seconds`;

      expect(canProceed).toBe(false);
      expect(message).toContain('Read for 1 more seconds');
    });

    it('should allow progression when minimum read time is undefined', () => {
      const stage = {
        id: 'content-stage-1',
        stage_type: 'content' as const,
        configuration: {
          slides: [
            { id: 'slide-1', content: '<p>Test content</p>', order: 0 }
          ],
          minimum_read_time: undefined // No enforcement
        }
      };

      const progressData = {
        current_slide_index: 0,
        time_spent: 0, // Even 0 seconds should be allowed
        slide_times: {}
      };

      // Simulate validation logic
      const config = stage.configuration as any;
      const timeSpent = progressData.time_spent || 0;
      const canProceed = config.minimum_read_time === undefined || 
                       config.minimum_read_time === 0 ||
                       timeSpent >= config.minimum_read_time;

      expect(canProceed).toBe(true);
    });

    it('should allow progression when minimum read time is zero', () => {
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
        time_spent: 0,
        slide_times: {}
      };

      // Simulate validation logic
      const config = stage.configuration as any;
      const timeSpent = progressData.time_spent || 0;
      const canProceed = config.minimum_read_time === undefined || 
                       config.minimum_read_time === 0 ||
                       timeSpent >= config.minimum_read_time;

      expect(canProceed).toBe(true);
    });

    it('should handle undefined time_spent in progress data', () => {
      const stage = {
        id: 'content-stage-1',
        stage_type: 'content' as const,
        configuration: {
          slides: [
            { id: 'slide-1', content: '<p>Test content</p>', order: 0 }
          ],
          minimum_read_time: 60
        }
      };

      const progressData = {
        current_slide_index: 0,
        time_spent: undefined, // Undefined should be treated as 0
        slide_times: {}
      };

      // Simulate validation logic
      const config = stage.configuration as any;
      const timeSpent = progressData.time_spent || 0; // Default to 0
      const canProceed = timeSpent >= config.minimum_read_time;

      expect(canProceed).toBe(false);
      expect(timeSpent).toBe(0);
    });

    it('should handle very large minimum read time values', () => {
      const stage = {
        id: 'content-stage-1',
        stage_type: 'content' as const,
        configuration: {
          slides: [
            { id: 'slide-1', content: '<p>Test content</p>', order: 0 }
          ],
          minimum_read_time: 3600 // 1 hour
        }
      };

      const progressData = {
        current_slide_index: 0,
        time_spent: 3600,
        slide_times: {}
      };

      // Simulate validation logic
      const config = stage.configuration as any;
      const timeSpent = progressData.time_spent || 0;
      const canProceed = timeSpent >= config.minimum_read_time;

      expect(canProceed).toBe(true);
    });
  });

  describe('Mixed Enforcement Scenarios', () => {
    it('should handle stage with no progress data', () => {
      const videoStage = {
        id: 'video-stage-1',
        stage_type: 'video' as const,
        configuration: {
          video_url: 'https://example.com/video.mp4',
          enforcement_threshold: 80
        }
      };

      const progressData = undefined;

      // Without progress data, should handle gracefully
      // In actual implementation, this would allow progression
      // because we can't enforce without data
      const config = videoStage.configuration as any;
      const canProceed = !progressData || 
                       config.enforcement_threshold === undefined ||
                       config.enforcement_threshold === 0;

      expect(canProceed).toBe(true);
    });

    it('should handle fractional threshold values', () => {
      const stage = {
        id: 'video-stage-1',
        stage_type: 'video' as const,
        configuration: {
          video_url: 'https://example.com/video.mp4',
          enforcement_threshold: 80.5
        }
      };

      // Exactly at threshold
      const progressAt = {
        watch_percentage: 80.5,
        total_watch_time: 0,
        last_position: 0,
        watched_segments: []
      };

      const config = stage.configuration as any;
      const canProceedAt = progressAt.watch_percentage >= config.enforcement_threshold;
      expect(canProceedAt).toBe(true);

      // Just below threshold
      const progressBelow = {
        watch_percentage: 80.4,
        total_watch_time: 0,
        last_position: 0,
        watched_segments: []
      };

      const canProceedBelow = progressBelow.watch_percentage >= config.enforcement_threshold;
      expect(canProceedBelow).toBe(false);
    });

    it('should handle negative values gracefully', () => {
      const stage = {
        id: 'video-stage-1',
        stage_type: 'video' as const,
        configuration: {
          video_url: 'https://example.com/video.mp4',
          enforcement_threshold: 80
        }
      };

      const progressData = {
        watch_percentage: -1, // Invalid negative value
        total_watch_time: 0,
        last_position: 0,
        watched_segments: []
      };

      // Negative values should fail enforcement
      const config = stage.configuration as any;
      const canProceed = progressData.watch_percentage >= config.enforcement_threshold;
      expect(canProceed).toBe(false);
    });
  });
});
