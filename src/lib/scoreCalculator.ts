/**
 * Score Calculator Module
 * 
 * Centralized, pure calculation engine for computing final scores from exam
 * and extra score components. This is the single source of truth for all
 * score calculations across the application.
 * 
 * @module scoreCalculator
 */

import type {
  CalculationInput,
  CalculationResult,
  ValidationResult,
  ExamComponent,
  ExtraComponent,
  ExamComponentDetail,
  ExtraComponentDetail,
  CalculationSettings,
  ExamAttempt,
  ExtraField,
} from './scoreCalculator.types';
import {
  logCalculationStart,
  logCalculationComplete,
  logCalculationError,
} from './calculationLogger';
import { logValidationError } from './errorLogger';

/**
 * Validates calculation input data
 * 
 * Performs comprehensive validation of all input fields to ensure
 * data integrity before calculation begins.
 * 
 * @param input - The calculation input to validate
 * @returns Validation result with error details if invalid
 */
export function validateInput(input: any): ValidationResult {
  const errors: string[] = [];

  // Check if input exists
  if (!input || typeof input !== 'object') {
    const validationResult = {
      valid: false,
      error: 'Input must be a valid object',
      errors: ['Input is null, undefined, or not an object'],
    };
    
    // Log validation error
    logValidationError(
      'input_validation',
      'Input validation failed: invalid input structure',
      {
        validationErrors: validationResult.errors,
        input: input ? 'invalid_object' : 'null_or_undefined',
      }
    );
    
    return validationResult;
  }

  // Validate required fields
  if (!input.studentId || typeof input.studentId !== 'string' || input.studentId.trim() === '') {
    errors.push('studentId is required and must be a non-empty string');
  }

  if (!input.studentCode || typeof input.studentCode !== 'string' || input.studentCode.trim() === '') {
    errors.push('studentCode is required and must be a non-empty string');
  }

  if (!input.studentName || typeof input.studentName !== 'string' || input.studentName.trim() === '') {
    errors.push('studentName is required and must be a non-empty string');
  }

  if (!Array.isArray(input.examAttempts)) {
    errors.push('examAttempts must be an array');
  }

  if (!input.extraScores || typeof input.extraScores !== 'object') {
    // For backward compatibility, allow null/undefined extraScores
    if (input.extraScores !== null && input.extraScores !== undefined) {
      errors.push('extraScores must be an object, null, or undefined');
    }
  }

  if (!Array.isArray(input.extraFields)) {
    errors.push('extraFields must be an array');
  }

  if (!input.settings || typeof input.settings !== 'object') {
    errors.push('settings is required and must be an object');
  }

  // If basic structure is invalid, return early
  if (errors.length > 0) {
    const validationResult = {
      valid: false,
      error: 'Invalid input structure',
      errors,
    };
    
    // Log validation error with context
    logValidationError(
      'input_validation',
      'Input validation failed: invalid input structure',
      {
        studentCode: input?.studentCode,
        studentId: input?.studentId,
        validationErrors: errors,
        input: 'invalid_structure',
      }
    );
    
    return validationResult;
  }

  // Validate settings
  const settings = input.settings;
  
  if (!['best', 'avg'].includes(settings.passCalcMode)) {
    errors.push('settings.passCalcMode must be "best" or "avg"');
  }

  if (typeof settings.overallPassThreshold !== 'number' || 
      isNaN(settings.overallPassThreshold) ||
      settings.overallPassThreshold < 0 || 
      settings.overallPassThreshold > 100) {
    errors.push('settings.overallPassThreshold must be a number between 0 and 100');
  }

  if (typeof settings.examWeight !== 'number' || 
      isNaN(settings.examWeight) ||
      settings.examWeight < 0) {
    errors.push('settings.examWeight must be a non-negative number');
  }

  if (!['final', 'raw'].includes(settings.examScoreSource)) {
    errors.push('settings.examScoreSource must be "final" or "raw"');
  }

  if (typeof settings.failOnAnyExam !== 'boolean') {
    errors.push('settings.failOnAnyExam must be a boolean');
  }

  // Validate exam attempts
  if (Array.isArray(input.examAttempts)) {
    input.examAttempts.forEach((attempt: any, index: number) => {
      if (!attempt.examId || typeof attempt.examId !== 'string') {
        errors.push(`examAttempts[${index}].examId is required and must be a string`);
      }

      if (!attempt.examTitle || typeof attempt.examTitle !== 'string') {
        errors.push(`examAttempts[${index}].examTitle is required and must be a string`);
      }

      if (attempt.scorePercentage !== null && attempt.scorePercentage !== undefined) {
        if (typeof attempt.scorePercentage !== 'number' || 
            isNaN(attempt.scorePercentage)) {
          errors.push(`examAttempts[${index}].scorePercentage must be a number or null`);
        }
      }

      if (attempt.finalScorePercentage !== null && attempt.finalScorePercentage !== undefined) {
        if (typeof attempt.finalScorePercentage !== 'number' || 
            isNaN(attempt.finalScorePercentage)) {
          errors.push(`examAttempts[${index}].finalScorePercentage must be a number or null`);
        }
      }

      if (typeof attempt.includeInPass !== 'boolean') {
        errors.push(`examAttempts[${index}].includeInPass must be a boolean`);
      }

      if (attempt.passThreshold !== null && attempt.passThreshold !== undefined) {
        if (typeof attempt.passThreshold !== 'number' || 
            isNaN(attempt.passThreshold)) {
          errors.push(`examAttempts[${index}].passThreshold must be a number or null`);
        }
      }
    });
  }

  // Validate extra fields
  if (Array.isArray(input.extraFields)) {
    input.extraFields.forEach((field: any, index: number) => {
      if (!field.key || typeof field.key !== 'string') {
        errors.push(`extraFields[${index}].key is required and must be a string`);
      }

      if (!field.label || typeof field.label !== 'string') {
        errors.push(`extraFields[${index}].label is required and must be a string`);
      }

      if (!['number', 'text', 'boolean'].includes(field.type)) {
        errors.push(`extraFields[${index}].type must be "number", "text", or "boolean" (got: ${field.type})`);
      }

      if (typeof field.includeInPass !== 'boolean') {
        errors.push(`extraFields[${index}].includeInPass must be a boolean (got: ${typeof field.includeInPass})`);
      }

      if (typeof field.passWeight !== 'number' || 
          isNaN(field.passWeight) ||
          field.passWeight < 0) {
        errors.push(`extraFields[${index}].passWeight must be a non-negative number (got: ${field.passWeight})`);
      }

      if (field.maxPoints !== null && field.maxPoints !== undefined) {
        if (typeof field.maxPoints !== 'number' || 
            isNaN(field.maxPoints) ||
            field.maxPoints <= 0) {
          errors.push(`extraFields[${index}].maxPoints must be a positive number or null (got: ${field.maxPoints})`);
        }
      }
    });
  }

  // Return validation result
  if (errors.length > 0) {
    return {
      valid: false,
      error: `Validation failed with ${errors.length} error(s)`,
      errors,
    };
  }

  return {
    valid: true,
  };
}

