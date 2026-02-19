/**
 * Unit tests for ExamSelector component
 * 
 * Tests exam list rendering, selection handling, status filtering, and search functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExamSelector } from '../ExamSelector';
import type { Exam } from '@/lib/results/types';

// Mock exam data
const mockExams: Exam[] = [
  {
    id: 'exam-1',
    title: 'Mathematics Final Exam',
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
    status: 'completed',
    access_type: 'code',
    exam_type: 'quiz',
    scheduling_mode: 'Auto',
    is_manually_published: false,
    is_archived: false,
    start_time: '2024-01-01T00:00:00Z',
    end_time: '2024-01-02T00:00:00Z',
    include_in_pass: true,
    pass_threshold: 70,
  },
  {
    id: 'exam-3',
    title: 'Chemistry Homework',
    status: 'draft',
    access_type: 'open',
    exam_type: 'homework',
    scheduling_mode: 'Manual',
    is_manually_published: false,
    is_archived: false,
    start_time: null,
    end_time: null,
    include_in_pass: false,
    pass_threshold: 50,
  },
];

describe('ExamSelector', () => {
  const mockOnExamChange = vi.fn();
  const mockOnStatusFilterChange = vi.fn();
  const mockOnSearchChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with "All Exams" selected by default', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      expect(screen.getByText('All Exams')).toBeInTheDocument();
    });

    it('renders with selected exam title and badge', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId="exam-1"
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      expect(screen.getByText('Mathematics Final Exam')).toBeInTheDocument();
      expect(screen.getByText('Exam')).toBeInTheDocument();
    });

    it('renders status filter buttons', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /published/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /completed/i })).toBeInTheDocument();
    });

    it('highlights active status filter', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="published"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const publishedButton = screen.getByRole('tab', { name: /published/i });
      expect(publishedButton).toHaveClass('btn-primary');
    });
  });

  describe('Dropdown Interaction', () => {
    it('opens dropdown when clicking selector button', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search exams...')).toBeInTheDocument();
    });

    it('displays all exams in dropdown', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      expect(screen.getByText('Mathematics Final Exam')).toBeInTheDocument();
      expect(screen.getByText('Physics Quiz')).toBeInTheDocument();
      expect(screen.getByText('Chemistry Homework')).toBeInTheDocument();
    });

    it('displays special options (All Exams, Matrix View)', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveTextContent('All Exams');
      expect(options[1]).toHaveTextContent('Matrix View');
    });

    it('closes dropdown when clicking outside', async () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <ExamSelector
            exams={mockExams}
            selectedExamId={null}
            onExamChange={mockOnExamChange}
            statusFilter="all"
            onStatusFilterChange={mockOnStatusFilterChange}
            searchTerm=""
            onSearchChange={mockOnSearchChange}
          />
        </div>
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      const outside = screen.getByTestId('outside');
      fireEvent.mouseDown(outside);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('closes dropdown when pressing Escape', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText('Search exams...');
      fireEvent.keyDown(searchInput, { key: 'Escape' });

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Exam Selection', () => {
    it('calls onExamChange when selecting an exam', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      const examOption = screen.getByRole('option', { name: /mathematics final exam/i });
      fireEvent.click(examOption);

      expect(mockOnExamChange).toHaveBeenCalledWith('exam-1');
    });

    it('calls onExamChange with null when selecting "All Exams"', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId="exam-1"
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      const allExamsOption = screen.getByRole('option', { name: /^all exams$/i });
      fireEvent.click(allExamsOption);

      expect(mockOnExamChange).toHaveBeenCalledWith(null);
    });

    it('calls onExamChange with "matrix" when selecting Matrix View', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      const matrixOption = screen.getByRole('option', { name: /matrix view/i });
      fireEvent.click(matrixOption);

      expect(mockOnExamChange).toHaveBeenCalledWith('matrix');
    });

    it('closes dropdown after selecting an exam', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      const examOption = screen.getByRole('option', { name: /mathematics final exam/i });
      fireEvent.click(examOption);

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Status Filtering', () => {
    it('calls onStatusFilterChange when clicking status filter button', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const publishedButton = screen.getByRole('tab', { name: /published/i });
      fireEvent.click(publishedButton);

      expect(mockOnStatusFilterChange).toHaveBeenCalledWith('published');
    });

    it('filters exams by published status', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="published"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      expect(screen.getByText('Mathematics Final Exam')).toBeInTheDocument();
      expect(screen.queryByText('Chemistry Homework')).not.toBeInTheDocument();
    });

    it('filters exams by completed status', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="completed"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      expect(screen.getByText('Physics Quiz')).toBeInTheDocument();
      expect(screen.queryByText('Mathematics Final Exam')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('calls onSearchChange when typing in search input', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      const searchInput = screen.getByPlaceholderText('Search exams...');
      fireEvent.change(searchInput, { target: { value: 'math' } });

      expect(mockOnSearchChange).toHaveBeenCalledWith('math');
    });

    it('clears search when selecting an exam', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm="math"
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      const examOption = screen.getByRole('option', { name: /mathematics final exam/i });
      fireEvent.click(examOption);

      expect(mockOnSearchChange).toHaveBeenCalledWith('');
    });
  });

  describe('Empty State', () => {
    it('displays "No exams found" when exam list is empty', () => {
      render(
        <ExamSelector
          exams={[]}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      expect(screen.getByText('No exams found')).toBeInTheDocument();
    });
  });

  describe('Exam Type Badges', () => {
    it('displays correct badge for exam type', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      fireEvent.click(selectorButton);

      // Check that badges are displayed for each exam type
      const badges = screen.getAllByText(/exam|quiz|homework/i);
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const selectorButton = screen.getByRole('button', { name: /select exam/i });
      expect(selectorButton).toHaveAttribute('aria-haspopup', 'listbox');
      expect(selectorButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(selectorButton);
      expect(selectorButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('has proper role attributes for status filter', () => {
      render(
        <ExamSelector
          exams={mockExams}
          selectedExamId={null}
          onExamChange={mockOnExamChange}
          statusFilter="all"
          onStatusFilterChange={mockOnStatusFilterChange}
          searchTerm=""
          onSearchChange={mockOnSearchChange}
        />
      );

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', 'Exam status filter');

      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab) => {
        expect(tab).toHaveAttribute('aria-selected');
        expect(tab).toHaveAttribute('aria-controls', 'exam-list');
      });
    });
  });
});
