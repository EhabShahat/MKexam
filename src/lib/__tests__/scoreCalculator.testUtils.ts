/**
 * Test utilities and arbitrary generators for property-based testing
 * of the Score Calculator module using fast-check
 */

import fc from 'fast-check';
import type {
  CalculationSettings,
  ExtraField,
  ExamAttempt,
  ExtraScoreData,
  CalculationInput,
} from '../scoreCalculator.types';

/**
 * Arbitrary generator for calculation settings
 */
export const arbitraryCalculationSettings = (): fc.Arbitrary<CalculationSettings> =>
  fc.record({
    passCalcMode: fc.constantFrom('best' as const, 'avg' as const),
    overallPassThreshold: fc.float({ min: 0, max: 100, noNaN: true }),
    examWeight: fc.float({ min: 0, max: 2, noNaN: true }),
    examScoreSource: fc.constantFrom('final' as const, 'raw' as const),
    failOnAnyExam: fc.boolean(),
  });

/**
 * Arbitrary generator for exam attempts
 */
export const arbitraryExamAttempt = (): fc.Arbitrary<ExamAttempt> =>
  fc.record({
    examId: fc.uuid(),
    examTitle: fc.string({ minLength: 1, maxLength: 100 }),
    scorePercentage: fc.option(fc.float({ min: 0, max: 100, noNaN: true })),
    finalScorePercentage: fc.option(fc.float({ min: 0, max: 100, noNaN: true })),
    includeInPass: fc.boolean(),
    passThreshold: fc.option(fc.float({ min: 0, max: 100, noNaN: true })),
  });

/**
 * Arbitrary generator for extra fields
 */
export const arbitraryExtraField = (): fc.Arbitrary<ExtraField> =>
  fc.record({
    key: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
    label: fc.string({ minLength: 1, maxLength: 100 }),
    type: fc.constantFrom('number' as const, 'text' as const, 'boolean' as const),
    includeInPass: fc.boolean(),
    passWeight: fc.float({ min: 0, max: 2, noNaN: true }),
    maxPoints: fc.option(fc.float({ min: 1, max: 100, noNaN: true })),
    boolTruePoints: fc.option(fc.float({ min: 0, max: 100, noNaN: true })),
    boolFalsePoints: fc.option(fc.float({ min: 0, max: 100, noNaN: true })),
    textScoreMap: fc.option(
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.float({ min: 0, max: 100, noNaN: true })
      )
    ),
  });

/**
 * Arbitrary generator for extra score data
 * Generates a dictionary with various value types
 */
export const arbitraryExtraScoreData = (fields?: ExtraField[]): fc.Arbitrary<ExtraScoreData> => {
  if (fields && fields.length > 0) {
    // Generate data matching the provided fields
    const generators: Record<string, fc.Arbitrary<any>> = {};
    
    for (const field of fields) {
      switch (field.type) {
        case 'number':
          generators[field.key] = fc.option(
            fc.float({ min: 0, max: field.maxPoints || 100, noNaN: true })
          );
          break;
        case 'boolean':
          generators[field.key] = fc.option(fc.boolean());
          break;
        case 'text':
          if (field.textScoreMap && Object.keys(field.textScoreMap).length > 0) {
            generators[field.key] = fc.option(
              fc.constantFrom(...Object.keys(field.textScoreMap))
            );
          } else {
            generators[field.key] = fc.option(fc.string({ maxLength: 50 }));
          }
          break;
      }
    }
    
    return fc.record(generators);
  }
  
  // Generate arbitrary data without field constraints
  return fc.dictionary(
    fc.string({ minLength: 1, maxLength: 50 }),
    fc.oneof(
      fc.float({ min: 0, max: 100, noNaN: true }),
      fc.boolean(),
      fc.string({ maxLength: 50 }),
      fc.constant(null)
    )
  );
};

/**
 * Arbitrary generator for complete calculation input
 */
export const arbitraryCalculationInput = (): fc.Arbitrary<CalculationInput> =>
  fc.record({
    studentId: fc.uuid(),
    studentCode: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    studentName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    examAttempts: fc.array(arbitraryExamAttempt(), { minLength: 0, maxLength: 10 }),
    extraFields: fc.array(arbitraryExtraField(), { minLength: 0, maxLength: 10 }),
    settings: arbitraryCalculationSettings(),
  }).chain(partial => {
    // Generate extra scores that match the extra fields
    return fc.constant(partial).chain(p => 
      arbitraryExtraScoreData(p.extraFields).map(extraScores => ({
        ...p,
        extraScores,
      }))
    );
  });

