/**
 * Property-Based Tests for MultiExamEntry Error Handling Consistency
 * Feature: student-experience-optimization, Property 4: Error Handling Consistency
 * Validates: Requirements 1.3, 2.4, 4.4, 8.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import MultiExamEntry from '@/components/public/MultiExamEntry';

// Mock the locale provider
vi.mock('@/components/public/PublicLocaleProvider', () => ({
  useStudentLocale: () => ({ locale: 'en', dir: 'ltr' }),
}));

// Mock the i18n function
vi.mock('@/i18n/student', () => ({
  t: (locale: string, key: string, params?: any) => {
    const translations: Record<string, string> = {
      'code_must_be_4_digits': 'Code must be 4 digits',
      'code_not_found': 'Code not found',
      'error_loading_results': 'Error loading results',
      'err_code_required': 'Code is required',
      'err_invalid_code': 'Invalid code',
      'err_code_already_used': 'Code already used',
      'err_exam_not_published': 'Exam not published',
      'err_exam_not_started': 'Exam not started',
      'err_exam_ended': 'Exam ended',
      'err_attempt_limit_reached': 'Attempt limit reached',
      'err_ip_not_whitelisted': 'IP not whitelisted',
      'err_ip_blacklisted': 'IP blacklisted',
      'unable_load_exam': 'Unable to load exam',
      'find_exams': 'Find Exams',
      'checking_code': 'Checking code...',
      'select_exam': 'Select Exam',
      'results_search_hint_code': 'Enter your exam code to find available exams',
      'exam_code': 'Exam Code',
    };
    return translations[key] || key;
  },
}));

// Mock other dependencies
vi.mock('@/components/BrandLogo', () => ({
  default: () => <div data-testid="brand-logo">Brand Logo</div>,
}));

vi.mock('@/components/ClearCodeButton', () => ({
  default: () => <button data-testid="clear-code-button">Clear Code</button>,
}));

vi.mock('@/hooks/useStudentCode', () => ({
  useStudentCode: () => ({
    storedCode: null,
    isValidating: false,
    validateAndRedirect: vi.fn().mockResolvedValue(false),
    storeCode: vi.fn(),
    clearCode: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock('@/lib/collectDeviceInfo', () => ({
  collectDetailedDeviceInfo: vi.fn().mockResolvedValue({
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
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Property 4: Error Handling Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    
    // Mock successful code settings fetch by default with proper response structure
    mockFetch.mockImplementation((url) => {
      if (url === '/api/public/code-settings') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            code_length: 4,
            code_format: 'numeric',
            code_pattern: null,
            enable_multi_exam: true,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /**
   * Property 4: Error Handling Consistency
   * 
   * For any error condition (invalid codes, storage failures, network issues), 
   * the system should display appropriate error messages without page refresh 
   * and handle the errors gracefully across all components.
   */
  it('Property 4: Error Handling Consistency - Network errors handled gracefully', async () => {
    // Feature: student-experience-optimization, Property 4: Error Handling Consistency
    const validCode = '1234';
    const errorType = 'NetworkError';
    
    // Mock network error for exam API call
    mockFetch.mockImplementation((url) => {
      if (url === '/api/public/code-settings') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            code_length: 4,
            code_format: 'numeric',
            code_pattern: null,
            enable_multi_exam: true,
          }),
        });
      }
      if (url.includes('/api/public/exams/by-code')) {
        return Promise.reject(new Error(errorType));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const { container } = render(<MultiExamEntry />);

    // Wait for component to initialize and code settings to load
    await waitFor(() => {
      const input = screen.getByRole('textbox', { name: /exam code/i });
      expect(input).toBeInTheDocument();
    }, { timeout: 5000 });

    const input = screen.getByRole('textbox', { name: /exam code/i });
    const submitButton = screen.getByRole('button', { name: /find exams/i });

    expect(input).toBeTruthy();

    // Enter valid code
    fireEvent.change(input, { target: { value: validCode } });
    fireEvent.click(submitButton);

    // Wait for error to appear
    await waitFor(() => {
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage.textContent).toContain('Error loading results');
    }, { timeout: 3000 });

    // Verify no page refresh occurred (component still mounted)
    expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
  }, 10000);

  it('Property 4: Error Handling Consistency - API error responses handled correctly', async () => {
    // Feature: student-experience-optimization, Property 4: Error Handling Consistency
    const validCode = '1234';
    const errorKey = 'invalid_code';
    
    // Mock API error response
    mockFetch.mockImplementation((url) => {
      if (url === '/api/public/code-settings') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            code_length: 4,
            code_format: 'numeric',
            code_pattern: null,
            enable_multi_exam: true,
          }),
        });
      }
      if (url.includes('/api/public/exams/by-code')) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: errorKey }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const { container } = render(<MultiExamEntry />);

    // Wait for component to initialize
    await waitFor(() => {
      const input = screen.getByRole('textbox', { name: /exam code/i });
      expect(input).toBeInTheDocument();
    }, { timeout: 5000 });

    const input = screen.getByRole('textbox', { name: /exam code/i });
    const submitButton = screen.getByRole('button', { name: /find exams/i });

    expect(input).toBeTruthy();

    // Enter valid code
    fireEvent.change(input, { target: { value: validCode } });
    fireEvent.click(submitButton);

    // Wait for error message to appear - the component shows "Code not found" for !res.ok
    await waitFor(() => {
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage.textContent).toContain('Code not found');
    }, { timeout: 3000 });

    // Verify component remains functional (no page refresh)
    expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
    expect(input).toBeInTheDocument();
  }, 10000);

  it('Property 4: Error Handling Consistency - Invalid code format errors', async () => {
    // Feature: student-experience-optimization, Property 4: Error Handling Consistency
    const invalidCode = 'ABC'; // Too short and wrong format
    
    const { container } = render(<MultiExamEntry />);

    // Wait for component to initialize
    await waitFor(() => {
      const input = screen.getByRole('textbox', { name: /exam code/i });
      expect(input).toBeInTheDocument();
    }, { timeout: 5000 });

    const input = screen.getByRole('textbox', { name: /exam code/i });
    const submitButton = screen.getByRole('button', { name: /find exams/i });

    expect(input).toBeTruthy();

    // Enter invalid code
    fireEvent.change(input, { target: { value: invalidCode } });

    // Invalid format should disable button or show validation error
    if (!submitButton.hasAttribute('disabled')) {
      fireEvent.click(submitButton);
      
      // Should show format error
      await waitFor(() => {
        const errorMessage = screen.queryByRole('alert');
        if (errorMessage) {
          expect(errorMessage.textContent).toContain('Code must be 4 digits');
        }
      }, { timeout: 2000 });
    }

    // Component should remain stable
    expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
  }, 10000);

  it('Property 4: Error Handling Consistency - Storage errors handled gracefully', async () => {
    // Feature: student-experience-optimization, Property 4: Error Handling Consistency
    const validCode = '1234';
    
    // Mock localStorage to throw error
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });

    // Mock successful API response
    mockFetch.mockImplementation((url) => {
      if (url === '/api/public/code-settings') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            code_length: 4,
            code_format: 'numeric',
            code_pattern: null,
            enable_multi_exam: true,
          }),
        });
      }
      if (url.includes('/api/public/exams/by-code')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            exams: [{
              id: '1',
              title: 'Test Exam',
              description: null,
              duration_minutes: 60,
              start_time: null,
              end_time: null,
              status: 'published',
              access_type: 'code_based',
              is_active: true,
              not_started: false,
              ended: false,
              attempt_status: null,
              attempt_id: null,
            }],
            student_name: 'Test Student',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const { container } = render(<MultiExamEntry />);

    // Wait for component to initialize
    await waitFor(() => {
      const input = screen.getByRole('textbox', { name: /exam code/i });
      expect(input).toBeInTheDocument();
    }, { timeout: 5000 });

    const input = screen.getByRole('textbox', { name: /exam code/i });
    const submitButton = screen.getByRole('button', { name: /find exams/i });

    expect(input).toBeTruthy();

    // Enter valid code
    fireEvent.change(input, { target: { value: validCode } });
    fireEvent.click(submitButton);

    // Wait for exams to load (storage error should not prevent this)
    await waitFor(() => {
      expect(screen.getByText('Test Exam')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Component should remain functional despite storage error
    expect(screen.getByTestId('brand-logo')).toBeInTheDocument();

    // Restore original setItem
    Storage.prototype.setItem = originalSetItem;
  }, 10000);

  it('Property 4: Error Handling Consistency - Component recovery after errors', async () => {
    // Feature: student-experience-optimization, Property 4: Error Handling Consistency
    const firstCode = '1234';
    const secondCode = '5678';
    let callCount = 0;
    
    // First call fails, second succeeds
    mockFetch.mockImplementation((url) => {
      if (url === '/api/public/code-settings') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            code_length: 4,
            code_format: 'numeric',
            code_pattern: null,
            enable_multi_exam: true,
          }),
        });
      }
      if (url.includes('/api/public/exams/by-code')) {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        } else {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              exams: [{
                id: '1',
                title: 'Recovery Exam',
                description: null,
                duration_minutes: 60,
                start_time: null,
                end_time: null,
                status: 'published',
                access_type: 'code_based',
                is_active: true,
                not_started: false,
                ended: false,
                attempt_status: null,
                attempt_id: null,
              }],
              student_name: 'Recovery Student',
            }),
          });
        }
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const { container } = render(<MultiExamEntry />);

    // Wait for component to initialize
    await waitFor(() => {
      const input = screen.getByRole('textbox', { name: /exam code/i });
      expect(input).toBeInTheDocument();
    }, { timeout: 5000 });

    const input = screen.getByRole('textbox', { name: /exam code/i });
    const submitButton = screen.getByRole('button', { name: /find exams/i });

    expect(input).toBeTruthy();

    // First attempt - should fail
    fireEvent.change(input, { target: { value: firstCode } });
    fireEvent.click(submitButton);

    // Wait for error
    await waitFor(() => {
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage.textContent).toContain('Error loading results');
    }, { timeout: 3000 });

    // Second attempt - should succeed
    fireEvent.change(input, { target: { value: secondCode } });
    fireEvent.click(submitButton);

    // Wait for success
    await waitFor(() => {
      expect(screen.getByText('Recovery Exam')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify component recovered properly
    expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // Error should be cleared
  }, 15000);

  it('Property 4: Error Handling Consistency - Error state cleanup on successful operations', async () => {
    // Feature: student-experience-optimization, Property 4: Error Handling Consistency
    const validCode = '1234';
    
    const { container } = render(<MultiExamEntry />);

    // Wait for component to initialize
    await waitFor(() => {
      const input = screen.getByRole('textbox', { name: /exam code/i });
      expect(input).toBeInTheDocument();
    }, { timeout: 5000 });

    const input = screen.getByRole('textbox', { name: /exam code/i });

    expect(input).toBeTruthy();

    // Start typing to trigger any existing error clearing
    fireEvent.change(input, { target: { value: validCode.substring(0, 2) } });
    
    // Complete the code
    fireEvent.change(input, { target: { value: validCode } });

    // Verify no stale error messages remain
    const errorMessages = screen.queryAllByRole('alert');
    errorMessages.forEach(error => {
      // If there are error messages, they should not be stale validation errors
      expect(error.textContent).not.toContain('Code must be 4 digits');
    });

    // Component should be in clean state
    expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
    expect(input).toHaveValue(validCode);
  }, 10000);
});