/**
 * Wrapper for device info collection with timeout and retry logic
 * Ensures collection completes within timeout and doesn't block exam access
 * 
 * Requirements: 1.1, 1.3, 1.4, 9.1
 */

import { collectDetailedDeviceInfo } from './collectDeviceInfo';

const COLLECTION_TIMEOUT_MS = 20000; // 20 seconds (increased from 15s for slow devices - Requirement 9.1)
const MAX_RETRIES = 3; // Maximum number of retry attempts (increased from 2 - Requirement 9.1)
const RETRY_DELAY_MS = 1000; // Delay between retries

/**
 * Creates a minimal partial device info object for timeout scenarios
 * Ensures we always send some data even if full collection fails
 * 
 * @param submitClicks - Optional submit click tracking data
 * @returns Minimal device info object
 */
function createPartialDeviceInfo(submitClicks?: { count: number; firstAt: string | null; lastAt: string | null; timestamps: string[] }): any {
  try {
    const nav = typeof navigator !== "undefined" ? (navigator as any) : ({} as any);
    const scr = typeof screen !== "undefined" ? (screen as any) : ({} as any);
    
    return {
      collectedAt: new Date().toISOString(),
      friendlyName: "Partial Data (Timeout)",
      userAgent: nav.userAgent || null,
      platform: nav.platform || null,
      vendor: nav.vendor || null,
      language: nav.language || null,
      screen: {
        width: scr.width || null,
        height: scr.height || null,
        colorDepth: scr.colorDepth || null,
        pixelDepth: scr.pixelDepth || null
      },
      browserDetails: {
        name: null,
        version: null,
        fullVersion: null,
        engine: null,
        engineVersion: null
      },
      platformDetails: {
        os: null,
        osVersion: null,
        architecture: null,
        bitness: null
      },
      partialData: true,
      partialReason: 'collection_timeout',
      entrySubmit: submitClicks || null
    };
  } catch (error) {
    console.error('[Device Collection Timeout] Failed to create partial device info:', {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    
    // Absolute minimal fallback
    return {
      collectedAt: new Date().toISOString(),
      friendlyName: "Minimal Data (Error)",
      partialData: true,
      partialReason: 'partial_creation_error',
      entrySubmit: submitClicks || null
    };
  }
}

/**
 * Collects device information with timeout and retry logic
 * Returns partial data if collection times out, null only if all retries fail
 * 
 * @param submitClicks - Optional submit click tracking data
 * @returns Device info object, partial data, or null
 */
export async function collectDeviceInfoWithTimeout(
  submitClicks?: { count: number; firstAt: string | null; lastAt: string | null; timestamps: string[] }
): Promise<any> {
  const startTime = Date.now();
  let lastError: Error | null = null;
  
  console.log('[Device Collection Timeout] Starting device info collection with retry logic:', {
    hasSubmitClicks: !!submitClicks,
    submitClickCount: submitClicks?.count,
    timeout: COLLECTION_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
    timestamp: new Date().toISOString()
  });
  
  // Try collection with retries
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const attemptStart = Date.now();
      
      if (attempt > 0) {
        console.log('[Device Collection Timeout] Retry attempt:', {
          attempt,
          maxRetries: MAX_RETRIES,
          delayMs: RETRY_DELAY_MS,
          timestamp: new Date().toISOString()
        });
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
      
      // Create timeout promise that returns partial data marker
      const timeoutPromise = new Promise<{ _timeout: true }>((resolve) => {
        setTimeout(() => {
          const duration = Date.now() - attemptStart;
          
          console.warn('[Device Collection Timeout] Collection attempt timed out:', {
            attempt,
            timeout: COLLECTION_TIMEOUT_MS,
            duration: `${duration}ms`,
            willRetry: attempt < MAX_RETRIES,
            timestamp: new Date().toISOString()
          });
          resolve({ _timeout: true });
        }, COLLECTION_TIMEOUT_MS);
      });

      // Race collection against timeout
      const result = await Promise.race([
        collectDetailedDeviceInfo(submitClicks),
        timeoutPromise
      ]);

      const duration = Date.now() - attemptStart;
      
      // Check if we got a timeout marker
      if (result && typeof result === 'object' && '_timeout' in result) {
        if (attempt < MAX_RETRIES) {
          console.warn('[Device Collection Timeout] Timeout on attempt, will retry:', {
            attempt,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
          });
          continue; // Try again
        } else {
          // Final timeout - return partial data instead of null (Requirement 9.1)
          console.warn('[Device Collection Timeout] Final timeout, returning partial data:', {
            attempt,
            duration: `${duration}ms`,
            totalDuration: `${Date.now() - startTime}ms`,
            timestamp: new Date().toISOString()
          });
          return createPartialDeviceInfo(submitClicks);
        }
      }
      
      // Check if collection returned null (failure)
      if (result === null) {
        if (attempt < MAX_RETRIES) {
          console.warn('[Device Collection Timeout] Collection returned null, will retry:', {
            attempt,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
          });
          continue; // Try again
        } else {
          // Final failure - return partial data instead of null (Requirement 9.1)
          console.warn('[Device Collection Timeout] Final attempt returned null, returning partial data:', {
            attempt,
            duration: `${duration}ms`,
            totalDuration: `${Date.now() - startTime}ms`,
            timestamp: new Date().toISOString()
          });
          return createPartialDeviceInfo(submitClicks);
        }
      }
      
      // Success!
      console.log('[Device Collection Timeout] Collection completed successfully:', {
        attempt,
        duration: `${duration}ms`,
        totalDuration: `${Date.now() - startTime}ms`,
        hasData: !!result,
        hasFriendlyName: !!result.friendlyName,
        hasOEM: !!result.oem,
        hasIPs: !!result.ips,
        timestamp: new Date().toISOString()
      });
      
      return result;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;
      
      console.error('[Device Collection Timeout] Collection attempt failed:', {
        attempt,
        error: lastError.message,
        name: lastError.name,
        willRetry: attempt < MAX_RETRIES,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
      
      // If this was the last attempt, return partial data instead of null (Requirement 9.1)
      if (attempt >= MAX_RETRIES) {
        console.error('[Device Collection Timeout] All retry attempts exhausted, returning partial data:', {
          totalAttempts: attempt + 1,
          totalDuration: `${duration}ms`,
          lastError: lastError.message,
          stack: lastError.stack,
          timestamp: new Date().toISOString()
        });
        return createPartialDeviceInfo(submitClicks);
      }
    }
  }
  
  // Fallback (should not reach here, but return partial data just in case)
  console.error('[Device Collection Timeout] Unexpected fallback reached, returning partial data:', {
    totalDuration: `${Date.now() - startTime}ms`,
    timestamp: new Date().toISOString()
  });
  return createPartialDeviceInfo(submitClicks);
}
