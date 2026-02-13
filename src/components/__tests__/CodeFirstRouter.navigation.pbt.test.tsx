/**
 * Property-Based Tests for CodeFirstRouter Navigation Logic
 * Feature: student-experience-optimization, Property 2: Navigation Flow Consistency
 * Validates: Requirements 1.1, 1.2, 3.1
 */

import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import CodeFirstRouter from '@/components/CodeFirstRouter';
import * as useStudentCodeModule from '@/hooks/useStudentCode';

// Mock the useStudentCode hook
const mockUseStudentCode = vi.fn();
vi.mock('@/hooks/useStudentCode', () => ({
  useStudentCode: () => mockUseStudentCode(),
}));

// Mock the child components
vi.mock('@/components/public/MultiExamEntry', () => ({
  default: () => <div data-testid="multi-exam-entry">Code Input Interface</div>,
}));

vi.mock('@/components/public/PublicHome', () => ({
  default: (props: any) => (
    <div data-testid="public-home">
      Main Page - Mode: {props.mode}
      {props.currentCode && <div data-testid="current-code">{props.currentCode}</div>}
    </div>
  ),
}));

// Mock PublicLocaleProvider
vi.mock('@/components/public/PublicLocaleProvider', () => ({
  useStudentLocale: () => ({ locale: 'en', dir: 'ltr' }),
}));

