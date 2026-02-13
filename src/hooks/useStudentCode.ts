"use client";

import { useState, useEffect, useCallback } from "react";
import { encryptData, decryptData, secureClear, hashValue } from "@/lib/security";
import { recordAttempt, isRateLimited, getRateLimitStatus } from "@/lib/rateLimiter";
import { clientSecurityLog } from "@/lib/audit";
import { trackCodeValidation, trackNetworkRequest } from "@/lib/reorderedFlowPerformance";
import { 
  offlineHandler, 
  queueOfflineOperation, 
  retryWithBackoff, 
  getCachedData, 
  setCachedData 
} from "@/lib/offlineHandler";

/**
 * Structure for stored student code in localStorage
 */
export interface StoredStudentCode {
  code: string;
  timestamp: number;
  studentId?: string;
  lastValidated?: number; // Track last successful validation
  validationAttempts?: number; // Track failed validation attempts
  expiresAt?: number; // Optional expiration timestamp
  metadata?: { // Additional metadata
    studentName?: string;
    examCount?: number;
    lastExamId?: string;
  };
}

/**
 * Code validation response interface
 */
export interface CodeValidationResponse {
  valid: boolean;
  studentId?: string;
  studentName?: string;
  examCount?: number;
  expiresAt?: number;
  error?: string;
}

const STORAGE_KEY = 'student_code';

/**
 * Hash a code for secure logging (never log actual codes)
 * @param code - The code to hash
 * @returns Promise<string> - Hashed code for logging
 */
async function hashCodeForLogging(code: string): Promise<string> {
  try {
    return await hashValue(code);
  } catch {
    return 'hash_failed';
  }
}

/**
 * Safely check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Store student code in localStorage with enhanced metadata and error handling
 * @param code - The student code to store
 * @param studentId - Optional student ID to cache
 * @param metadata - Optional additional metadata
 */
export async function storeCode(code: string, studentId?: string, metadata?: StoredStudentCode['metadata']): Promise<void> {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available, code persistence disabled');
    return;
  }

  try {
    // Encrypt the sensitive code data
    const encryptedCode = await encryptData(code);
    
    const data: StoredStudentCode = {
      code: encryptedCode,
      timestamp: Date.now(),
      studentId,
      lastValidated: Date.now(),
      validationAttempts: 0,
      metadata,
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    // Securely clear the original code from memory
    secureClear(code);
  } catch (error) {
    const handled = handleStorageError(error, 'store code');
    if (!handled) {
      console.error('Failed to store student code:', error);
    }
  }
}

/**
 * Clear stored student code from localStorage with optional reason logging
 * @param reason - Optional reason for clearing the code (for debugging/audit)
 */
export function clearCode(reason?: string): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    if (reason) {
      console.info(`Clearing student code: ${reason}`);
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear student code:', error);
  }
}

/**
 * Handle storage errors gracefully with fallback mechanisms
 * @param error - The error that occurred
 * @param operation - The operation that failed
 * @returns Whether the error was handled gracefully
 */
function handleStorageError(error: unknown, operation: string): boolean {
  console.error(`Storage error during ${operation}:`, error);
  
  // Check if it's a quota exceeded error
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    console.warn('localStorage quota exceeded, attempting cleanup');
    try {
      // Clear the student code to free up space
      clearCode('quota exceeded');
      return true;
    } catch (cleanupError) {
      console.error('Failed to cleanup after quota exceeded:', cleanupError);
      return false;
    }
  }
  
  // Check if localStorage is disabled
  if (error instanceof DOMException && error.name === 'SecurityError') {
    console.warn('localStorage access denied, code persistence disabled');
    return true; // Gracefully handle by disabling persistence
  }
  
  return false;
}

/**
 * Get stored student code from localStorage with validation and expiration handling
 * @returns The stored code data or null if not found/invalid/expired
 */