/**
 * Calculates the extra component of the final score
 * 
 * @param input - The calculation input containing extra scores and fields
 * @returns Extra component with score and detailed breakdown
 */
function calculateExtraComponent(input: CalculationInput): ExtraComponent {
  const { extraScores, extraFields } = input;
  
  const details: ExtraComponentDetail[] = [];
  let totalWeight = 0;
  let weightedSum = 0;
  
  // Process each extra field
  for (const field of extraFields) {
    if (!field.includeInPass) {
      continue; // Skip fields not included in pass calculation
    }
    
    // Get raw value from extra scores - handle missing fields gracefully
    const rawValue = extraScores && typeof extraScores === 'object' 
      ? extraScores[field.key] 
      : undefined;
    
    // Normalize the value to a 0-100 scale
    let normalizedScore = 0;
    
    // Handle missing or null values gracefully (legacy compatibility)
    if (rawValue !== null && rawValue !== undefined) {
      switch (field.type) {
        case 'number':
          if (typeof rawValue === 'number' && !isNaN(rawValue)) {
            if (field.maxPoints && field.maxPoints > 0) {
              // Normalize: (value / maxPoints) * 100
              normalizedScore = (rawValue / field.maxPoints) * 100;
            } else {
              // No normalization, assume already 0-100
              normalizedScore = rawValue;
            }
          }
          break;
          
        case 'boolean':
          if (typeof rawValue === 'boolean') {
            if (rawValue) {
              normalizedScore = field.boolTruePoints ?? 100;
            } else {
              normalizedScore = field.boolFalsePoints ?? 0;
            }
          }
          break;
          
        case 'text':
          if (typeof rawValue === 'string' && field.textScoreMap) {
            // Use hasOwnProperty to avoid prototype pollution
            if (Object.prototype.hasOwnProperty.call(field.textScoreMap, rawValue)) {
              const mappedValue = field.textScoreMap[rawValue];
              // Ensure the mapped value is a valid number
              if (typeof mappedValue === 'number' && !isNaN(mappedValue)) {
                normalizedScore = mappedValue;
              }
            }
          }
          break;
      }
    }
    // If rawValue is null/undefined, normalizedScore remains 0 (graceful handling)
    
    // Clamp to [0, 100]
    normalizedScore = Math.max(0, Math.min(100, normalizedScore));
    
    // Round to 2 decimal places
    normalizedScore = Math.round(normalizedScore * 100) / 100;
    
    // Calculate weighted contribution
    const weightedContribution = normalizedScore * field.passWeight;
    
    details.push({
      fieldKey: field.key,
      fieldLabel: field.label,
      rawValue,
      normalizedScore,
      weight: field.passWeight,
      weightedContribution,
    });
    
    totalWeight += field.passWeight;
    weightedSum += weightedContribution;
  }
  
  // Calculate final extra component score
  let componentScore: number | null = null;
  
  if (totalWeight > 0) {
    // Weighted average: sum of (normalizedScore * weight) / totalWeight
    componentScore = weightedSum / totalWeight;
    
    // Round to 2 decimal places
    componentScore = Math.round(componentScore * 100) / 100;
    
    // Clamp to [0, 100]
    componentScore = Math.max(0, Math.min(100, componentScore));
  }
  
  return {
    score: componentScore,
    totalWeight,
    details,
  };
}

