/**
 * Debounce Utility Module
 * 
 * Provides debouncing functionality to limit the rate at which functions are executed.
 * Particularly useful for auto-save operations to reduce network requests.
 * 
 * Requirements: 4.5 - Auto-save debouncing with 3 second delay
 */

/**
 * Creates a debounced version of a function that delays execution until after
 * a specified wait time has elapsed since the last time it was invoked.
 * 
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay (default: 3000ms = 3 seconds)
 * @returns A debounced version of the function with a cancel method
 * 
 * @example
 * ```typescript
 * const debouncedSave = debounce(saveToServer, 3000);
 * 
 * // Call multiple times rapidly
 * debouncedSave(data1); // Scheduled
 * debouncedSave(data2); // Cancels previous, schedules new
 * debouncedSave(data3); // Cancels previous, schedules new
 * // Only the last call executes after 3 seconds
 * 
 * // Cancel pending execution
 * debouncedSave.cancel();
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 3000
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (this: any, ...args: Parameters<T>) {
    // Clear existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Schedule new execution
    timeoutId = setTimeout(() => {
      timeoutId = null;
      func.apply(this, args);
    }, wait);
  } as T & { cancel: () => void };

  // Add cancel method to clear pending execution
  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Creates a debounced version of an async function with proper cleanup.
 * Ensures that only the most recent invocation's result is used.
 * 
 * @param func - The async function to debounce
 * @param wait - The number of milliseconds to delay (default: 3000ms = 3 seconds)
 * @returns A debounced version of the async function with a cancel method
 * 
 * @example
 * ```typescript
 * const debouncedSaveAsync = debounceAsync(async (data) => {
 *   const response = await fetch('/api/save', { method: 'POST', body: JSON.stringify(data) });
 *   return response.json();
 * }, 3000);
 * 
 * // Call multiple times rapidly
 * await debouncedSaveAsync(data1); // Cancelled
 * await debouncedSaveAsync(data2); // Cancelled
 * const result = await debouncedSaveAsync(data3); // Executes after 3 seconds
 * ```
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number = 3000
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let latestResolve: ((value: any) => void) | null = null;
  let latestReject: ((reason?: any) => void) | null = null;

  const debounced = function (this: any, ...args: Parameters<T>): Promise<any> {
    // Clear existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Reject previous pending promise if it exists
    if (latestReject) {
      latestReject(new Error('Debounced call cancelled by newer call'));
    }

    // Create new promise for this invocation
    return new Promise((resolve, reject) => {
      latestResolve = resolve;
      latestReject = reject;

      // Schedule new execution
      timeoutId = setTimeout(async () => {
        timeoutId = null;
        const currentResolve = latestResolve;
        const currentReject = latestReject;
        latestResolve = null;
        latestReject = null;

        try {
          const result = await func.apply(this, args);
          currentResolve?.(result);
        } catch (error) {
          currentReject?.(error);
        }
      }, wait);
    });
  };

  // Add cancel method to clear pending execution
  (debounced as any).cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (latestReject) {
      latestReject(new Error('Debounced call cancelled'));
      latestReject = null;
      latestResolve = null;
    }
  };

  return debounced as T & { cancel: () => void };
}

/**
 * Creates a throttled version of a function that only executes at most once
 * per specified time period, regardless of how many times it's called.
 * 
 * Unlike debounce (which delays execution), throttle ensures the function
 * executes at regular intervals during rapid calls.
 * 
 * @param func - The function to throttle
 * @param limit - The minimum time between executions in milliseconds
 * @returns A throttled version of the function
 * 
 * @example
 * ```typescript
 * const throttledScroll = throttle(handleScroll, 100);
 * 
 * window.addEventListener('scroll', throttledScroll);
 * // handleScroll executes at most once every 100ms during scrolling
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean = false;
  let lastResult: ReturnType<T>;

  const throttled = function (this: any, ...args: Parameters<T>): ReturnType<T> {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    return lastResult;
  };
  
  return throttled as T;
}

/**
 * React hook for creating a debounced callback
 * Automatically cleans up on unmount
 * 
 * @param callback - The callback to debounce
 * @param delay - The debounce delay in milliseconds (default: 3000ms)
 * @returns A debounced version of the callback
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const debouncedSave = useDebouncedCallback((data) => {
 *     saveToServer(data);
 *   }, 3000);
 * 
 *   return <input onChange={(e) => debouncedSave(e.target.value)} />;
 * }
 * ```
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 3000
): T & { cancel: () => void } {
  // This would be implemented in a React component file
  // Included here for reference
  throw new Error('useDebouncedCallback should be implemented in a React hook file');
}
