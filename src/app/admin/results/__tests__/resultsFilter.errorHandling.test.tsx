/**
 * Unit tests for error handling in results filter persistence
 * 
 * Tests cover:
 * - sessionStorage errors are handled gracefully
 * - Invalid filter values are cleared from storage
 * - Filter system works without sessionStorage
 * - Appropriate fallbacks are used
 */

import { renderHook, act } from '@testing-library/react';
import { useState, useEffect } from 'react';
import type { StatusFilterValue } from '@/components/admin/StatusFilter';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Simulate the filter persistence logic from the results page
function useFilterPersistence() {
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('published');

  // Load filter from sessionStorage on mount
  useEffect(() => {
    try {
      const savedFilter = sessionStorage.getItem('results-status-filter');
      
      // Validate saved filter value
      if (savedFilter !== null) {
        if (savedFilter === 'all' || savedFilter === 'published' || savedFilter === 'completed') {
          setStatusFilter(savedFilter as StatusFilterValue);
        } else {
          // Clear invalid value from storage
          console.warn(`Invalid filter value in sessionStorage: "${savedFilter}". Clearing.`);
          try {
            sessionStorage.removeItem('results-status-filter');
          } catch (clearError) {
            // Ignore errors when clearing
            console.debug('Failed to clear invalid filter from sessionStorage', clearError);
          }
        }
      }
    } catch (error) {
      // Ignore errors (e.g., if sessionStorage is not available)
      console.warn('Failed to load filter from sessionStorage:', error);
    }
  }, []);

  // Save filter to sessionStorage when it changes
  useEffect(() => {
    try {
      sessionStorage.setItem('results-status-filter', statusFilter);
    } catch (error) {
      // Ignore errors (e.g., if sessionStorage is not available)
      console.warn('Failed to save filter to sessionStorage:', error);
    }
  }, [statusFilter]);

  return { statusFilter, setStatusFilter };
}

