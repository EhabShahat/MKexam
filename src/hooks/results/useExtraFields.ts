/**
 * useExtraFields Hook
 * 
 * Fetches extra score field definitions and filters visible fields.
 * Requirements: 4.4
 */

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, resultsQueryConfig } from '@/lib/results/queryConfig';
import type { ExtraField } from '@/lib/results/types';

interface UseExtraFieldsResult {
  /** All extra fields */
  fields: ExtraField[];
  /** Only visible fields (hidden=false) */
  visibleFields: ExtraField[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Fetch extra field definitions from API
 */
async function fetchExtraFields(): Promise<ExtraField[]> {
  const response = await fetch('/api/admin/settings/extra-fields');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch extra fields: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.fields || [];
}

/**
 * Filter visible fields (not hidden)
 */
function filterVisibleFields(fields: ExtraField[]): ExtraField[] {
  return fields.filter((field) => !field.hidden);
}

/**
 * Sort fields by label alphabetically
 */
function sortFields(fields: ExtraField[]): ExtraField[] {
  return [...fields].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  );
}

/**
 * Hook to fetch extra field definitions
 */
export function useExtraFields(): UseExtraFieldsResult {
  const {
    data: rawFields = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: QUERY_KEYS.extraFields,
    queryFn: fetchExtraFields,
    ...resultsQueryConfig,
    // Extra fields change rarely, use longer stale time
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
  
  // Sort all fields
  const fields = sortFields(rawFields);
  
  // Filter and sort visible fields
  const visibleFields = sortFields(filterVisibleFields(rawFields));
  
  return {
    fields,
    visibleFields,
    isLoading,
    error: error as Error | null,
  };
}
