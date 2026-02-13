import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';
import * as useThemeModule from '@/hooks/useTheme';

/**
 * Unit tests for ThemeToggle component
 * 
 * Tests:
 * - Toggle interaction
 * - Keyboard navigation
 * - Accessibility attributes
 * 
 * Requirements: 3.6, 4.4
 */

describe('ThemeToggle Component', () => {
  let mockToggleTheme: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockToggleTheme = vi.fn();
    
    // Mock the useTheme hook
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      setTheme: vi.fn(),
      toggleTheme: mockToggleTheme,
    });
  });

  it('should render the component', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    expect(button).toBeDefined();
  });

  it('should display sun icon in light theme', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      setTheme: vi.fn(),
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    const svg = button.querySelector('svg');
    
    expect(svg).toBeDefined();
    // Sun icon has a circle element
    expect(svg?.querySelector('circle')).toBeDefined();
  });

  it('should display moon icon in dark theme', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'dark',
      setTheme: vi.fn(),
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    const svg = button.querySelector('svg');
    
    expect(svg).toBeDefined();
    // Moon icon has a path element
    expect(svg?.querySelector('path')).toBeDefined();
  });

  it('should call toggleTheme when clicked', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    fireEvent.click(button);
    
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('should support keyboard navigation with Enter key', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    
    // Simulate Enter key press - the component's handleKeyDown will call toggleTheme
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('should support keyboard navigation with Space key', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    
    // Simulate Space key press - the component's handleKeyDown will call toggleTheme
    fireEvent.keyDown(button, { key: ' ', code: 'Space' });
    
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('should have proper aria-label for light theme', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      setTheme: vi.fn(),
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  it('should have proper aria-label for dark theme', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'dark',
      setTheme: vi.fn(),
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
  });

  it('should have proper title attribute for light theme', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      setTheme: vi.fn(),
      toggleTheme: mockToggleTheme as () => void,
    });

    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    expect(button.getAttribute('title')).toBe('Switch to dark theme');
  });

  it('should have proper title attribute for dark theme', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'dark',
      setTheme: vi.fn(),
      toggleTheme: mockToggleTheme as () => void,
    });

    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    expect(button.getAttribute('title')).toBe('Switch to light theme');
  });

  it('should have type="button" attribute', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('should apply custom className', () => {
    render(<ThemeToggle className="custom-class" />);
    
    const button = screen.getByRole('switch');
    expect(button.className).toContain('custom-class');
  });

  it('should have btn and btn-ghost classes', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    expect(button.className).toContain('btn');
    expect(button.className).toContain('btn-ghost');
  });

  it('should not display label by default', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    expect(button.textContent).toBe('');
  });

  it('should display label when showLabel is true in light theme', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      setTheme: vi.fn(),
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle showLabel={true} />);
    
    const button = screen.getByRole('switch');
    expect(button.textContent).toContain('Light');
  });

  it('should display label when showLabel is true in dark theme', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'dark',
      setTheme: vi.fn(),
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle showLabel={true} />);
    
    const button = screen.getByRole('switch');
    expect(button.textContent).toContain('Dark');
  });

  it('should have aria-hidden on SVG icons', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    const svg = button.querySelector('svg');
    
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('should be keyboard accessible', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    
    // Button should be focusable
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('should handle multiple clicks', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('switch');
    
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    
    expect(mockToggleTheme).toHaveBeenCalledTimes(3);
  });
});