/**
 * Arbitrary generator for valid calculation input (with at least one exam)
 */
export const arbitraryValidCalculationInput = (): fc.Arbitrary<CalculationInput> =>
  fc.record({
    studentId: fc.uuid(),
    studentCode: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    studentName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    examAttempts: fc.array(arbitraryExamAttempt(), { minLength: 1, maxLength: 10 }),
    extraFields: fc.array(arbitraryExtraField(), { minLength: 0, maxLength: 10 }),
    settings: arbitraryCalculationSettings(),
  }).chain(partial => {
    return fc.constant(partial).chain(p => 
      arbitraryExtraScoreData(p.extraFields).map(extraScores => ({
        ...p,
        extraScores,
      }))
    );
  });

/**
 * Arbitrary generator for invalid calculation input
 * Produces inputs with missing fields, wrong types, invalid values, etc.
 * Each branch MUST produce an input that will fail validation.
 */
export const arbitraryInvalidCalculationInput = (): fc.Arbitrary<any> =>
  fc.oneof(
    // Null or undefined
    fc.constant(null),
    fc.constant(undefined),
    
    // Wrong types (primitives instead of objects)
    fc.string(),
    fc.integer(),
    fc.boolean(),
    fc.constant([]),
    
    // Missing required field: studentId
    fc.record({
      // studentId is missing
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      settings: arbitraryCalculationSettings(),
    }),
    
    // Missing required field: studentCode
    fc.record({
      studentId: fc.uuid(),
      // studentCode is missing
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      settings: arbitraryCalculationSettings(),
    }),
    
    // Missing required field: settings
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      // settings is missing
    }),
    
    // Empty strings for required fields (will fail trim check)
    fc.record({
      studentId: fc.constant('   '), // Only whitespace
      studentCode: fc.constant('   '),
      studentName: fc.constant('   '),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      settings: arbitraryCalculationSettings(),
    }),
    
    // Wrong types for required fields
    fc.record({
      studentId: fc.integer(),
      studentCode: fc.boolean(),
      studentName: fc.constant([]),
      examAttempts: fc.string(),
      extraScores: fc.string(),
      extraFields: fc.constant(null),
      settings: fc.string(),
    }),
    
    // Invalid settings: wrong passCalcMode
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      settings: fc.record({
        passCalcMode: fc.constantFrom('invalid', 'wrong', 'bad'),
        overallPassThreshold: fc.float({ min: 0, max: 100, noNaN: true }),
        examWeight: fc.float({ min: 0, max: 2, noNaN: true }),
        examScoreSource: fc.constantFrom('final' as const, 'raw' as const),
        failOnAnyExam: fc.boolean(),
      }),
    }),
    
    // Invalid settings: negative threshold
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      settings: fc.record({
        passCalcMode: fc.constantFrom('best' as const, 'avg' as const),
        overallPassThreshold: fc.float({ min: Math.fround(-100), max: Math.fround(-1) }),
        examWeight: fc.float({ min: 0, max: 2, noNaN: true }),
        examScoreSource: fc.constantFrom('final' as const, 'raw' as const),
        failOnAnyExam: fc.boolean(),
      }),
    }),
    
    // Invalid settings: threshold > 100
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      settings: fc.record({
        passCalcMode: fc.constantFrom('best' as const, 'avg' as const),
        overallPassThreshold: fc.float({ min: Math.fround(101), max: Math.fround(200) }),
        examWeight: fc.float({ min: 0, max: 2, noNaN: true }),
        examScoreSource: fc.constantFrom('final' as const, 'raw' as const),
        failOnAnyExam: fc.boolean(),
      }),
    }),
    
    // Invalid settings: negative weight
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      settings: fc.record({
        passCalcMode: fc.constantFrom('best' as const, 'avg' as const),
        overallPassThreshold: fc.float({ min: 0, max: 100, noNaN: true }),
        examWeight: fc.float({ min: Math.fround(-2), max: Math.fround(-0.1) }),
        examScoreSource: fc.constantFrom('final' as const, 'raw' as const),
        failOnAnyExam: fc.boolean(),
      }),
    }),
    
    // Invalid settings: wrong examScoreSource
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      settings: fc.record({
        passCalcMode: fc.constantFrom('best' as const, 'avg' as const),
        overallPassThreshold: fc.float({ min: 0, max: 100, noNaN: true }),
        examWeight: fc.float({ min: 0, max: 2, noNaN: true }),
        examScoreSource: fc.constantFrom('invalid', 'wrong'),
        failOnAnyExam: fc.boolean(),
      }),
    }),
    
    // Invalid exam attempt: empty examId
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([
        {
          examId: '', // Empty examId - will fail validation
          examTitle: 'Test Exam',
          scorePercentage: null,
          finalScorePercentage: null,
          includeInPass: false,
          passThreshold: null,
        },
      ]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      settings: arbitraryCalculationSettings(),
    }),
    
    // Invalid exam attempt: NaN score
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([
        {
          examId: '00000000-0000-1000-8000-000000000000',
          examTitle: 'Test Exam',
          scorePercentage: NaN, // NaN score - will fail validation
          finalScorePercentage: null,
          includeInPass: false,
          passThreshold: null,
        },
      ]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      settings: arbitraryCalculationSettings(),
    }),
    
    // Invalid exam attempt: missing examTitle
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([
        {
          examId: '00000000-0000-1000-8000-000000000000',
          examTitle: '', // Empty title - will fail validation
          scorePercentage: null,
          finalScorePercentage: null,
          includeInPass: false,
          passThreshold: null,
        },
      ]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([]),
      settings: arbitraryCalculationSettings(),
    }),
    
    // Invalid extra field: empty key
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([
        {
          key: '', // Empty key - will fail validation
          label: 'Test Field',
          type: 'number',
          includeInPass: true,
          passWeight: 0.3,
          maxPoints: 100,
        },
      ]),
      settings: arbitraryCalculationSettings(),
    }),
    
    // Invalid extra field: wrong type
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([
        {
          key: 'test',
          label: 'Test Field',
          type: 'invalid', // Invalid type - will fail validation
          includeInPass: true,
          passWeight: 0.3,
          maxPoints: 100,
        },
      ]),
      settings: arbitraryCalculationSettings(),
    }),
    
    // Invalid extra field: negative weight
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([
        {
          key: 'test',
          label: 'Test Field',
          type: 'number',
          includeInPass: true,
          passWeight: -0.5, // Negative weight - will fail validation
          maxPoints: 100,
        },
      ]),
      settings: arbitraryCalculationSettings(),
    }),
    
    // Invalid extra field: zero maxPoints
    fc.record({
      studentId: fc.uuid(),
      studentCode: fc.string({ minLength: 1, maxLength: 20 }),
      studentName: fc.string({ minLength: 1, maxLength: 100 }),
      examAttempts: fc.constant([]),
      extraScores: fc.constant({}),
      extraFields: fc.constant([
        {
          key: 'test',
          label: 'Test Field',
          type: 'number',
          includeInPass: true,
          passWeight: 0.3,
          maxPoints: 0, // Zero maxPoints - will fail validation
        },
      ]),
      settings: arbitraryCalculationSettings(),
    })
  );

