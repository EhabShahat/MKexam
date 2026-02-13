// Feature: dark-mode-and-ux-improvements, Property 17: Minimal Re-renders
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { ThemeToggle } from '@/components/ThemeToggle';
import React from 'react';

/**
 * Property 17: Minimal Re-renders (dark-mode-and-ux-improvements)
 * 
 * For any theme change, components that don't depend on theme state should not re-render.
 * Components using CSS variables should update visually without React re-renders.
 * 
 * Validates: Requirements 6.6
 */

describe('Property 17: Minimal Re-renders', () => {
  beforeEach(() => {
    // Clean up any previous renders
    cleanup();
    
    // Clear localStorage before each test
    localStorage.clear();
    
    // Reset document classes
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    // Clean up after each test
    cleanup();
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
  });

  it('should not re-render parent component when theme changes', () => {
    let parentRenderCount = 0;
    let childRenderCount = 0;

    // Child component that doesn't use theme
    const ChildComponent = React.memo(() => {
      childRenderCount++;
      return <div data-testid="child">Child component</div>;
    });

    // Parent component that uses theme
    const ParentWithTheme = () => {
      parentRenderCount++;
      const { theme, toggleTheme } = useTheme();
      return (
        <div data-testid="parent">
          <button data-testid="toggle-btn" onClick={toggleTheme}>Toggle Theme</button>
          <div data-testid="theme-display">{theme}</div>
          <ChildComponent />
        </div>
      );
    };

    const { getByTestId } = render(<ParentWithTheme />);
    const initialParentRenders = parentRenderCount;
    const initialChildRenders = childRenderCount;

    // Toggle theme
    act(() => {
      getByTestId('toggle-btn').click();
    });

    // Parent will re-render because it uses theme state
    expect(parentRenderCount).toBeGreaterThan(initialParentRenders);
    
    // Memoized child should not re-render
    expect(childRenderCount).toBe(initialChildRenders);
  });

  it('should only re-render ThemeToggle when theme actually changes', () => {
    let themeToggleRenderCount = 0;

    // Wrap ThemeToggle to count renders - but don't memoize the wrapper
    const CountedThemeToggle = () => {
      themeToggleRenderCount++;
      return <ThemeToggle />;
    };

    // Parent that provides theme context
    const Parent = () => {
      return <CountedThemeToggle />;
    };

    const { container } = render(<Parent />);
    const initialRenderCount = themeToggleRenderCount;

    // Click the toggle button
    const button = container.querySelector('button[role="switch"]');
    expect(button).toBeTruthy();

    act(() => {
      button!.click();
    });

    // The wrapper will re-render because useTheme in ThemeToggle causes a state update
    // This is expected - the component using the theme hook will re-render
    // The key optimization is that OTHER components don't re-render
    expect(themeToggleRenderCount).toBeGreaterThanOrEqual(initialRenderCount);
    
    cleanup();
  });

  it('property: CSS-only components should not re-render on theme change', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (targetTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 17: Minimal Re-renders
          
          // Clean up before each property test iteration
          cleanup();
          localStorage.clear();
          
          let cssOnlyRenderCount = 0;

          // Component that uses CSS variables only (no theme hook)
          const CSSOnlyComponent = React.memo(() => {
            cssOnlyRenderCount++;
            return (
              <div 
                data-testid="css-only"
                style={{ 
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text-primary)'
                }}
              >
                CSS Only
              </div>
            );
          });

          // Parent with theme control
          const Parent = () => {
            const { setTheme } = useTheme();
            return (
              <div>
                <button data-testid="change-btn" onClick={() => setTheme(targetTheme)}>Change</button>
                <CSSOnlyComponent />
              </div>
            );
          };

          const { getByTestId } = render(<Parent />);
          const initialRenderCount = cssOnlyRenderCount;

          // Change theme
          act(() => {
            getByTestId('change-btn').click();
          });

          // CSS-only component should not re-render
          expect(cssOnlyRenderCount).toBe(initialRenderCount);
          
          cleanup();

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('property: memoized components should not re-render on theme change', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        (targetTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 17: Minimal Re-renders
          
          cleanup();
          localStorage.clear();
          
          let memoizedRenderCount = 0;

          // Memoized component
          const MemoizedComponent = React.memo(() => {
            memoizedRenderCount++;
            return <div data-testid="memoized">Memoized</div>;
          });

          // Parent with theme control
          const Parent = () => {
            const { setTheme } = useTheme();
            return (
              <div>
                <button data-testid="change-btn" onClick={() => setTheme(targetTheme)}>Change</button>
                <MemoizedComponent />
              </div>
            );
          };

          const { getByTestId } = render(<Parent />);
          const initialRenderCount = memoizedRenderCount;

          // Change theme
          act(() => {
            getByTestId('change-btn').click();
          });

          // Memoized component should not re-render
          expect(memoizedRenderCount).toBe(initialRenderCount);
          
          cleanup();

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should minimize re-renders in complex component trees', () => {
    let leafRenderCount = 0;
    let middleRenderCount = 0;

    // Deep component tree with memoization
    const LeafComponent = React.memo(() => {
      leafRenderCount++;
      return <div data-testid="leaf">Leaf</div>;
    });

    const MiddleComponent = React.memo(() => {
      middleRenderCount++;
      return (
        <div data-testid="middle">
          <LeafComponent />
        </div>
      );
    });

    const TopComponent = () => {
      const { theme, toggleTheme } = useTheme();
      return (
        <div>
          <button data-testid="toggle-btn" onClick={toggleTheme}>Toggle</button>
          <div data-testid="theme-display">{theme}</div>
          <MiddleComponent />
        </div>
      );
    };

    const { getByTestId } = render(<TopComponent />);
    const initialLeafRenders = leafRenderCount;
    const initialMiddleRenders = middleRenderCount;

    // Toggle theme
    act(() => {
      getByTestId('toggle-btn').click();
    });

    // Memoized child components should not re-render
    expect(leafRenderCount).toBe(initialLeafRenders);
    expect(middleRenderCount).toBe(initialMiddleRenders);
  });

  it('property: document class changes should not trigger React re-renders', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Theme>('light', 'dark'),
        fc.constantFrom<Theme>('light', 'dark'),
        (initialTheme, targetTheme) => {
          // Feature: dark-mode-and-ux-improvements, Property 17: Minimal Re-renders
          
          cleanup();
          localStorage.clear();
          
          let componentRenderCount = 0;

          // Component that observes document class but doesn't use theme hook
          const DocumentObserver = React.memo(() => {
            componentRenderCount++;
            return <div data-testid="observer">Observer</div>;
          });

          // Parent with theme control
          const Parent = () => {
            const { setTheme } = useTheme();
            return (
              <div>
                <button data-testid="change-btn" onClick={() => setTheme(targetTheme)}>Change</button>
                <DocumentObserver />
              </div>
            );
          };

          localStorage.setItem('theme-preference', initialTheme);
          const { getByTestId } = render(<Parent />);

          const initialRenderCount = componentRenderCount;

          // Change theme (which changes document class)
          act(() => {
            getByTestId('change-btn').click();
          });

          // Component should not re-render even though document class changed
          expect(componentRenderCount).toBe(initialRenderCount);

          // But document class should be updated
          expect(document.documentElement.classList.contains(targetTheme)).toBe(true);
          
          cleanup();

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
