/**
 * Client-side rate limiting and security monitoring utilities
 * Provides protection against brute force attacks and suspicious patterns
 */

import { generateSecureToken, hashValue } from "./security";

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

/**
 * Rate limit attempt record
 */
interface RateLimitAttempt {
  timestamp: number;
  identifier: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Rate limit state
 */
interface RateLimitState {
  attempts: RateLimitAttempt[];
  blockedUntil?: number;
  suspiciousPatterns: string[];
}

/**
 * Default rate limit configurations
 */
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  codeValidation: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  },
  codeStorage: {
    maxAttempts: 10,
    windowMs: 5 * 60 * 1000, // 5 minutes
    blockDurationMs: 10 * 60 * 1000, // 10 minutes
  },
  securityLogSync: {
    maxAttempts: 20,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDurationMs: 15 * 60 * 1000, // 15 minutes
  },
};

/**
 * Get rate limit storage key
 * @param operation - The operation being rate limited
 * @returns string - Storage key
 */
function getRateLimitKey(operation: string): string {
  return `rate_limit_${operation}`;
}

/**
 * Get current rate limit state from storage
 * @param operation - The operation being rate limited
 * @returns RateLimitState - Current state
 */
function getRateLimitState(operation: string): RateLimitState {
  try {
    const stored = localStorage.getItem(getRateLimitKey(operation));
    if (!stored) {
      return { attempts: [], suspiciousPatterns: [] };
    }
    return JSON.parse(stored) as RateLimitState;
  } catch {
    return { attempts: [], suspiciousPatterns: [] };
  }
}

/**
 * Save rate limit state to storage (client-side only)
 * @param operation - The operation being rate limited
 * @param state - State to save
 */
function saveRateLimitState(operation: string, state: RateLimitState): void {
  // Only use localStorage in browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return; // Skip saving in server-side environment
  }
  
  try {
    localStorage.setItem(getRateLimitKey(operation), JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save rate limit state:', error);
  }
}

/**
 * Clean up old attempts outside the time window
 * @param attempts - Array of attempts
 * @param windowMs - Time window in milliseconds
 * @returns RateLimitAttempt[] - Cleaned attempts
 */
function cleanupOldAttempts(attempts: RateLimitAttempt[], windowMs: number): RateLimitAttempt[] {
  const cutoff = Date.now() - windowMs;
  return attempts.filter(attempt => attempt.timestamp > cutoff);
}

/**
 * Detect suspicious patterns in attempts
 * @param attempts - Array of attempts
 * @returns string[] - Array of detected patterns
 */
function detectSuspiciousPatterns(attempts: RateLimitAttempt[]): string[] {
  const patterns: string[] = [];
  
  if (attempts.length === 0) {
    return patterns;
  }

  // Pattern 1: Rapid successive failures
  const recentFailures = attempts
    .filter(a => !a.success)
    .slice(-5); // Last 5 failures
  
  if (recentFailures.length >= 3) {
    const timeSpan = recentFailures[recentFailures.length - 1].timestamp - recentFailures[0].timestamp;
    if (timeSpan < 30000) { // Less than 30 seconds
      patterns.push('rapid_failures');
    }
  }

  // Pattern 2: Regular interval attempts (bot-like behavior)
  if (attempts.length >= 5) {
    const intervals = [];
    for (let i = 1; i < Math.min(attempts.length, 10); i++) {
      intervals.push(attempts[i].timestamp - attempts[i - 1].timestamp);
    }
    
    // Check if intervals are suspiciously regular (within 1 second variance)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    
    if (variance < 1000000 && avgInterval < 10000) { // Low variance, short intervals
      patterns.push('regular_intervals');
    }
  }

  // Pattern 3: High frequency attempts
  const recentAttempts = attempts.filter(a => Date.now() - a.timestamp < 60000); // Last minute
  if (recentAttempts.length > 10) {
    patterns.push('high_frequency');
  }

  return patterns;
}

/**
 * Check if an operation is currently rate limited
 * @param operation - The operation to check
 * @returns boolean - True if rate limited
 */
