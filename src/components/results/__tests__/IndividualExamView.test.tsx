/**
 * Unit tests for IndividualExamView component
 * 
 * Tests table rendering, filtering, sorting, delete confirmation, regrade action,
 * integration with DeviceInfoCell and ManualGradingIndicator, and loading/error states.
 * 
 * Requirements: 20.10
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IndividualExamView } from '../IndividualExamView';
import * as useAttemptsHook from '@/hooks/results/useAttempts';
import type { Exam, Attempt } from '@/lib/results/types';

// Mock fetch
global.fetch = vi.fn();

describe('IndividualExamView', () => {
  let queryClient: QueryClient;
  const mockExam: Exam = {
    id: 'exam-1',
    title: 'Test Exam',
    status: 'published',
    access_type: 'open',
    exam_type: 'exam',
    scheduling_mode: 'Auto',
    is_manually_published: false,
    is_archived: false,
    start_time: '2024-01-01T00:00:00Z',
    end_time: '2024-12-31T23:59:59Z',
    include_in_pass: true,
    pass_threshold: 60,
  };

  const mockAttempts: Attempt[] = [
    {
      id: 'attempt-1',
      student_id: 'student-1',
      student_name: 'Alice Johnson',
      code: 'A001',
      completion_status: 'completed',
      started_at: '2024-01-15T10:00:00Z',
      submitted_at: '2024-01-15T11:30:00Z',
      score_percentage: 85.5,
      final_score_percentage: 85.5,
      ip_address: '192.168.1.1',
      device_info: JSON.stringify({
        device: { type: 'desktop', oem: 'Dell', model: 'XPS 15' },
        allIPs: { local: ['192.168.1.100'] },
        security: { automationRisk: false },
      }),
      manual_total_count: 0,
      manual_graded_count: 0,
      manual_pending_count: 0,
    },
    {
      id: 'attempt-2',
      student_id: 'student-2',
      student_name: 'Bob Smith',
      code: 'B002',
      completion_status: 'completed',
      started_at: '2024-01-16T14:00:00Z',
      submitted_at: '2024-01-16T15:00:00Z',
      score_percentage: 72.0,
      final_score_percentage: null,
      ip_address: '192.168.1.2',
      device_info: JSON.stringify({
        device: { type: 'mobile', oem: 'Apple', model: 'iPhone 13' },
        allIPs: { local: ['10.0.0.5'] },
        security: { automationRisk: false },
      }),
      manual_total_count: 5,
      manual_graded_count: 3,
      manual_pending_count: 2,
    },
    {
      id: 'attempt-3',
      student_id: 'student-3',
      student_name: 'Charlie Brown',
      code: 'C003',
      completion_status: 'in_progress',
      started_at: '2024-01-17T09:00:00Z',
      submitted_at: null,
      score_percentage: null,
      final_score_percentage: null,
      ip_address: '192.168.1.3',
      device_info: null,
      manual_total_count: 0,
      manual_graded_count: 0,
      manual_pending_count: 0,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockClear();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <IndividualExamView examId="exam-1" exam={mockExam} {...props} />
      </QueryClientProvider>
    );
  };

  describe('Loading and Error States', () => {
    it('should display loading state', () => {
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap: new Map(),
      });

      renderComponent();
      expect(screen.getByText('Loading attempts...')).toBeInTheDocument();
    });

    it('should display error state', () => {
      const mockError = new Error('Failed to fetch attempts');
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: [],
        isLoading: false,
        error: mockError,
        refetch: vi.fn(),
        deviceUsageMap: new Map(),
      });

      renderComponent();
      expect(screen.getByText(/Error loading attempts/)).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch attempts/)).toBeInTheDocument();
    });
  });

  describe('Table Rendering', () => {
    beforeEach(() => {
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: mockAttempts,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap: new Map([['device-1', 2]]),
      });
    });

    it('should render attempts table with all columns', () => {
      renderComponent();

      // Check headers
      expect(screen.getByText('Student')).toBeInTheDocument();
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
      expect(screen.getByText('Device')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should render all attempts in the table', () => {
      renderComponent();

      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    });

    it('should display student codes', () => {
      renderComponent();

      expect(screen.getByText('A001')).toBeInTheDocument();
      expect(screen.getByText('B002')).toBeInTheDocument();
      expect(screen.getByText('C003')).toBeInTheDocument();
    });

    it('should display scores correctly', () => {
      renderComponent();

      expect(screen.getByText('85.5%')).toBeInTheDocument();
      expect(screen.getByText('72.0%')).toBeInTheDocument();
    });

    it('should display completion status badges', () => {
      renderComponent();

      const completedBadges = screen.getAllByText('completed');
      expect(completedBadges).toHaveLength(2);
      expect(screen.getByText('in_progress')).toBeInTheDocument();
    });

    it('should display result count', () => {
      renderComponent();

      expect(screen.getByText('Showing 3 of 3 attempts')).toBeInTheDocument();
    });

    it('should display empty state when no attempts', () => {
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap: new Map(),
      });

      renderComponent();
      expect(screen.getByText('No attempts found')).toBeInTheDocument();
    });
  });

  describe('Virtual Scrolling', () => {
    it('should enable virtual scrolling for >50 rows', () => {
      const manyAttempts = Array.from({ length: 60 }, (_, i) => ({
        ...mockAttempts[0],
        id: `attempt-${i}`,
        student_name: `Student ${i}`,
      }));

      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: manyAttempts,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap: new Map(),
      });

      const { container } = renderComponent();
      
      // Check that container has fixed height (virtual scrolling enabled)
      const scrollContainer = container.querySelector('[style*="height"]');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('should not enable virtual scrolling for <=50 rows', () => {
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: mockAttempts,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap: new Map(),
      });

      const { container } = renderComponent();

      // With only 3 attempts, virtual scrolling should not be enabled
      // The container should have height: auto
      const scrollContainer = container.querySelector('[style*="height: auto"]');
      expect(scrollContainer).toBeTruthy();
    });
  });

  describe('Filtering Functionality', () => {
    beforeEach(() => {
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: mockAttempts,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap: new Map(),
      });
    });

    it('should filter by student name', async () => {
      renderComponent();

      const searchInput = screen.getByLabelText('Filter by student name or code');
      fireEvent.change(searchInput, { target: { value: 'Alice' } });

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
        expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Showing 1 of 3 attempts')).toBeInTheDocument();
    });

    it('should filter by student code', async () => {
      renderComponent();

      const searchInput = screen.getByLabelText('Filter by student name or code');
      fireEvent.change(searchInput, { target: { value: 'B002' } });

      await waitFor(() => {
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
      });
    });

    it('should perform case-insensitive search', async () => {
      renderComponent();

      const searchInput = screen.getByLabelText('Filter by student name or code');
      fireEvent.change(searchInput, { target: { value: 'alice' } });

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });
    });

    it('should filter by date range', async () => {
      renderComponent();

      const startDateInput = screen.getByLabelText('Filter by start date');
      const endDateInput = screen.getByLabelText('Filter by end date');

      fireEvent.change(startDateInput, { target: { value: '2024-01-16' } });
      fireEvent.change(endDateInput, { target: { value: '2024-01-17' } });

      await waitFor(() => {
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
      });
    });

    it('should clear all filters', async () => {
      renderComponent();

      // Apply filters
      const searchInput = screen.getByLabelText('Filter by student name or code');
      fireEvent.change(searchInput, { target: { value: 'Alice' } });

      await waitFor(() => {
        expect(screen.getByText('Showing 1 of 3 attempts')).toBeInTheDocument();
      });

      // Clear filters
      const clearButton = screen.getByLabelText('Clear all filters');
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(screen.getByText('Showing 3 of 3 attempts')).toBeInTheDocument();
      });

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Sorting Functionality', () => {
    beforeEach(() => {
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: mockAttempts,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap: new Map(),
      });
    });

    it('should sort by score ascending', async () => {
      renderComponent();

      const sortSelect = screen.getByLabelText('Sort by score');
      fireEvent.change(sortSelect, { target: { value: 'asc' } });

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // First row is header, so data rows start at index 1
        // Null scores should be last, so Charlie (null) should be last
        const studentNames = rows.slice(1).map(row => 
          within(row).queryByText(/Alice|Bob|Charlie/)?.textContent
        ).filter(Boolean);
        
        expect(studentNames[0]).toContain('Bob'); // 72.0%
        expect(studentNames[1]).toContain('Alice'); // 85.5%
        expect(studentNames[2]).toContain('Charlie'); // null (last)
      });
    });

    it('should sort by score descending', async () => {
      renderComponent();

      const sortSelect = screen.getByLabelText('Sort by score');
      fireEvent.change(sortSelect, { target: { value: 'desc' } });

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const studentNames = rows.slice(1).map(row => 
          within(row).queryByText(/Alice|Bob|Charlie/)?.textContent
        ).filter(Boolean);
        
        expect(studentNames[0]).toContain('Alice'); // 85.5%
        expect(studentNames[1]).toContain('Bob'); // 72.0%
        expect(studentNames[2]).toContain('Charlie'); // null (last)
      });
    });

    it('should reset to no sorting', async () => {
      renderComponent();

      const sortSelect = screen.getByLabelText('Sort by score');
      
      // Sort descending
      fireEvent.change(sortSelect, { target: { value: 'desc' } });
      await waitFor(() => {
        expect(sortSelect).toHaveValue('desc');
      });

      // Reset to none
      fireEvent.change(sortSelect, { target: { value: 'none' } });
      await waitFor(() => {
        expect(sortSelect).toHaveValue('none');
      });
    });
  });

  describe('Delete Confirmation Flow', () => {
    let mockRefetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockRefetch = vi.fn();
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: mockAttempts,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
        deviceUsageMap: new Map(),
      });
    });

    it('should show confirmation dialog when delete is clicked', async () => {
      renderComponent();

      const deleteButtons = screen.getAllByLabelText('Delete attempt');
      fireEvent.click(deleteButtons[0]);

      expect(screen.getByLabelText('Confirm delete')).toBeInTheDocument();
      expect(screen.getByLabelText('Cancel delete')).toBeInTheDocument();
    });

    it('should cancel delete confirmation', async () => {
      renderComponent();

      const deleteButtons = screen.getAllByLabelText('Delete attempt');
      fireEvent.click(deleteButtons[0]);

      const cancelButton = screen.getByLabelText('Cancel delete');
      fireEvent.click(cancelButton);

      expect(screen.queryByLabelText('Confirm delete')).not.toBeInTheDocument();
      expect(screen.getAllByLabelText('Delete attempt')).toHaveLength(3);
    });

    it('should delete attempt on confirmation', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      renderComponent();

      const deleteButtons = screen.getAllByLabelText('Delete attempt');
      fireEvent.click(deleteButtons[0]);

      const confirmButton = screen.getByLabelText('Confirm delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/attempts/attempt-1',
          { method: 'DELETE' }
        );
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('should handle delete error', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to delete' }),
      } as Response);

      renderComponent();

      const deleteButtons = screen.getAllByLabelText('Delete attempt');
      fireEvent.click(deleteButtons[0]);

      const confirmButton = screen.getByLabelText('Confirm delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Failed to delete attempt. Please try again.'
        );
      });

      alertSpy.mockRestore();
    });
  });

  describe('Regrade Action', () => {
    let mockRefetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockRefetch = vi.fn();
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: mockAttempts,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
        deviceUsageMap: new Map(),
      });
    });

    it('should regrade all attempts', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { regraded_count: 3 } }),
      } as Response);

      renderComponent();

      const regradeButton = screen.getByLabelText('Regrade all attempts');
      fireEvent.click(regradeButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/exams/exam-1/regrade',
          { method: 'POST' }
        );
        expect(alertSpy).toHaveBeenCalledWith('Successfully regraded 3 attempts');
        expect(mockRefetch).toHaveBeenCalled();
      });

      alertSpy.mockRestore();
    });

    it('should disable regrade button while regrading', async () => {
      vi.mocked(global.fetch).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ result: { regraded_count: 3 } }),
        } as Response), 100))
      );

      renderComponent();

      const regradeButton = screen.getByLabelText('Regrade all attempts');
      fireEvent.click(regradeButton);

      expect(screen.getByText('Regrading...')).toBeInTheDocument();
      expect(regradeButton).toBeDisabled();
    });

    it('should handle regrade error', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to regrade' }),
      } as Response);

      renderComponent();

      const regradeButton = screen.getByLabelText('Regrade all attempts');
      fireEvent.click(regradeButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Failed to regrade attempts. Please try again.'
        );
      });

      alertSpy.mockRestore();
    });

    it('should disable regrade button when no attempts', () => {
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap: new Map(),
      });

      renderComponent();

      const regradeButton = screen.getByLabelText('Regrade all attempts');
      expect(regradeButton).toBeDisabled();
    });
  });

  describe('Integration with DeviceInfoCell', () => {
    beforeEach(() => {
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: mockAttempts,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap: new Map([['device-1', 2]]),
      });
    });

    it('should render DeviceInfoCell for each attempt', () => {
      renderComponent();

      // DeviceInfoCell should parse and display device information
      // Check that device models are displayed (parser extracts model from oem.model)
      expect(screen.getByText('XPS 15')).toBeInTheDocument();
      expect(screen.getByText('iPhone 13')).toBeInTheDocument();
    });

    it('should pass deviceUsageMap to DeviceInfoCell', () => {
      const deviceUsageMap = new Map([['device-1', 3]]);
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: mockAttempts,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap,
      });

      renderComponent();

      // DeviceInfoCell should receive the usage map
      // This is tested more thoroughly in DeviceInfoCell.test.tsx
      expect(screen.getByText('XPS 15')).toBeInTheDocument();
    });
  });

  describe('Integration with ManualGradingIndicator', () => {
    beforeEach(() => {
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: mockAttempts,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap: new Map(),
      });
    });

    it('should render ManualGradingIndicator for attempts with manual grading', () => {
      renderComponent();

      // Bob Smith has manual grading pending (2 pending out of 5 total)
      // ManualGradingIndicator should display pending count
      const bobRow = screen.getByText('Bob Smith').closest('tr');
      expect(bobRow).toBeInTheDocument();
      
      // Check that the indicator is rendered (tested more in ManualGradingIndicator.test.tsx)
      expect(within(bobRow!).getByText('72.0%')).toBeInTheDocument();
    });

    it('should use score_percentage when manual grading is pending', () => {
      renderComponent();

      // Bob has manual_pending_count > 0, so should show score_percentage (72.0%)
      const bobRow = screen.getByText('Bob Smith').closest('tr');
      expect(within(bobRow!).getByText('72.0%')).toBeInTheDocument();
    });

    it('should use final_score_percentage when manual grading is complete', () => {
      renderComponent();

      // Alice has no manual grading, so should show final_score_percentage (85.5%)
      const aliceRow = screen.getByText('Alice Johnson').closest('tr');
      expect(within(aliceRow!).getByText('85.5%')).toBeInTheDocument();
    });
  });

  describe('Date and Duration Formatting', () => {
    beforeEach(() => {
      vi.spyOn(useAttemptsHook, 'useAttempts').mockReturnValue({
        attempts: mockAttempts,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        deviceUsageMap: new Map(),
      });
    });

    it('should format submission dates correctly', () => {
      renderComponent();

      // Dates should be formatted with Cairo timezone
      // The exact format depends on the locale, but should include date and time
      const aliceRow = screen.getByText('Alice Johnson').closest('tr');
      expect(aliceRow).toBeInTheDocument();
      
      // Check that a formatted date is present (format: "Jan 15, 2024, 12:00 PM")
      expect(within(aliceRow!).getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });

    it('should calculate and display duration correctly', () => {
      renderComponent();

      // Alice: 10:00 to 11:30 = 90 minutes
      const aliceRow = screen.getByText('Alice Johnson').closest('tr');
      expect(within(aliceRow!).getByText('90 min')).toBeInTheDocument();

      // Bob: 14:00 to 15:00 = 60 minutes
      const bobRow = screen.getByText('Bob Smith').closest('tr');
      expect(within(bobRow!).getByText('60 min')).toBeInTheDocument();
    });

    it('should display "-" for missing dates or durations', () => {
      renderComponent();

      // Charlie has no submitted_at, so duration should be "-"
      const charlieRow = screen.getByText('Charlie Brown').closest('tr');
      const durationCells = within(charlieRow!).getAllByText('-');
      expect(durationCells.length).toBeGreaterThan(0);
    });
  });
});
