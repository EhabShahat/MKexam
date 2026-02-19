/**
 * Property-Based Test: Multi-User Device Support
 * Feature: student-experience-optimization, Property 11: Multi-User Device Support
 * 
 * Validates: Requirements 2.5, 3.2, 8.4
 * 
 * Property: For any device used by multiple students, the system should provide clear
 * mechanisms to change codes and handle code clearing with appropriate warnings.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import fc from 'fast-check';
import CodeManagement from '@/components/CodeManagement';
import PublicHome from '@/components/public/PublicHome';
import { useStudentCode } from '@/hooks/useStudentCode';

// Mock the useStudentLocale hook
vi.mock('@/components/public/PublicLocaleProvider', () => ({
  useStudentLocale: () => ({
    locale: 'en' as const,
  }),
}));

// Mock the useStudentCode hook
vi.mock('@/hooks/useStudentCode');

// Mock BrandLogo to prevent API calls in tests
vi.mock('@/components/BrandLogo', () => ({
  default: () => <div data-testid="brand-logo">Brand Logo</div>,
}));

// Mock i18n function to return predictable strings
vi.mock('@/i18n/student', () => ({
  t: (locale: string, key: string) => {
    const translations: Record<string, string> = {
      current_code: 'Current Code',
      manage: 'Manage',
      hide: 'Hide',
      clear_code: 'Clear Code',
      change_code: 'Change Code',
      code_management_help: 'Your code is stored locally in your browser. You can clear it anytime to enter a different code.',
      confirm_clear_code: 'Confirm Clear Code',
      clear_code_warning: 'This will remove your stored code and you\'ll need to enter it again.',
      cancel: 'Cancel',
      note: 'Note',
      code_management_note: 'Your code is stored locally in your browser for convenience. You can clear it anytime to enter a different code.',
      hide_code_management: 'Hide code management',
      show_code_management: 'Show code management',
      clear_stored_code: 'Clear stored code',
      change_to_different_code: 'Change to different code',
    };
    return translations[key] || key;
  },
}));

describe('Property 11: Multi-User Device Support', () => {
  const mockClearCode = vi.fn();
  const mockStoreCode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
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

    // Default mock implementation
    (useStudentCode as any).mockReturnValue({
      storedCode: null,
      isValidating: false,
      hasValidCode: false,
      codeMetadata: null,
      storeCode: mockStoreCode,
      clearCode: mockClearCode,
      validateAndRedirect: vi.fn().mockResolvedValue(true),
      validateCode: vi.fn().mockResolvedValue(true),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should provide clear code management interface for any valid student code', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 10 }).filter(code => code.trim().length >= 4 && /^[a-zA-Z0-9]+$/.test(code.trim())),
        fc.boolean(),
        (studentCode, compact) => {
          // Reset mocks for each iteration
          mockClearCode.mockClear();
          
          const { container, unmount } = render(
            <CodeManagement
              currentCode={studentCode}
              onClearCode={mockClearCode}
              onChangeCode={mockClearCode}
              compact={compact}
            />
          );

          // Should display the current code - use container queries for isolation with whitespace handling
          const codeElements = within(container).getAllByText((content, element) => {
            return content.trim() === studentCode.trim();
          });
          expect(codeElements.length).toBeGreaterThan(0);

          if (compact) {
            // In compact mode, should have manage button initially
            const manageButtons = within(container).getAllByRole('button', { name: /manage/i });
            expect(manageButtons.length).toBeGreaterThan(0);
            
            // Click to expand and show management options
            fireEvent.click(manageButtons[0]);
            
            // After expansion, should have clear and change buttons
            const clearButtons = within(container).getAllByText(/clear code/i);
            const changeButtons = within(container).getAllByText(/change code/i);
            expect(clearButtons.length).toBeGreaterThan(0);
            expect(changeButtons.length).toBeGreaterThan(0);
          } else {
            // In full mode, should have clear and change buttons directly
            const clearButtons = within(container).getAllByText(/clear code/i);
            const changeButtons = within(container).getAllByText(/change code/i);
            expect(clearButtons.length).toBeGreaterThan(0);
            expect(changeButtons.length).toBeGreaterThan(0);
          }

          // Component should render without errors
          expect(container).toBeTruthy();
          
          // Clean up to prevent DOM conflicts
          unmount();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should show confirmation dialog before clearing code for any student code', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 10 }).filter(code => code.trim().length >= 4 && /^[a-zA-Z0-9]+$/.test(code.trim())),
        (studentCode) => {
          // Reset mocks for each iteration
          mockClearCode.mockClear();
          
          const { container, unmount } = render(
            <CodeManagement
              currentCode={studentCode}
              onClearCode={mockClearCode}
              onChangeCode={mockClearCode}
              compact={false}
            />
          );

          // Click clear code button - find by text content
          const clearButtons = within(container).getAllByText(/clear code/i);
          expect(clearButtons.length).toBeGreaterThan(0);
          
          // Find the button element (not just text)
          const clearButton = clearButtons[0].closest('button');
          expect(clearButton).toBeTruthy();
          fireEvent.click(clearButton!);

          // Should show confirmation dialog
          const confirmTexts = within(container).getAllByText(/confirm clear code/i);
          expect(confirmTexts.length).toBeGreaterThan(0);
          
          const warningTexts = within(container).getAllByText(/this will remove your stored code/i);
          expect(warningTexts.length).toBeGreaterThan(0);

          // Should display the current code in confirmation - handle whitespace
          const codeInDialog = within(container).getAllByText((content, element) => {
            return content.trim() === studentCode.trim();
          });
          expect(codeInDialog.length).toBeGreaterThan(1); // Original + in dialog

          // Should have cancel button
          const cancelButtons = within(container).getAllByText(/cancel/i);
          expect(cancelButtons.length).toBeGreaterThan(0);

          // Should not have called clearCode yet
          expect(mockClearCode).not.toHaveBeenCalled();
          
          // Clean up
          unmount();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should allow canceling code clear operation for any student code', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 10 }).filter(code => code.trim().length >= 4 && /^[a-zA-Z0-9]+$/.test(code.trim())),
        (studentCode) => {
          // Reset mocks for each iteration
          mockClearCode.mockClear();
          
          const { container, unmount } = render(
            <CodeManagement
              currentCode={studentCode}
              onClearCode={mockClearCode}
              onChangeCode={mockClearCode}
              compact={false}
            />
          );

          // Click clear code button
          const clearButtons = within(container).getAllByText(/clear code/i);
          expect(clearButtons.length).toBeGreaterThan(0);
          
          const clearButton = clearButtons[0].closest('button');
          expect(clearButton).toBeTruthy();
          fireEvent.click(clearButton!);

          // Click cancel in confirmation dialog
          const cancelButtons = within(container).getAllByText(/cancel/i);
          expect(cancelButtons.length).toBeGreaterThan(0);
          
          const cancelButton = cancelButtons[0].closest('button');
          expect(cancelButton).toBeTruthy();
          fireEvent.click(cancelButton!);

          // Confirmation dialog should be closed - check that confirm text is gone
          const confirmTexts = within(container).queryAllByText(/confirm clear code/i);
          expect(confirmTexts.length).toBe(0);

          // Should not have called clearCode
          expect(mockClearCode).not.toHaveBeenCalled();

          // Original code should still be displayed - handle whitespace properly
          const codeElements = within(container).getAllByText((content, element) => {
            return content.trim() === studentCode.trim();
          });
          expect(codeElements.length).toBeGreaterThan(0);
          
          // Clean up
          unmount();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should execute code clear when confirmed for any student code', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 10 }).filter(code => code.trim().length >= 4 && /^[a-zA-Z0-9]+$/.test(code.trim())),
        (studentCode) => {
          // Reset mocks for each iteration
          mockClearCode.mockClear();
          
          const { container, unmount } = render(
            <CodeManagement
              currentCode={studentCode}
              onClearCode={mockClearCode}
              onChangeCode={mockClearCode}
              compact={false}
            />
          );

          // Click clear code button
          const clearButtons = within(container).getAllByText(/clear code/i);
          expect(clearButtons.length).toBeGreaterThan(0);
          
          const clearButton = clearButtons[0].closest('button');
          expect(clearButton).toBeTruthy();
          fireEvent.click(clearButton!);

          // Click confirm in confirmation dialog - find all clear code buttons after dialog opens
          const allClearButtons = within(container).getAllByText(/clear code/i);
          expect(allClearButtons.length).toBeGreaterThan(1); // Main + confirm button
          
          // Find the confirm button (should be in the modal)
          const confirmButton = allClearButtons.find(btn => {
            const buttonEl = btn.closest('button');
            return buttonEl && buttonEl.closest('.fixed'); // In modal
          });
          
          expect(confirmButton).toBeTruthy();
          const confirmButtonEl = confirmButton!.closest('button');
          fireEvent.click(confirmButtonEl!);

          // Should have called clearCode exactly once
          expect(mockClearCode).toHaveBeenCalledTimes(1);
          
          // Clean up
          unmount();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should handle compact mode toggle for any student code', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 10 }).filter(code => code.trim().length >= 4 && /^[a-zA-Z0-9]+$/.test(code.trim())),
        (studentCode) => {
          // Reset mocks for each iteration
          mockClearCode.mockClear();
          
          const { container, rerender, unmount } = render(
            <CodeManagement
              currentCode={studentCode}
              onClearCode={mockClearCode}
              onChangeCode={mockClearCode}
              compact={true}
            />
          );

          // In compact mode, should have manage button
          const manageButtons = within(container).getAllByText(/manage/i);
          expect(manageButtons.length).toBeGreaterThan(0);

          // Click the first manage button to expand
          const manageButton = manageButtons[0].closest('button');
          expect(manageButton).toBeTruthy();
          fireEvent.click(manageButton!);

          // Should show management options after expansion
          const clearButtons = within(container).getAllByText(/clear code/i);
          const changeButtons = within(container).getAllByText(/change code/i);
          expect(clearButtons.length).toBeGreaterThan(0);
          expect(changeButtons.length).toBeGreaterThan(0);

          // Rerender in full mode
          rerender(
            <CodeManagement
              currentCode={studentCode}
              onClearCode={mockClearCode}
              onChangeCode={mockClearCode}
              compact={false}
            />
          );

          // In full mode, should show all options directly
          const fullClearButtons = within(container).getAllByText(/clear code/i);
          const fullChangeButtons = within(container).getAllByText(/change code/i);
          expect(fullClearButtons.length).toBeGreaterThan(0);
          expect(fullChangeButtons.length).toBeGreaterThan(0);
          
          // Clean up
          unmount();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should integrate properly with PublicHome for any valid configuration', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 10 }).filter(code => code.trim().length >= 4 && /^[a-zA-Z0-9]+$/.test(code.trim())),
        fc.constantFrom<'exam' | 'results'>('exam', 'results'), // Skip disabled mode
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (studentCode, mode, showExams, showResults, showRegister) => {
          // Reset mocks for each iteration
          mockClearCode.mockClear();
          
          const { container, unmount } = render(
            <PublicHome
              mode={mode}
              disabledMessage={null}
              showExams={showExams}
              showResults={showResults}
              showRegister={showRegister}
              currentCode={studentCode}
              onCodeClear={mockClearCode}
            />
          );

          // Should display the current code - handle whitespace by trimming
          const trimmedCode = studentCode.trim();
          const codeElements = within(container).getAllByText((content, element) => {
            return content.trim() === trimmedCode;
          });
          expect(codeElements.length).toBeGreaterThan(0);

          // Should have code management interface
          const currentCodeTexts = within(container).getAllByText(/current code/i);
          expect(currentCodeTexts.length).toBeGreaterThan(0);

          // Should have manage button in compact mode
          const manageButtons = within(container).getAllByText(/manage/i);
          expect(manageButtons.length).toBeGreaterThan(0);

          // Click the first manage button to show options
          const manageButton = manageButtons[0].closest('button');
          expect(manageButton).toBeTruthy();
          fireEvent.click(manageButton!);

          // Should show clear and change options after expansion
          const clearButtons = within(container).getAllByText(/clear/i);
          const changeButtons = within(container).getAllByText(/change/i);
          
          expect(clearButtons.length).toBeGreaterThan(0);
          expect(changeButtons.length).toBeGreaterThan(0);
          
          // Clean up
          unmount();
        }
      ),
      { numRuns: 20 } // Reduce iterations for complex integration test
    );
  });

  it('should provide appropriate warnings for multi-user scenarios', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 10 }).filter(code => code.trim().length >= 4 && /^[a-zA-Z0-9]+$/.test(code.trim())),
        (studentCode) => {
          // Reset mocks for each iteration
          mockClearCode.mockClear();
          
          const { container, unmount } = render(
            <CodeManagement
              currentCode={studentCode}
              onClearCode={mockClearCode}
              onChangeCode={mockClearCode}
              compact={false}
            />
          );

          // Should show help text about code management
          const helpTexts = within(container).getAllByText(/your code is stored locally/i);
          expect(helpTexts.length).toBeGreaterThan(0);
          
          const clearAnytimeTexts = within(container).getAllByText(/you can clear it anytime/i);
          expect(clearAnytimeTexts.length).toBeGreaterThan(0);

          // Click clear code button
          const clearButtons = within(container).getAllByText(/clear code/i);
          expect(clearButtons.length).toBeGreaterThan(0);
          
          const clearButton = clearButtons[0].closest('button');
          expect(clearButton).toBeTruthy();
          fireEvent.click(clearButton!);

          // Should show warning in confirmation dialog
          const warningTexts = within(container).getAllByText(/this will remove your stored code/i);
          expect(warningTexts.length).toBeGreaterThan(0);
          
          const enterAgainTexts = within(container).getAllByText(/you'll need to enter it again/i);
          expect(enterAgainTexts.length).toBeGreaterThan(0);
          
          // Clean up
          unmount();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should handle accessibility requirements for multi-user scenarios', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 10 }).filter(code => code.trim().length >= 4 && /^[a-zA-Z0-9]+$/.test(code.trim())),
        fc.boolean(),
        (studentCode, compact) => {
          // Reset mocks for each iteration
          mockClearCode.mockClear();
          
          const { container, unmount } = render(
            <CodeManagement
              currentCode={studentCode}
              onClearCode={mockClearCode}
              onChangeCode={mockClearCode}
              compact={compact}
            />
          );

          // All buttons should have proper ARIA labels or accessible names
          const buttons = within(container).getAllByRole('button');
          buttons.forEach(button => {
            // Button should have either aria-label or accessible text content
            const hasAriaLabel = button.hasAttribute('aria-label');
            const hasTextContent = button.textContent && button.textContent.trim().length > 0;
            expect(hasAriaLabel || hasTextContent).toBe(true);
          });

          // Should have buttons with clear functionality
          const clearButtons = buttons.filter(btn => {
            const text = btn.textContent?.toLowerCase() || '';
            const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
            return text.includes('clear') || ariaLabel.includes('clear');
          });
          
          if (!compact) {
            // In full mode, clear buttons should be immediately visible
            expect(clearButtons.length).toBeGreaterThan(0);
          } else {
            // In compact mode, need to expand first
            const manageButtons = buttons.filter(btn => {
              const text = btn.textContent?.toLowerCase() || '';
              const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
              return text.includes('manage') || ariaLabel.includes('manage');
            });
            expect(manageButtons.length).toBeGreaterThan(0);
          }

          // Check focus management classes for action buttons
          buttons.forEach(button => {
            const buttonText = button.textContent?.toLowerCase() || '';
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            
            // Only check focus classes for main action buttons with specific aria-labels
            if ((ariaLabel.includes('clear') && ariaLabel.includes('code')) ||
                (ariaLabel.includes('change') && ariaLabel.includes('code'))) {
              expect(button).toHaveClass('focus:outline-none');
              expect(button).toHaveClass('focus:ring-2');
            }
          });
          
          // Clean up
          unmount();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should maintain state consistency across multiple user interactions', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 10 }).filter(code => code.trim().length >= 4 && /^[a-zA-Z0-9]+$/.test(code.trim())),
        fc.array(fc.constantFrom('clear', 'change', 'cancel'), { minLength: 1, maxLength: 2 }), // Reduce complexity
        (studentCode, actions) => {
          // Reset mocks before each test iteration
          mockClearCode.mockClear();
          
          const { container, unmount } = render(
            <CodeManagement
              currentCode={studentCode}
              onClearCode={mockClearCode}
              onChangeCode={mockClearCode}
              compact={false}
            />
          );

          let expectedClearCallCount = 0;

          actions.forEach(action => {
            if (action === 'clear') {
              // Click clear code button
              const clearButtons = within(container).getAllByText(/clear code/i);
              if (clearButtons.length > 0) {
                const clearButton = clearButtons[0].closest('button');
                if (clearButton) {
                  fireEvent.click(clearButton);

                  // Confirm the clear - find the confirm button in modal
                  const allClearButtons = within(container).getAllByText(/clear code/i);
                  const confirmButton = allClearButtons.find(btn => {
                    const buttonEl = btn.closest('button');
                    return buttonEl && buttonEl.closest('.fixed'); // In modal
                  });
                  
                  if (confirmButton) {
                    const confirmButtonEl = confirmButton.closest('button');
                    if (confirmButtonEl) {
                      fireEvent.click(confirmButtonEl);
                      expectedClearCallCount++;
                    }
                  }
                }
              }
            } else if (action === 'change') {
              // Click change code button (if available)
              const changeButtons = within(container).queryAllByText(/change code/i);
              if (changeButtons.length > 0) {
                const changeButton = changeButtons[0].closest('button');
                if (changeButton) {
                  fireEvent.click(changeButton);
                  expectedClearCallCount++; // Change code also calls clearCode
                }
              }
            } else if (action === 'cancel') {
              // Try to clear but cancel
              const clearButtons = within(container).getAllByText(/clear code/i);
              if (clearButtons.length > 0) {
                const clearButton = clearButtons[0].closest('button');
                if (clearButton) {
                  fireEvent.click(clearButton);
                  const cancelButtons = within(container).queryAllByText(/cancel/i);
                  if (cancelButtons.length > 0) {
                    const cancelButton = cancelButtons[0].closest('button');
                    if (cancelButton) {
                      fireEvent.click(cancelButton);
                    }
                  }
                }
              }
            }
          });

          // Should have called clearCode the expected number of times
          expect(mockClearCode).toHaveBeenCalledTimes(expectedClearCallCount);
          
          // Clean up
          unmount();
        }
      ),
      { numRuns: 15 } // Reduce iterations for complex test
    );
  });
});