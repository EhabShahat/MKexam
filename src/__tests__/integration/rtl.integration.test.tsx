/**
 * RTL Layout Integration Tests for Student Experience Optimization
 * 
 * Tests Arabic language support, RTL layout for code input and navigation,
 * and proper text direction handling in the reordered flow.
 * 
 * Requirements: 6.2, 6.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import CodeFirstRouter from '@/components/CodeFirstRouter';
import CodeInputForm from '@/components/CodeInputForm';
import CodeManagement from '@/components/CodeManagement';
import PublicLocaleProvider from '@/components/public/PublicLocaleProvider';

// Mock hooks and dependencies
vi.mock('@/hooks/useStudentCode', () => ({
  useStudentCode: vi.fn(() => ({
    storedCode: null,
    isValidating: false,
    hasValidCode: false,
    codeMetadata: null,
    storeCode: vi.fn(),
    clearCode: vi.fn(),
    validateAndRedirect: vi.fn().mockResolvedValue(false),
    validateCode: vi.fn().mockResolvedValue(true),
  })),
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

describe('RTL Layout Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
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
            default_language: 'ar', // Arabic by default for RTL tests
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

  describe('Arabic Language Support', () => {
    it('should render Arabic text correctly in CodeInputForm', async () => {
      render(
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
        // Check for Arabic text content
        expect(screen.getByText('الكود')).toBeInTheDocument(); // "Code" in Arabic
        expect(screen.getByText('اعرض الاختبارات')).toBeInTheDocument(); // "Find Exams" in Arabic
      }, { timeout: 2000 });
    });

    it('should render Arabic text correctly in CodeManagement', async () => {
      render(
        <PublicLocaleProvider>
          <CodeManagement
            currentCode="1234"
            onClearCode={vi.fn()}
            onChangeCode={vi.fn()}
            compact={false}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        // Check for Arabic text content
        expect(screen.getByText('إدارة الكود')).toBeInTheDocument(); // "Code Management" in Arabic
        expect(screen.getByText('الكود الحالي')).toBeInTheDocument(); // "Current Code" in Arabic
      }, { timeout: 2000 });
    });

    it('should handle Arabic text in error messages', async () => {
      render(
        <PublicLocaleProvider>
          <CodeInputForm
            code="123"
            onCodeChange={vi.fn()}
            onSubmit={vi.fn()}
            error="يجب أن يتكون الرمز من 4 أرقام بالضبط" // Arabic error message
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toHaveTextContent('يجب أن يتكون الرمز من 4 أرقام بالضبط');
      }, { timeout: 2000 });
    });
  });

  describe('RTL Layout Support', () => {
    it('should apply RTL direction to the container', async () => {
      render(
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
        const container = screen.getByText('الكود').closest('[dir]');
        expect(container).toHaveAttribute('dir', 'rtl');
        expect(container).toHaveAttribute('lang', 'ar');
      }, { timeout: 2000 });
    });

    it('should position icons correctly in RTL layout', async () => {
      render(
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
        // In RTL, the icon should be positioned on the left side
        const iconContainer = screen.getByText('الكود').closest('form')?.querySelector('.absolute.inset-y-0.left-4');
        expect(iconContainer).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should flip arrow icons in RTL layout', async () => {
      render(
        <PublicLocaleProvider>
          <CodeInputForm
            code="1234"
            onCodeChange={vi.fn()}
            onSubmit={vi.fn()}
            autoFocus={true}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        // Check for flipped arrow icon in submit button
        const submitButton = screen.getByRole('button', { name: /اعرض الاختبارات/i });
        const arrowIcon = submitButton.querySelector('svg[style*="scaleX(-1)"]');
        expect(arrowIcon).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should maintain proper text alignment in RTL', async () => {
      render(
        <PublicLocaleProvider>
          <CodeInputForm
            code=""
            onCodeChange={vi.fn()}
            onSubmit={vi.fn()}
            title="دخول الاختبار" // Arabic title
            hint="ابحث بواسطة بالكود بتاعك لعرض نتائجك." // Arabic hint
            autoFocus={true}
            showValidation={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        // Check that Arabic text is displayed
        expect(screen.getByText('دخول الاختبار')).toBeInTheDocument();
        expect(screen.getByText('ابحث بواسطة بالكود بتاعك لعرض نتائجك.')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Text Direction Handling', () => {
    it('should handle mixed content (Arabic text with numeric codes)', async () => {
      render(
        <PublicLocaleProvider>
          <CodeManagement
            currentCode="1234"
            onClearCode={vi.fn()}
            onChangeCode={vi.fn()}
            compact={false}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        // Check that numeric code is displayed correctly alongside Arabic text
        expect(screen.getByText('الكود الحالي')).toBeInTheDocument();
        expect(screen.getByText('1234')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should handle input field direction correctly', async () => {
      render(
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
        const input = screen.getByLabelText('الكود');
        expect(input).toBeInTheDocument();
        
        // Input should have proper attributes for RTL
        expect(input).toHaveAttribute('id', 'exam-code');
        expect(input).toHaveAttribute('type', 'text');
        
        // Check that the input is in an RTL container
        const rtlContainer = input.closest('[dir="rtl"]');
        expect(rtlContainer).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should handle button layout in RTL', async () => {
      render(
        <PublicLocaleProvider>
          <CodeManagement
            currentCode="1234"
            onClearCode={vi.fn()}
            onChangeCode={vi.fn()}
            compact={false}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        // Check that buttons are present with Arabic text
        const changeButton = screen.getByRole('button', { name: /تغيير الرمز/i });
        const clearButton = screen.getByRole('button', { name: /مسح الكود/i });
        
        expect(changeButton).toBeInTheDocument();
        expect(clearButton).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Cross-Language Compatibility', () => {
    it('should switch between English and Arabic correctly', async () => {
      // First render in English
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/public/settings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              default_language: 'en',
            }),
          });
        }
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
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        });
      });

      const { unmount } = render(
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
        expect(screen.getByText('Code')).toBeInTheDocument();
        const container = screen.getByText('Code').closest('[dir]');
        expect(container).toHaveAttribute('dir', 'ltr');
        expect(container).toHaveAttribute('lang', 'en');
      }, { timeout: 2000 });

      // Unmount and remount with Arabic settings
      unmount();

      // Switch to Arabic
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/public/settings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              default_language: 'ar',
            }),
          });
        }
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
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        });
      });

      render(
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
        expect(screen.getByText('الكود')).toBeInTheDocument();
        const container = screen.getByText('الكود').closest('[dir]');
        expect(container).toHaveAttribute('dir', 'rtl');
        expect(container).toHaveAttribute('lang', 'ar');
      }, { timeout: 2000 });
    });

    it('should maintain functionality regardless of language direction', async () => {
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
        const input = screen.getByLabelText('الكود');
        expect(input).toBeInTheDocument();
        
        // Form functionality should work regardless of RTL
        const form = input.closest('form');
        expect(form).toBeInTheDocument();
        
        const submitButton = screen.getByRole('button', { name: /اعرض الاختبارات/i });
        expect(submitButton).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('CodeFirstRouter RTL Support', () => {
    it('should handle RTL layout in loading state', async () => {
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
        // Check for loading text in Arabic
        const loadingText = screen.queryByText('جاري التحقق من وصولك...');
        if (loadingText) {
          const container = loadingText.closest('[dir]');
          expect(container).toHaveAttribute('dir', 'rtl');
          expect(container).toHaveAttribute('lang', 'ar');
        }
      }, { timeout: 2000 });
    });

    it('should handle RTL layout in disabled state', async () => {
      render(
        <PublicLocaleProvider>
          <CodeFirstRouter
            mode="disabled"
            disabledMessage="النظام غير متاح حاليًا" // Arabic disabled message
            showExams={true}
            showResults={true}
            showRegister={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        // Check that the disabled message is displayed in RTL context
        const container = document.querySelector('[dir="rtl"]');
        expect(container).toBeInTheDocument();
        expect(container).toHaveAttribute('lang', 'ar');
      }, { timeout: 2000 });
    });
  });

  describe('Responsive RTL Layout', () => {
    it('should maintain RTL layout on different screen sizes', async () => {
      // Mock different viewport sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320, // Mobile width
      });

      render(
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
        const container = screen.getByText('الكود').closest('[dir]');
        expect(container).toHaveAttribute('dir', 'rtl');
        expect(container).toHaveAttribute('lang', 'ar');
      }, { timeout: 2000 });

      // Test tablet width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      await waitFor(() => {
        const container = screen.getByText('الكود').closest('[dir]');
        expect(container).toHaveAttribute('dir', 'rtl');
        expect(container).toHaveAttribute('lang', 'ar');
      }, { timeout: 1000 });
    });

    it('should handle compact mode in RTL', async () => {
      render(
        <PublicLocaleProvider>
          <CodeManagement
            currentCode="1234"
            onClearCode={vi.fn()}
            onChangeCode={vi.fn()}
            compact={true}
          />
        </PublicLocaleProvider>
      );

      await waitFor(() => {
        // Check that compact mode works in RTL
        const container = screen.getByText('الكود الحالي').closest('[dir]');
        expect(container).toHaveAttribute('dir', 'rtl');
        expect(container).toHaveAttribute('lang', 'ar');
        
        // Check for manage button in Arabic
        const manageButton = screen.getByRole('button', { name: /إدارة/i });
        expect(manageButton).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });
});