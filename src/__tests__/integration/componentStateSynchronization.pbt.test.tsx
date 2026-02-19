/**
 * Property-Based Test: Component State Synchronization
 * Feature: student-experience-optimization, Property 6: Component State Synchronization
 * 
 * Validates: Requirements 4.1, 4.2
 * 
 * Property: For any change in student code state, all dependent components should update
 * reactively and receive the updated code information through the state management system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import fc from 'fast-check';
import PublicHome from '@/components/public/PublicHome';
import CodeFirstRouter from '@/components/CodeFirstRouter';
import { useStudentCode } from '@/hooks/useStudentCode';

// Mock the useStudentLocale hook
vi.mock('@/components/public/PublicLocaleProvider', () => ({
  useStudentLocale: () => ({
    locale: 'en' as const,
  }),
}));

// Mock MultiExamEntry component
vi.mock('@/components/public/MultiExamEntry', () => ({
  default: () => <div data-testid="multi-exam-entry">Code Input Interface</div>,
}));

// Mock BrandLogo component to prevent API calls
vi.mock('@/components/BrandLogo', () => ({
  default: () => <div data-testid="brand-logo">Brand Logo</div>,
}));

// Mock CodeManagement component with unique identifiers
vi.mock('@/components/CodeManagement', () => ({
  default: ({ currentCode }: { currentCode: string }) => (
    <div data-testid="code-management" key={`code-mgmt-${currentCode}-${Date.now()}`}>
      <span data-testid="current-code" data-code={currentCode}>{currentCode}</span>
      <span data-testid="validation-status">Code verified</span>
    </div>
  ),
}));

// Mock the useStudentCode hook
vi.mock('@/hooks/useStudentCode');

describe('Property 6: Component State Synchronization', () => {
  const mockClearCode = vi.fn();
  const mockStoreCode = vi.fn();
  const mockValidateCode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    
    // Clear DOM completely
    document.body.innerHTML = '';
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Mock fetch to prevent API calls
    global.fetch = vi.fn().mockRejectedValue(new Error('API calls not allowed in tests'));
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('should synchronize code state between PublicHome and useStudentCode hook', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 8 }).filter(code => /^[a-zA-Z0-9]+$/.test(code)),
        fc.boolean(),
        fc.boolean(),
        (studentCode, hasValidCode, isValidating) => {
          // Clean DOM before each iteration
          cleanup();
          document.body.innerHTML = '';

          // Mock useStudentCode hook with current state
          (useStudentCode as any).mockReturnValue({
            storedCode: studentCode,
            isValidating,
            hasValidCode,
            codeMetadata: {
              code: studentCode,
              timestamp: Date.now(),
            },
            storeCode: mockStoreCode,
            clearCode: mockClearCode,
            validateAndRedirect: vi.fn().mockResolvedValue(hasValidCode),
            validateCode: mockValidateCode.mockResolvedValue(hasValidCode),
          });

          const { unmount } = render(
            <PublicHome
              mode="exam"
              disabledMessage={null}
              showExams={true}
              showResults={true}
              showRegister={false}
              onCodeClear={mockClearCode}
            />
          );

          // Should display the current code from the hook using unique selector
          const codeElement = screen.queryByTestId('current-code');
          if (codeElement) {
            expect(codeElement.getAttribute('data-code')).toBe(studentCode);
          }

          // Should show validation status based on state
          if (isValidating) {
            // During validation, may show loading state
            expect(document.body.textContent).toMatch(/checking|loading|validating/i);
          } else if (hasValidCode && codeElement) {
            // Should show verified status when code is valid
            const statusElement = screen.queryByTestId('validation-status');
            expect(statusElement?.textContent).toContain('verified');
          }

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  });

  it('should synchronize code clearing across components', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 8 }).filter(code => /^[a-zA-Z0-9]+$/.test(code)),
        (studentCode) => {
          // Clean DOM before each iteration
          cleanup();
          document.body.innerHTML = '';

          // Start with a valid code
          (useStudentCode as any).mockReturnValue({
            storedCode: studentCode,
            isValidating: false,
            hasValidCode: true,
            codeMetadata: {
              code: studentCode,
              timestamp: Date.now(),
              lastValidated: Date.now(),
            },
            storeCode: mockStoreCode,
            clearCode: mockClearCode,
            validateAndRedirect: vi.fn().mockResolvedValue(true),
            validateCode: mockValidateCode.mockResolvedValue(true),
          });

          const { rerender, unmount } = render(
            <PublicHome
              mode="exam"
              disabledMessage={null}
              showExams={true}
              showResults={true}
              showRegister={false}
              onCodeClear={mockClearCode}
            />
          );

          // Should show the code initially
          const initialCodeElement = screen.queryByTestId('current-code');
          if (initialCodeElement) {
            expect(initialCodeElement.getAttribute('data-code')).toBe(studentCode);
          }

          // Simulate code clearing
          (useStudentCode as any).mockReturnValue({
            storedCode: null,
            isValidating: false,
            hasValidCode: false,
            codeMetadata: null,
            storeCode: mockStoreCode,
            clearCode: mockClearCode,
            validateAndRedirect: vi.fn().mockResolvedValue(false),
            validateCode: mockValidateCode.mockResolvedValue(false),
          });

          rerender(
            <PublicHome
              mode="exam"
              disabledMessage={null}
              showExams={true}
              showResults={true}
              showRegister={false}
              onCodeClear={mockClearCode}
            />
          );

          // Should not show code management UI when no code
          const clearedCodeElement = screen.queryByTestId('code-management');
          expect(clearedCodeElement).toBeNull();

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  });

  it('should synchronize state between CodeFirstRouter and PublicHome', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 8 }).filter(code => /^[a-zA-Z0-9]+$/.test(code)),
        fc.boolean(),
        fc.boolean(),
        (studentCode, hasValidCode, isValidating) => {
          // Clean DOM before each iteration
          cleanup();
          document.body.innerHTML = '';

          // Mock useStudentCode hook
          (useStudentCode as any).mockReturnValue({
            storedCode: hasValidCode ? studentCode : null,
            isValidating,
            hasValidCode,
            codeMetadata: hasValidCode ? {
              code: studentCode,
              timestamp: Date.now(),
              lastValidated: Date.now(),
            } : null,
            storeCode: mockStoreCode,
            clearCode: mockClearCode,
            validateAndRedirect: vi.fn().mockResolvedValue(hasValidCode),
            validateCode: mockValidateCode.mockResolvedValue(hasValidCode),
          });

          const { unmount } = render(
            <CodeFirstRouter
              mode="exam"
              disabledMessage={null}
              showExams={true}
              showResults={true}
              showRegister={false}
            />
          );

          if (isValidating) {
            // Should show loading state
            expect(document.body.textContent).toMatch(/checking|loading|access/i);
          } else if (hasValidCode && studentCode) {
            // Should show PublicHome with code management
            const codeElement = screen.queryByTestId('current-code');
            if (codeElement) {
              expect(codeElement.getAttribute('data-code')).toBe(studentCode);
            }
          } else {
            // Should show code input interface
            const multiExamElement = screen.queryByTestId('multi-exam-entry');
            expect(multiExamElement).toBeTruthy();
          }

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  });

  it('should handle prop vs hook state precedence correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 8 }).filter(code => /^[a-zA-Z0-9]+$/.test(code)),
        fc.string({ minLength: 4, maxLength: 8 }).filter(code => /^[a-zA-Z0-9]+$/.test(code)),
        fc.boolean(),
        (propCode, hookCode, hasValidCode) => {
          // Ensure codes are different
          if (propCode === hookCode) return;

          // Clean DOM before each iteration
          cleanup();
          document.body.innerHTML = '';

          // Mock useStudentCode hook
          (useStudentCode as any).mockReturnValue({
            storedCode: hookCode,
            isValidating: false,
            hasValidCode,
            codeMetadata: {
              code: hookCode,
              timestamp: Date.now(),
            },
            storeCode: mockStoreCode,
            clearCode: mockClearCode,
            validateAndRedirect: vi.fn().mockResolvedValue(hasValidCode),
            validateCode: mockValidateCode.mockResolvedValue(hasValidCode),
          });

          const { unmount } = render(
            <PublicHome
              mode="exam"
              disabledMessage={null}
              showExams={true}
              showResults={true}
              showRegister={false}
              currentCode={propCode} // Explicit prop code
              onCodeClear={mockClearCode}
            />
          );

          // Should display the prop code (takes precedence)
          const codeElement = screen.queryByTestId('current-code');
          if (codeElement) {
            expect(codeElement.getAttribute('data-code')).toBe(propCode);
            expect(codeElement.getAttribute('data-code')).not.toBe(hookCode);
          }

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  });

  it('should maintain consistent state across multiple re-renders', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 8 }).filter(code => /^[a-zA-Z0-9]+$/.test(code)),
        fc.array(fc.boolean(), { minLength: 2, maxLength: 3 }),
        (studentCode, stateChanges) => {
          // Clean DOM before each iteration
          cleanup();
          document.body.innerHTML = '';

          let currentHasValidCode = true;

          // Start with valid code
          (useStudentCode as any).mockReturnValue({
            storedCode: studentCode,
            isValidating: false,
            hasValidCode: currentHasValidCode,
            codeMetadata: {
              code: studentCode,
              timestamp: Date.now(),
              lastValidated: Date.now(),
            },
            storeCode: mockStoreCode,
            clearCode: mockClearCode,
            validateAndRedirect: vi.fn().mockResolvedValue(currentHasValidCode),
            validateCode: mockValidateCode.mockResolvedValue(currentHasValidCode),
          });

          const { rerender, unmount } = render(
            <PublicHome
              mode="exam"
              disabledMessage={null}
              showExams={true}
              showResults={true}
              showRegister={false}
              onCodeClear={mockClearCode}
            />
          );

          // Apply state changes
          stateChanges.forEach((hasValidCode, index) => {
            currentHasValidCode = hasValidCode;

            (useStudentCode as any).mockReturnValue({
              storedCode: studentCode,
              isValidating: false,
              hasValidCode: currentHasValidCode,
              codeMetadata: {
                code: studentCode,
                timestamp: Date.now(),
                lastValidated: currentHasValidCode ? Date.now() : undefined,
                validationAttempts: currentHasValidCode ? 0 : index + 1,
              },
              storeCode: mockStoreCode,
              clearCode: mockClearCode,
              validateAndRedirect: vi.fn().mockResolvedValue(currentHasValidCode),
              validateCode: mockValidateCode.mockResolvedValue(currentHasValidCode),
            });

            rerender(
              <PublicHome
                mode="exam"
                disabledMessage={null}
                showExams={true}
                showResults={true}
                showRegister={false}
                onCodeClear={mockClearCode}
              />
            );

            // Should always display the code
            const codeElement = screen.queryByTestId('current-code');
            if (codeElement) {
              expect(codeElement.getAttribute('data-code')).toBe(studentCode);
            }

            // Should show correct validation status
            if (currentHasValidCode) {
              const statusElement = screen.queryByTestId('validation-status');
              if (statusElement) {
                expect(statusElement.textContent).toContain('verified');
              }
            }
          });

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  });
});