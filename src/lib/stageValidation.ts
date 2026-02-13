import { Stage, VideoStageConfig, ContentStageConfig, QuestionsStageConfig } from './types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface StageValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates a video URL format
 */
export function validateVideoUrl(url: string): boolean {
  if (!url) return false;
  
  // Accept any valid URL or common video formats
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a video stage configuration
 */
export function validateVideoStage(config: VideoStageConfig): StageValidationResult {
  const errors: ValidationError[] = [];

  // Validate video URL (required)
  if (!config.video_url) {
    errors.push({
      field: 'video_url',
      message: 'Video URL is required',
    });
  } else if (!validateVideoUrl(config.video_url)) {
    errors.push({
      field: 'video_url',
      message: 'Invalid video URL format',
    });
  }

  // Validate enforcement threshold (optional, but must be in range if provided)
  if (config.enforcement_threshold !== undefined) {
    if (config.enforcement_threshold < 0 || config.enforcement_threshold > 100) {
      errors.push({
        field: 'enforcement_threshold',
        message: 'Enforcement threshold must be between 0 and 100',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a content stage configuration
 */
export function validateContentStage(config: ContentStageConfig): StageValidationResult {
  const errors: ValidationError[] = [];

  // Validate content (required)
  if (!config.content || config.content.trim() === '' || config.content === '<p><br></p>') {
    errors.push({
      field: 'content',
      message: 'Content is required',
    });
  }

  // Validate minimum read time (optional, but must be positive if provided)
  if (config.minimum_read_time !== undefined) {
    if (config.minimum_read_time < 0) {
      errors.push({
        field: 'minimum_read_time',
        message: 'Minimum read time must be positive',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a questions stage configuration
 */
export function validateQuestionsStage(config: QuestionsStageConfig): StageValidationResult {
  const errors: ValidationError[] = [];

  // Validate question_ids (must have at least one)
  if (!config.question_ids || config.question_ids.length === 0) {
    errors.push({
      field: 'question_ids',
      message: 'At least one question must be selected',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a stage based on its type
 */
export function validateStage(stage: Stage): StageValidationResult {
  switch (stage.stage_type) {
    case 'video':
      return validateVideoStage(stage.configuration as VideoStageConfig);
    case 'content':
      return validateContentStage(stage.configuration as ContentStageConfig);
    case 'questions':
      return validateQuestionsStage(stage.configuration as QuestionsStageConfig);
    default:
      return {
        isValid: false,
        errors: [{ field: 'stage_type', message: 'Invalid stage type' }],
      };
  }
}

/**
 * Validates all stages in an exam
 */
export function validateAllStages(stages: Stage[]): {
  isValid: boolean;
  stageErrors: Map<string, ValidationError[]>;
} {
  const stageErrors = new Map<string, ValidationError[]>();
  let isValid = true;

  stages.forEach((stage) => {
    const result = validateStage(stage);
    if (!result.isValid) {
      stageErrors.set(stage.id, result.errors);
      isValid = false;
    }
  });

  return {
    isValid,
    stageErrors,
  };
}
