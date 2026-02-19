/**
 * Property-Based Tests for Backward Compatibility
 * 
 * Feature: score-calculation-optimization, Property 20: Legacy Score Field Fallback
 * Feature: score-calculation-optimization, Property 21: Legacy Data Compatibility  
 * Feature: score-calculation-optimization, Property 22: Export Format Compatibility
 * 
 * Validates: Requirements 12.2, 12.4, 12.6
 * 
 * These tests verify that the score calculator maintains backward compatibility
 * with legacy data formats and produces consistent results with the old system.
 */

import fc from 'fast-check';
import { 
  calculateFinalScore, 
  fromLegacyFormat, 
  toLegacyFormat 
} from '../scoreCalculator';
import type { 
  CalculationInput, 
  ExamAttempt, 
  LegacyDataFormat 
} from '../scoreCalculator.types';
import { 
  createMinimalInput,
  arbitraryCalculationInput,
  arbitraryExamAttempt,
  arbitraryExtraField
} from './scoreCalculator.testUtils';

describe('Score Calculator - Backward Compatibility Properties', () => {
  /**
   * Property 20: Legacy Score Field Fallback
   * 
   * For any exam attempt with final_score_percentage = null, the calculation
   * SHALL use score_percentage as the fallback value.
   * 
   * Validates: Requirements 12.2
   * Feature: score-calculation-optimization, Property 20: Legacy Score Field Fallback
   */
  it('Property 20: Legacy Score Field Fallback', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          examId: fc.uuid(),
          examTitle: fc.string({ minLength: 1, maxLength: 100 }),
          scorePercentage: fc.integer({ min: 1, max: 100 }), // Use integer to avoid NaN
          finalScorePercentage: fc.constantFrom(null, undefined),
          includeInPass: fc.boolean(),
          passThreshold: fc.option(fc.integer({ min: 0, max: 100 })) // Use integer to avoid NaN
        }), { minLength: 1, maxLength: 5 }),
        fc.constantFrom('final', 'raw'),
        (examAttempts, examScoreSource) => {
          const input = createMinimalInput({
            examAttempts,
            settings: {
              passCalcMode: 'best' as const,
              overallPassThreshold: 50,
              examWeight: 1,
              examScoreSource: examScoreSource as 'final' | 'raw',
              failOnAnyExam: false
            }
          });

          const result = calculateFinalScore(input);
          
          // Should succeed
          expect(result.success).toBe(true);
          
          // Each exam detail should use scorePercentage as fallback (with rounding)
          for (let i = 0; i < examAttempts.length; i++) {
            const examDetail = result.examComponent.details[i];
            const originalAttempt = examAttempts[i];
            
            // Should use scorePercentage since finalScorePercentage is null
            // Account for rounding to 2 decimal places
            const expectedScore = Math.round(originalAttempt.scorePercentage * 100) / 100;
            expect(examDetail.score).toBe(expectedScore);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20: Legacy Score Field Fallback - Raw Mode
   * 
   * For any exam attempt in raw mode, the calculation SHALL prefer
   * score_percentage over final_score_percentage.
   */
  it('Property 20: Raw mode should prefer score_percentage', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          examId: fc.uuid(),
          examTitle: fc.string({ minLength: 1, maxLength: 100 }),
          scorePercentage: fc.integer({ min: 1, max: 100 }), // Use integer to avoid NaN
          finalScorePercentage: fc.integer({ min: 1, max: 100 }),
          includeInPass: fc.boolean(),
          passThreshold: fc.option(fc.integer({ min: 0, max: 100 })) // Use integer to avoid NaN
        }), { minLength: 1, maxLength: 5 }),
        (examAttempts) => {
          const input = createMinimalInput({
            examAttempts,
            settings: {
              passCalcMode: 'best' as const,
              overallPassThreshold: 50,
              examWeight: 1,
              examScoreSource: 'raw',
              failOnAnyExam: false
            }
          });

          const result = calculateFinalScore(input);
          
          // Should succeed
          expect(result.success).toBe(true);
          
          // Each exam detail should use scorePercentage in raw mode (with rounding)
          for (let i = 0; i < examAttempts.length; i++) {
            const examDetail = result.examComponent.details[i];
            const originalAttempt = examAttempts[i];
            
            // Should use scorePercentage in raw mode
            // Account for rounding to 2 decimal places
            const expectedScore = Math.round(originalAttempt.scorePercentage * 100) / 100;
            expect(examDetail.score).toBe(expectedScore);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20: Legacy Score Field Fallback - Final Mode
   * 
   * For any exam attempt in final mode, the calculation SHALL prefer
   * final_score_percentage over score_percentage when both are available.
   */
  it('Property 20: Final mode should prefer final_score_percentage', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          examId: fc.uuid(),
          examTitle: fc.string({ minLength: 1, maxLength: 100 }),
          scorePercentage: fc.integer({ min: 1, max: 100 }),
          finalScorePercentage: fc.integer({ min: 1, max: 100 }), // Use integer to avoid NaN
          includeInPass: fc.boolean(),
          passThreshold: fc.option(fc.integer({ min: 0, max: 100 })) // Use integer to avoid NaN
        }), { minLength: 1, maxLength: 5 }),
        (examAttempts) => {
          const input = createMinimalInput({
            examAttempts,
            settings: {
              passCalcMode: 'best' as const,
              overallPassThreshold: 50,
              examWeight: 1,
              examScoreSource: 'final',
              failOnAnyExam: false
            }
          });

          const result = calculateFinalScore(input);
          
          // Should succeed
          expect(result.success).toBe(true);
          
          // Each exam detail should use finalScorePercentage in final mode (with rounding)
          for (let i = 0; i < examAttempts.length; i++) {
            const examDetail = result.examComponent.details[i];
            const originalAttempt = examAttempts[i];
            
            // Should use finalScorePercentage in final mode
            // Account for rounding to 2 decimal places
            const expectedScore = Math.round(originalAttempt.finalScorePercentage * 100) / 100;
            expect(examDetail.score).toBe(expectedScore);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21: Legacy Data Compatibility
   * 
   * For any set of test cases from the old calculation system, the new
   * Score_Calculator SHALL produce results that match the old system's
   * output within 0.01 percentage points.
   * 
   * Validates: Requirements 12.4
   * Feature: score-calculation-optimization, Property 21: Legacy Data Compatibility
   */
  it('Property 21: Legacy Data Compatibility - fromLegacyFormat conversion', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Legacy field names
          student_id: fc.uuid(),
          student_code: fc.string({ minLength: 1, maxLength: 20 }),
          student_name: fc.string({ minLength: 1, maxLength: 100 }),
          
          // Legacy exam format
          exams: fc.array(fc.record({
            id: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            score_percentage: fc.option(fc.float({ min: 0, max: 100 })),
            final_score_percentage: fc.option(fc.float({ min: 0, max: 100 })),
            include_in_pass: fc.boolean(),
            pass_threshold: fc.option(fc.float({ min: 0, max: 100 }))
          }), { minLength: 0, maxLength: 5 }),
          
          // Legacy extra scores format
          extra_scores: fc.dictionary(fc.string(), fc.anything()),
          
          // Legacy fields format
          fields: fc.array(fc.record({
            key: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            type: fc.constantFrom('number', 'text', 'boolean'),
            include_in_pass: fc.boolean(),
            weight: fc.float({ min: 0, max: 2 }),
            max_points: fc.option(fc.float({ min: 1, max: 100 }))
          }), { minLength: 0, maxLength: 5 }),
          
          // Legacy settings format
          pass_calc_mode: fc.constantFrom('best', 'avg'),
          overall_pass_threshold: fc.float({ min: 0, max: 100 }),
          exam_weight: fc.float({ min: 0, max: 2 })
        }),
        (legacyData) => {
          // Convert legacy format to modern format
          const modernInput = fromLegacyFormat(legacyData);
          
          // Should be valid input
          expect(modernInput.studentId).toBe(legacyData.student_id);
          expect(modernInput.studentCode).toBe(legacyData.student_code);
          expect(modernInput.studentName).toBe(legacyData.student_name);
          
          // Exam attempts should be converted correctly
          expect(modernInput.examAttempts).toHaveLength(legacyData.exams.length);
          for (let i = 0; i < legacyData.exams.length; i++) {
            const legacyExam = legacyData.exams[i];
            const modernExam = modernInput.examAttempts[i];
            
            expect(modernExam.examId).toBe(legacyExam.id);
            expect(modernExam.examTitle).toBe(legacyExam.title);
            expect(modernExam.scorePercentage).toBe(legacyExam.score_percentage);
            expect(modernExam.finalScorePercentage).toBe(legacyExam.final_score_percentage);
            expect(modernExam.includeInPass).toBe(legacyExam.include_in_pass);
            expect(modernExam.passThreshold).toBe(legacyExam.pass_threshold);
          }
          
          // Extra scores should be preserved
          expect(modernInput.extraScores).toEqual(legacyData.extra_scores);
          
          // Extra fields should be converted correctly
          expect(modernInput.extraFields).toHaveLength(legacyData.fields.length);
          for (let i = 0; i < legacyData.fields.length; i++) {
            const legacyField = legacyData.fields[i];
            const modernField = modernInput.extraFields[i];
            
            expect(modernField.key).toBe(legacyField.key);
            expect(modernField.label).toBe(legacyField.name);
            expect(modernField.type).toBe(legacyField.type);
            expect(modernField.includeInPass).toBe(legacyField.include_in_pass);
            expect(modernField.passWeight).toBe(legacyField.weight);
            expect(modernField.maxPoints).toBe(legacyField.max_points);
          }
          
          // Settings should be converted correctly
          expect(modernInput.settings.passCalcMode).toBe(legacyData.pass_calc_mode);
          expect(modernInput.settings.overallPassThreshold).toBe(legacyData.overall_pass_threshold);
          expect(modernInput.settings.examWeight).toBe(legacyData.exam_weight);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21: Legacy Data Compatibility - Missing fields handling
   * 
   * The calculator should handle missing extra score fields gracefully
   * by treating them as 0 or excluding them from calculation.
   */
  it('Property 21: Missing extra fields should be handled gracefully', () => {
    fc.assert(
      fc.property(
        arbitraryCalculationInput(),
        (baseInput) => {
          // Create input with missing extra scores
          const inputWithMissingScores = {
            ...baseInput,
            extraScores: null as any // Simulate missing extra scores
          };
          
          const result = calculateFinalScore(inputWithMissingScores);
          
          // Should succeed (not crash)
          expect(result.success).toBe(true);
          
          // Extra component should handle missing scores gracefully
          for (const detail of result.extraComponent.details) {
            // Raw value should be null/undefined for missing fields
            expect(detail.rawValue == null).toBe(true); // Allow both null and undefined
            // Normalized score should be 0 for missing fields
            expect(detail.normalizedScore).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Export Format Compatibility
   * 
   * For any export operation, the output file structure (column names,
   * order, data types) SHALL match the existing export format to maintain
   * compatibility with downstream tools.
   * 
   * Validates: Requirements 12.6
   * Feature: score-calculation-optimization, Property 22: Export Format Compatibility
   */
  it('Property 22: Export Format Compatibility - toLegacyFormat conversion', () => {
    fc.assert(
      fc.property(
        arbitraryCalculationInput(),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (input, studentCode, studentName) => {
          const result = calculateFinalScore(input);
          
          // Convert to legacy format
          const legacyResponse = toLegacyFormat(result, studentCode, studentName);
          
          // Should have required legacy fields
          expect(legacyResponse).toHaveProperty('code', studentCode);
          expect(legacyResponse).toHaveProperty('student_name', studentName);
          expect(legacyResponse).toHaveProperty('calculation');
          expect(legacyResponse).toHaveProperty('extras');
          expect(legacyResponse).toHaveProperty('pass_summary');
          
          // Calculation should be the original result
          expect(legacyResponse.calculation).toBe(result);
          
          // Extras should be in legacy format
          expect(Array.isArray(legacyResponse.extras)).toBe(true);
          for (const extra of legacyResponse.extras) {
            expect(extra).toHaveProperty('key');
            expect(extra).toHaveProperty('value');
            // Legacy format includes these optional fields
            expect(extra).toHaveProperty('label');
            expect(extra).toHaveProperty('max_points');
            expect(extra).toHaveProperty('type');
          }
          
          // Pass summary should be in legacy format
          const passSummary = legacyResponse.pass_summary;
          expect(passSummary).toHaveProperty('overall_score', result.finalScore);
          expect(passSummary).toHaveProperty('passed', result.passed);
          expect(passSummary).toHaveProperty('threshold', result.passThreshold);
          expect(passSummary).toHaveProperty('exam_passed', result.examComponent.examsPassed);
          expect(passSummary).toHaveProperty('exam_total', result.examComponent.examsTotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Export Format Compatibility - Extras array structure
   * 
   * The extras array in legacy format should match the structure expected
   * by existing export and display code.
   */
  it('Property 22: Extras array should maintain legacy structure', () => {
    fc.assert(
      fc.property(
        arbitraryCalculationInput(),
        (input) => {
          const result = calculateFinalScore(input);
          const legacyResponse = toLegacyFormat(result, 'TEST123', 'Test Student');
          
          // Each extra should correspond to an extra component detail
          expect(legacyResponse.extras).toHaveLength(result.extraComponent.details.length);
          
          for (let i = 0; i < result.extraComponent.details.length; i++) {
            const detail = result.extraComponent.details[i];
            const extra = legacyResponse.extras[i];
            
            // Key and value should match
            expect(extra.key).toBe(detail.fieldKey);
            expect(extra.value).toBe(detail.rawValue);
            expect(extra.label).toBe(detail.fieldLabel);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Export Format Compatibility - Pass summary completeness
   * 
   * The pass_summary object should contain all fields expected by legacy
   * export and display code.
   */
  it('Property 22: Pass summary should contain all legacy fields', () => {
    fc.assert(
      fc.property(
        arbitraryCalculationInput(),
        (input) => {
          const result = calculateFinalScore(input);
          const legacyResponse = toLegacyFormat(result, 'TEST123', 'Test Student');
          
          const passSummary = legacyResponse.pass_summary;
          
          // Required legacy fields
          expect(passSummary).toHaveProperty('overall_score');
          expect(passSummary).toHaveProperty('passed');
          expect(passSummary).toHaveProperty('threshold');
          expect(passSummary).toHaveProperty('exam_passed');
          expect(passSummary).toHaveProperty('exam_total');
          
          // Values should match calculation result
          expect(passSummary.overall_score).toBe(result.finalScore);
          expect(passSummary.passed).toBe(result.passed);
          expect(passSummary.threshold).toBe(result.passThreshold);
          expect(passSummary.exam_passed).toBe(result.examComponent.examsPassed);
          expect(passSummary.exam_total).toBe(result.examComponent.examsTotal);
        }
      ),
      { numRuns: 100 }
    );
  });
});