export async function getStoredCode(): Promise<StoredStudentCode | null> {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored) as StoredStudentCode;
    
    // Decrypt the code
    const decryptedCode = await decryptData(data.code);
    
    // Validate structure and content
    if (!decryptedCode || typeof decryptedCode !== 'string' || decryptedCode.trim() === '') {
      clearCode('invalid code structure');
      return null;
    }

    // Check if code has expired
    if (data.expiresAt && Date.now() > data.expiresAt) {
      clearCode('code expired');
      return null;
    }

    // Check if code is too old (default 7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    if (data.timestamp && (Date.now() - data.timestamp) > maxAge) {
      clearCode('code too old');
      return null;
    }

    // Check if there are too many failed validation attempts
    if (data.validationAttempts && data.validationAttempts >= 5) {
      clearCode('too many failed validation attempts');
      return null;
    }

    // Return data with decrypted code
    return {
      ...data,
      code: decryptedCode
    };
  } catch (error) {
    console.error('Failed to retrieve student code:', error);
    clearCode('corrupted data');
    return null;
  }
}

/**
 * Update stored code metadata without changing the code itself, with error handling
 * @param updates - Partial updates to apply to stored code
 */
export async function updateStoredCodeMetadata(updates: Partial<StoredStudentCode>): Promise<void> {
  const current = await getStoredCode();
  if (!current) {
    console.warn('Cannot update metadata: no valid stored code found');
    return;
  }

  try {
    const updated: StoredStudentCode = {
      ...current,
      ...updates,
      code: current.code, // Ensure code is not overwritten
      timestamp: current.timestamp, // Preserve original timestamp
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    const handled = handleStorageError(error, 'update metadata');
    if (!handled) {
      console.error('Failed to update stored code metadata:', error);
    }
  }
}

/**
 * Check if stored code needs validation based on age and attempts
 * @param data - Stored code data
 * @returns True if validation is needed
 */
function needsValidation(data: StoredStudentCode): boolean {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  // Always validate if never validated or last validation was over 5 minutes ago
  if (!data.lastValidated || (now - data.lastValidated) > fiveMinutes) {
    return true;
  }
  
  // Validate if there were recent failed attempts
  if (data.validationAttempts && data.validationAttempts > 0) {
    return true;
  }
  
  return false;
}

/**
 * Hook for managing student code persistence with enhanced validation
 */
export function useStudentCode() {
  const [storedCode, setStoredCode] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidCode, setHasValidCode] = useState(false);
  const [codeMetadata, setCodeMetadata] = useState<StoredStudentCode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Define handleClearCode first since it's used by other functions
  const handleClearCode = useCallback(async (reason?: string) => {
    const currentCode = storedCode;
    
    clearCode(reason);
    setStoredCode(null);
    setCodeMetadata(null);
    setHasValidCode(false);

    // Log code clearing for security audit
    if (currentCode) {
      clientSecurityLog('code_cleared', {
        reason: reason || 'manual',
        code_hash: await hashCodeForLogging(currentCode),
      }, 'low');
    }
  }, [storedCode]);

  // Validate stored code in background
  const validateStoredCode = useCallback(async (data: StoredStudentCode) => {
    setIsValidating(true);
    const validationStartTime = performance.now();
    
    // Check rate limiting before validation
    if (isRateLimited('codeValidation')) {
      const status = getRateLimitStatus('codeValidation');
      clientSecurityLog('rate_limit_exceeded', {
        operation: 'codeValidation',
        remaining_attempts: status.remainingAttempts,
        reset_time: status.resetTime,
        suspicious_patterns: status.suspiciousPatterns,
      }, 'medium');
      
      setIsValidating(false);
      handleClearCode('rate limited');
      return;
    }

    try {
      const response = await fetch('/api/student/validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: data.code }),
      });

      const validationEndTime = performance.now();

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status}`);
      }

      const result: CodeValidationResponse = await response.json();
      
      // Track validation performance
      trackCodeValidation(
        validationStartTime,
        validationEndTime,
        result.valid,
        false, // Not cached for background validation
        {
          student_id: result.studentId,
          response_status: response.status,
          validation_type: 'background',
        }
      );
      
      // Record the validation attempt
      await recordAttempt('codeValidation', result.valid, data.code, {
        student_id: result.studentId,
        response_status: response.status,
      });
      
      if (result.valid) {
        // Update metadata with successful validation
        const updates: Partial<StoredStudentCode> = {
          lastValidated: Date.now(),
          validationAttempts: 0,
          studentId: result.studentId || data.studentId,
          expiresAt: result.expiresAt,
          metadata: {
            ...data.metadata,
            studentName: result.studentName || data.metadata?.studentName,
            examCount: result.examCount || data.metadata?.examCount,
          },
        };
        
        updateStoredCodeMetadata(updates);
        setHasValidCode(true);
        setCodeMetadata({ ...data, ...updates });

        // Log successful validation
        clientSecurityLog('code_validation_success', {
          student_id: result.studentId,
          exam_count: result.examCount,
        }, 'low');
      } else {
        // Code is invalid, clear it with reason
        clientSecurityLog('code_validation_failed', {
          code_hash: await hashCodeForLogging(data.code),
          error: result.error,
        }, 'medium');
        
        handleClearCode('validation failed');
      }
    } catch (error) {
      const validationEndTime = performance.now();
      console.error('Background validation failed:', error);
      
      // Track failed validation performance
      trackCodeValidation(
        validationStartTime,
        validationEndTime,
        false,
        false,
        {
          error: error instanceof Error ? error.message : 'unknown error',
          validation_type: 'background',
        }
      );
      
      // Record failed attempt
      await recordAttempt('codeValidation', false, data.code, {
        error: error instanceof Error ? error.message : 'unknown error',
      });
      
      // Log validation error
      clientSecurityLog('code_validation_error', {
        error: error instanceof Error ? error.message : 'unknown error',
        code_hash: await hashCodeForLogging(data.code),
      }, 'high');
      
      // Increment validation attempts on error
      const attempts = (data.validationAttempts || 0) + 1;
      updateStoredCodeMetadata({ validationAttempts: attempts });
      
      // If too many failed attempts, clear the code
      if (attempts >= 3) {
        clientSecurityLog('code_cleared_excessive_failures', {
          attempts,
          code_hash: await hashCodeForLogging(data.code),
        }, 'high');
        handleClearCode('too many validation failures');
      } else {
        // Keep code but mark as needing validation
        setHasValidCode(false);
      }
    } finally {
      setIsValidating(false);
    }
  }, [handleClearCode]);

  // Load stored code on mount and validate if needed
  useEffect(() => {
    const loadStoredCode = async () => {
      try {
        const data = await getStoredCode();
        if (data) {
          console.log('[useStudentCode] Loaded code from storage:', data.code);
          setStoredCode(data.code);
          setCodeMetadata(data);
          
          // Check if automatic validation is needed
          if (needsValidation(data)) {
            console.log('[useStudentCode] Code needs validation, validating in background');
            // Validate in background without blocking UI
            validateStoredCode(data);
          } else {
            console.log('[useStudentCode] Code is valid, no validation needed');
            setHasValidCode(true);
          }
        } else {
          console.log('[useStudentCode] No stored code found');
          setStoredCode(null);
          setCodeMetadata(null);
          setHasValidCode(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredCode();
  }, [validateStoredCode]);

  const handleStoreCode = useCallback(async (code: string, studentId?: string, metadata?: StoredStudentCode['metadata']) => {
    // Check rate limiting for storage operations
    if (isRateLimited('codeStorage')) {
      const status = getRateLimitStatus('codeStorage');
      clientSecurityLog('rate_limit_exceeded', {
        operation: 'codeStorage',
        remaining_attempts: status.remainingAttempts,
        reset_time: status.resetTime,
        suspicious_patterns: status.suspiciousPatterns,
      }, 'medium');
      return;
    }

    // Record storage attempt
    await recordAttempt('codeStorage', true, code, {
      student_id: studentId,
      has_metadata: !!metadata,
    });

    await storeCode(code, studentId, metadata);
    const data = await getStoredCode();
    setStoredCode(code);
    setCodeMetadata(data);
    setHasValidCode(true);

    // Log successful code storage
    clientSecurityLog('code_stored', {
      student_id: studentId,
      has_metadata: !!metadata,
      code_hash: await hashCodeForLogging(code),
    }, 'low');
  }, []);

  const validateCode = useCallback(async (code: string): Promise<boolean> => {
    // Check rate limiting before validation
    if (isRateLimited('codeValidation')) {
      const status = getRateLimitStatus('codeValidation');
      clientSecurityLog('rate_limit_exceeded', {
        operation: 'codeValidation',
        remaining_attempts: status.remainingAttempts,
        reset_time: status.resetTime,
        suspicious_patterns: status.suspiciousPatterns,
      }, 'medium');
      return false;
    }

    setIsValidating(true);
    const validationStartTime = performance.now();
    
    try {
      // Check if we're offline and try cached validation first
      if (!offlineHandler.isOnline()) {
        const cachedResult = getCachedData(`code_validation_${code}`);
        if (cachedResult && cachedResult.valid) {
          const validationEndTime = performance.now();
          
          trackCodeValidation(
            validationStartTime,
            validationEndTime,
            true,
            true, // cached
            { validation_type: 'offline_cache', code_length: code.length }
          );
          
          return true;
        }
        
        // Queue for later validation
        queueOfflineOperation('code_validation', { code }, 'retry_exponential');
        
        // Return false for offline validation without cache
        trackCodeValidation(
          validationStartTime,
          performance.now(),
          false,
          false,
          { validation_type: 'offline_queued', code_length: code.length }
        );
        
        return false;
      }

      // Online validation with retry logic
      const response = await retryWithBackoff(async () => {
        return await fetch('/api/student/validate-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });
      }, 2, 500); // 2 retries with 500ms base delay

      const validationEndTime = performance.now();

      if (!response.ok) {
        // Track failed network request
        trackNetworkRequest(
          'code_validation',
          validationStartTime,
          validationEndTime,
          false,
          false,
          { response_status: response.status, error: 'http_error' }
        );
        
        // Record failed attempt
        await recordAttempt('codeValidation', false, code, {
          response_status: response.status,
          error: 'http_error',
        });
        return false;
      }

      const result: CodeValidationResponse = await response.json();
      
      // Cache successful validation results
      if (result.valid) {
        setCachedData(`code_validation_${code}`, {
          valid: true,
          studentId: result.studentId,
          examCount: result.examCount,
          timestamp: Date.now(),
        });
      }
      
      // Track validation performance
      trackCodeValidation(
        validationStartTime,
        validationEndTime,
        result.valid,
        false, // Not cached for direct validation
        {
          student_id: result.studentId,
          response_status: response.status,
          validation_type: 'online_direct',
        }
      );
      
      // Record the validation attempt
      await recordAttempt('codeValidation', result.valid, code, {
        student_id: result.studentId,
        response_status: response.status,
      });

      if (result.valid) {
        clientSecurityLog('code_validation_success', {
          student_id: result.studentId,
          exam_count: result.examCount,
        }, 'low');
      } else {
        clientSecurityLog('code_validation_failed', {
          code_hash: await hashCodeForLogging(code),
          error: result.error,
        }, 'medium');
      }

      return result.valid;
    } catch (error) {
      const validationEndTime = performance.now();
      console.error('Failed to validate code:', error);
      
      // Check if we have cached data as fallback
      const cachedResult = getCachedData(`code_validation_${code}`);
      if (cachedResult && cachedResult.valid) {
        console.log('Using cached validation result as fallback');
        
        trackCodeValidation(
          validationStartTime,
          validationEndTime,
          true,
          true,
          {
            validation_type: 'offline_fallback',
            error: error instanceof Error ? error.message : 'unknown error',
          }
        );
        
        return true;
      }
      
      // Track failed validation performance
      trackCodeValidation(
        validationStartTime,
        validationEndTime,
        false,
        false,
        {
          error: error instanceof Error ? error.message : 'unknown error',
          validation_type: 'online_failed',
        }
      );
      
      // Queue for retry if network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        queueOfflineOperation('code_validation', { code }, 'retry_exponential');
      }
      
      // Record failed attempt
      await recordAttempt('codeValidation', false, code, {
        error: error instanceof Error ? error.message : 'unknown error',
      });

      // Log validation error
      clientSecurityLog('code_validation_error', {
        error: error instanceof Error ? error.message : 'unknown error',
        code_hash: await hashCodeForLogging(code),
      }, 'high');

      return false;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const validateAndRedirect = useCallback(async (): Promise<boolean> => {
    const data = await getStoredCode();
    if (!data) {
      return false;
    }

    const isValid = await validateCode(data.code);
    if (!isValid) {
      handleClearCode('validation failed on redirect');
      return false;
    }

    setHasValidCode(true);
    return true;
  }, [validateCode, handleClearCode]);

  return {
    storedCode,
    isLoading,
    isValidating,
    hasValidCode,
    codeMetadata,
    storeCode: handleStoreCode,
    clearCode: handleClearCode,
    validateAndRedirect,
    validateCode,
  };
}