/**
 * Calculates the exam component of the final score
 * 
 * @param input - The calculation input containing exam attempts and settings
 * @returns Exam component with score and detailed breakdown
 */
function calculateExamComponent(input: CalculationInput): ExamComponent {
  const { examAttempts, settings } = input;
  
  // Filter exams that should be included in the calculation
  const includedExams = examAttempts.filter(exam => exam.includeInPass);
  
  // Build details for all exams
  const details: ExamComponentDetail[] = examAttempts.map(exam => {
    // Determine which score to use based on settings with legacy fallback
    let score: number;
    if (settings.examScoreSource === 'final') {
      // Prefer final_score_percentage, fallback to score_percentage (legacy compatibility)
      if (exam.finalScorePercentage !== null && exam.finalScorePercentage !== undefined) {
        score = exam.finalScorePercentage;
      } else if (exam.scorePercentage !== null && exam.scorePercentage !== undefined) {
        score = exam.scorePercentage;
      } else {
        score = 0;
      }
    } else {
      // Raw mode: prefer score_percentage, fallback to final_score_percentage
      if (exam.scorePercentage !== null && exam.scorePercentage !== undefined) {
        score = exam.scorePercentage;
      } else if (exam.finalScorePercentage !== null && exam.finalScorePercentage !== undefined) {
        score = exam.finalScorePercentage;
      } else {
        score = 0;
      }
    }
    
    // Clamp score to [0, 100]
    score = Math.max(0, Math.min(100, score));
    
    // Round to 2 decimal places
    score = Math.round(score * 100) / 100;
    
    // Determine if this exam was passed (if threshold exists)
    let passed: boolean | null = null;
    if (exam.passThreshold !== null && exam.passThreshold !== undefined) {
      passed = score >= exam.passThreshold;
    }
    
    return {
      examId: exam.examId,
      examTitle: exam.examTitle,
      score,
      included: exam.includeInPass,
      passed,
      passThreshold: exam.passThreshold,
    };
  });
  
  // Calculate component score based on mode
  let componentScore: number | null = null;
  
  if (includedExams.length > 0) {
    const includedScores = details
      .filter(d => d.included)
      .map(d => d.score);
    
    if (settings.passCalcMode === 'best') {
      // Best mode: use maximum score
      componentScore = Math.max(...includedScores);
    } else {
      // Average mode: use arithmetic mean
      const sum = includedScores.reduce((acc, score) => acc + score, 0);
      componentScore = sum / includedScores.length;
    }
    
    // Round to 2 decimal places
    componentScore = Math.round(componentScore * 100) / 100;
    
    // Clamp to [0, 100]
    componentScore = Math.max(0, Math.min(100, componentScore));
  }
  
  // Count exams passed
  const examsPassed = details.filter(d => d.passed === true).length;
  
  return {
    score: componentScore,
    mode: settings.passCalcMode,
    examsIncluded: includedExams.length,
    examsTotal: examAttempts.length,
    examsPassed,
    details,
  };
}

