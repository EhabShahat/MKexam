import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatusFilter, { StatusFilterValue } from '../StatusFilter';

describe('StatusFilter', () => {
  it('renders all three filter options', () => {
    const onChange = vi.fn();
    render(<StatusFilter value="all" onChange={onChange} />);
    
    expect(screen.getByRole('button', { name: /filter by all exams/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter by published/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter by completed/i })).toBeInTheDocument();
  });

  it('calls onChange when a button is clicked', () => {
    const onChange = vi.fn();
    render(<StatusFilter value="all" onChange={onChange} />);
    
    const publishedButton = screen.getByRole('button', { name: /filter by published/i });
    fireEvent.click(publishedButton);
    
    expect(onChange).toHaveBeenCalledWith('published');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('applies active styling to the selected button', () => {
    const onChange = vi.fn();
    render(<StatusFilter value="published" onChange={onChange} />);
    
    const publishedButton = screen.getByRole('button', { name: /filter by published/i });
    const allButton = screen.getByRole('button', { name: /filter by all exams/i });
    
    // Active button should have specific classes
    expect(publishedButton).toHaveClass('bg-white', 'text-blue-600', 'shadow-sm');
    
    // Inactive button should not have active classes
    expect(allButton).not.toHaveClass('bg-white', 'text-blue-600', 'shadow-sm');
    expect(allButton).toHaveClass('text-gray-600');
  });

  it('has proper ARIA attributes', () => {
    const onChange = vi.fn();
    render(<StatusFilter value="completed" onChange={onChange} />);
    
    const group = screen.getByRole('group', { name: /filter exams by status/i });
    expect(group).toBeInTheDocument();
    
    const completedButton = screen.getByRole('button', { name: /filter by completed/i });
    expect(completedButton).toHaveAttribute('aria-pressed', 'true');
    
    const allButton = screen.getByRole('button', { name: /filter by all exams/i });
    expect(allButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('updates when value prop changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(<StatusFilter value="all" onChange={onChange} />);
    
    let allButton = screen.getByRole('button', { name: /filter by all exams/i });
    expect(allButton).toHaveAttribute('aria-pressed', 'true');
    
    rerender(<StatusFilter value="published" onChange={onChange} />);
    
    allButton = screen.getByRole('button', { name: /filter by all exams/i });
    const publishedButton = screen.getByRole('button', { name: /filter by published/i });
    
    expect(allButton).toHaveAttribute('aria-pressed', 'false');
    expect(publishedButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('handles all three filter values correctly', () => {
    const onChange = vi.fn();
    render(<StatusFilter value="all" onChange={onChange} />);
    
    // Click published
    fireEvent.click(screen.getByRole('button', { name: /filter by published/i }));
    expect(onChange).toHaveBeenCalledWith('published');
    
    // Click completed
    fireEvent.click(screen.getByRole('button', { name: /filter by completed/i }));
    expect(onChange).toHaveBeenCalledWith('completed');
    
    // Click all
    fireEvent.click(screen.getByRole('button', { name: /filter by all exams/i }));
    expect(onChange).toHaveBeenCalledWith('all');
    
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});
