/**
 * JSONB Field Optimization Module
 * 
 * This module provides utilities to reduce the size of JSONB fields before storage
 * and transfer, optimizing Supabase egress bandwidth and storage costs.
 * 
 * Key optimizations:
 * - Remove whitespace from JSON (compact encoding)
 * - Deduplicate IP arrays in device_info
 * - Create answer deltas for incremental updates
 * - Convert timestamps to integers
 * 
 * @module jsonb-optimizer
 * @see Requirements 5.1, 5.2, 5.3, 5.6
 */

/**
 * Answer delta structure for incremental updates
 * Only stores changed answers instead of full answer set
 */
export interface AnswerDelta {
  /** Changed answer values keyed by question ID */
  changed: Record<string, any>;
  /** Question IDs that were removed/cleared */
  removed: string[];
  /** Delta version for ordering and conflict resolution */
  version: number;
  /** Timestamp when delta was created (integer Unix timestamp) */
  timestamp: number;
}

/**
 * Device info structure with IP arrays
 */
export interface DeviceInfoWithIPs {
  fingerprint?: string;
  allIPs?: {
    local?: string[];
    public?: string[];
  };
  [key: string]: any;
}

/**
 * Compacts answers by removing whitespace from JSON encoding
 * 
 * This reduces the size of answer data by using compact JSON encoding
 * without unnecessary whitespace, indentation, or formatting.
 * 
 * @param answers - Answer object keyed by question ID
 * @returns Compacted answers (same structure, optimized for storage)
 * 
 * @example
 * const answers = { "q1": "answer", "q2": ["a", "b"] };
 * const compact = compactAnswers(answers);
 * // Returns same data but will be stored without whitespace
 * 
 * @see Requirement 5.1
 */
export function compactAnswers(answers: Record<string, any>): Record<string, any> {
  if (!answers || typeof answers !== 'object') {
    return answers;
  }

  // The compaction happens during JSON.stringify without spaces
  // This function ensures the data is ready for compact encoding
  // by normalizing the structure
  const compacted: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(answers)) {
    if (value !== undefined) {
      // Parse and re-stringify to remove any existing formatting
      compacted[key] = value;
    }
  }
  
  return compacted;
}

/**
 * Deduplicates IP addresses in device_info structure
 * 
 * Removes duplicate IP addresses from local and public IP arrays
 * to reduce storage size and bandwidth usage.
 * 
 * @param deviceInfo - Device info object with allIPs structure
 * @returns Device info with deduplicated IP arrays
 * 
 * @example
 * const deviceInfo = {
 *   fingerprint: "abc123",
 *   allIPs: {
 *     local: ["192.168.1.1", "192.168.1.1", "10.0.0.1"],
 *     public: ["1.2.3.4", "1.2.3.4"]
 *   }
 * };
 * const deduplicated = deduplicateDeviceInfo(deviceInfo);
 * // Returns: { ..., allIPs: { local: ["192.168.1.1", "10.0.0.1"], public: ["1.2.3.4"] } }
 * 
 * @see Requirements 1.5, 5.2
 */
export function deduplicateDeviceInfo(deviceInfo: DeviceInfoWithIPs): DeviceInfoWithIPs {
  if (!deviceInfo || typeof deviceInfo !== 'object') {
    return deviceInfo;
  }

  const deduplicated = { ...deviceInfo };

  if (deduplicated.allIPs && typeof deduplicated.allIPs === 'object') {
    const allIPs = { ...deduplicated.allIPs };

    // Deduplicate local IPs
    if (Array.isArray(allIPs.local)) {
      allIPs.local = Array.from(new Set(allIPs.local.filter(ip => ip != null)));
    }

    // Deduplicate public IPs
    if (Array.isArray(allIPs.public)) {
      allIPs.public = Array.from(new Set(allIPs.public.filter(ip => ip != null)));
    }

    deduplicated.allIPs = allIPs;
  }

  return deduplicated;
}

/**
 * Creates an answer delta containing only changed answers
 * 
 * Compares old and new answer sets to identify changes and removals,
 * creating a minimal delta object for incremental updates.
 * 
 * @param oldAnswers - Previous answer state
 * @param newAnswers - New answer state
 * @param version - Delta version number for ordering
 * @returns Answer delta with only changes
 * 
 * @example
 * const oldAnswers = { "q1": "a", "q2": "b", "q3": "c" };
 * const newAnswers = { "q1": "a", "q2": "x", "q4": "d" };
 * const delta = createAnswerDelta(oldAnswers, newAnswers, 2);
 * // Returns: { changed: { "q2": "x", "q4": "d" }, removed: ["q3"], version: 2, timestamp: ... }
 * 
 * @see Requirements 1.6, 5.3
 */
export function createAnswerDelta(
  oldAnswers: Record<string, any> | null | undefined,
  newAnswers: Record<string, any> | null | undefined,
  version: number = 1
): AnswerDelta {
  const changed: Record<string, any> = {};
  const removed: string[] = [];
  const timestamp = Math.floor(Date.now() / 1000); // Integer Unix timestamp

  const old = oldAnswers || {};
  const newAns = newAnswers || {};

  // Find changed and new answers
  for (const [key, value] of Object.entries(newAns)) {
    // Compare values - use JSON stringify for deep comparison
    const oldValue = old[key];
    const isChanged = JSON.stringify(oldValue) !== JSON.stringify(value);
    
    if (isChanged) {
      changed[key] = value;
    }
  }

  // Find removed answers
  for (const key of Object.keys(old)) {
    if (!(key in newAns)) {
      removed.push(key);
    }
  }

  return {
    changed,
    removed,
    version,
    timestamp
  };
}