export function isRateLimited(operation: string): boolean {
  const config = DEFAULT_CONFIGS[operation];
  if (!config) {
    return false;
  }

  const state = getRateLimitState(operation);
  
  // Check if currently blocked
  if (state.blockedUntil && Date.now() < state.blockedUntil) {
    return true;
  }

  // Clean up old attempts
  const cleanAttempts = cleanupOldAttempts(state.attempts, config.windowMs);
  
  // Count failed attempts in the window
  const failedAttempts = cleanAttempts.filter(a => !a.success).length;
  
  return failedAttempts >= config.maxAttempts;
}

/**
 * Record a rate limit attempt
 * @param operation - The operation being attempted
 * @param success - Whether the attempt was successful
 * @param identifier - Optional identifier for the attempt
 * @param metadata - Optional metadata about the attempt
 * @returns boolean - True if attempt is allowed, false if rate limited
 */
export async function recordAttempt(
  operation: string,
  success: boolean,
  identifier?: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const config = DEFAULT_CONFIGS[operation];
  if (!config) {
    return true; // Allow if no config
  }

  // Check if currently rate limited
  if (isRateLimited(operation)) {
    return false;
  }

  const state = getRateLimitState(operation);
  
  // Generate identifier if not provided
  const attemptIdentifier = identifier || await generateAttemptIdentifier();
  
  // Record the attempt
  const attempt: RateLimitAttempt = {
    timestamp: Date.now(),
    identifier: attemptIdentifier,
    success,
    metadata,
  };

  // Clean up old attempts and add new one
  const cleanAttempts = cleanupOldAttempts(state.attempts, config.windowMs);
  cleanAttempts.push(attempt);

  // Detect suspicious patterns
  const suspiciousPatterns = detectSuspiciousPatterns(cleanAttempts);

  // Update state
  const newState: RateLimitState = {
    attempts: cleanAttempts,
    suspiciousPatterns,
  };

  // Check if we should block after this attempt
  const failedAttempts = cleanAttempts.filter(a => !a.success).length;
  if (failedAttempts >= config.maxAttempts) {
    newState.blockedUntil = Date.now() + config.blockDurationMs;
  }

  // Save updated state
  saveRateLimitState(operation, newState);

  return true;
}

/**
 * Generate a unique identifier for an attempt
 * @returns Promise<string> - Hashed identifier
 */
async function generateAttemptIdentifier(): Promise<string> {
  const components = [
    navigator.userAgent,
    Date.now().toString(),
    generateSecureToken(8),
  ];
  
  return await hashValue(components.join('|'));
}

/**
 * Get rate limit status for an operation
 * @param operation - The operation to check
 * @returns Object with rate limit information
 */
export function getRateLimitStatus(operation: string): {
  isLimited: boolean;
  remainingAttempts: number;
  resetTime: number | null;
  suspiciousPatterns: string[];
} {
  const config = DEFAULT_CONFIGS[operation];
  if (!config) {
    return {
      isLimited: false,
      remainingAttempts: Infinity,
      resetTime: null,
      suspiciousPatterns: [],
    };
  }

  const state = getRateLimitState(operation);
  const cleanAttempts = cleanupOldAttempts(state.attempts, config.windowMs);
  const failedAttempts = cleanAttempts.filter(a => !a.success).length;
  
  const isLimited = state.blockedUntil ? Date.now() < state.blockedUntil : failedAttempts >= config.maxAttempts;
  const remainingAttempts = Math.max(0, config.maxAttempts - failedAttempts);
  const resetTime = state.blockedUntil || (cleanAttempts.length > 0 ? cleanAttempts[0].timestamp + config.windowMs : null);

  return {
    isLimited,
    remainingAttempts,
    resetTime,
    suspiciousPatterns: state.suspiciousPatterns,
  };
}

/**
 * Clear rate limit state for an operation (admin function)
 * @param operation - The operation to clear
 */
export function clearRateLimit(operation: string): void {
  try {
    localStorage.removeItem(getRateLimitKey(operation));
  } catch (error) {
    console.error('Failed to clear rate limit:', error);
  }
}

/**
 * Get all rate limit operations with their status
 * @returns Record<string, object> - Status for all operations
 */
export function getAllRateLimitStatus(): Record<string, ReturnType<typeof getRateLimitStatus>> {
  const status: Record<string, ReturnType<typeof getRateLimitStatus>> = {};
  
  for (const operation of Object.keys(DEFAULT_CONFIGS)) {
    status[operation] = getRateLimitStatus(operation);
  }
  
  return status;
}