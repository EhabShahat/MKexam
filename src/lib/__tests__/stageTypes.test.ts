import { describe, it, expect } from 'vitest';
import type {
  StageType,
  Stage,
  VideoStageConfig,
  ContentStageConfig,
  QuestionsStageConfig,
  ContentSlide,
  StageProgress,
  VideoStageProgress,
  ContentStageProgress,
  QuestionsStageProgress,
  AttemptState,
} from '../types';

describe('Stage Type Definitions', () => {
  it('should allow valid StageType values', () => {
    const videoType: StageType = 'video';
    const contentType: StageType = 'content';
    const questionsType: StageType = 'questions';

    expect(videoType).toBe('video');
    expect(contentType).toBe('content');
    expect(questionsType).toBe('questions');
  });

  it('should create valid VideoStageConfig', () => {
    const config: VideoStageConfig = {
      youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      enforcement_threshold: 80,
      description: 'Test video',
    };

    expect(config.youtube_url).toBeDefined();
    expect(config.enforcement_threshold).toBe(80);
  });

  it('should create valid ContentStageConfig', () => {
    const slide: ContentSlide = {
      id: 'slide-1',
      content: '<p>Test content</p>',
      order: 0,
    };

    const config: ContentStageConfig = {
      slides: [slide],
      minimum_read_time_per_slide: 30,
    };

    expect(config.slides).toHaveLength(1);
    expect(config.minimum_read_time_per_slide).toBe(30);
  });

  it('should create valid QuestionsStageConfig', () => {
    const config: QuestionsStageConfig = {
      question_ids: ['q1', 'q2', 'q3'],
      randomize_within_stage: true,
    };

    expect(config.question_ids).toHaveLength(3);
    expect(config.randomize_within_stage).toBe(true);
  });

  it('should create valid Stage with VideoStageConfig', () => {
    const stage: Stage = {
      id: 'stage-1',
      exam_id: 'exam-1',
      stage_type: 'video',
      stage_order: 0,
      configuration: {
        youtube_url: 'https://www.youtube.com/watch?v=test',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(stage.stage_type).toBe('video');
  });

  it('should create valid VideoStageProgress', () => {
    const progress: VideoStageProgress = {
      watch_percentage: 75.5,
      total_watch_time: 300,
      last_position: 350,
      watched_segments: [[0, 100], [150, 400]],
    };

    expect(progress.watch_percentage).toBe(75.5);
    expect(progress.watched_segments).toHaveLength(2);
  });

  it('should create valid ContentStageProgress', () => {
    const progress: ContentStageProgress = {
      current_slide_index: 2,
      slide_times: {
        'slide-1': 45,
        'slide-2': 60,
      },
    };

    expect(progress.current_slide_index).toBe(2);
    expect(Object.keys(progress.slide_times)).toHaveLength(2);
  });

  it('should create valid QuestionsStageProgress', () => {
    const progress: QuestionsStageProgress = {
      answered_count: 8,
      total_count: 10,
    };

    expect(progress.answered_count).toBe(8);
    expect(progress.total_count).toBe(10);
  });

  it('should create valid StageProgress', () => {
    const stageProgress: StageProgress = {
      id: 'progress-1',
      attempt_id: 'attempt-1',
      stage_id: 'stage-1',
      started_at: new Date().toISOString(),
      completed_at: null,
      progress_data: {
        watch_percentage: 50,
        total_watch_time: 200,
        last_position: 250,
        watched_segments: [[0, 250]],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(stageProgress.attempt_id).toBe('attempt-1');
    expect(stageProgress.completed_at).toBeNull();
  });

  it('should extend AttemptState with optional stages and stage_progress', () => {
    const attemptState: AttemptState = {
      attemptId: 'attempt-1',
      version: 1,
      started_at: new Date().toISOString(),
      exam: {
        id: 'exam-1',
        title: 'Test Exam',
        description: 'Test description',
        start_time: null,
        end_time: null,
        duration_minutes: 60,
        settings: {},
        access_type: 'open',
      },
      auto_save_data: {},
      answers: {},
      completion_status: 'in_progress',
      submitted_at: null,
      questions: [],
      stages: [
        {
          id: 'stage-1',
          exam_id: 'exam-1',
          stage_type: 'video',
          stage_order: 0,
          configuration: {
            youtube_url: 'https://www.youtube.com/watch?v=test',
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      stage_progress: [],
    };

    expect(attemptState.stages).toBeDefined();
    expect(attemptState.stages).toHaveLength(1);
    expect(attemptState.stage_progress).toBeDefined();
  });

  it('should allow AttemptState without stages (backward compatibility)', () => {
    const attemptState: AttemptState = {
      attemptId: 'attempt-1',
      version: 1,
      started_at: new Date().toISOString(),
      exam: {
        id: 'exam-1',
        title: 'Test Exam',
        description: null,
        start_time: null,
        end_time: null,
        duration_minutes: null,
        settings: {},
        access_type: 'open',
      },
      auto_save_data: {},
      answers: {},
      completion_status: 'in_progress',
      submitted_at: null,
      questions: [],
    };

    expect(attemptState.stages).toBeUndefined();
    expect(attemptState.stage_progress).toBeUndefined();
  });
});
