/**
 * Performance Monitor Component Tests
 * 
 * Feature: performance-optimization-and-backend-fixes
 * Tests the PerformanceMonitor component
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PerformanceMonitor } from '../PerformanceMonitor';
import * as useWebVitalsHook from '@/hooks/useWebVitals';

// Mock the useWebVitals hook
vi.mock('@/hooks/useWebVitals', () => ({
  useWebVitals: vi.fn(),
}));

describe('PerformanceMonitor', () => {
  it('should render without crashing', () => {
    const { container } = render(<PerformanceMonitor />);
    expect(container).toBeTruthy();
  });

  it('should not render any visible content', () => {
    const { container } = render(<PerformanceMonitor />);
    expect(container.firstChild).toBeNull();
  });

  it('should call useWebVitals hook on mount', () => {
    vi.clearAllMocks();
    render(<PerformanceMonitor />);
    expect(useWebVitalsHook.useWebVitals).toHaveBeenCalled();
  });

  it('should be a client component', () => {
    // Verify the component can be rendered in a client context
    expect(() => render(<PerformanceMonitor />)).not.toThrow();
  });
});
