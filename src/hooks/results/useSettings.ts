/**
 * useSettings Hook
 * 
 * Fetches app settings for score calculation configuration.
 * Requirements: 5.1
 */

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, resultsQueryConfig } from '@/lib/results/queryConfig';
import type { AppSettings } from '@/lib/results/types';

interface UseSettingsResult {
  /** Application settings */
  settings: AppSettings | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Default settings fallback
 */
const DEFAULT_SETTINGS: AppSettings = {
  result_pass_calc_mode: 'best',
  result_overall_pass_threshold: 50,
  result_exam_weight: 0.7,
  result_fail_on_any_exam: false,
};

/**
 * Fetch app settings from API
 */
async function fetchSettings(): Promise<AppSettings> {
  const response = await fetch('/api/admin/settings');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch settings: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Extract relevant settings for score calculation
  const settings: AppSettings = {
    result_pass_calc_mode: data.result_pass_calc_mode || DEFAULT_SETTINGS.result_pass_calc_mode,
    result_overall_pass_threshold: data.result_overall_pass_threshold ?? DEFAULT_SETTINGS.result_overall_pass_threshold,
    result_exam_weight: data.result_exam_weight ?? DEFAULT_SETTINGS.result_exam_weight,
    result_fail_on_any_exam: data.result_fail_on_any_exam ?? DEFAULT_SETTINGS.result_fail_on_any_exam,
  };
  
  return settings;
}

/**
 * Hook to fetch application settings
 */
export function useSettings(): UseSettingsResult {
  const {
    data: settings = null,
    isLoading,
    error,
  } = useQuery({
    queryKey: QUERY_KEYS.settings,
    queryFn: fetchSettings,
    ...resultsQueryConfig,
    // Settings change rarely, use longer stale time
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
  
  return {
    settings,
    isLoading,
    error: error as Error | null,
  };
}
