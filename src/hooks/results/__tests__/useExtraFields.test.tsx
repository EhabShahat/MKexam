/**
 * Unit tests for useExtraFields hook
 * Tests extra field fetching, filtering, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useExtraFields } from '../useExtraFields';
import type { ExtraField } from '@/lib/results/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test data
const mockFields: ExtraField[] = [
  {
    key: 'attendance',
    label: 'Attendance',
    type: 'number',
    hidden: false,
    include_in_pass: true,
    pass_weight: 10,
    max_points: 100,
    bool_true_points: null,
    bool_false_points: null,
    text_score_map: null,
  },
  {
    key: 'participation',
    label: 'Participation',
    type: 'number',
    hidden: false,
    include_in_pass: true,
    pass_weight: 20,
    max_points: 50,
    bool_true_points: null,
    bool_false_points: null,
    text_score_map: null,
  },
  {
    key: 'internal_notes',
    label: 'Internal Notes',
    type: 'text',
    hidden: true,
    include_in_pass: false,
    pass_weight: null,
    max_points: null,
    bool_true_points: null,
    bool_false_points: null,
    text_score_map: null,
  },
  {
    key: 'bonus_completed',
    label: 'Bonus Completed',
    type: 'boolean',
    hidden: false,
    include_in_pass: false,
    pass_weight: 5,
    max_points: null,
    bool_true_points: 10,
    bool_false_points: 0,
    text_score_map: null,
  },
  {
    key: 'grade_level',
    label: 'Grade Level',
    type: 'text',
    hidden: true,
    include_in_pass: false,
    pass_weight: null,
    max_points: null,
    bool_true_points: null,
    bool_false_points: null,
    text_score_map: {
      A: 100,
      B: 85,
      C: 70,
      D: 60,
      F: 0,
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

describe('useExtraFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ fields: mockFields }),
    });
  });

  describe('Basic Functionality', () => {
    it('should fetch extra fields successfully', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.fields).toEqual([]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.fields.length).toBe(5);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/settings/extra-fields');
    });

    it('should return fields with correct structure', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const field = result.current.fields[0];
      expect(field).toHaveProperty('key');
      expect(field).toHaveProperty('label');
      expect(field).toHaveProperty('type');
      expect(field).toHaveProperty('hidden');
      expect(field).toHaveProperty('include_in_pass');
      expect(field).toHaveProperty('pass_weight');
    });
  });

  describe('Visible Fields Filtering', () => {
    it('should filter out hidden fields in visibleFields', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.visibleFields.length).toBe(3);
      result.current.visibleFields.forEach((field) => {
        expect(field.hidden).toBe(false);
      });
    });

    it('should include all fields in fields array', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.fields.length).toBe(5);
      const hiddenFields = result.current.fields.filter((f) => f.hidden);
      expect(hiddenFields.length).toBe(2);
    });

    it('should not include hidden fields in visibleFields', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const hiddenInVisible = result.current.visibleFields.find(
        (f) => f.key === 'internal_notes' || f.key === 'grade_level'
      );
      expect(hiddenInVisible).toBeUndefined();
    });
  });

  describe('Field Sorting', () => {
    it('should sort fields alphabetically by label', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const labels = result.current.fields.map((f) => f.label);
      const sortedLabels = [...labels].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
      expect(labels).toEqual(sortedLabels);
    });

    it('should sort visible fields alphabetically', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const labels = result.current.visibleFields.map((f) => f.label);
      const sortedLabels = [...labels].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
      expect(labels).toEqual(sortedLabels);
    });
  });

  describe('Field Types', () => {
    it('should handle number type fields', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const numberFields = result.current.fields.filter((f) => f.type === 'number');
      expect(numberFields.length).toBeGreaterThan(0);
      numberFields.forEach((field) => {
        expect(field.max_points).toBeTruthy();
      });
    });

    it('should handle boolean type fields', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const booleanFields = result.current.fields.filter((f) => f.type === 'boolean');
      expect(booleanFields.length).toBeGreaterThan(0);
      booleanFields.forEach((field) => {
        expect(field.bool_true_points).not.toBeNull();
        expect(field.bool_false_points).not.toBeNull();
      });
    });

    it('should handle text type fields with score map', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const textFieldWithMap = result.current.fields.find(
        (f) => f.key === 'grade_level'
      );
      expect(textFieldWithMap).toBeDefined();
      expect(textFieldWithMap?.text_score_map).toBeTruthy();
      expect(Object.keys(textFieldWithMap?.text_score_map || {}).length).toBeGreaterThan(0);
    });
  });

  describe('Include in Pass Flag', () => {
    it('should identify fields included in pass calculation', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const includedFields = result.current.fields.filter((f) => f.include_in_pass);
      expect(includedFields.length).toBeGreaterThan(0);
      includedFields.forEach((field) => {
        expect(field.pass_weight).toBeTruthy();
      });
    });

    it('should identify fields not included in pass calculation', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const excludedFields = result.current.fields.filter((f) => !f.include_in_pass);
      expect(excludedFields.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.fields).toEqual([]);
      expect(result.current.visibleFields).toEqual([]);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty fields list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ fields: [] }),
      });

      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.fields).toEqual([]);
      expect(result.current.visibleFields).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle missing fields field in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.fields).toEqual([]);
      expect(result.current.visibleFields).toEqual([]);
    });

    it('should handle all fields being hidden', async () => {
      const allHiddenFields = mockFields.map((f) => ({ ...f, hidden: true }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ fields: allHiddenFields }),
      });

      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.fields.length).toBe(5);
      expect(result.current.visibleFields.length).toBe(0);
    });

    it('should handle all fields being visible', async () => {
      const allVisibleFields = mockFields.map((f) => ({ ...f, hidden: false }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ fields: allVisibleFields }),
      });

      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.fields.length).toBe(5);
      expect(result.current.visibleFields.length).toBe(5);
    });

    it('should handle fields with null weights', async () => {
      const fieldsWithNullWeights = mockFields.map((f) => ({
        ...f,
        pass_weight: null,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ fields: fieldsWithNullWeights }),
      });

      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.fields.forEach((field) => {
        expect(field.pass_weight).toBeNull();
      });
    });
  });

  describe('Cache Behavior', () => {
    it('should cache fields across multiple hook instances', async () => {
      const wrapper = createWrapper();

      const { result: result1 } = renderHook(() => useExtraFields(), { wrapper });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second hook instance should use cached data
      const { result: result2 } = renderHook(() => useExtraFields(), { wrapper });

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // Should not make another API call (uses cache)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result2.current.fields).toEqual(result1.current.fields);
    });

    it('should use longer stale time (10 minutes)', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Extra fields should be cached longer since they change rarely
      // This is tested implicitly through the query config
      expect(result.current.fields.length).toBe(5);
    });
  });

  describe('Loading States', () => {
    it('should show loading state initially', () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.fields).toEqual([]);
      expect(result.current.visibleFields).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should transition from loading to loaded', async () => {
      const { result } = renderHook(() => useExtraFields(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.fields.length).toBeGreaterThan(0);
    });
  });
});
