/**
 * Unit tests for useAttempts hook
 * Tests attempt fetching, device usage calculation, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAttempts } from '../useAttempts';
import type { Attempt } from '@/lib/results/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test data
const mockAttempts: Attempt[] = [
  {
    id: 'attempt-1',
    student_id: 'student-1',
    student_name: 'John Doe',
    code: 'STU001',
    completion_status: 'completed',
    started_at: '2024-01-15T10:00:00Z',
    submitted_at: '2024-01-15T11:30:00Z',
    score_percentage: 85,
    final_score_percentage: 85,
    ip_address: '192.168.1.100',
    device_info: JSON.stringify({
      type: 'desktop',
      oem: { brand: 'Apple', model: 'MacBook Pro' },
      allIPs: { local: ['192.168.1.50'] },
      security: { automationRisk: false, webdriver: false },
    }),
    manual_total_count: 0,
    manual_graded_count: 0,
    manual_pending_count: 0,
  },
  {
    id: 'attempt-2',
    student_id: 'student-2',
    student_name: 'Jane Smith',
    code: 'STU002',
    completion_status: 'completed',
    started_at: '2024-01-15T11:00:00Z',
    submitted_at: '2024-01-15T12:00:00Z',
    score_percentage: 92,
    final_score_percentage: 90,
    ip_address: '192.168.1.101',
    device_info: JSON.stringify({
      type: 'mobile',
      oem: { brand: 'Samsung', model: 'Galaxy S21' },
      allIPs: { local: ['192.168.1.51'] },
      security: { automationRisk: false, webdriver: false },
    }),
    manual_total_count: 2,
    manual_graded_count: 2,
    manual_pending_count: 0,
  },
  {
    id: 'attempt-3',
    student_id: 'student-3',
    student_name: 'Bob Johnson',
    code: 'STU003',
    completion_status: 'in_progress',
    started_at: '2024-01-15T12:00:00Z',
    submitted_at: null,
    score_percentage: null,
    final_score_percentage: null,
    ip_address: '192.168.1.100', // Same IP as attempt-1
    device_info: JSON.stringify({
      type: 'desktop',
      oem: { brand: 'Apple', model: 'MacBook Pro' },
      allIPs: { local: ['192.168.1.50'] },
      security: { automationRisk: false, webdriver: false },
    }),
    manual_total_count: 0,
    manual_graded_count: 0,
    manual_pending_count: 0,
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

describe('useAttempts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ attempts: mockAttempts }),
    });
  });

  describe('Basic Functionality', () => {
    it('should fetch attempts for a specific exam', async () => {
      const { result } = renderHook(() => useAttempts('exam-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.attempts).toEqual([]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.attempts.length).toBe(3);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/exams/exam-1/attempts');
    });

    it('should use bulk API when examId is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ allAttempts: mockAttempts }),
      });

      const { result } = renderHook(() => useAttempts(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/attempts/bulk');
      expect(result.current.attempts.length).toBe(3);
    });

    it('should use bulk API when examId is "__ALL__"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ allAttempts: mockAttempts }),
      });

      const { result } = renderHook(() => useAttempts('__ALL__'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/attempts/bulk');
    });
  });

  describe('Device Usage Calculation', () => {
    it('should calculate device usage map correctly', async () => {
      const { result } = renderHook(() => useAttempts('exam-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.deviceUsageMap).toBeDefined();
      expect(result.current.deviceUsageMap.size).toBeGreaterThan(0);
    });

    it('should count duplicate IP addresses', async () => {
      const { result } = renderHook(() => useAttempts('exam-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // IP 192.168.1.100 is used twice
      const ipUsage = result.current.deviceUsageMap.get('192.168.1.100');
      expect(ipUsage).toBe(2);
    });

    it('should handle attempts without device info', async () => {
      const attemptsWithoutDevice: Attempt[] = [
        {
          ...mockAttempts[0],
          device_info: null,
          ip_address: null,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ attempts: attemptsWithoutDevice }),
      });

      const { result } = renderHook(() => useAttempts('exam-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.attempts.length).toBe(1);
      expect(result.current.deviceUsageMap.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useAttempts('exam-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.attempts).toEqual([]);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAttempts('exam-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle malformed JSON in device_info', async () => {
      const attemptsWithBadJson: Attempt[] = [
        {
          ...mockAttempts[0],
          device_info: 'invalid json{',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ attempts: attemptsWithBadJson }),
      });

      const { result } = renderHook(() => useAttempts('exam-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still return attempts even with bad device_info
      expect(result.current.attempts.length).toBe(1);
    });
  });

  describe('Refetch Functionality', () => {
    it('should refetch data when refetch is called', async () => {
      const { result } = renderHook(() => useAttempts('exam-1'), {
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
    it('should handle empty attempts list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ attempts: [] }),
      });

      const { result } = renderHook(() => useAttempts('exam-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.attempts).toEqual([]);
      expect(result.current.deviceUsageMap.size).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it('should handle missing attempts field in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useAttempts('exam-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.attempts).toEqual([]);
    });

    it('should handle attempts with null scores', async () => {
      const attemptsWithNullScores: Attempt[] = [
        {
          ...mockAttempts[0],
          score_percentage: null,
          final_score_percentage: null,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ attempts: attemptsWithNullScores }),
      });

      const { result } = renderHook(() => useAttempts('exam-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.attempts[0].score_percentage).toBeNull();
      expect(result.current.attempts[0].final_score_percentage).toBeNull();
    });

    it('should handle attempts with pending manual grading', async () => {
      const attemptsWithPending: Attempt[] = [
        {
          ...mockAttempts[0],
          manual_total_count: 3,
          manual_graded_count: 1,
          manual_pending_count: 2,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ attempts: attemptsWithPending }),
      });

      const { result } = renderHook(() => useAttempts('exam-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.attempts[0].manual_pending_count).toBe(2);
    });
  });

  describe('Cache Behavior', () => {
    it('should use different cache keys for different exams', async () => {
      const wrapper = createWrapper();

      const { result: result1 } = renderHook(() => useAttempts('exam-1'), {
        wrapper,
      });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      const { result: result2 } = renderHook(() => useAttempts('exam-2'), {
        wrapper,
      });

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // Should have made separate API calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/exams/exam-1/attempts');
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/exams/exam-2/attempts');
    });
  });
});
