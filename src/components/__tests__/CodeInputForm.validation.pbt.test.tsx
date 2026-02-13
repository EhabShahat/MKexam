/**
 * Property-Based Tests for Code Input Form Validation Consistency
 * Feature: student-experience-optimization, Property 3: Code Validation Consistency
 * Validates: Requirements 1.5, 9.1, 9.4, 9.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fc from 'fast-check';
import CodeInputForm from '@/components/CodeInputForm';
import { validateCodeFormat, type CodeFormatSettings } from '@/lib/codeGenerator';

// Mock the locale provider
vi.mock('@/components/public/PublicLocaleProvider', () => ({
  useStudentLocale: () => ({ locale: 'en', dir: 'ltr' }),
}));

// Mock the i18n function
vi.mock('@/i18n/student', () => ({
  t: (locale: string, key: string, params?: any) => {
    const translations: Record<string, string> = {
      'exam_code': 'Exam Code',
      'code_must_be_4_digits': 'Code must be 4 digits',
      'find_exams': 'Find Exams',
      'checking_code': 'Checking code...',
      'select_exam': 'Select Exam',
      'results_search_hint_code': 'Enter your exam code to find available exams',
    };
    return translations[key] || key;
  },
}));

// Mock fetch for code settings
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Property 3: Code Validation Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        code_length: 4,
        code_format: 'numeric',
        code_pattern: null,
        enable_multi_exam: true,
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 3: Code Validation Consistency
   * 
   * For any code input, the system should validate format before making API requests,
   * provide real-time feedback, and handle all supported code formats correctly.
   */
  it('Property 3: Code Validation Consistency - Format validation logic', async () => {
    // Feature: student-experience-optimization, Property 3: Code Validation Consistency
    await fc.assert(
      fc.property(
        fc.record({
          code_length: fc.integer({ min: 3, max: 8 }),
          code_format: fc.constantFrom('numeric', 'alphabetic', 'alphanumeric'),
          code_pattern: fc.constant(null),
          enable_multi_exam: fc.boolean(),
        }),
        fc.string({ minLength: 1, maxLength: 15 }),
        (settings: CodeFormatSettings, inputCode: string) => {
          // Test the validation logic directly - this is the core property
          const isValidFormat = validateCodeFormat(inputCode, settings);
          
          // Generate a valid code for comparison
          let validCode = '';
          switch (settings.code_format) {
            case 'numeric':
              validCode = '1'.repeat(settings.code_length);
              break;
            case 'alphabetic':
              validCode = 'A'.repeat(settings.code_length);
              break;
            case 'alphanumeric':
              validCode = 'A1'.repeat(Math.ceil(settings.code_length / 2)).substring(0, settings.code_length);
              break;
          }
          
          // Verify that our validation logic works correctly
          expect(validateCodeFormat(validCode, settings)).toBe(true);
          
          // Test validation consistency - same input should always give same result
          const result1 = validateCodeFormat(inputCode, settings);
          const result2 = validateCodeFormat(inputCode, settings);
          expect(result1).toBe(result2);
          
          // Test that validation follows format rules
          if (inputCode.length !== settings.code_length) {
            expect(isValidFormat).toBe(false);
          } else {
            switch (settings.code_format) {
              case 'numeric':
                expect(isValidFormat).toBe(/^\d+$/.test(inputCode));
                break;
              case 'alphabetic':
                expect(isValidFormat).toBe(/^[A-Z]+$/i.test(inputCode));
                break;
              case 'alphanumeric':
                expect(isValidFormat).toBe(/^[A-Z0-9]+$/i.test(inputCode));
                break;
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 3: Code Validation Consistency - Code normalization', async () => {
    // Feature: student-experience-optimization, Property 3: Code Validation Consistency
    
    // Test a simple case to verify component behavior
    const settings: CodeFormatSettings = {
      code_length: 4,
      code_format: 'alphanumeric',
      code_pattern: null,
      enable_multi_exam: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => settings,
    });

    const mockOnSubmit = vi.fn();
    const mockOnCodeChange = vi.fn();

    render(
      <CodeInputForm
        code=""
        onCodeChange={mockOnCodeChange}
        onSubmit={mockOnSubmit}
        showValidation={true}
      />
    );

    // Wait for component to load
    await waitFor(
      () => {
        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const input = screen.getByRole('textbox');
    
    // Test normalization with a simple case
    const testCode = 'abc1';
    fireEvent.change(input, { target: { value: testCode } });

    // Verify that onCodeChange was called with uppercase version
    await waitFor(
      () => {
        expect(mockOnCodeChange).toHaveBeenCalledWith(testCode.toUpperCase());
      },
      { timeout: 1000 }
    );
  });

  it('Property 3: Code Validation Consistency - Empty field handling', async () => {
    // Feature: student-experience-optimization, Property 3: Code Validation Consistency
    const settings: CodeFormatSettings = {
      code_length: 4,
      code_format: 'numeric',
      code_pattern: null,
      enable_multi_exam: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => settings,
    });

    const mockOnSubmit = vi.fn();
    const mockOnCodeChange = vi.fn();

    render(
      <CodeInputForm
        code=""
        onCodeChange={mockOnCodeChange}
        onSubmit={mockOnSubmit}
        showValidation={true}
      />
    );

    // Wait for component to load
    await waitFor(
      () => {
        const submitButton = screen.getByRole('button', { name: /find exams/i });
        expect(submitButton).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const submitButton = screen.getByRole('button', { name: /find exams/i });

    // Empty field should disable submit button
    expect(submitButton).toBeDisabled();

    // Clicking disabled button should not call onSubmit
    fireEvent.click(submitButton);
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('Property 3: Code Validation Consistency - Validation logic correctness', async () => {
    // Feature: student-experience-optimization, Property 3: Code Validation Consistency
    await fc.assert(
      fc.property(
        fc.record({
          code_length: fc.integer({ min: 1, max: 10 }),
          code_format: fc.constantFrom('numeric', 'alphabetic', 'alphanumeric'),
          code_pattern: fc.constant(null),
          enable_multi_exam: fc.boolean(),
        }),
        fc.string({ minLength: 0, maxLength: 15 }),
        (settings: CodeFormatSettings, code: string) => {
          const result = validateCodeFormat(code, settings);
          
          // Test basic validation rules
          if (code.length !== settings.code_length) {
            expect(result).toBe(false);
            return;
          }

          switch (settings.code_format) {
            case 'numeric':
              expect(result).toBe(/^\d+$/.test(code));
              break;
            case 'alphabetic':
              expect(result).toBe(/^[A-Z]+$/i.test(code));
              break;
            case 'alphanumeric':
              expect(result).toBe(/^[A-Z0-9]+$/i.test(code));
              break;
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});