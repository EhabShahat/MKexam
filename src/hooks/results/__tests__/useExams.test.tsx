/**
 * Unit tests for useExams hook
 * Tests exam fetching, filtering, sorting, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useExams } from '../useExams';
import type { Exam } from '@/lib/results/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test data
const mockExams: Exam[] = [
  {
    id: 'exam-1',
    title: 'Mathematics Final',
    status: 'published',
    access_type: 'open',
    exam_type: 'exam',
    scheduling_mode: 'Manual',
    is_manually_published: true,
    is_archived: false,
    start_time: null,
    end_time: null,
    include_in_pass: true,
    pass_threshold: 60,
  },
  {
    id: 'exam-2',
    title: 'Physics Quiz',
    status: 'draft',
    access_type: 'code',
    exam_type: 'quiz',
    scheduling_mode: 'Manual',
    is_manually_published: false,
    is_archived: false,
    start_time: null,
    end_time: null,
    include_in_pass: true,
    pass_threshold: 50,
  },
  {
    id: 'exam-3',
    title: 'Chemistry Homework',
    status: 'published',
    access_type: 'open',
    exam_type: 'homework',
    scheduling_mode: 'Auto',
    is_manually_published: false,
    is_archived: false,
    start_time: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    end_time: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
    include_in_pass: false,
    pass_threshold: 70,
  },
  {
    id: 'exam-4',
    title: 'Archived Exam',
    status: 'completed',
    access_type: 'open',
    exam_type: 'exam',
    scheduling_mode: 'Manual',
    is_manually_published: true,
    is_archived: true,
    start_time: null,
    end_time: null,
    include_in_pass: true,
    pass_threshold: 60,
  },
  {
    id: 'exam-5',
    title: 'Biology Test',
    status: 'completed',
    access_type: 'open',
    exam_type: 'exam',
    scheduling_mode: 'Auto',
    is_manually_published: false,
    is_archived: false,
    start_time: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    end_time: new Date(Date.now() - 86400000).toISOString(), // 1 day ago (completed)
    include_in_pass: true,
    pass_threshold: 65,
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

describe('useExams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ exams: mockExams }),
    });
  });

  describe('Basic Functionality', () => {
    it('should fetch and return exams successfully', async () => {
      const { result } = renderHook(() => useExams(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.exams).toEqual([]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.exams.length).toBeGreaterThan(0);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/exams');
    });

    it('should filter out archived exams', async () => {
      const { result } = renderHook(() => useExams(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const archivedExam = result.current.exams.find(
        (exam) => exam.id === 'exam-4'
      );
      expect(archivedExam).toBeUndefined();
    });

    it('should sort exams alphabetically by title', async () => {
      const { result } = renderHook(() => useExams(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const titles = result.current.exams.map((exam) => exam.title);
      const sortedTitles = [...titles].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
      expect(titles).toEqual(sortedTitles);
    });
  });

  describe('Status Filtering', () => {
    it('should filter by published status', async () => {
      const { result } = renderHook(
        () => useExams({ statusFilter: 'published' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.exams.forEach((exam) => {
        const isPublished =
          (exam.scheduling_mode === 'Manual' && exam.is_manually_published) ||
          (exam.scheduling_mode === 'Auto' &&
            exam.start_time &&
            new Date(exam.start_time) <= new Date() &&
            (!exam.end_time || new Date(exam.end_time) > new Date()));
        expect(isPublished).toBe(true);
      });
    });

    it('should filter by completed status', async () => {
      const { result } = renderHook(
        () => useExams({ statusFilter: 'completed' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.exams.forEach((exam) => {
        if (exam.scheduling_mode === 'Auto' && exam.end_time) {
          expect(new Date(exam.end_time) < new Date()).toBe(true);
        }
      });
    });

    it('should filter by draft status', async () => {
      const { result } = renderHook(() => useExams({ statusFilter: 'draft' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.exams.forEach((exam) => {
        if (exam.scheduling_mode === 'Manual') {
          expect(exam.is_manually_published).toBe(false);
        }
      });
    });

    it('should return all exams when statusFilter is "all"', async () => {
      const { result } = renderHook(() => useExams({ statusFilter: 'all' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have all non-archived exams
      expect(result.current.exams.length).toBe(4);
    });
  });

  describe('Search Filtering', () => {
    it('should filter by search term (case-insensitive)', async () => {
      const { result } = renderHook(
        () => useExams({ searchTerm: 'physics' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.exams.length).toBe(1);
      expect(result.current.exams[0].title).toBe('Physics Quiz');
    });

    it('should handle partial search matches', async () => {
      const { result } = renderHook(() => useExams({ searchTerm: 'math' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.exams.length).toBe(1);
      expect(result.current.exams[0].title).toContain('Math');
    });

    it('should return all exams when search term is empty', async () => {
      const { result } = renderHook(() => useExams({ searchTerm: '' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.exams.length).toBe(4);
    });

    it('should trim whitespace from search term', async () => {
      const { result } = renderHook(
        () => useExams({ searchTerm: '  physics  ' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.exams.length).toBe(1);
      expect(result.current.exams[0].title).toBe('Physics Quiz');
    });
  });

  describe('Combined Filtering', () => {
    it('should apply both status and search filters', async () => {
      const { result } = renderHook(
        () =>
          useExams({
            statusFilter: 'published',
            searchTerm: 'chemistry',
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.exams.length).toBe(1);
      expect(result.current.exams[0].title).toBe('Chemistry Homework');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useExams(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.exams).toEqual([]);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useExams(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Refetch Functionality', () => {
    it('should refetch data when refetch is called', async () => {
      const { result } = renderHook(() => useExams(), {
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
    it('should handle empty exam list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ exams: [] }),
      });

      const { result } = renderHook(() => useExams(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.exams).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle missing exams field in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useExams(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.exams).toEqual([]);
    });
  });
});
