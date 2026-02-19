export type QuestionType =
  | "true_false"
  | "single_choice"
  | "multiple_choice"
  | "multi_select"
  | "short_answer"
  | "paragraph"
  | "photo_upload";

export interface Question {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options?: string[] | null;
  correct_answers?: unknown;
  points: number;
  required: boolean;
  order_index: number | null;
  // Optional image support
  question_image_url?: string | null;
  option_image_urls?: (string | null)[] | null;
}

export interface ExamInfo {
  id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  settings: Record<string, unknown>;
  access_type: string;
}

export interface AttemptState {
  attemptId: string;
  version: number;
  started_at: string;
  exam: ExamInfo;
  auto_save_data: any;
  answers: Record<string, unknown>;
  completion_status: "in_progress" | "submitted" | "abandoned" | "invalid";
  submitted_at: string | null;
  questions: Question[];
  stages?: Stage[];
  stage_progress?: StageProgress[];
}

// Stage Types
export type StageType = 'video' | 'content' | 'questions';

export interface Stage {
  id: string;
  exam_id: string;
  stage_type: StageType;
  stage_order: number;
  configuration: VideoStageConfig | ContentStageConfig | QuestionsStageConfig;
  created_at: string;
  updated_at: string;
}

export interface VideoStageConfig {
  video_url: string;
  enforcement_threshold?: number;
  description?: string;
}

export interface ContentStageConfig {
  content: string; // Rich text HTML content
  title?: string; // Optional title for the content
  minimum_read_time?: number; // Optional minimum read time in seconds
}

export interface QuestionsStageConfig {
  question_ids: string[];
  randomize_within_stage: boolean;
}

// Stage Progress Types
export interface StageProgress {
  id: string;
  attempt_id: string;
  stage_id: string;
  started_at: string | null;
  completed_at: string | null;
  progress_data: VideoStageProgress | ContentStageProgress | QuestionsStageProgress;
  created_at: string;
  updated_at: string;
}

export interface VideoStageProgress {
  watch_percentage: number;
  total_watch_time: number;
  last_position: number;
  watched_segments: [number, number][];
}

export interface ContentStageProgress {
  time_spent: number; // Total time spent reading in seconds
  completed_reading: boolean; // Whether minimum read time was met
}

export interface QuestionsStageProgress {
  answered_count: number;
  total_count: number;
}
