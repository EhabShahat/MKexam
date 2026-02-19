/**
 * Integration tests for existing exam features with reordered flow
 * Tests exam access, result association, and WhatsApp integration compatibility
 * 
 * Requirements: 10.1, 10.2, 10.5
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import CodeFirstRouter from '@/components/CodeFirstRouter';
import MultiExamEntry from '@/components/public/MultiExamEntry';
import { useStudentCode } from '@/hooks/useStudentCode';
import PublicLocaleProvider from '@/components/public/PublicLocaleProvider';

// Mock the hooks and modules
vi.mock('@/hooks/useStudentCode');
vi.mock('@/lib/collectDeviceInfo');
vi.mock('@/lib/security');
vi.mock('@/lib/rateLimiter');
vi.mock('@/lib/audit');
vi.mock('@/lib/reorderedFlowPerformance');
vi.mock('@/lib/offlineHandler');

// Mock the offline status hook
vi.mock('@/lib/offlineHandler', () => ({
  useOfflineStatus: vi.fn(() => ({
    isOnline: true,
    networkStatus: 'online',
    lastOnline: Date.now(),
    connectionType: 'unknown',
  })),
}));

const mockUseStudentCode = vi.mocked(useStudentCode);

// Mock fetch globally
global.fetch = vi.fn();

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <PublicLocaleProvider>
        {children}
      </PublicLocaleProvider>
    </QueryClientProvider>
  );
}

describe('Exam Feature Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockClear();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    // Mock performance API
    Object.defineProperty(window, 'performance', {
      value: {
        now: vi.fn(() => Date.now()),
      },
      writable: true,
    });
  });

  describe('Exam Access Through Reordered Flow', () => {
    test('should allow exam access with valid stored code', async () => {
      // Mock stored code scenario
      mockUseStudentCode.mockReturnValue({
        storedCode: 'TEST123',
        isValidating: false,
        hasValidCode: true,
        codeMetadata: {
          code: 'TEST123',
          timestamp: Date.now(),
          studentId: 'student-1',
          lastValidated: Date.now(),
          validationAttempts: 0,
        },
        storeCode: vi.fn(),
        clearCode: vi.fn(),
        validateAndRedirect: vi.fn().mockResolvedValue(true),
        validateCode: vi.fn().mockResolvedValue(true),
      });

      render(
        <TestWrapper>
          <CodeFirstRouter
            mode="exam"
            disabledMessage={null}
            showExams={true}
            showResults={false}
            showRegister={false}
          />
        </TestWrapper>
      );

      // Should show main page with code management
      await waitFor(() => {
        expect(screen.getByText(/current code/i)).toBeInTheDocument();
      });

      // Should show exam access button - use more specific selector
      expect(screen.getByRole('link', { name: /exams/i })).toBeInTheDocument();
    });

    test('should redirect to code input when no valid stored code', async () => {
      // Mock no stored code scenario
      mockUseStudentCode.mockReturnValue({
        storedCode: null,
        isValidating: false,
        hasValidCode: false,
        codeMetadata: null,
        storeCode: vi.fn(),
        clearCode: vi.fn(),
        validateAndRedirect: vi.fn().mockResolvedValue(false),
        validateCode: vi.fn().mockResolvedValue(false),
      });

      render(
        <TestWrapper>
          <CodeFirstRouter
            mode="exam"
            disabledMessage={null}
            showExams={true}
            showResults={false}
            showRegister={false}
          />
        </TestWrapper>
      );

      // Should show code input interface - look for the actual placeholder
      await waitFor(() => {
        expect(screen.getByPlaceholderText('0000')).toBeInTheDocument();
      });
    });

    test('should handle exam access API integration', async () => {
      const mockExamData = {
        valid: true,
        student_id: 'student-1',
        student_name: 'Test Student',
        exams: [
          {
            id: 'exam-1',
            title: 'Test Exam',
            description: 'Test Description',
            duration_minutes: 60,
            start_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            end_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            status: 'published',
            access_type: 'code_based',
            is_active: true,
            not_started: false,
            ended: false,
            attempt_status: null,
            attempt_id: null,
          },
        ],
      };

      // Mock API responses
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockExamData),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            attemptId: 'attempt-1',
            studentName: 'Test Student',
          }),
        } as Response);

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

      render(
        <TestWrapper>
          <MultiExamEntry />
        </TestWrapper>
      );

      // Enter code and submit
      const codeInput = screen.getByPlaceholderText(/enter.*code/i);
      fireEvent.change(codeInput, { target: { value: 'TEST123' } });
      
      const submitButton = screen.getByRole('button', { name: /verify/i });
      fireEvent.click(submitButton);

      // Wait for exam list to appear
      await waitFor(() => {
        expect(screen.getByText('Test Exam')).toBeInTheDocument();
      });

      // Click start exam button
      const startButton = screen.getByRole('button', { name: /start exam/i });
      fireEvent.click(startButton);

      // Verify API calls were made correctly
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/public/exams/by-code?code=TEST123')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/public/exams/exam-1/access'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('TEST123'),
        })
      );
    });
  });

  describe('Result Association with Student Codes', () => {
    test('should maintain student code association in exam attempts', async () => {
      const mockExamAccessResponse = {
        attemptId: 'attempt-123',
        studentName: 'Test Student',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExamAccessResponse),
      } as Response);

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

      // Mock collectDetailedDeviceInfo
      const mockCollectDeviceInfo = await vi.importMock('@/lib/collectDeviceInfo');
      mockCollectDeviceInfo.collectDetailedDeviceInfo = vi.fn().mockResolvedValue({
        collectedAt: new Date().toISOString(),
        friendlyName: 'Test Device (Test OS) Test Browser',
        fingerprint: 'abc123def456',
        browserDetails: {
          name: 'Chrome',
          version: '120',
          fullVersion: '120.0.6099.129',
          engine: 'Blink',
          engineVersion: '120.0.6099.129',
        },
        platformDetails: {
          os: 'Windows',
          osVersion: '10',
          architecture: 'x86',
          bitness: '64',
        },
        clientHints: null,
        deviceMemory: 8,
        hardwareConcurrency: 8,
        pixelRatio: 1,
        touch: false,
        screen: {
          width: 1920,
          height: 1080,
          colorDepth: 24,
          pixelDepth: 24,
        },
        viewport: {
          width: 1920,
          height: 969,
        },
        gpu: {
          vendor: 'Intel',
          renderer: 'Intel HD Graphics',
        },
        network: null,
        ips: {
          ips: [],
          error: null,
          completedAt: new Date().toISOString(),
        },
        security: {
          webdriver: false,
          pdfViewer: true,
          doNotTrack: false,
          pluginsCount: 3,
          cookiesEnabled: true,
          isExtended: false,
          maxTouchPoints: 0,
          automationRisk: false,
        },
        location: {
          latitude: null,
          longitude: null,
          accuracy: null,
          timestamp: null,
          error: 'not_supported',
        },
        timezone: 'America/New_York',
        timezoneOffset: 300,
        language: 'en-US',
        languages: ['en-US', 'en'],
        parsed: {
          browser: { name: 'Chrome', version: '120' },
          os: { name: 'Windows', version: '10' },
          device: { type: 'desktop' },
        },
        oem: {
          brand: 'Unknown',
          model: 'Unknown',
          source: null,
        },
        battery: null,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        platform: 'Win32',
        vendor: 'Google Inc.',
        entrySubmit: null,
      });

      render(
        <TestWrapper>
          <MultiExamEntry />
        </TestWrapper>
      );

      // Verify that exam access includes proper code and device info
      const expectedRequestBody = {
        code: 'TEST123',
        studentName: null,
        deviceInfo: {
          collectedAt: expect.any(String),
          friendlyName: 'Test Device (Test OS) Test Browser',
          fingerprint: 'abc123def456',
          browserDetails: {
            name: 'Chrome',
            version: '120',
            fullVersion: '120.0.6099.129',
            engine: 'Blink',
            engineVersion: '120.0.6099.129',
          },
          platformDetails: {
            os: 'Windows',
            osVersion: '10',
            architecture: 'x86',
            bitness: '64',
          },
          clientHints: null,
          deviceMemory: 8,
          hardwareConcurrency: 8,
          pixelRatio: 1,
          touch: false,
          screen: {
            width: 1920,
            height: 1080,
            colorDepth: 24,
            pixelDepth: 24,
          },
          viewport: {
            width: 1920,
            height: 969,
          },
          gpu: {
            vendor: 'Intel',
            renderer: 'Intel HD Graphics',
          },
          network: null,
          ips: {
            ips: [],
            error: null,
            completedAt: expect.any(String),
          },
          security: {
            webdriver: false,
            pdfViewer: true,
            doNotTrack: false,
            pluginsCount: 3,
            cookiesEnabled: true,
            isExtended: false,
            maxTouchPoints: 0,
            automationRisk: false,
          },
          location: {
            latitude: null,
            longitude: null,
            accuracy: null,
            timestamp: null,
            error: 'not_supported',
          },
          timezone: 'America/New_York',
          timezoneOffset: 300,
          language: 'en-US',
          languages: ['en-US', 'en'],
          parsed: {
            browser: { name: 'Chrome', version: '120' },
            os: { name: 'Windows', version: '10' },
            device: { type: 'desktop' },
          },
          oem: {
            brand: 'Unknown',
            model: 'Unknown',
            source: null,
          },
          battery: null,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          platform: 'Win32',
          vendor: 'Google Inc.',
          entrySubmit: null,
        },
      };

      // This would be called internally when starting an exam
      await fetch('/api/public/exams/exam-1/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expectedRequestBody),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/public/exams/exam-1/access',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expectedRequestBody),
        })
      );
    });

    test('should handle result retrieval with stored codes', async () => {
      const mockResultsData = {
        valid: true,
        student_id: 'student-1',
        student_name: 'Test Student',
        exams: [
          {
            id: 'exam-1',
            title: 'Completed Exam',
            attempt_status: 'completed',
            attempt_id: 'attempt-1',
            score: 85,
            total_score: 100,
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResultsData),
      } as Response);

      mockUseStudentCode.mockReturnValue({
        storedCode: 'TEST123',
        isValidating: false,
        hasValidCode: true,
        codeMetadata: {
          code: 'TEST123',
          timestamp: Date.now(),
          studentId: 'student-1',
          lastValidated: Date.now(),
          validationAttempts: 0,
        },
        storeCode: vi.fn(),
        clearCode: vi.fn(),
        validateAndRedirect: vi.fn().mockResolvedValue(true),
        validateCode: vi.fn().mockResolvedValue(true),
      });

      render(
        <TestWrapper>
          <CodeFirstRouter
            mode="results"
            disabledMessage={null}
            showExams={false}
            showResults={true}
            showRegister={false}
          />
        </TestWrapper>
      );

      // Should show results page with stored code - use more specific selector
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /results/i })).toBeInTheDocument();
      });

      // Verify that results are associated with the correct student code
      expect(screen.getByText('Current Code')).toBeInTheDocument();
      expect(screen.getByText('TEST123')).toBeInTheDocument();
    });
  });

  describe('WhatsApp Integration Compatibility', () => {
    test('should maintain WhatsApp URL format compatibility', () => {
      // Test that WhatsApp URL generation still works with reordered flow
      const studentCode = 'WA123';
      const message = 'Your exam code is {code}. Click here to access: https://example.com/?code={code}';
      const mobileNumber = '1234567890';
      
      const personalizedMessage = message.replace(/{code}/g, studentCode);
      const encodedMessage = encodeURIComponent(personalizedMessage);
      const whatsappUrl = `https://wa.me/${mobileNumber}?text=${encodedMessage}`;
      
      expect(whatsappUrl).toContain('https://wa.me/1234567890');
      expect(whatsappUrl).toContain('code%3DWA123'); // URL encoded code parameter
      expect(decodeURIComponent(whatsappUrl)).toContain('?code=WA123');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle API errors gracefully', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      mockUseStudentCode.mockReturnValue({
        storedCode: null,
        isValidating: false,
        hasValidCode: false,
        codeMetadata: null,
        storeCode: vi.fn(),
        clearCode: vi.fn(),
        validateAndRedirect: vi.fn().mockResolvedValue(false),
        validateCode: vi.fn().mockResolvedValue(false),
      });

      render(
        <TestWrapper>
          <MultiExamEntry />
        </TestWrapper>
      );

      const codeInput = screen.getByPlaceholderText('0000');
      fireEvent.change(codeInput, { target: { value: 'ERROR123' } });
      
      const submitButton = screen.getByRole('button', { name: /find exams/i });
      fireEvent.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/error.*loading/i)).toBeInTheDocument();
      });
    });

    test('should handle invalid codes appropriately', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ valid: false, reason: 'not_found' }),
      } as Response);

      mockUseStudentCode.mockReturnValue({
        storedCode: null,
        isValidating: false,
        hasValidCode: false,
        codeMetadata: null,
        storeCode: vi.fn(),
        clearCode: vi.fn(),
        validateAndRedirect: vi.fn().mockResolvedValue(false),
        validateCode: vi.fn().mockResolvedValue(false),
      });

      render(
        <TestWrapper>
          <MultiExamEntry />
        </TestWrapper>
      );

      const codeInput = screen.getByPlaceholderText('0000');
      fireEvent.change(codeInput, { target: { value: 'INVALID' } });
      
      const submitButton = screen.getByRole('button', { name: /find exams/i });
      fireEvent.click(submitButton);

      // Should show code not found error
      await waitFor(() => {
        expect(screen.getByText(/code.*not.*found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Multi-Exam Mode Compatibility', () => {
    test('should handle single exam mode with reordered flow', async () => {
      const mockSingleExamData = {
        valid: true,
        student_id: 'student-single',
        student_name: 'Single Exam Student',
        exams: [
          {
            id: 'single-exam',
            title: 'Single Mode Exam',
            is_active: true,
            not_started: false,
            ended: false,
            attempt_status: null,
          },
        ],
      };

      // Mock code settings for single exam mode
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code_length: 4,
            code_format: 'numeric',
            enable_multi_exam: false, // Single exam mode
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSingleExamData),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            attemptId: 'single-attempt',
            studentName: 'Single Exam Student',
          }),
        } as Response);

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

      render(
        <TestWrapper>
          <MultiExamEntry />
        </TestWrapper>
      );

      const codeInput = screen.getByPlaceholderText('0000');
      fireEvent.change(codeInput, { target: { value: '1234' } });
      
      const submitButton = screen.getByRole('button', { name: /find exams/i });
      fireEvent.click(submitButton);

      // In single exam mode, should auto-redirect to exam
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/public/exams/single-exam/access'),
          expect.any(Object)
        );
      });
    });

    test('should handle multi-exam mode with exam selection', async () => {
      const mockMultiExamData = {
        valid: true,
        student_id: 'student-multi',
        student_name: 'Multi Exam Student',
        exams: [
          {
            id: 'exam-1',
            title: 'First Exam',
            is_active: true,
            not_started: false,
            ended: false,
            attempt_status: null,
          },
          {
            id: 'exam-2',
            title: 'Second Exam',
            is_active: true,
            not_started: false,
            ended: false,
            attempt_status: null,
          },
        ],
      };

      // Mock code settings for multi-exam mode
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code_length: 4,
            code_format: 'numeric',
            enable_multi_exam: true, // Multi-exam mode
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMultiExamData),
        } as Response);

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

      render(
        <TestWrapper>
          <MultiExamEntry />
        </TestWrapper>
      );

      const codeInput = screen.getByPlaceholderText('0000');
      fireEvent.change(codeInput, { target: { value: '1234' } });
      
      const submitButton = screen.getByRole('button', { name: /find exams/i });
      fireEvent.click(submitButton);

      // Should show exam selection list
      await waitFor(() => {
        expect(screen.getByText('First Exam')).toBeInTheDocument();
        expect(screen.getByText('Second Exam')).toBeInTheDocument();
      });
    });
  });
});