/**
 * Combines exam and extra components into a final score
 * 
 * Uses weighted combination formula:
 * finalScore = (examScore * examWeight + extraScore * totalExtraWeight) / (examWeight + totalExtraWeight)
 * 
 * @param examComponent - The exam component result
 * @param extraComponent - The extra component result
 * @param settings - Calculation settings containing weights
 * @returns Final combined score or null if no components available
 */
function combineComponents(
  examComponent: ExamComponent,
  extraComponent: ExtraComponent,
  settings: CalculationSettings
): number | null {
  const examScore = examComponent.score;
  const extraScore = extraComponent.score;
  const examWeight = settings.examWeight;
  const extraWeight = extraComponent.totalWeight;
  
  // If both components are null, return null
  if (examScore === null && extraScore === null) {
    return null;
  }
  
  // If only exam component exists
  if (examScore !== null && extraScore === null) {
    return examScore;
  }
  
  // If only extra component exists
  if (examScore === null && extraScore !== null) {
    return extraScore;
  }
  
  // Both components exist - calculate weighted average
  const totalWeight = examWeight + extraWeight;
  
  // Avoid division by zero
  if (totalWeight === 0) {
    return null;
  }
  
  const weightedSum = (examScore! * examWeight) + (extraScore! * extraWeight);
  let finalScore = weightedSum / totalWeight;
  
  // Round to 2 decimal places
  finalScore = Math.round(finalScore * 100) / 100;
  
  // Clamp to [0, 100]
  finalScore = Math.max(0, Math.min(100, finalScore));
  
  return finalScore;
}

/**
 * Determines pass/fail status based on final score and exam results
 * 
 * @param examComponent - The exam component result
 * @param finalScore - The combined final score
 * @param settings - Calculation settings containing thresholds and rules
 * @returns Pass status and whether failure was due to exam threshold
 */
function determinePassStatus(
  examComponent: ExamComponent,
  finalScore: number | null,
  settings: CalculationSettings
): { passed: boolean | null; failedDueToExam: boolean } {
  // If no final score, cannot determine pass status
  if (finalScore === null) {
    return { passed: null, failedDueToExam: false };
  }
  
  // Check if failOnAnyExam rule is enabled
  if (settings.failOnAnyExam) {
    // Check if any exam with a threshold was failed
    const failedExams = examComponent.details.filter(
      exam => exam.passed === false && exam.passThreshold !== null
    );
    
    if (failedExams.length > 0) {
      // Student failed at least one exam - overall fail
      return { passed: false, failedDueToExam: true };
    }
  }
  
  // Determine pass based on overall threshold
  const passed = finalScore >= settings.overallPassThreshold;
  
  return { passed, failedDueToExam: false };
}