/**
 * Helper function to create a minimal valid calculation input for testing
 */
export const createMinimalInput = (overrides?: Partial<CalculationInput>): CalculationInput => ({
  studentId: '00000000-0000-0000-0000-000000000001',
  studentCode: 'TEST001',
  studentName: 'Test Student',
  examAttempts: [],
  extraScores: {},
  extraFields: [],
  settings: {
    passCalcMode: 'best',
    overallPassThreshold: 50,
    examWeight: 0.7,
    examScoreSource: 'final',
    failOnAnyExam: false,
  },
  ...overrides,
});

/**
 * Helper function to create a calculation input with specific exam scores
 */
export const createInputWithExams = (
  scores: number[],
  mode: 'best' | 'avg' = 'best'
): CalculationInput => ({
  ...createMinimalInput(),
  examAttempts: scores.map((score, index) => ({
    examId: `exam-${index + 1}`,
    examTitle: `Exam ${index + 1}`,
    scorePercentage: score,
    finalScorePercentage: score,
    includeInPass: true,
    passThreshold: null,
  })),
  settings: {
    passCalcMode: mode,
    overallPassThreshold: 50,
    examWeight: 1.0,
    examScoreSource: 'final',
    failOnAnyExam: false,
  },
});

/**
 * Helper function to create a calculation input with extra fields
 */
export const createInputWithExtras = (
  extras: Array<{ key: string; value: number; weight: number; maxPoints?: number }>
): CalculationInput => ({
  ...createMinimalInput(),
  extraFields: extras.map(e => ({
    key: e.key,
    label: e.key,
    type: 'number' as const,
    includeInPass: true,
    passWeight: e.weight,
    maxPoints: e.maxPoints || null,
  })),
  extraScores: extras.reduce((acc, e) => ({ ...acc, [e.key]: e.value }), {}),
  settings: {
    passCalcMode: 'best',
    overallPassThreshold: 50,
    examWeight: 0,
    examScoreSource: 'final',
    failOnAnyExam: false,
  },
});
