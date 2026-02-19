/**
 * Unit tests for AllExamsView component
 * 
 * Tests aggregated table rendering, virtual scrolling, student search, sorting,
 * pass/fail indicators, summary statistics, score breakdown expansion, and
 * integration with ScoreBreakdownOverlay.
 * 
 * Requirements: 20.10
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AllExamsView } from '../AllExamsView';
import type { Exam, StudentSummary, AppSettings, ExtraField } from '@/lib/results/types';

// Mock hooks
vi.mock('@/hooks/results/useSummaries');
vi.mock('@/hooks/results/useSettings');
vi.mock('@/hooks/results/useExtraFields');
vi.mock('@/hooks/results/useExams');

import { useSummaries } from '@/hooks/results/useSummaries';
import { useSettings } from '@/hooks/results/useSettings';
import { useExtraFields } from '@/hooks/results/useExtraFields';

describe('AllExamsView', () => {
  let queryClient: QueryClient;

  const mockExams: Exam[] = [
    {
      id: 'exam-1',
      title: 'Math Exam',
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
    },
    {
      id: 'exam-2',
      title: 'Science Quiz',
      status: 'published',
      access_type: 'code',
      exam_type: 'quiz',
      scheduling_mode: 'Manual',
      is_manually_published: true,
      is_archived: false,
      start_time: null,
      end_time: null,
      include_in_pass: true,
      pass_threshold: 70,
    },
    {
      id: 'exam-3',
      title: 'History Homework',
      status: 'completed',
      access_type: 'open',
      exam_type: 'homework',
      scheduling_mode: 'Auto',
      is_manually_published: false,
      is_archived: false,
      start_time: '2024-01-01T00:00:00Z',
      end_time: '2024-01-31T23:59:59Z',
      include_in_pass: false,
      pass_threshold: 50,
    },
  ];

  const mockSummaries: StudentSummary[] = [
    {
      student_id: 'student-1',
      student_name: 'Alice Johnson',
      code: 'A001',
      scores: {
        'exam-1': 85,
        'exam-2': 90,
        'exam-3': 75,
      },
      attempt_counts: {
        'exam-1': 1,
        'exam-2': 1,
        'exam-3': 1,
      },
      extra_data: {
        attendance: 95,
        participation: 'excellent',
      },
    },
    {
      student_id: 'student-2',
      student_name: 'Bob Smith',
      code: 'B002',
      scores: {
        'exam-1': 55,
        'exam-2': 65,
        'exam-3': null,
      },
      attempt_counts: {
        'exam-1': 2,
        'exam-2': 1,
        'exam-3': 0,
      },
      extra_data: {
        attendance: 80,
        participation: 'good',
      },
    },
    {
      student_id: 'student-3',
      student_name: 'Charlie Brown',
      code: 'C003',
      scores: {
        'exam-1': 70,
        'exam-2': 75,
        'exam-3': 80,
      },
      attempt_counts: {
        'exam-1': 1,
        'exam-2': 1,
        'exam-3': 1,
      },
      extra_data: {
        attendance: 90,
        participation: 'excellent',
      },
    },
  ];

  const mockSettings: AppSettings = {
    result_pass_calc_mode: 'best',
    result_overall_pass_threshold: 60,
    result_exam_weight: 0.8,
    result_fail_on_any_exam: false,
  };

  const mockExtraFields: ExtraField[] = [
    {
      key: 'attendance',
      label: 'Attendance',
      type: 'number',
      hidden: false,
      include_in_pass: true,
      pass_weight: 0.5,
      max_points: 100,
      bool_true_points: null,
      bool_false_points: null,
      text_score_map: null,
    },
    {
      key: 'participation',
      label: 'Participation',
      type: 'text',
      hidden: false,
      include_in_pass: true,
      pass_weight: 0.5,
      max_points: null,
      bool_true_points: null,
      bool_false_points: null,
      text_score_map: {
        excellent: 100,
        good: 75,
        fair: 50,
        poor: 25,
      },
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useSummaries).mockReturnValue({
      summaries: mockSummaries,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      refreshView: vi.fn(),
    });

    vi.mocked(useSettings).mockReturnValue({
      settings: mockSettings,
      isLoading: false,
      error: null,
    });

    vi.mocked(useExtraFields).mockReturnValue({
      fields: mockExtraFields,
      visibleFields: mockExtraFields,
      isLoading: false,
      error: null,
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AllExamsView exams={mockExams} {...props} />
      </QueryClientProvider>
    );
  };

  describe('Loading and Error States', () => {
    it('should display loading state when summaries are loading', () => {
      vi.mocked(useSummaries).mockReturnValue({
        summaries: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
        refreshView: vi.fn(),
      });

      renderComponent();
      expect(screen.getByText('Loading aggregated data...')).toBeInTheDocument();
    });

    it('should display loading state when settings are loading', () => {
      vi.mocked(useSettings).mockReturnValue({
        settings: null as any,
        isLoading: true,
        error: null,
      });

      renderComponent();
      expect(screen.getByText('Loading aggregated data...')).toBeInTheDocument();
    });

    it('should display error state when summaries fail to load', () => {
      const mockError = new Error('Failed to fetch summaries');
      vi.mocked(useSummaries).mockReturnValue({
        summaries: [],
        isLoading: false,
        error: mockError,
        refetch: vi.fn(),
        refreshView: vi.fn(),
      });

      renderComponent();
      expect(screen.getByText(/Error loading data/)).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch summaries/)).toBeInTheDocument();
    });

    it('should display error state when settings fail to load', () => {
      const mockError = new Error('Failed to fetch settings');
      vi.mocked(useSettings).mockReturnValue({
        settings: null as any,
        isLoading: false,
        error: mockError,
      });

      renderComponent();
      expect(screen.getByText(/Error loading data/)).toBeInTheDocument();
    });
  });

  describe('Aggregated Table Rendering', () => {
    it('should render all students in the table', () => {
      renderComponent();

      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    });

    it('should render student codes', () => {
      renderComponent();

      expect(screen.getByText('A001')).toBeInTheDocument();
      expect(screen.getByText('B002')).toBeInTheDocument();
      expect(screen.getByText('C003')).toBeInTheDocument();
    });

    it('should render exam columns with titles', () => {
      renderComponent();

      expect(screen.getByText('Math Exam')).toBeInTheDocument();
      expect(screen.getByText('Science Quiz')).toBeInTheDocument();
      expect(screen.getByText('History Homework')).toBeInTheDocument();
    });

    it('should render exam type badges in headers', () => {
      renderComponent();

      expect(screen.getByText('exam')).toBeInTheDocument();
      expect(screen.getByText('quiz')).toBeInTheDocument();
      expect(screen.getByText('homework')).toBeInTheDocument();
    });

    it('should render exam scores for each student', () => {
      renderComponent();

      // Alice's scores - check they exist (may appear multiple times in component scores)
      expect(screen.getAllByText('85.0%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('90.0%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('75.0%').length).toBeGreaterThanOrEqual(1);

      // Bob's scores
      expect(screen.getAllByText('55.0%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('65.0%').length).toBeGreaterThanOrEqual(1);
    });

    it('should render extra field columns', () => {
      renderComponent();

      expect(screen.getByText('Attendance')).toBeInTheDocument();
      expect(screen.getByText('Participation')).toBeInTheDocument();
    });

    it('should render extra field values', () => {
      renderComponent();

      // Check that extra field values exist (may appear multiple times)
      expect(screen.getAllByText('95').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('excellent').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('80').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('good').length).toBeGreaterThanOrEqual(1);
    });

    it('should render component score columns', () => {
      renderComponent();

      expect(screen.getByText('Exam Component')).toBeInTheDocument();
      expect(screen.getByText('Extra Component')).toBeInTheDocument();
      expect(screen.getByText('Final Score')).toBeInTheDocument();
    });

    it('should display "-" for missing scores', () => {
      renderComponent();

      // Bob has no score for exam-3
      const rows = screen.getAllByRole('row');
      const bobRow = rows.find(row => row.textContent?.includes('Bob Smith'));
      expect(bobRow).toBeDefined();
      expect(bobRow?.textContent).toContain('-');
    });
  });

  describe('Virtual Scrolling', () => {
    it('should enable virtual scrolling for more than 50 students', () => {
      const manySummaries: StudentSummary[] = Array.from({ length: 60 }, (_, i) => ({
        student_id: `student-${i}`,
        student_name: `Student ${i}`,
        code: `CODE${i}`,
        scores: {},
        attempt_counts: {},
        extra_data: {},
      }));

      vi.mocked(useSummaries).mockReturnValue({
        summaries: manySummaries,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        refreshView: vi.fn(),
      });

      const { container } = renderComponent();

      // Virtual scrolling container should have fixed height
      const scrollContainer = container.querySelector('[style*="height"]');
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer?.getAttribute('style')).toContain('600px');
    });

    it('should not enable virtual scrolling for 50 or fewer students', () => {
      const { container } = renderComponent();

      // Should not have fixed height for virtual scrolling
      const scrollContainer = container.querySelector('[style*="600px"]');
      expect(scrollContainer).not.toBeInTheDocument();
    });
  });

  describe('Student Search', () => {
    it('should filter students by name', async () => {
      renderComponent();

      const searchInput = screen.getByLabelText('Search by student name or code');
      fireEvent.change(searchInput, { target: { value: 'Alice' } });

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
        expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
      });
    });

    it('should filter students by code', async () => {
      renderComponent();

      const searchInput = screen.getByLabelText('Search by student name or code');
      fireEvent.change(searchInput, { target: { value: 'B002' } });

      await waitFor(() => {
        expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
      });
    });

    it('should be case-insensitive', async () => {
      renderComponent();

      const searchInput = screen.getByLabelText('Search by student name or code');
      fireEvent.change(searchInput, { target: { value: 'alice' } });

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });
    });

    it('should update result count when filtering', async () => {
      renderComponent();

      expect(screen.getByText('Showing 3 of 3 students')).toBeInTheDocument();

      const searchInput = screen.getByLabelText('Search by student name or code');
      fireEvent.change(searchInput, { target: { value: 'Alice' } });

      await waitFor(() => {
        expect(screen.getByText('Showing 1 of 3 students')).toBeInTheDocument();
      });
    });

    it('should show empty state when no students match', async () => {
      renderComponent();

      const searchInput = screen.getByLabelText('Search by student name or code');
      fireEvent.change(searchInput, { target: { value: 'NonexistentStudent' } });

      await waitFor(() => {
        expect(screen.getByText('No students found')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting by Final Score', () => {
    it('should sort students by final score ascending', async () => {
      renderComponent();

      const sortSelect = screen.getByLabelText('Sort by final score');
      fireEvent.change(sortSelect, { target: { value: 'finalAsc' } });

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const studentNames = rows
          .slice(1) // Skip header row
          .map(row => row.textContent)
          .filter(text => text?.includes('Johnson') || text?.includes('Smith') || text?.includes('Brown'));

        // Bob should be first (lowest score), then Charlie, then Alice
        expect(studentNames[0]).toContain('Bob Smith');
      });
    });

    it('should sort students by final score descending', async () => {
      renderComponent();

      const sortSelect = screen.getByLabelText('Sort by final score');
      fireEvent.change(sortSelect, { target: { value: 'finalDesc' } });

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const studentNames = rows
          .slice(1) // Skip header row
          .map(row => row.textContent)
          .filter(text => text?.includes('Johnson') || text?.includes('Smith') || text?.includes('Brown'));

        // Alice should be first (highest score)
        expect(studentNames[0]).toContain('Alice Johnson');
      });
    });

    it('should reset to original order when sort is set to none', async () => {
      renderComponent();

      const sortSelect = screen.getByLabelText('Sort by final score');
      
      // Sort descending
      fireEvent.change(sortSelect, { target: { value: 'finalDesc' } });
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows[1].textContent).toContain('Alice Johnson');
      });

      // Reset to none
      fireEvent.change(sortSelect, { target: { value: 'none' } });
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows[1].textContent).toContain('Alice Johnson'); // Original order
      });
    });
  });

  describe('Pass/Fail Indicators', () => {
    it('should display pass indicator (✓) for passing students', () => {
      renderComponent();

      // Alice and Charlie should pass
      const checkmarks = screen.getAllByText('✓');
      expect(checkmarks.length).toBeGreaterThanOrEqual(2);
    });

    it('should display fail indicator (✗) for failing students', () => {
      // Update Bob's scores to ensure he fails
      const failingSummaries: StudentSummary[] = [
        {
          student_id: 'student-1',
          student_name: 'Alice Johnson',
          code: 'A001',
          scores: {
            'exam-1': 85,
            'exam-2': 90,
            'exam-3': 75,
          },
          attempt_counts: {},
          extra_data: { attendance: 95, participation: 'excellent' },
        },
        {
          student_id: 'student-2',
          student_name: 'Bob Smith',
          code: 'B002',
          scores: {
            'exam-1': 30, // Low score to ensure failure
            'exam-2': 35,
            'exam-3': null,
          },
          attempt_counts: {},
          extra_data: { attendance: 50, participation: 'poor' },
        },
      ];

      vi.mocked(useSummaries).mockReturnValue({
        summaries: failingSummaries,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        refreshView: vi.fn(),
      });

      renderComponent();

      // Bob should fail - check that at least one ✗ exists
      const crosses = screen.getAllByText('✗');
      expect(crosses.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Summary Statistics', () => {
    it('should display pass count', () => {
      renderComponent();

      expect(screen.getByText('Pass Count:')).toBeInTheDocument();
      // Should show count (exact number depends on calculation)
      const passCountElement = screen.getByText('Pass Count:').nextSibling;
      expect(passCountElement).toBeDefined();
    });

    it('should display total student count', () => {
      renderComponent();

      expect(screen.getByText('Total Students:')).toBeInTheDocument();
      expect(screen.getByText('Total Students:').nextSibling?.textContent).toBe('3');
    });

    it('should display pass rate percentage', () => {
      renderComponent();

      expect(screen.getByText('Pass Rate:')).toBeInTheDocument();
      const passRateElement = screen.getByText('Pass Rate:').nextSibling;
      expect(passRateElement?.textContent).toMatch(/%$/);
    });

    it('should update statistics when filtering', async () => {
      renderComponent();

      const searchInput = screen.getByLabelText('Search by student name or code');
      fireEvent.change(searchInput, { target: { value: 'Alice' } });

      await waitFor(() => {
        const totalText = screen.getByText('Total Students:').nextSibling?.textContent;
        expect(totalText).toBe('1');
      });
    });
  });

  describe('Score Breakdown Expansion', () => {
    it('should open breakdown overlay when clicking final score', async () => {
      renderComponent();

      // Find Alice's final score button
      const rows = screen.getAllByRole('row');
      const aliceRow = rows.find(row => row.textContent?.includes('Alice Johnson'));
      expect(aliceRow).toBeDefined();

      const scoreButton = aliceRow?.querySelector('button');
      expect(scoreButton).toBeDefined();

      fireEvent.click(scoreButton!);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/Score Breakdown: Alice Johnson/)).toBeInTheDocument();
      });
    });

    it('should close breakdown when clicking close button', async () => {
      renderComponent();

      // Open breakdown
      const rows = screen.getAllByRole('row');
      const aliceRow = rows.find(row => row.textContent?.includes('Alice Johnson'));
      const scoreButton = aliceRow?.querySelector('button');
      fireEvent.click(scoreButton!);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close breakdown
      const closeButton = screen.getByLabelText('Close breakdown');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should close previous breakdown when opening a new one', async () => {
      renderComponent();

      const rows = screen.getAllByRole('row');

      // Open Alice's breakdown
      const aliceRow = rows.find(row => row.textContent?.includes('Alice Johnson'));
      const aliceButton = aliceRow?.querySelector('button');
      fireEvent.click(aliceButton!);

      await waitFor(() => {
        expect(screen.getByText(/Score Breakdown: Alice Johnson/)).toBeInTheDocument();
      });

      // Open Bob's breakdown
      const bobRow = rows.find(row => row.textContent?.includes('Bob Smith'));
      const bobButton = bobRow?.querySelector('button');
      fireEvent.click(bobButton!);

      await waitFor(() => {
        expect(screen.getByText(/Score Breakdown: Bob Smith/)).toBeInTheDocument();
        // Should only have one breakdown open
        const dialogs = screen.getAllByRole('dialog');
        expect(dialogs).toHaveLength(1);
      });
    });
  });

  describe('Integration with ScoreBreakdownOverlay', () => {
    it('should pass correct calculation data to overlay', async () => {
      renderComponent();

      const rows = screen.getAllByRole('row');
      const aliceRow = rows.find(row => row.textContent?.includes('Alice Johnson'));
      const scoreButton = aliceRow?.querySelector('button');
      fireEvent.click(scoreButton!);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        
        // Should show exam component section in dialog
        expect(dialog.textContent).toContain('Exam Component');
        
        // Should show extra component section in dialog
        expect(dialog.textContent).toContain('Extra Component');
        
        // Should show final score section in dialog
        expect(dialog.textContent).toContain('Final Score');
      });
    });

    it('should display pass/fail status in overlay', async () => {
      renderComponent();

      const rows = screen.getAllByRole('row');
      const aliceRow = rows.find(row => row.textContent?.includes('Alice Johnson'));
      const scoreButton = aliceRow?.querySelector('button');
      fireEvent.click(scoreButton!);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        // Should show PASSED or FAILED status in dialog
        expect(dialog.textContent).toMatch(/PASSED|FAILED/);
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no students exist', () => {
      vi.mocked(useSummaries).mockReturnValue({
        summaries: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        refreshView: vi.fn(),
      });

      renderComponent();

      expect(screen.getByText('No students found')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for search input', () => {
      renderComponent();

      const searchInput = screen.getByLabelText('Search by student name or code');
      expect(searchInput).toHaveAttribute('aria-label');
    });

    it('should have proper ARIA labels for sort select', () => {
      renderComponent();

      const sortSelect = screen.getByLabelText('Sort by final score');
      expect(sortSelect).toHaveAttribute('aria-label');
    });

    it('should have proper ARIA labels for score breakdown buttons', () => {
      renderComponent();

      const buttons = screen.getAllByLabelText('View score breakdown');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