/**
 * Placeholder for calculateFinalScore - will be implemented in subsequent tasks
 */
export function calculateFinalScore(input: CalculationInput): CalculationResult {
  const startTime = performance.now();
  const operationId = logCalculationStart(
    input?.studentCode || 'unknown',
    input?.studentId || 'unknown',
    input
  );

  try {
    // Validate input
    const validation = validateInput(input);
    if (!validation.valid) {
      const duration = performance.now() - startTime;
      const error = validation.error || 'Input validation failed';
      
      logCalculationError(
        operationId,
        input?.studentCode || 'unknown',
        input?.studentId || 'unknown',
        error,
        duration,
        input
      );

      // Create safe error response without accessing potentially invalid input
      const safeMode = input?.settings?.passCalcMode || 'best';
      const safeThreshold = input?.settings?.overallPassThreshold ?? 50;
      
      return {
        success: false,
        error,
        examComponent: {
          score: null,
          mode: safeMode,
          examsIncluded: 0,
          examsTotal: 0,
          examsPassed: 0,
          details: [],
        },
        extraComponent: {
          score: null,
          totalWeight: 0,
          details: [],
        },
        finalScore: null,
        passed: null,
        passThreshold: safeThreshold,
        failedDueToExam: false,
      };
    }

    // Calculate exam component
    const examComponent = calculateExamComponent(input);
    
    // Calculate extra component
    const extraComponent = calculateExtraComponent(input);
    
    // Combine components into final score
    const finalScore = combineComponents(examComponent, extraComponent, input.settings);
    
    // Determine pass/fail status
    const passResult = determinePassStatus(examComponent, finalScore, input.settings);
    
    const result: CalculationResult = {
      success: true,
      examComponent,
      extraComponent,
      finalScore,
      passed: passResult.passed,
      passThreshold: input.settings.overallPassThreshold,
      failedDueToExam: passResult.failedDueToExam,
    };

    // Log successful completion
    const duration = performance.now() - startTime;
    logCalculationComplete(
      operationId,
      input.studentCode,
      input.studentId,
      result,
      duration,
      false // Not cached in this direct calculation
    );

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    logCalculationError(
      operationId,
      input?.studentCode || 'unknown',
      input?.studentId || 'unknown',
      error instanceof Error ? error : String(error),
      duration,
      input
    );

    // Return error result
    const safeMode = input?.settings?.passCalcMode || 'best';
    const safeThreshold = input?.settings?.overallPassThreshold ?? 50;
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      examComponent: {
        score: null,
        mode: safeMode,
        examsIncluded: 0,
        examsTotal: 0,
        examsPassed: 0,
        details: [],
      },
      extraComponent: {
        score: null,
        totalWeight: 0,
        details: [],
      },
      finalScore: null,
      passed: null,
      passThreshold: safeThreshold,
      failedDueToExam: false,
    };
  }
}

/**
 * Converts a modern CalculationResult to legacy API response format
 * 
 * This function provides backward compatibility by converting the new
 * detailed calculation result into the format expected by legacy clients.
 * 
 * @param result - Modern calculation result
 * @param studentCode - Student code for the response
 * @param studentName - Student name for the response
 * @returns Legacy-formatted response object
 */
