/**
 * useAttempts Hook
 * 
 * Fetches attempts for a specific exam or all exams (bulk mode).
 * Calculates device usage map for tracking duplicate devices.
 * Requirements: 3.1, 13.2
 */

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, resultsQueryConfig } from '@/lib/results/queryConfig';
import type { Attempt } from '@/lib/results/types';

interface UseAttemptsResult {
  /** List of attempts */
  attempts: Attempt[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => Promise<void>;
  /** Map of device fingerprint to usage count */
  deviceUsageMap: Map<string, number>;
}

/**
 * Fetch attempts for a specific exam
 */
async function fetchAttemptsByExam(examId: string): Promise<Attempt[]> {
  const response = await fetch(`/api/admin/exams/${examId}/attempts`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch attempts: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.attempts || [];
}

/**
 * Fetch all attempts across all exams (bulk API)
 */
async function fetchBulkAttempts(): Promise<Attempt[]> {
  const response = await fetch('/api/admin/attempts/bulk');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch bulk attempts: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.allAttempts || [];
}

/**
 * Generate device fingerprint from device_info and IP
 */
function generateDeviceFingerprint(attempt: Attempt): string {
  const parts: string[] = [];
  
  // Parse device_info if available
  if (attempt.device_info) {
    try {
      const deviceData = JSON.parse(attempt.device_info);
      
      // Use various device identifiers
      if (deviceData.device?.model) {
        parts.push(deviceData.device.model);
      }
      if (deviceData.device?.brand) {
        parts.push(deviceData.device.brand);
      }
      if (deviceData.os?.name && deviceData.os?.version) {
        parts.push(`${deviceData.os.name}-${deviceData.os.version}`);
      }
      if (deviceData.browser?.name && deviceData.browser?.version) {
        parts.push(`${deviceData.browser.name}-${deviceData.browser.version}`);
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  // Add IP address as fallback
  if (attempt.ip_address) {
    parts.push(attempt.ip_address);
  }
  
  return parts.length > 0 ? parts.join('|') : 'unknown';
}

/**
 * Calculate device usage counts across attempts
 */
function calculateDeviceUsage(attempts: Attempt[]): Map<string, number> {
  const usageMap = new Map<string, number>();
  
  for (const attempt of attempts) {
    const fingerprint = generateDeviceFingerprint(attempt);
    const currentCount = usageMap.get(fingerprint) || 0;
    usageMap.set(fingerprint, currentCount + 1);
  }
  
  return usageMap;
}

/**
 * Hook to fetch attempts for an exam or all exams
 * 
 * @param examId - Exam ID, or null/"__ALL__" for bulk mode
 */
export function useAttempts(examId: string | null): UseAttemptsResult {
  const isBulkMode = !examId || examId === '__ALL__';
  
  const {
    data: attempts = [],
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: isBulkMode
      ? QUERY_KEYS.attempts.bulk
      : QUERY_KEYS.attempts.byExam(examId),
    queryFn: () =>
      isBulkMode ? fetchBulkAttempts() : fetchAttemptsByExam(examId),
    ...resultsQueryConfig,
    enabled: !!examId || isBulkMode,
  });
  
  // Calculate device usage map
  const deviceUsageMap = calculateDeviceUsage(attempts);
  
  const refetch = async () => {
    await queryRefetch();
  };
  
  return {
    attempts,
    isLoading,
    error: error as Error | null,
    refetch,
    deviceUsageMap,
  };
}
