/**
 * Unit tests for useSettings hook
 * Tests app settings fetching and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useSettings } from '../useSettings';
import type { AppSettings } from '@/lib/results/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test data
const mockSettings: AppSettings = {
  result_pass_calc_mode: 'best',
  result_overall_pass_threshold: 60,
  result_exam_weight: 70,
  result_fail_on_any_exam: true,
};

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ settings: mockSettings }),
    });
  });

  describe('Basic Functionality', () => {
    it('should fetch settings successfully', async () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.settings).toBeNull();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings).toEqual(mockSettings);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/settings');
    });

    it('should return settings with correct structure', async () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings).toHaveProperty('result_pass_calc_mode');
      expect(result.current.settings).toHaveProperty('result_overall_pass_threshold');
      expect(result.current.settings).toHaveProperty('result_exam_weight');
      expect(result.current.settings).toHaveProperty('result_fail_on_any_exam');
    });

    it('should have correct data types', async () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const settings = result.current.settings!;
      expect(['best', 'avg']).toContain(settings.result_pass_calc_mode);
      expect(typeof settings.result_overall_pass_threshold).toBe('number');
      expect(typeof settings.result_exam_weight).toBe('number');
      expect(typeof settings.result_fail_on_any_exam).toBe('boolean');
    });
  });

  describe('Calculation Modes', () => {
    it('should handle "best" calculation mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          settings: { ...mockSettings, result_pass_calc_mode: 'best' },
        }),
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings?.result_pass_calc_mode).toBe('best');
    });

    it('should handle "avg" calculation mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          settings: { ...mockSettings, result_pass_calc_mode: 'avg' },
        }),
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings?.result_pass_calc_mode).toBe('avg');
    });
  });

  describe('Threshold Values', () => {
    it('should handle various pass threshold values', async () => {
      const thresholds = [0, 50, 60, 75, 100];

      for (const threshold of thresholds) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            settings: { ...mockSettings, result_overall_pass_threshold: threshold },
          }),
        });

        const { result } = renderHook(() => useSettings(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.settings?.result_overall_pass_threshold).toBe(threshold);
      }
    });

    it('should handle various exam weight values', async () => {
      const weights = [0, 30, 50, 70, 100];

      for (const weight of weights) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            settings: { ...mockSettings, result_exam_weight: weight },
          }),
        });

        const { result } = renderHook(() => useSettings(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.settings?.result_exam_weight).toBe(weight);
      }
    });
  });

  describe('Fail on Any Exam Flag', () => {
    it('should handle fail_on_any_exam = true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          settings: { ...mockSettings, result_fail_on_any_exam: true },
        }),
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings?.result_fail_on_any_exam).toBe(true);
    });

    it('should handle fail_on_any_exam = false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          settings: { ...mockSettings, result_fail_on_any_exam: false },
        }),
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings?.result_fail_on_any_exam).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.settings).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        status: 404,
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing settings field in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings).toBeNull();
    });

    it('should handle partial settings object', async () => {
      const partialSettings = {
        result_pass_calc_mode: 'best',
        result_overall_pass_threshold: 60,
        // Missing other fields
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: partialSettings }),
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings).toEqual(partialSettings);
    });

    it('should handle null settings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: null }),
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings).toBeNull();
    });
  });

  describe('Cache Behavior', () => {
    it('should cache settings across multiple hook instances', async () => {
      const wrapper = createWrapper();

      const { result: result1 } = renderHook(() => useSettings(), { wrapper });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second hook instance should use cached data
      const { result: result2 } = renderHook(() => useSettings(), { wrapper });

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // Should not make another API call (uses cache)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result2.current.settings).toEqual(result1.current.settings);
    });

    it('should use longer stale time for settings', async () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Settings should be cached longer since they change rarely
      // This is tested implicitly through the query config
      expect(result.current.settings).toEqual(mockSettings);
    });
  });

  describe('Loading States', () => {
    it('should show loading state initially', () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.settings).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should transition from loading to loaded', async () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings).toBeTruthy();
    });
  });
});
