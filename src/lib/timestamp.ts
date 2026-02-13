/**
 * Timestamp utilities for progress data
 * Ensures millisecond precision and consistent handling
 */

/**
 * Get current timestamp with millisecond precision
 * Uses Date.now() for consistent precision
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Validates timestamp is a valid number with millisecond precision
 */
export function isValidTimestamp(timestamp: unknown): timestamp is number {
  if (typeof timestamp !== 'number') return false;
  if (!Number.isFinite(timestamp)) return false;
  if (timestamp < 0) return false;
  
  // Check if timestamp is in reasonable range (after year 2000, before year 2100)
  const minTimestamp = 946684800000; // 2000-01-01
  const maxTimestamp = 4102444800000; // 2100-01-01
  
  return timestamp >= minTimestamp && timestamp <= maxTimestamp;
}

/**
 * Ensures timestamp has millisecond precision
 * Converts seconds to milliseconds if needed
 */
export function normalizeTimestamp(timestamp: number): number {
  // If timestamp appears to be in seconds (less than year 2000 in milliseconds)
  if (timestamp < 946684800000) {
    return timestamp * 1000;
  }
  
  return timestamp;
}

/**
 * Formats timestamp for display
 * Preserves millisecond precision in ISO format
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Parses ISO timestamp string back to milliseconds
 */
export function parseTimestamp(isoString: string): number {
  return new Date(isoString).getTime();
}

/**
 * Calculates time difference in seconds
 */
export function getTimeDifferenceSeconds(startTimestamp: number, endTimestamp: number): number {
  return Math.round((endTimestamp - startTimestamp) / 1000);
}

/**
 * Validates and normalizes timestamp in progress data
 */
export function sanitizeTimestamps(data: unknown): unknown {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeTimestamps(item));
  }
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Check if this looks like a timestamp field
    if ((key.includes('timestamp') || key.includes('_at') || key === 'time') && typeof value === 'number') {
      sanitized[key] = normalizeTimestamp(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeTimestamps(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