describe('Results Filter - Error Handling', () => {
  let sessionStorageMock: Record<string, string>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock sessionStorage
    sessionStorageMock = {};
    
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn((key: string) => sessionStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          sessionStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete sessionStorageMock[key];
        }),
        clear: vi.fn(() => {
          sessionStorageMock = {};
        }),
      },
      writable: true,
    });

    // Spy on console methods
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('sessionStorage error handling', () => {
    it('should handle sessionStorage.getItem errors gracefully', () => {
      // Mock getItem to throw an error
      (window.sessionStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('sessionStorage is disabled');
      });

      const { result } = renderHook(() => useFilterPersistence());

      // Should fall back to default 'published'
      expect(result.current.statusFilter).toBe('published');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to load filter from sessionStorage:',
        expect.any(Error)
      );
    });

    it('should handle sessionStorage.setItem errors gracefully', () => {
      // Mock setItem to throw an error
      (window.sessionStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('sessionStorage is full');
      });

      const { result } = renderHook(() => useFilterPersistence());

      // Should still be able to change filter (just not persist it)
      act(() => {
        result.current.setStatusFilter('all');
      });

      expect(result.current.statusFilter).toBe('all');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save filter to sessionStorage:',
        expect.any(Error)
      );
    });

    it('should handle sessionStorage.removeItem errors gracefully when clearing invalid values', () => {
      // Set an invalid value
      sessionStorageMock['results-status-filter'] = 'invalid-filter';

      // Mock removeItem to throw an error
      (window.sessionStorage.removeItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Cannot remove item');
      });

      const { result } = renderHook(() => useFilterPersistence());

      // Should still work and fall back to default
      expect(result.current.statusFilter).toBe('published');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Invalid filter value in sessionStorage: "invalid-filter". Clearing.'
      );
    });

    it('should work when sessionStorage is completely unavailable', () => {
      // Remove sessionStorage entirely
      Object.defineProperty(window, 'sessionStorage', {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useFilterPersistence());

      // Should fall back to default 'published'
      expect(result.current.statusFilter).toBe('published');
    });
  });

  describe('Invalid value handling', () => {
    it('should clear invalid filter value from sessionStorage', () => {
      sessionStorageMock['results-status-filter'] = 'invalid-filter';

      renderHook(() => useFilterPersistence());

      // Should have attempted to remove the invalid value
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('results-status-filter');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid filter value in sessionStorage: "invalid-filter"'),
        expect.anything()
      );
    });

    it('should clear empty string from sessionStorage', () => {
      sessionStorageMock['results-status-filter'] = '';

      renderHook(() => useFilterPersistence());

      // Should have attempted to remove the invalid value
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('results-status-filter');
    });

    it('should clear numeric value from sessionStorage', () => {
      sessionStorageMock['results-status-filter'] = '123';

      renderHook(() => useFilterPersistence());

      // Should have attempted to remove the invalid value
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('results-status-filter');
    });

    it('should clear object-like value from sessionStorage', () => {
      sessionStorageMock['results-status-filter'] = '{"filter":"all"}';

      renderHook(() => useFilterPersistence());

      // Should have attempted to remove the invalid value
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('results-status-filter');
    });

    it('should accept valid "all" value', () => {
      sessionStorageMock['results-status-filter'] = 'all';

      const { result } = renderHook(() => useFilterPersistence());

      expect(result.current.statusFilter).toBe('all');
      expect(window.sessionStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should accept valid "published" value', () => {
      sessionStorageMock['results-status-filter'] = 'published';

      const { result } = renderHook(() => useFilterPersistence());

      expect(result.current.statusFilter).toBe('published');
      expect(window.sessionStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should accept valid "completed" value', () => {
      sessionStorageMock['results-status-filter'] = 'completed';

      const { result } = renderHook(() => useFilterPersistence());

      expect(result.current.statusFilter).toBe('completed');
      expect(window.sessionStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('Fallback behavior', () => {
    it('should use "published" as default when no storage', () => {
      // Remove sessionStorage entirely
      Object.defineProperty(window, 'sessionStorage', {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useFilterPersistence());

      expect(result.current.statusFilter).toBe('published');
    });

    it('should use "published" as default when storage is empty', () => {
      const { result } = renderHook(() => useFilterPersistence());

      expect(result.current.statusFilter).toBe('published');
    });
  });

  describe('Filter switching with errors', () => {
    it('should still switch filter even if sessionStorage fails', () => {
      // Mock setItem to throw an error
      (window.sessionStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('sessionStorage is full');
      });

      const { result } = renderHook(() => useFilterPersistence());

      // Initial filter
      expect(result.current.statusFilter).toBe('published');

      // Switch filter
      act(() => {
        result.current.setStatusFilter('all');
      });

      // Filter should change even though persistence failed
      expect(result.current.statusFilter).toBe('all');
    });

    it('should switch between all filter values even if sessionStorage fails', () => {
      // Mock setItem to throw an error
      (window.sessionStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('sessionStorage is full');
      });

      const { result } = renderHook(() => useFilterPersistence());

      // Test all transitions
      act(() => {
        result.current.setStatusFilter('all');
      });
      expect(result.current.statusFilter).toBe('all');

      act(() => {
        result.current.setStatusFilter('completed');
      });
      expect(result.current.statusFilter).toBe('completed');

      act(() => {
        result.current.setStatusFilter('published');
      });
      expect(result.current.statusFilter).toBe('published');
    });
  });

  describe('Persistence across re-renders', () => {
    it('should load saved filter on mount', () => {
      sessionStorageMock['results-status-filter'] = 'completed';

      const { result } = renderHook(() => useFilterPersistence());

      expect(result.current.statusFilter).toBe('completed');
    });

    it('should persist filter changes', () => {
      const { result } = renderHook(() => useFilterPersistence());

      act(() => {
        result.current.setStatusFilter('all');
      });

      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('results-status-filter', 'all');
    });
  });
});