describe('CodeFirstRouter Navigation Logic Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /**
   * Property 2: Navigation Flow Consistency
   * For any student visiting the application, if they have a valid stored code 
   * they should bypass code input and go directly to the main page, otherwise 
   * they should be redirected to code input first.
   */
  it('Property 2: Navigation Flow Consistency - Valid code bypasses input', () => {
    fc.assert(
      fc.property(
        // Generate valid student codes
        fc.record({
          storedCode: fc.string({ minLength: 3, maxLength: 10 }).filter(s => s.trim().length > 0),
          mode: fc.constantFrom('exam', 'results'),
          showExams: fc.boolean(),
          showResults: fc.boolean(),
          showRegister: fc.boolean(),
        }),
        ({ storedCode, mode, showExams, showResults, showRegister }) => {
          // Setup mock to return valid stored code
          mockUseStudentCode.mockReturnValue({
            storedCode,
            isValidating: false,
            hasValidCode: true,
            validateAndRedirect: vi.fn().mockResolvedValue(true),
            clearCode: vi.fn(),
          });

          render(
            <CodeFirstRouter
              mode={mode}
              disabledMessage={null}
              showExams={showExams}
              showResults={showResults}
              showRegister={showRegister}
            />
          );

          // Should show main page with enhanced features
          expect(screen.getByTestId('public-home')).toBeInTheDocument();
          expect(screen.getByText(`Main Page - Mode: ${mode}`)).toBeInTheDocument();
          expect(screen.queryByTestId('multi-exam-entry')).not.toBeInTheDocument();
          
          cleanup();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 2: Navigation Flow Consistency - No valid code shows input', () => {
    fc.assert(
      fc.property(
        // Generate scenarios with no valid code
        fc.record({
          storedCode: fc.oneof(
            fc.constant(null),
            fc.constant(''),
            fc.string({ minLength: 1, maxLength: 10 })
          ),
          mode: fc.constantFrom('exam', 'results'),
          showExams: fc.boolean(),
          showResults: fc.boolean(),
          showRegister: fc.boolean(),
        }),
        ({ storedCode, mode, showExams, showResults, showRegister }) => {
          // Setup mock to return invalid/no stored code
          mockUseStudentCode.mockReturnValue({
            storedCode,
            isValidating: false,
            hasValidCode: false,
            validateAndRedirect: vi.fn().mockResolvedValue(false),
            clearCode: vi.fn(),
          });

          render(
            <CodeFirstRouter
              mode={mode}
              disabledMessage={null}
              showExams={showExams}
              showResults={showResults}
              showRegister={showRegister}
            />
          );

          // Should show code input interface
          expect(screen.getByTestId('multi-exam-entry')).toBeInTheDocument();
          expect(screen.queryByTestId('public-home')).not.toBeInTheDocument();
          
          cleanup();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 2: Navigation Flow Consistency - Disabled mode always shows main page', () => {
    fc.assert(
      fc.property(
        // Generate various code states but always disabled mode
        fc.record({
          storedCode: fc.oneof(
            fc.constant(null),
            fc.string({ minLength: 1, maxLength: 10 })
          ),
          hasValidCode: fc.boolean(),
          disabledMessage: fc.oneof(
            fc.constant(null),
            fc.string({ minLength: 5, maxLength: 50 })
          ),
          showExams: fc.boolean(),
          showResults: fc.boolean(),
          showRegister: fc.boolean(),
        }),
        ({ storedCode, hasValidCode, disabledMessage, showExams, showResults, showRegister }) => {
          // Setup mock with any code state
          mockUseStudentCode.mockReturnValue({
            storedCode,
            isValidating: false,
            hasValidCode,
            validateAndRedirect: vi.fn().mockResolvedValue(hasValidCode),
            clearCode: vi.fn(),
          });

          render(
            <CodeFirstRouter
              mode="disabled"
              disabledMessage={disabledMessage}
              showExams={showExams}
              showResults={showResults}
              showRegister={showRegister}
            />
          );

          // Disabled mode should always show main page regardless of code state
          expect(screen.getByTestId('public-home')).toBeInTheDocument();
          expect(screen.getByText('Main Page - Mode: disabled')).toBeInTheDocument();
          expect(screen.queryByTestId('multi-exam-entry')).not.toBeInTheDocument();
          
          cleanup();
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 2: Navigation Flow Consistency - Loading state consistency', () => {
    fc.assert(
      fc.property(
        // Generate loading scenarios
        fc.record({
          storedCode: fc.oneof(
            fc.constant(null),
            fc.string({ minLength: 3, maxLength: 10 })
          ),
          hasValidCode: fc.boolean(),
          mode: fc.constantFrom('exam', 'results'),
        }),
        ({ storedCode, hasValidCode, mode }) => {
          // Setup mock in validating state
          mockUseStudentCode.mockReturnValue({
            storedCode,
            isValidating: true,
            hasValidCode,
            validateAndRedirect: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
            clearCode: vi.fn(),
          });

          render(
            <CodeFirstRouter
              mode={mode}
              disabledMessage={null}
              showExams={true}
              showResults={true}
              showRegister={false}
            />
          );

          // Should always show loading state when validating
          expect(screen.getByText('Checking your access...')).toBeInTheDocument();
          expect(screen.queryByTestId('public-home')).not.toBeInTheDocument();
          expect(screen.queryByTestId('multi-exam-entry')).not.toBeInTheDocument();
          
          cleanup();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('Property 2: Navigation Flow Consistency - Code state transitions', () => {
    fc.assert(
      fc.property(
        // Generate scenarios for state transitions
        fc.record({
          initialCode: fc.string({ minLength: 3, maxLength: 10 }).filter(s => s.trim().length > 0),
          mode: fc.constantFrom('exam', 'results'),
          showExams: fc.boolean(),
          showResults: fc.boolean(),
          showRegister: fc.boolean(),
        }),
        ({ initialCode, mode, showExams, showResults, showRegister }) => {
          // Test valid code state
          mockUseStudentCode.mockReturnValue({
            storedCode: initialCode,
            isValidating: false,
            hasValidCode: true,
            validateAndRedirect: vi.fn().mockResolvedValue(true),
            clearCode: vi.fn(),
          });

          const { unmount } = render(
            <CodeFirstRouter
              mode={mode}
              disabledMessage={null}
              showExams={showExams}
              showResults={showResults}
              showRegister={showRegister}
            />
          );

          // Should show main page with valid code
          expect(screen.getByTestId('public-home')).toBeInTheDocument();
          expect(screen.queryByTestId('multi-exam-entry')).not.toBeInTheDocument();
          
          unmount();
          
          // Test invalid code state
          mockUseStudentCode.mockReturnValue({
            storedCode: null,
            isValidating: false,
            hasValidCode: false,
            validateAndRedirect: vi.fn().mockResolvedValue(false),
            clearCode: vi.fn(),
          });
          
          render(
            <CodeFirstRouter
              mode={mode}
              disabledMessage={null}
              showExams={showExams}
              showResults={showResults}
              showRegister={showRegister}
            />
          );

          // Should now show code input
          expect(screen.getByTestId('multi-exam-entry')).toBeInTheDocument();
          expect(screen.queryByTestId('public-home')).not.toBeInTheDocument();
          
          cleanup();
        }
      ),
      { numRuns: 15 }
    );
  });

  it('Property 2: Navigation Flow Consistency - Props are passed correctly', () => {
    fc.assert(
      fc.property(
        // Generate various prop combinations
        fc.record({
          mode: fc.constantFrom('exam', 'results', 'disabled'),
          disabledMessage: fc.oneof(
            fc.constant(null),
            fc.string({ minLength: 5, maxLength: 50 })
          ),
          showExams: fc.boolean(),
          showResults: fc.boolean(),
          showRegister: fc.boolean(),
          hasValidCode: fc.boolean(),
          storedCode: fc.oneof(
            fc.constant(null),
            fc.string({ minLength: 3, maxLength: 10 }).filter(s => s.trim().length > 0)
          ),
        }),
        ({ mode, disabledMessage, showExams, showResults, showRegister, hasValidCode, storedCode }) => {
          // Setup mock - CodeFirstRouter requires BOTH hasValidCode AND storedCode to show main page
          const actuallyHasValidCode = hasValidCode && storedCode && storedCode.trim().length > 0;
          
          mockUseStudentCode.mockReturnValue({
            storedCode: storedCode,
            isValidating: false,
            hasValidCode: actuallyHasValidCode,
            validateAndRedirect: vi.fn().mockResolvedValue(actuallyHasValidCode),
            clearCode: vi.fn(),
          });

          const { container } = render(
            <CodeFirstRouter
              mode={mode}
              disabledMessage={disabledMessage}
              showExams={showExams}
              showResults={showResults}
              showRegister={showRegister}
            />
          );

          if (mode === 'disabled') {
            // Disabled mode always shows PublicHome regardless of code state
            const publicHome = container.querySelector('[data-testid="public-home"]');
            expect(publicHome).toBeInTheDocument();
            expect(publicHome).toHaveTextContent(`Main Page - Mode: disabled`);
          } else if (actuallyHasValidCode && storedCode) {
            // Valid code with actual stored code shows enhanced PublicHome
            const publicHome = container.querySelector('[data-testid="public-home"]');
            expect(publicHome).toBeInTheDocument();
            expect(publicHome).toHaveTextContent(`Main Page - Mode: ${mode}`);
            
            // The code is displayed in the EnhancedPublicHome component
            expect(container).toHaveTextContent(storedCode);
          } else {
            // No valid code or no stored code shows MultiExamEntry
            const multiExamEntry = container.querySelector('[data-testid="multi-exam-entry"]');
            expect(multiExamEntry).toBeInTheDocument();
          }
          
          cleanup();
        }
      ),
      { numRuns: 10 }
    );
  });
});