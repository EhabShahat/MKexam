import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import StatusFilter, { StatusFilterValue } from '../StatusFilter';

/**
 * Property 5: Filter Label Consistency
 * 
 * **Validates: Requirements 1.8**
 * 
 * For any filter value (all, published, completed), the StatusFilter component
 * must display a clear label indicating the current filter mode.
 * 
 * Property: For all valid filter values v in {all, published, completed},
 * when StatusFilter is rendered with value=v, then the component must display
 * a button with a label that clearly indicates the filter mode.
 */
describe('Property 5: Filter Label Consistency', () => {
  it('should display clear labels for all filter values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<StatusFilterValue>('all', 'published', 'completed'),
        (filterValue) => {
          const onChange = vi.fn();
          const { unmount } = render(<StatusFilter value={filterValue} onChange={onChange} />);
          
          // Define expected labels for each filter value
          const expectedLabels: Record<StatusFilterValue, string> = {
            all: 'All Exams',
            published: 'Published',
            completed: 'Completed',
          };
          
          // Check that the button with the expected label exists
          const button = screen.getByRole('button', { 
            name: new RegExp(`filter by ${expectedLabels[filterValue]}`, 'i') 
          });
          
          // Verify the button is in the document
          expect(button).toBeInTheDocument();
          
          // Verify the button displays the correct text
          expect(button.textContent).toContain(expectedLabels[filterValue]);
          
          // Verify the button is marked as active (aria-pressed="true")
          expect(button).toHaveAttribute('aria-pressed', 'true');
          
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain label consistency across multiple renders', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<StatusFilterValue>('all', 'published', 'completed'),
        (filterValue) => {
          const onChange = vi.fn();
          
          const expectedLabels: Record<StatusFilterValue, string> = {
            all: 'All Exams',
            published: 'Published',
            completed: 'Completed',
          };
          
          // Render once and verify
          const { unmount, rerender } = render(<StatusFilter value={filterValue} onChange={onChange} />);
          
          const button = screen.getByRole('button', { 
            name: new RegExp(`filter by ${expectedLabels[filterValue]}`, 'i') 
          });
          expect(button.textContent).toContain(expectedLabels[filterValue]);
          
          // Rerender with same value and verify consistency
          rerender(<StatusFilter value={filterValue} onChange={onChange} />);
          
          const buttonAfterRerender = screen.getByRole('button', { 
            name: new RegExp(`filter by ${expectedLabels[filterValue]}`, 'i') 
          });
          expect(buttonAfterRerender.textContent).toContain(expectedLabels[filterValue]);
          
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  }, 10000);

  it('should display all three labels simultaneously', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<StatusFilterValue>('all', 'published', 'completed'),
        (activeValue) => {
          const onChange = vi.fn();
          const { unmount } = render(<StatusFilter value={activeValue} onChange={onChange} />);
          
          // All three labels should be visible regardless of which is active
          expect(screen.getByRole('button', { name: /filter by all exams/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /filter by published/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /filter by completed/i })).toBeInTheDocument();
          
          // Verify all buttons have text content
          const allButton = screen.getByRole('button', { name: /filter by all exams/i });
          const publishedButton = screen.getByRole('button', { name: /filter by published/i });
          const completedButton = screen.getByRole('button', { name: /filter by completed/i });
          
          expect(allButton.textContent).toContain('All Exams');
          expect(publishedButton.textContent).toContain('Published');
          expect(completedButton.textContent).toContain('Completed');
          
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
