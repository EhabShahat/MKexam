'use client';

import { memo } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { t, type StudentLocale } from '@/i18n/student';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  locale?: StudentLocale;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * ThemeToggle Component
 * 
 * A button component that allows users to toggle between light and dark themes.
 * 
 * Features:
 * - Displays sun icon for light theme, moon icon for dark theme
 * - Accessible with ARIA labels and keyboard support (Enter and Space keys)
 * - Styled for both themes
 * - Optional label display
 * - Supports i18n for Arabic and English
 * - Configurable size
 * - Optimized with React.memo to prevent unnecessary re-renders
 * 
 * Requirements: 3.6, 3.7, 3.8, 6.6
 */
const ThemeToggleComponent = ({ className = '', showLabel = false, locale = 'en', size = 'md' }: ThemeToggleProps) => {
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === 'dark';

  // Handle keyboard events for accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTheme();
    }
  };

  // Size classes for the button
  const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  };

  return (
    <button
      onClick={toggleTheme}
      onKeyDown={handleKeyDown}
      className={`btn btn-ghost ${sizeClasses[size]} ${className}`}
      aria-label={isDark ? t(locale, 'switch_to_light_theme') : t(locale, 'switch_to_dark_theme')}
      aria-pressed={isDark}
      role="switch"
      title={isDark ? t(locale, 'switch_to_light_theme') : t(locale, 'switch_to_dark_theme')}
      type="button"
    >
      {/* Sun icon for light theme */}
      {!isDark && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}

      {/* Moon icon for dark theme */}
      {isDark && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}

      {/* Optional label */}
      {showLabel && (
        <span className="ml-2">
          {isDark ? t(locale, 'dark_theme') : t(locale, 'light_theme')}
        </span>
      )}
    </button>
  );
};

// Memoize the component to prevent unnecessary re-renders
// Only re-render when props change, not when parent re-renders
export const ThemeToggle = memo(ThemeToggleComponent);
