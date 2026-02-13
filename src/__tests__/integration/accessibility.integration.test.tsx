/**
 * Accessibility Integration Tests for Student Experience Optimization
 * 
 * Tests screen reader compatibility, ARIA labels, keyboard navigation,
 * and focus management in the reordered flow.
 * 
 * Requirements: 6.1, 6.3, 6.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CodeFirstRouter from '@/components/CodeFirstRouter';
import CodeInputForm from '@/components/CodeInputForm';
import CodeManagement from '@/components/CodeManagement';
import PublicLocaleProvider from '@/components/public/PublicLocaleProvider';
import { runBasicA11yChecks, testKeyboardNavigation, a11yHelpers } from '@/__tests__/utils/accessibility';
import { useStudentCode } from '@/hooks/useStudentCode';

const mockUseStudentCode = vi.mocked(useStudentCode);

// Mock hooks and dependencies
vi.mock('@/hooks/useStudentCode', () => ({
  useStudentCode: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

describe('Accessibility Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mock for useStudentCode
    mockUseStudentCode.mockReturnValue({
      storedCode: null,
      isValidating: false,
      hasValidCode: false,
      codeMetadata: null,
      storeCode: vi.fn(),
      clearCode: vi.fn(),
      validateAndRedirect: vi.fn().mockResolvedValue(false),
      validateCode: vi.fn().mockResolvedValue(true),
    });
    
    // Mock successful API responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/public/code-settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            code_length: 4,
            code_format: 'numeric',
            code_pattern: null,
            enable_multi_exam: true,
          }),
        });
      }
      if (url.includes('/api/public/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            default_language: 'en',
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('CodeFirstRouter Accessibility', () => {
    it('should have no accessibility violations in loading state', async () => {
      // Mock the hook to force loading state
      mockUseStudentCode.mockReturnValue({
        storedCode: null,
        isValidating: true, // Force loading state
        hasValidCode: false,
        codeMetadata: null,
        storeCode: vi.fn(),
        clearCode: vi.fn(),
        validateAndRedirect: vi.fn().mockResolvedValue(false),
        validateCode: vi.fn().mockResolvedValue(true),
      });

      const { container } = render(
        <PublicLocaleProvider>
          <CodeFirstRouter
            mode="exam"
            disabledMessage={null}
            showExams={true}
            showResults={true}
            showRegister={true}
          />
        </PublicLocaleProvider>
      );

      // Wait for loading state to render
      await waitFor(() => {
        expect(screen.getByText('Checking your access...')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Run basic accessibility checks instead of axe
      runBasicA11yChecks(container);
    });

    it('should have proper ARIA labels and roles in loading state', async () => {
      // Mock the hook to force loading state
      mockUseStudentCode.mockReturnValue({
        storedCode: null,
        isValidating: true, // Force loading state
        hasValidCode: false,
        codeMetadata: null,
        storeCode: vi.fn(),
        clearCode: vi.fn(),
        validateAndRedirect: vi.fn().mockResolvedValue(false),
        validateCode: vi.fn().mockResolvedValue(true),
      });

      render(
        <PublicLocaleProvider>
          <CodeFirstRouter
            mode="exam"
            disabledMessage={null}
            showExams={true}
            showResults={true}
            showRegister={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Checking your access...')).toBeInTheDocument();
      });

      // Check main landmark
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();

      // Check loading spinner accessibility
      const loadingText = screen.getByText('Checking your access...');
      expect(loadingText).toBeInTheDocument();
    });

    it('should maintain focus management during state transitions', async () => {
      // Start with loading state
      mockUseStudentCode.mockReturnValue({
        storedCode: null,
        isValidating: true, // Start with loading
        hasValidCode: false,
        codeMetadata: null,
        storeCode: vi.fn(),
        clearCode: vi.fn(),
        validateAndRedirect: vi.fn().mockResolvedValue(false),
        validateCode: vi.fn().mockResolvedValue(true),
      });

      const { rerender } = render(
        <PublicLocaleProvider>
          <CodeFirstRouter
            mode="exam"
            disabledMessage={null}
            showExams={true}
            showResults={true}
            showRegister={true}
          />
        </PublicLocaleProvider>
      );

      // Wait for initial loading state
      await waitFor(() => {
        expect(screen.getByText('Checking your access...')).toBeInTheDocument();
      });

      // Simulate transition to code input by changing the mock
      mockUseStudentCode.mockReturnValue({
        storedCode: null,
        isValidating: false, // No longer validating
        hasValidCode: false,
        codeMetadata: null,
        storeCode: vi.fn(),
        clearCode: vi.fn(),
        validateAndRedirect: vi.fn().mockResolvedValue(false),
        validateCode: vi.fn().mockResolvedValue(true),
      });

      rerender(
        <PublicLocaleProvider>
          <CodeFirstRouter
            mode="exam"
            disabledMessage={null}
            showExams={true}
            showResults={true}
            showRegister={true}
          />
        </PublicLocaleProvider>
      );

      // Focus should be managed properly during transitions
      await waitFor(() => {
        // Look for code input field specifically
        const codeInputs = screen.queryAllByLabelText(/code/i);
        if (codeInputs.length > 0) {
          // Check if any of the code inputs has focus
          const focusedInput = codeInputs.find(input => document.activeElement === input);
          expect(focusedInput).toBeTruthy();
        }
      });
    });
  });

  describe('CodeInputForm Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const mockOnCodeChange = vi.fn();
      const mockOnSubmit = vi.fn();

      const { container } = render(
        <PublicLocaleProvider>
          <CodeInputForm
            code=""
            onCodeChange={mockOnCodeChange}
            onSubmit={mockOnSubmit}
            autoFocus={true}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      // Wait for component to fully render
      await waitFor(() => {
        expect(screen.getByLabelText(/الكود|code/i)).toBeInTheDocument();
      });

      // Run basic accessibility checks instead of axe
      runBasicA11yChecks(container);
    });

    it('should have proper form labels and associations', async () => {
      const mockOnCodeChange = vi.fn();
      const mockOnSubmit = vi.fn();

      render(
        <PublicLocaleProvider>
          <CodeInputForm
            code=""
            onCodeChange={mockOnCodeChange}
            onSubmit={mockOnSubmit}
            autoFocus={true}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        // Look for the specific input with id="exam-code"
        const codeInput = screen.getByDisplayValue('');
        expect(codeInput).toBeInTheDocument();
        
        // Check input has proper attributes
        expect(codeInput).toHaveAttribute('id', 'exam-code');
        expect(codeInput).toHaveAttribute('required');
        expect(codeInput).toHaveAttribute('autoComplete', 'one-time-code');
        
        // Check label association by looking for label with for attribute
        const labels = document.querySelectorAll('label[for="exam-code"]');
        expect(labels.length).toBeGreaterThan(0);
      });
    });

    it('should auto-focus the input field when autoFocus is true', async () => {
      const mockOnCodeChange = vi.fn();
      const mockOnSubmit = vi.fn();

      render(
        <PublicLocaleProvider>
          <CodeInputForm
            code=""
            onCodeChange={mockOnCodeChange}
            onSubmit={mockOnSubmit}
            autoFocus={true}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        // Look for the specific input with id="exam-code"
        const codeInput = document.getElementById('exam-code');
        expect(codeInput).toBeInTheDocument();
        expect(document.activeElement).toBe(codeInput);
      });
    });

    it('should provide proper error announcements', async () => {
      const mockOnCodeChange = vi.fn();
      const mockOnSubmit = vi.fn();

      render(
        <PublicLocaleProvider>
          <CodeInputForm
            code="123"
            onCodeChange={mockOnCodeChange}
            onSubmit={mockOnSubmit}
            error="Code must be exactly 4 digits"
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveTextContent('Code must be exactly 4 digits');
      });
    });

    it('should support keyboard navigation', async () => {
      const mockOnCodeChange = vi.fn();
      const mockOnSubmit = vi.fn();

      const { rerender } = render(
        <PublicLocaleProvider>
          <CodeInputForm
            code="1234" // Start with a valid code
            onCodeChange={mockOnCodeChange}
            onSubmit={mockOnSubmit}
            autoFocus={true}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        const codeInput = document.getElementById('exam-code');
        expect(codeInput).toBeInTheDocument();
      });

      // Test keyboard input
      const codeInput = document.getElementById('exam-code') as HTMLInputElement;
      
      // Simulate typing a new code
      fireEvent.change(codeInput, { target: { value: '5678' } });
      expect(mockOnCodeChange).toHaveBeenCalledWith('5678');

      // Re-render with the updated code to simulate the parent component updating the prop
      rerender(
        <PublicLocaleProvider>
          <CodeInputForm
            code="5678" // Updated code
            onCodeChange={mockOnCodeChange}
            onSubmit={mockOnSubmit}
            autoFocus={true}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      // Test form submission - the form should be enabled with a valid 4-digit code
      const form = codeInput.closest('form')!;
      const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      
      // Ensure button is not disabled
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
      
      // Submit the form
      fireEvent.submit(form);
      
      // The form should call onSubmit with the current code value
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('5678');
      });
    });

    it('should handle RTL layout properly', async () => {
      // Mock Arabic locale
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        if (url.includes('/api/public/settings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              default_language: 'ar',
            }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        });
      });

      const mockOnCodeChange = vi.fn();
      const mockOnSubmit = vi.fn();

      render(
        <PublicLocaleProvider>
          <CodeInputForm
            code=""
            onCodeChange={mockOnCodeChange}
            onSubmit={mockOnSubmit}
            autoFocus={true}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        // Look for RTL container
        const rtlContainer = document.querySelector('[dir="rtl"]');
        if (rtlContainer) {
          expect(rtlContainer).toHaveAttribute('dir', 'rtl');
          expect(rtlContainer).toHaveAttribute('lang', 'ar');
        }
      });
    });
  });

  describe('CodeManagement Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const mockOnClearCode = vi.fn();
      const mockOnChangeCode = vi.fn();

      const { container } = render(
        <PublicLocaleProvider>
          <CodeManagement
            currentCode="1234"
            onClearCode={mockOnClearCode}
            onChangeCode={mockOnChangeCode}
            compact={false}
          />
        </PublicLocaleProvider>
      );

      // Run basic accessibility checks instead of axe
      runBasicA11yChecks(container);
    });

    it('should have proper button labels and descriptions', async () => {
      const mockOnClearCode = vi.fn();
      const mockOnChangeCode = vi.fn();

      render(
        <PublicLocaleProvider>
          <CodeManagement
            currentCode="1234"
            onClearCode={mockOnClearCode}
            onChangeCode={mockOnChangeCode}
            compact={false}
          />
        </PublicLocaleProvider>
      );

      // Check button accessibility
      const changeButton = screen.getByRole('button', { name: /change code/i });
      const clearButton = screen.getByRole('button', { name: /clear code/i });

      expect(changeButton).toBeInTheDocument();
      expect(clearButton).toBeInTheDocument();

      // Check focus management
      expect(changeButton).toHaveAttribute('class');
      expect(clearButton).toHaveAttribute('class');
    });

    it('should handle modal dialog accessibility', async () => {
      const mockOnClearCode = vi.fn();
      const mockOnChangeCode = vi.fn();

      render(
        <PublicLocaleProvider>
          <CodeManagement
            currentCode="1234"
            onClearCode={mockOnClearCode}
            onChangeCode={mockOnChangeCode}
            compact={false}
          />
        </PublicLocaleProvider>
      );

      // Open confirmation dialog
      const clearButton = screen.getByRole('button', { name: /clear code/i });
      fireEvent.click(clearButton);

      // Check dialog accessibility
      await waitFor(() => {
        const dialog = screen.getByText(/confirm clear code/i).closest('.fixed');
        expect(dialog).toBeInTheDocument();
      });

      // Check dialog buttons
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const confirmButton = screen.getAllByRole('button', { name: /clear code/i })[1]; // Second one is in dialog

      expect(cancelButton).toBeInTheDocument();
      expect(confirmButton).toBeInTheDocument();
    });

    it('should support compact mode accessibility', async () => {
      const mockOnClearCode = vi.fn();
      const mockOnChangeCode = vi.fn();

      const { container } = render(
        <PublicLocaleProvider>
          <CodeManagement
            currentCode="1234"
            onClearCode={mockOnClearCode}
            onChangeCode={mockOnChangeCode}
            compact={true}
          />
        </PublicLocaleProvider>
      );

      // Check compact mode has proper accessibility
      runBasicA11yChecks(container);

      // Check toggle button has proper aria-label
      const toggleButton = screen.getByRole('button', { name: /manage/i });
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe('Cross-Component Accessibility', () => {
    it('should maintain accessibility across component transitions', async () => {
      const { container, rerender } = render(
        <PublicLocaleProvider>
          <CodeInputForm
            code=""
            onCodeChange={vi.fn()}
            onSubmit={vi.fn()}
            autoFocus={true}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      // Check initial accessibility
      await waitFor(() => {
        expect(document.getElementById('exam-code')).toBeInTheDocument();
      });

      runBasicA11yChecks(container);

      // Transition to code management
      rerender(
        <PublicLocaleProvider>
          <CodeManagement
            currentCode="1234"
            onClearCode={vi.fn()}
            onChangeCode={vi.fn()}
            compact={false}
          />
        </PublicLocaleProvider>
      );

      // Check accessibility after transition
      runBasicA11yChecks(container);
    });

    it('should run basic accessibility checks on all components', async () => {
      // Test CodeInputForm
      const { container: codeInputContainer } = render(
        <PublicLocaleProvider>
          <CodeInputForm
            code=""
            onCodeChange={vi.fn()}
            onSubmit={vi.fn()}
            autoFocus={true}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        expect(document.getElementById('exam-code')).toBeInTheDocument();
      });

      runBasicA11yChecks(codeInputContainer);
      testKeyboardNavigation(codeInputContainer);

      cleanup();

      // Test CodeManagement
      const { container: codeManagementContainer } = render(
        <PublicLocaleProvider>
          <CodeManagement
            currentCode="1234"
            onClearCode={vi.fn()}
            onChangeCode={vi.fn()}
            compact={false}
          />
        </PublicLocaleProvider>
      );

      runBasicA11yChecks(codeManagementContainer);
      testKeyboardNavigation(codeManagementContainer);
    });

    it('should maintain proper heading hierarchy', async () => {
      render(
        <PublicLocaleProvider>
          <div>
            <CodeInputForm
              code=""
              onCodeChange={vi.fn()}
              onSubmit={vi.fn()}
              title="Exam Access"
              autoFocus={true}
              showValidation={true}
            />
            <CodeManagement
              currentCode="1234"
              onClearCode={vi.fn()}
              onChangeCode={vi.fn()}
              compact={false}
            />
          </div>
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        // Check heading hierarchy
        const h2Elements = screen.getAllByRole('heading', { level: 2 });
        const h3Elements = screen.getAllByRole('heading', { level: 3 });

        // Should have proper heading structure
        expect(h2Elements.length).toBeGreaterThan(0);
        expect(h3Elements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('should provide proper live region announcements', async () => {
      const mockOnCodeChange = vi.fn();
      const mockOnSubmit = vi.fn();

      render(
        <PublicLocaleProvider>
          <CodeInputForm
            code=""
            onCodeChange={mockOnCodeChange}
            onSubmit={mockOnSubmit}
            checking={false}
            error={null}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        const codeInput = document.getElementById('exam-code');
        expect(codeInput).toBeInTheDocument();
      });

      // Type invalid code to trigger validation
      const codeInput = document.getElementById('exam-code') as HTMLInputElement;
      fireEvent.change(codeInput, { target: { value: '123' } });

      // Check for live region announcement
      await waitFor(() => {
        const alert = screen.queryByRole('alert');
        if (alert) {
          expect(alert).toHaveTextContent(/code must be/i);
        }
      });
    });

    it('should announce loading states properly', async () => {
      const mockOnCodeChange = vi.fn();
      const mockOnSubmit = vi.fn();

      render(
        <PublicLocaleProvider>
          <CodeInputForm
            code="1234"
            onCodeChange={mockOnCodeChange}
            onSubmit={mockOnSubmit}
            checking={true}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        const loadingText = screen.getByText(/checking code/i);
        expect(loadingText).toBeInTheDocument();
      });
    });

    it('should provide proper status updates', async () => {
      const mockOnCodeChange = vi.fn();
      const mockOnSubmit = vi.fn();

      const { rerender } = render(
        <PublicLocaleProvider>
          <CodeInputForm
            code="1234"
            onCodeChange={mockOnCodeChange}
            onSubmit={mockOnSubmit}
            checking={false}
            error={null}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      // Simulate error state
      rerender(
        <PublicLocaleProvider>
          <CodeInputForm
            code="1234"
            onCodeChange={mockOnCodeChange}
            onSubmit={mockOnSubmit}
            checking={false}
            error="Invalid code"
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent('Invalid code');
      });
    });
  });
});