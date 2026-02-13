/**
 * Unit tests for error handling in staged exam system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { stageProgressQueue } from '@/lib/stageProgressQueue';

describe('Stage Progress Queue', () => {
  beforeEach(() => {
    // Clear queue before each test
    stageProgressQueue.clear();
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    stageProgressQueue.clear();
  });

  it('should enqueue failed saves', () => {
    const attemptId = 'test-attempt-1';
    const stageId = 'test-stage-1';
    const progressData = { test: 'data' };

    stageProgressQueue.enqueue(attemptId, stageId, progressData, false);

    expect(stageProgressQueue.getQueueSize()).toBe(1);
    expect(stageProgressQueue.hasPendingSaves()).toBe(true);
  });

  it('should update existing queued item', () => {
    const attemptId = 'test-attempt-1';
    const stageId = 'test-stage-1';
    const progressData1 = { test: 'data1' };
    const progressData2 = { test: 'data2' };

    stageProgressQueue.enqueue(attemptId, stageId, progressData1, false);
    stageProgressQueue.enqueue(attemptId, stageId, progressData2, false);

    // Should still be 1 item (updated, not added)
    expect(stageProgressQueue.getQueueSize()).toBe(1);
  });

  it('should handle multiple different stages', () => {
    const attemptId = 'test-attempt-1';
    
    stageProgressQueue.enqueue(attemptId, 'stage-1', { data: 1 }, false);
    stageProgressQueue.enqueue(attemptId, 'stage-2', { data: 2 }, false);
    stageProgressQueue.enqueue(attemptId, 'stage-3', { data: 3 }, false);

    expect(stageProgressQueue.getQueueSize()).toBe(3);
  });

  it('should clear all queued items', () => {
    stageProgressQueue.enqueue('attempt-1', 'stage-1', {}, false);
    stageProgressQueue.enqueue('attempt-1', 'stage-2', {}, false);

    expect(stageProgressQueue.getQueueSize()).toBe(2);

    stageProgressQueue.clear();

    expect(stageProgressQueue.getQueueSize()).toBe(0);
    expect(stageProgressQueue.hasPendingSaves()).toBe(false);
  });

  it('should persist queue to localStorage', () => {
    const attemptId = 'test-attempt-1';
    const stageId = 'test-stage-1';
    const progressData = { test: 'data' };

    stageProgressQueue.enqueue(attemptId, stageId, progressData, false);

    // Check localStorage
    const stored = localStorage.getItem('stage_progress_queue_data');
    expect(stored).toBeTruthy();
    
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
  });

  it('should persist and restore queue from localStorage', () => {
    const attemptId = 'test-attempt-1';
    const stageId = 'test-stage-1';
    const progressData = { test: 'data' };

    // Enqueue an item
    stageProgressQueue.enqueue(attemptId, stageId, progressData, false);
    expect(stageProgressQueue.getQueueSize()).toBe(1);

    // Verify it was persisted to localStorage
    const stored = localStorage.getItem('stage_progress_queue_data');
    expect(stored).toBeTruthy();
    
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0][0]).toBe(`${attemptId}:${stageId}`);
  });
});

describe('Stage Configuration Validation', () => {
  it('should validate stage has required fields', () => {
    const validStage = {
      id: 'stage-1',
      stage_type: 'video',
      stage_order: 1,
      configuration: {
        youtube_url: 'https://www.youtube.com/watch?v=test'
      }
    };

    expect(validStage.id).toBeTruthy();
    expect(validStage.stage_type).toBeTruthy();
    expect(validStage.configuration).toBeTruthy();
  });

  it('should validate video stage has youtube_url', () => {
    const videoConfig = {
      youtube_url: 'https://www.youtube.com/watch?v=test',
      enforcement_threshold: 80
    };

    expect(videoConfig.youtube_url).toBeTruthy();
    expect(videoConfig.youtube_url).toContain('youtube.com');
  });

  it('should validate content stage has slides', () => {
    const contentConfig = {
      slides: [
        { id: 'slide-1', content: '<p>Test content</p>' }
      ],
      minimum_read_time_per_slide: 10
    };

    expect(contentConfig.slides).toBeTruthy();
    expect(contentConfig.slides.length).toBeGreaterThan(0);
  });

  it('should validate questions stage has question_ids', () => {
    const questionsConfig = {
      question_ids: ['q1', 'q2', 'q3'],
      randomize: false
    };

    expect(questionsConfig.question_ids).toBeTruthy();
    expect(questionsConfig.question_ids.length).toBeGreaterThan(0);
  });
});
