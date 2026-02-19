/**
 * Score Calculator Module
 * 
 * Pure functions for calculating exam scores, extra scores, and final scores
 * with pass/fail determination. All calculations are deterministic and thoroughly tested.
 * 
 * Requirements: 5.1-5.9
 */

import type {
  Exam,
  ExtraField,
  AppSettings,
  ExamComponentResult,
  ExtraComponentResult,
  CalculationResult,
} from './types';

/**
 * Calculate exam component score using best or average mode
 * 
 * @param scores - Map of exam ID to score percentage
 * @param exams - Array of exam definitions
 * @param mode - Calculation mode ('best' or 'avg')
 * @returns Exam component calculation result
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export function calculateExamComponent(
  scores: Record<string, number | null>,
  exams: Exam[],
  mode: 'best' | 'avg'
): ExamComponentResult {
  // Filter to only exams included in pass calculation
  const includedExams = exams.filter(exam => exam.include_in_pass);
  
  // Build details array with pass/fail status
  const details = includedExams.map(exam => {
    const score = scores[exam.id] ?? null;
    const passed = score !== null && score >= exam.pass_threshold;
    
    return {
      exam_id: exam.id,
      exam_title: exam.title,
      score,
      passed,
      pass_threshold: exam.pass_threshold,
    };
  });
  
  // Get valid scores (non-null)
  const validScores = details
    .map(d => d.score)
    .filter((score): score is number => score !== null);
  
  // Calculate component score based on mode
  let componentScore = 0;
  if (validScores.length > 0) {
    if (mode === 'best') {
      componentScore = Math.max(...validScores);
    } else {
      // avg mode
      const sum = validScores.reduce((acc, score) => acc + score, 0);
      componentScore = sum / validScores.length;
    }
  }
  
  // Count passed exams
  const examsPassed = details.filter(d => d.passed).length;
  
  return {
    mode,
    score: componentScore,
    exams_included: includedExams.length,
    exams_total: exams.length,
    exams_passed: examsPassed,
    details,
  };
}

/**
 * Normalize extra field value to percentage (0-100)
 * 
 * @param value - Raw field value
 * @param field - Field definition with normalization rules
 * @returns Normalized score (0-100)
 * 
 * Requirements: 5.6
 */
export function normalizeExtraFieldValue(
  value: any,
  field: ExtraField
): number {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return 0;
  }
  
  switch (field.type) {
    case 'number': {
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(numValue)) {
        return 0;
      }
      
      // Normalize based on max_points
      if (field.max_points && field.max_points > 0) {
        return Math.min(100, Math.max(0, (numValue / field.max_points) * 100));
      }
      
      // If no max_points, assume value is already a percentage
      return Math.min(100, Math.max(0, numValue));
    }
    
    case 'boolean': {
      const boolValue = typeof value === 'boolean' ? value : value === 'true' || value === true;
      
      if (boolValue) {
        return field.bool_true_points ?? 100;
      } else {
        return field.bool_false_points ?? 0;
      }
    }
    
    case 'text': {
      const textValue = String(value).trim();
      
      // Check text_score_map for matching value
      if (field.text_score_map && textValue in field.text_score_map) {
        const mappedScore = field.text_score_map[textValue];
        
        // If max_points is defined, normalize the mapped score
        if (field.max_points && field.max_points > 0) {
          return Math.min(100, Math.max(0, (mappedScore / field.max_points) * 100));
        }
        
        // Otherwise assume mapped score is already a percentage
        return Math.min(100, Math.max(0, mappedScore));
      }
      
      // No mapping found
      return 0;
    }
    
    default:
      return 0;
  }
}

/**
 * Calculate extra component score from extra fields
 * 
 * @param extraData - Map of field key to raw value
 * @param fields - Array of extra field definitions
 * @returns Extra component calculation result
 * 
 * Requirements: 5.5, 5.6, 5.7
 */
export function calculateExtraComponent(
  extraData: Record<string, any>,
  fields: ExtraField[]
): ExtraComponentResult {
  // Filter to only fields included in pass calculation
  const includedFields = fields.filter(field => field.include_in_pass);
  
  // Calculate total weight
  const totalWeight = includedFields.reduce(
    (sum, field) => sum + (field.pass_weight ?? 0),
    0
  );
  
  // Build details array with normalized scores and weighted contributions
  const details = includedFields.map(field => {
    const rawValue = extraData[field.key] ?? null;
    const normalizedScore = normalizeExtraFieldValue(rawValue, field);
    const weight = field.pass_weight ?? 0;
    const weightedContribution = totalWeight > 0 
      ? (normalizedScore * weight) / totalWeight 
      : 0;
    
    return {
      field_key: field.key,
      field_label: field.label,
      raw_value: rawValue,
      normalized_score: normalizedScore,
      weight,
      weighted_contribution: weightedContribution,
    };
  });
  
  // Calculate component score as weighted sum
  const componentScore = details.reduce(
    (sum, detail) => sum + detail.weighted_contribution,
    0
  );
  
  return {
    score: componentScore,
    total_weight: totalWeight,
    details,
  };
}

/**
 * Calculate final score with pass/fail determination
 * 
 * @param examComponent - Exam component calculation result
 * @param extraComponent - Extra component calculation result
 * @param settings - Application settings for calculation
 * @returns Complete calculation result with pass/fail status
 * 
 * Requirements: 5.7, 5.8, 5.9
 */
export function calculateFinalScore(
  examComponent: ExamComponentResult,
  extraComponent: ExtraComponentResult,
  settings: AppSettings
): CalculationResult {
  // Calculate final score as weighted combination
  const examWeight = settings.result_exam_weight;
  const extraWeight = 1 - examWeight;
  
  const finalScore = 
    (examComponent.score * examWeight) + 
    (extraComponent.score * extraWeight);
  
  // Determine pass/fail status
  let passed = finalScore >= settings.result_overall_pass_threshold;
  let failedDueToExam = false;
  
  // Check fail_on_any_exam requirement
  if (settings.result_fail_on_any_exam) {
    const hasFailedExam = examComponent.details.some(
      detail => detail.score !== null && !detail.passed
    );
    
    if (hasFailedExam) {
      passed = false;
      failedDueToExam = true;
    }
  }
  
  return {
    exam_component: examComponent,
    extra_component: extraComponent,
    final_score: finalScore,
    passed,
    failed_due_to_exam: failedDueToExam,
    pass_threshold: settings.result_overall_pass_threshold,
  };
}