/**
 * Applies an answer delta to reconstruct full answers
 * 
 * Takes current answers and applies a delta to produce the updated answer set.
 * Handles both changed values and removed keys.
 * 
 * @param currentAnswers - Current answer state
 * @param delta - Answer delta to apply
 * @returns Updated full answer set
 * 
 * @example
 * const current = { "q1": "a", "q2": "b", "q3": "c" };
 * const delta = { changed: { "q2": "x", "q4": "d" }, removed: ["q3"], version: 2, timestamp: 123 };
 * const updated = applyAnswerDelta(current, delta);
 * // Returns: { "q1": "a", "q2": "x", "q4": "d" }
 * 
 * @see Requirements 1.6, 5.3
 */
export function applyAnswerDelta(
  currentAnswers: Record<string, any> | null | undefined,
  delta: AnswerDelta
): Record<string, any> {
  const result = { ...(currentAnswers || {}) };

  // Apply changed values
  for (const [key, value] of Object.entries(delta.changed)) {
    result[key] = value;
  }

  // Remove deleted keys
  for (const key of delta.removed) {
    delete result[key];
  }

  return result;
}

/**
 * Converts ISO timestamp string to integer Unix timestamp
 * 
 * Reduces storage size by using integer timestamps instead of ISO 8601 strings.
 * 
 * @param isoTimestamp - ISO 8601 timestamp string
 * @returns Integer Unix timestamp (seconds since epoch)
 * 
 * @example
 * const iso = "2024-01-15T10:30:00.000Z";
 * const unix = convertToIntegerTimestamp(iso);
 * // Returns: 1705315800
 * 
 * @see Requirement 5.6
 */
export function convertToIntegerTimestamp(isoTimestamp: string | null | undefined): number | null {
  if (!isoTimestamp) {
    return null;
  }

  try {
    const date = new Date(isoTimestamp);
    if (isNaN(date.getTime())) {
      return null;
    }
    return Math.floor(date.getTime() / 1000);
  } catch {
    return null;
  }
}

/**
 * Converts integer Unix timestamp to ISO timestamp string
 * 
 * Converts integer timestamps back to ISO 8601 format for display or API compatibility.
 * 
 * @param unixTimestamp - Integer Unix timestamp (seconds since epoch)
 * @returns ISO 8601 timestamp string
 * 
 * @example
 * const unix = 1705315800;
 * const iso = convertFromIntegerTimestamp(unix);
 * // Returns: "2024-01-15T10:30:00.000Z"
 * 
 * @see Requirement 5.6
 */
export function convertFromIntegerTimestamp(unixTimestamp: number | null | undefined): string | null {
  if (!unixTimestamp || typeof unixTimestamp !== 'number') {
    return null;
  }

  try {
    const date = new Date(unixTimestamp * 1000);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Optimizes progress_data by converting timestamps to integers
 * 
 * Processes progress data objects to replace ISO timestamp strings
 * with integer Unix timestamps for reduced storage size.
 * 
 * @param progressData - Progress data object with timestamps
 * @returns Optimized progress data with integer timestamps
 * 
 * @example
 * const progress = { started_at: "2024-01-15T10:30:00.000Z", completed: true };
 * const optimized = optimizeProgressData(progress);
 * // Returns: { started_at: 1705315800, completed: true }
 * 
 * @see Requirement 5.6
 */
export function optimizeProgressData(progressData: any): any {
  if (!progressData || typeof progressData !== 'object') {
    return progressData;
  }

  const optimized = { ...progressData };

  // Convert common timestamp fields
  const timestampFields = ['started_at', 'completed_at', 'created_at', 'updated_at', 'timestamp'];
  
  for (const field of timestampFields) {
    if (field in optimized && typeof optimized[field] === 'string') {
      optimized[field] = convertToIntegerTimestamp(optimized[field]);
    }
  }

  return optimized;
}

/**
 * Serializes data to compact JSON string
 * 
 * Converts data to JSON string without whitespace for minimal size.
 * This is the final step before storing JSONB data.
 * 
 * @param data - Data to serialize
 * @returns Compact JSON string
 * 
 * @example
 * const data = { key: "value", nested: { a: 1, b: 2 } };
 * const json = toCompactJSON(data);
 * // Returns: '{"key":"value","nested":{"a":1,"b":2}}'
 * 
 * @see Requirement 5.1
 */
export function toCompactJSON(data: any): string {
  return JSON.stringify(data);
}

/**
 * Parses compact JSON string back to object
 * 
 * Safely parses JSON string with error handling.
 * 
 * @param json - JSON string to parse
 * @returns Parsed object or null on error
 * 
 * @example
 * const json = '{"key":"value"}';
 * const data = fromCompactJSON(json);
 * // Returns: { key: "value" }
 */
export function fromCompactJSON(json: string | null | undefined): any {
  if (!json) {
    return null;
  }

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
