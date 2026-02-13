'use client';

import { useEffect, useState } from 'react';
import { isLocalStorageAvailable, isMatchMediaAvailable } from '@/lib/browserCompat';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme-preference';

interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  systemPreference: Theme | null;
  isSystemPreferenceOverridden: boolean;
}

/**
 * Detects the user's system color scheme preference
 * 
 * @returns 'dark' | 'light' | null (null if not supported or unavailable)
 * 
 * Requirements: 2.8, 5.6
 */
function detectSystemPreference(): Theme | null {
  if (typeof window === 'undefined' || !isMatchMediaAvailable()) {
    return null;
  }
  
  try {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'dark' : 'light';
  } catch (error) {
    console.warn('Failed to detect system preference', error);
    return null;
  }
}

/**
 * Validates that a value is a valid theme
 * 
 * @param value - The value to validate
 * @returns true if the value is 'light' or 'dark', false otherwise
 */
function isValidTheme(value: any): value is Theme {
  return value === 'light' || value === 'dark';
}

/**
 * Determines the initial theme with priority:
 * 1. localStorage value (if exists and valid)
 * 2. Default to 'dark' (always dark by default)
 * 
 * Note: System preference is intentionally ignored to ensure consistent dark theme by default
 * 
 * Validates stored values and clears invalid values from storage
 * 
 * Requirements: 2.1, 2.8, 3.4, 5.6
 */
function getInitialTheme(): Theme {
  if (isLocalStorageAvailable()) {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      
      // Validate stored value
      if (stored !== null) {
        if (isValidTheme(stored)) {
          return stored;
        } else {
          // Clear invalid value from storage
          console.warn(`Invalid theme value in localStorage: "${stored}". Clearing.`);
          try {
            localStorage.removeItem(THEME_STORAGE_KEY);
          } catch (clearError) {
            // Ignore errors when clearing
            console.debug('Failed to clear invalid theme from localStorage', clearError);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to read theme from localStorage', error);
    }
  }
  
  // Always default to dark mode (system preference ignored for consistent default)
  return 'dark';
}

/**
 * Hook for managing theme state with localStorage persistence
 * 
 * Features:
 * - Dark mode as default theme
 * - System preference detection with feature detection
 * - Persists theme preference to localStorage (with fallback)
 * - Applies theme class and color-scheme to document root
 * - Provides theme toggle functionality
 * - Handles localStorage unavailability gracefully
 * - Handles matchMedia unavailability gracefully
 * - Tracks system preference and override status
 * - Optimized to minimize re-renders by using CSS variables
 * 
 * Requirements: 2.1, 2.8, 3.1, 3.2, 3.3, 3.4, 5.6, 6.6
 */
export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize with the correct theme to avoid hydration mismatch
    if (typeof window !== 'undefined') {
      return getInitialTheme();
    }
    return 'dark';
  });
  const [systemPreference, setSystemPreference] = useState<Theme | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load theme and detect system preference on mount
  useEffect(() => {
    const initialTheme = getInitialTheme();
    const sysPref = detectSystemPreference();
    
    setThemeState(initialTheme);
    setSystemPreference(sysPref);
    applyThemeToDocument(initialTheme);
    setMounted(true);

    // Listen for system preference changes (only if matchMedia is available)
    if (typeof window !== 'undefined' && isMatchMediaAvailable()) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const newPref = e.matches ? 'dark' : 'light';
        setSystemPreference(newPref);
        
        // Only auto-switch if user hasn't set a preference
        if (isLocalStorageAvailable()) {
          try {
            const stored = localStorage.getItem(THEME_STORAGE_KEY);
            if (!stored) {
              setThemeState(newPref);
              applyThemeToDocument(newPref);
            }
          } catch (error) {
            // localStorage unavailable, ignore
          }
        }
      };
      
      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
      // Legacy browsers
      else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, []);

  // Apply theme class and color-scheme to document root
  // Optimized to use CSS-only transitions for instant visual updates
  // Includes performance monitoring to ensure theme switching completes within 100ms
  // Preserves focus state during theme changes (Requirement 7.5)
  const applyThemeToDocument = (newTheme: Theme) => {
    if (typeof document !== 'undefined') {
      // Start performance measurement
      const startTime = performance.now();
      
      const root = document.documentElement;
      
      // Preserve the currently focused element (Requirement 7.5)
      const activeElement = document.activeElement as HTMLElement;
      const hadFocus = activeElement && activeElement !== document.body;
      
      // Temporarily disable transitions to prevent flash
      root.classList.add('theme-transitioning');
      
      // Remove both classes first
      root.classList.remove('light', 'dark');
      
      // Add the new theme class
      root.classList.add(newTheme);
      
      // Set color-scheme property for native browser elements
      root.style.colorScheme = newTheme;
      
      // Restore focus if an element had focus before theme change (Requirement 7.5)
      if (hadFocus && activeElement && typeof activeElement.focus === 'function') {
        // Use setTimeout to ensure focus is restored after the DOM updates
        setTimeout(() => {
          try {
            activeElement.focus();
          } catch (error) {
            // Element may no longer be focusable, ignore error
            console.debug('[Theme] Could not restore focus to element', error);
          }
        }, 0);
      }
      
      // Re-enable transitions after a frame
      // Using requestAnimationFrame ensures this happens after the browser has painted
      requestAnimationFrame(() => {
        root.classList.remove('theme-transitioning');
        
        // Measure and log performance
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Log performance metrics in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Theme] Switched to ${newTheme} in ${duration.toFixed(2)}ms`);
          
          // Warn if theme switch exceeds 100ms threshold
          if (duration > 100) {
            console.warn(
              `[Theme] Performance warning: Theme switch took ${duration.toFixed(2)}ms (threshold: 100ms)`
            );
          }
        }
      });
    }
  };

  // Set theme and persist to localStorage (with feature detection)
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeToDocument(newTheme);
    
    if (isLocalStorageAvailable()) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch (error) {
        // localStorage unavailable, theme still applied to document
        console.warn('Failed to persist theme to localStorage', error);
      }
    }
  };

  // Toggle between light and dark themes
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  // Check if user has overridden system preference
  const isSystemPreferenceOverridden = (() => {
    if (!systemPreference) return false;
    if (!isLocalStorageAvailable()) return false;
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return stored !== null && stored !== systemPreference;
    } catch {
      return false;
    }
  })();

  return {
    theme,
    setTheme,
    toggleTheme,
    systemPreference,
    isSystemPreferenceOverridden,
  };
}
