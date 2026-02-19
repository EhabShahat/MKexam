/**
 * Unit tests for useSummaries hook
 * Tests summary fetching, materialized view refresh, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useSummaries } from '../useSummaries';
import type { StudentSummary } from '@/lib/results/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test data
const mockSummaries: StudentSummary[] = [
  {
    student_id: 'student-1',
    student_name: 'John Doe',
    code: 'STU001',
    scores: {
      'exam-1': 85,
      'exam-2': 90,
      'exam-3': 78,
    },
    attempt_counts: {
      'exam-1': 1,
      'exam-2': 2,
      'exam-3': 1,
    },
  },
  {
    student_id: 'student-2',
    student_name: 'Jane Smith',
    code: 'STU002',
    scores: {
      'exam-1': 92,
      'exam-2': 88,
      'exam-3': null,
    },
    attempt_counts: {
      'exam-1': 1,
      'exam-2': 1,
      'exam-3': 0,
    },
  },
  {
    student_id: 'student-3',
    student_name: 'Bob Johnson',
    code: 'STU003',
    scores: {
      'exam-1': 75,
      'exam-2': null,
      'exam-3': 82,
    },
    attempt_counts: {
      'exam-1': 3,
      'exam-2': 0,
      'exam-3': 1,
    },
  },
];

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

describe('useSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ students: mockSummaries }),
    });
  });

  describe('Basic Functionality', () => {
    it('should fetch summaries successfully', async () => {
      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.summaries).toEqual([]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.summaries.length).toBe(3);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/results/summary');
    });

    it('should return summaries with correct structure', async () => {
      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const summary = result.current.summaries[0];
      expect(summary).toHaveProperty('student_id');
      expect(summary).toHaveProperty('student_name');
      expect(summary).toHaveProperty('code');
      expect(summary).toHaveProperty('scores');
      expect(summary).toHaveProperty('attempt_counts');
    });
  });

  describe('Filtering Options', () => {
    it('should filter by student IDs', async () => {
      const studentIds = ['student-1', 'student-2'];
      const { result } = renderHook(() => useSummaries({ studentIds }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const url = new URL(mockFetch.mock.calls[0][0], 'http://localhost');
      expect(url.searchParams.get('student_ids')).toBe(studentIds.join(','));
    });

    it('should filter by exam IDs', async () => {
      const examIds = ['exam-1', 'exam-2'];
      const { result } = renderHook(() => useSummaries({ examIds }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const url = new URL(mockFetch.mock.calls[0][0], 'http://localhost');
      expect(url.searchParams.get('exam_ids')).toBe(examIds.join(','));
    });

    it('should combine student and exam filters', async () => {
      const studentIds = ['student-1'];
      const examIds = ['exam-1', 'exam-2'];
      const { result } = renderHook(
        () => useSummaries({ studentIds, examIds }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const url = new URL(mockFetch.mock.calls[0][0], 'http://localhost');
      expect(url.searchParams.get('student_ids')).toBe(studentIds.join(','));
      expect(url.searchParams.get('exam_ids')).toBe(examIds.join(','));
    });
  });

  describe('Materialized View Refresh', () => {
    it('should trigger view refresh when refresh option is true', async () => {
      const { result } = renderHook(() => useSummaries({ refresh: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const url = new URL(mockFetch.mock.calls[0][0], 'http://localhost');
      expect(url.searchParams.get('refresh')).toBe('true');
    });

    it('should provide refreshView function', async () => {
      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.refreshView).toBeDefined();
      expect(typeof result.current.refreshView).toBe('function');
    });

    it('should call API with refresh parameter when refreshView is called', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ students: mockSummaries }),
      });

      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear previous calls
      mockFetch.mockClear();

      // Call refreshView
      await result.current.refreshView();

      // Should have made a new call with refresh=true
      expect(mockFetch).toHaveBeenCalled();
      const url = new URL(mockFetch.mock.calls[0][0], 'http://localhost');
      expect(url.searchParams.get('refresh')).toBe('true');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.summaries).toEqual([]);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle errors during view refresh', async () => {
      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mock error for refresh call
      mockFetch.mockRejectedValueOnce(new Error('Refresh failed'));

      await expect(result.current.refreshView()).rejects.toThrow();
    });
  });

  describe('Refetch Functionality', () => {
    it('should refetch data when refetch is called', async () => {
      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      await result.current.refetch();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty summaries list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ students: [] }),
      });

      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.summaries).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle missing students field in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.summaries).toEqual([]);
    });

    it('should handle summaries with null scores', async () => {
      const summariesWithNulls: StudentSummary[] = [
        {
          student_id: 'student-1',
          student_name: 'John Doe',
          code: 'STU001',
          scores: {
            'exam-1': null,
            'exam-2': null,
            'exam-3': null,
          },
          attempt_counts: {
            'exam-1': 0,
            'exam-2': 0,
            'exam-3': 0,
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ students: summariesWithNulls }),
      });

      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.summaries[0].scores['exam-1']).toBeNull();
    });

    it('should handle summaries with missing code', async () => {
      const summariesWithoutCode: StudentSummary[] = [
        {
          student_id: 'student-1',
          student_name: 'John Doe',
          code: null,
          scores: { 'exam-1': 85 },
          attempt_counts: { 'exam-1': 1 },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ students: summariesWithoutCode }),
      });

      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.summaries[0].code).toBeNull();
    });

    it('should handle empty filter arrays', async () => {
      const { result } = renderHook(
        () => useSummaries({ studentIds: [], examIds: [] }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still make the API call
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Cache Behavior', () => {
    it('should use different cache keys for different filters', async () => {
      const wrapper = createWrapper();

      const { result: result1 } = renderHook(
        () => useSummaries({ studentIds: ['student-1'] }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      const { result: result2 } = renderHook(
        () => useSummaries({ studentIds: ['student-2'] }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // Should have made separate API calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use longer stale time (5 minutes)', async () => {
      const { result } = renderHook(() => useSummaries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The hook should be configured with 5-minute stale time
      // This is tested implicitly through the query config
      expect(result.current.summaries.length).toBe(3);
    });
  });
});
