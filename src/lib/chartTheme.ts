/**
 * Chart.js theme configuration for light and dark themes
 * 
 * Provides theme-aware color palettes and chart options
 * that maintain WCAG AA contrast ratios in both themes.
 * 
 * Requirements: 3.8
 */

export type ChartTheme = 'light' | 'dark';

/**
 * Color palette for charts in light theme
 */
const lightThemeColors = {
  primary: 'rgba(59, 130, 246, 0.6)',      // Blue
  secondary: 'rgba(16, 185, 129, 0.6)',    // Green
  tertiary: 'rgba(245, 158, 11, 0.6)',     // Amber
  quaternary: 'rgba(239, 68, 68, 0.6)',    // Red
  text: '#1f2937',                          // Gray-800
  grid: 'rgba(229, 231, 235, 0.5)',        // Gray-200
  border: 'rgba(209, 213, 219, 1)',        // Gray-300
};

/**
 * Color palette for charts in dark theme
 * Adjusted for sufficient contrast against dark backgrounds
 */
const darkThemeColors = {
  primary: 'rgba(96, 165, 250, 0.7)',      // Blue-400 (lighter, more visible)
  secondary: 'rgba(52, 211, 153, 0.7)',    // Green-400
  tertiary: 'rgba(251, 191, 36, 0.7)',     // Amber-400
  quaternary: 'rgba(248, 113, 113, 0.7)',  // Red-400
  text: '#f1f5f9',                          // Slate-100
  grid: 'rgba(51, 65, 85, 0.5)',           // Slate-700
  border: 'rgba(71, 85, 105, 1)',          // Slate-600
};

/**
 * Get color palette for the current theme
 */
export function getChartColors(theme: ChartTheme) {
  return theme === 'dark' ? darkThemeColors : lightThemeColors;
}

/**
 * Get Chart.js options configured for the current theme
 * 
 * @param theme - Current theme ('light' or 'dark')
 * @param customOptions - Additional chart-specific options to merge
 * @returns Chart.js options object with theme-aware colors
 */
export function getThemedChartOptions(
  theme: ChartTheme,
  customOptions: any = {}
) {
  const colors = getChartColors(theme);

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: {
          color: colors.text,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: colors.text,
        bodyColor: colors.text,
        borderColor: colors.border,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: {
          color: colors.text,
        },
        grid: {
          color: colors.grid,
        },
        border: {
          color: colors.border,
        },
      },
      y: {
        ticks: {
          color: colors.text,
        },
        grid: {
          color: colors.grid,
        },
        border: {
          color: colors.border,
        },
      },
    },
  };

  // Deep merge custom options with base options
  return mergeChartOptions(baseOptions, customOptions);
}

/**
 * Deep merge two chart options objects
 * Handles null values gracefully by skipping them
 */
function mergeChartOptions(base: any, custom: any): any {
  // If custom is null or undefined, return base as-is
  if (custom === null || custom === undefined) {
    return base;
  }
  
  // If base is null or undefined, return custom as-is
  if (base === null || base === undefined) {
    return custom;
  }
  
  const result = { ...base };

  for (const key in custom) {
    const customValue = custom[key];
    
    // Skip null or undefined values - don't override base options with null
    if (customValue === null || customValue === undefined) {
      continue;
    }
    
    // Deep merge objects (but not arrays)
    if (typeof customValue === 'object' && !Array.isArray(customValue)) {
      result[key] = mergeChartOptions(result[key] || {}, customValue);
    } else {
      result[key] = customValue;
    }
  }

  return result;
}

/**
 * Get a themed dataset configuration
 * 
 * @param theme - Current theme
 * @param colorKey - Which color from the palette to use
 * @param label - Dataset label
 * @param data - Dataset data
 * @returns Chart.js dataset object
 */
export function getThemedDataset(
  theme: ChartTheme,
  colorKey: 'primary' | 'secondary' | 'tertiary' | 'quaternary',
  label: string,
  data: any[]
) {
  const colors = getChartColors(theme);

  return {
    label,
    data,
    backgroundColor: colors[colorKey],
    borderColor: colors[colorKey].replace(/[\d.]+\)$/, '1)'), // Full opacity for border
    borderWidth: 1,
  };
}