export function toLegacyFormat(
  result: CalculationResult, 
  studentCode: string, 
  studentName: string | null = null
) {
  // Build legacy extras format
  const extras = result.extraComponent.details.map(detail => ({
    key: detail.fieldKey,
    label: detail.fieldLabel,
    value: detail.rawValue,
    max_points: null, // Legacy format doesn't include max_points in this context
    type: 'unknown' // Legacy format doesn't include type information
  }));

  // Build legacy pass_summary format
  const pass_summary = {
    overall_score: result.finalScore,
    passed: result.passed,
    threshold: result.passThreshold,
    message: null, // Message is typically set by the calling API
    hidden: false, // Hidden flag is typically set by the calling API
    exam_passed: result.examComponent.examsPassed,
    exam_total: result.examComponent.examsTotal,
  };

  return {
    code: studentCode,
    student_name: studentName,
    calculation: result,
    extras,
    pass_summary,
  };
}

/**
 * Creates a CalculationInput from legacy data formats
 * 
 * This function handles the conversion of legacy data structures
 * into the modern CalculationInput format, providing backward
 * compatibility for older data sources.
 * 
 * @param legacyData - Legacy data structure
 * @returns Modern CalculationInput object
 */
export function fromLegacyFormat(legacyData: any): CalculationInput {
  // Handle legacy exam attempts format
  const examAttempts: ExamAttempt[] = (legacyData.examAttempts || legacyData.exams || []).map((exam: any) => ({
    examId: exam.examId || exam.id || exam.exam_id || '',
    examTitle: exam.examTitle || exam.title || exam.name || 'Untitled Exam',
    // Legacy fallback: prefer final_score_percentage, fallback to score_percentage
    scorePercentage: exam.scorePercentage ?? exam.score_percentage ?? exam.score ?? null,
    finalScorePercentage: exam.finalScorePercentage ?? exam.final_score_percentage ?? exam.final_score ?? null,
    includeInPass: exam.includeInPass ?? exam.include_in_pass ?? true,
    passThreshold: exam.passThreshold ?? exam.pass_threshold ?? exam.threshold ?? null,
  }));

  // Handle legacy extra fields format
  const extraFields: ExtraField[] = (legacyData.extraFields || legacyData.fields || []).map((field: any) => ({
    key: field.key || '',
    label: field.label || field.name || '',
    type: field.type || 'number',
    includeInPass: field.includeInPass ?? field.include_in_pass ?? true,
    passWeight: field.passWeight ?? field.pass_weight ?? field.weight ?? 0,
    maxPoints: field.maxPoints ?? field.max_points ?? null,
    boolTruePoints: field.boolTruePoints ?? field.bool_true_points ?? 100,
    boolFalsePoints: field.boolFalsePoints ?? field.bool_false_points ?? 0,
    textScoreMap: field.textScoreMap ?? field.text_score_map ?? {},
  }));

  // Handle legacy settings format
  const settings: CalculationSettings = {
    passCalcMode: legacyData.settings?.passCalcMode ?? legacyData.settings?.pass_calc_mode ?? legacyData.passCalcMode ?? legacyData.pass_calc_mode ?? 'best',
    overallPassThreshold: legacyData.settings?.overallPassThreshold ?? legacyData.settings?.overall_pass_threshold ?? legacyData.passThreshold ?? legacyData.overall_pass_threshold ?? 50,
    examWeight: legacyData.settings?.examWeight ?? legacyData.settings?.exam_weight ?? legacyData.examWeight ?? legacyData.exam_weight ?? 1,
    examScoreSource: legacyData.settings?.examScoreSource ?? legacyData.settings?.exam_score_source ?? 'final',
    failOnAnyExam: legacyData.settings?.failOnAnyExam ?? legacyData.settings?.fail_on_any_exam ?? false,
  };

  return {
    studentId: legacyData.studentId ?? legacyData.student_id ?? '',
    studentCode: legacyData.studentCode ?? legacyData.student_code ?? legacyData.code ?? '',
    studentName: legacyData.studentName ?? legacyData.student_name ?? legacyData.name ?? '',
    examAttempts,
    extraScores: legacyData.extraScores ?? legacyData.extra_scores ?? {},
    extraFields,
    settings,
  };
}
