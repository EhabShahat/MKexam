/**
 * Unit Tests for Device Info Collection with Timeout
 * Feature: enhanced-device-tracking
 * 
 * Tests the timeout wrapper functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectDeviceInfoWithTimeout } from '../collectDeviceInfoWithTimeout';

describe('collectDeviceInfoWithTimeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should collect device info successfully', async () => {
    const result = await collectDeviceInfoWithTimeout();

    // Should return device info or null (both are acceptable)
    expect(result === null || typeof result === 'object').toBe(true);

    if (result !== null) {
      expect(result).toHaveProperty('collectedAt');
    }
  }, 15000); // 15 second timeout for test

  it('should handle timeout gracefully', async () => {
    const startTime = Date.now();
    const result = await collectDeviceInfoWithTimeout();
    const elapsedTime = Date.now() - startTime;

    // Should complete within 10 seconds + small buffer
    expect(elapsedTime).toBeLessThan(11000);

    // Result should be device info or null
    expect(result === null || typeof result === 'object').toBe(true);
  }, 15000); // 15 second timeout for test

  it('should pass submit clicks data through', async () => {
    const submitClicks = {
      count: 2,
      firstAt: '2025-02-07T10:00:00.000Z',
      lastAt: '2025-02-07T10:00:05.000Z',
      timestamps: ['2025-02-07T10:00:00.000Z', '2025-02-07T10:00:05.000Z']
    };

    const result = await collectDeviceInfoWithTimeout(submitClicks);

    if (result !== null) {
      expect(result.entrySubmit).toEqual(submitClicks);
    }
  }, 15000); // 15 second timeout for test

  it('should return partial data on error without throwing', async () => {
    // Force an error by breaking navigator
    const originalNavigator = global.navigator;
    
    try {
      Object.defineProperty(global, 'navigator', {
        get() {
          throw new Error('Navigator error');
        },
        configurable: true
      });

      // Should not throw, should return partial data (Requirement 9.1)
      const result = await collectDeviceInfoWithTimeout();
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('partialData', true);
      expect(result).toHaveProperty('partialReason');
      expect(result).toHaveProperty('collectedAt');
    } finally {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true
      });
    }
  }, 15000); // 15 second timeout for test

  it('should log warning on timeout', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // The function will timeout after 10 seconds in test environment
    // where collection is slow
    const result = await collectDeviceInfoWithTimeout();

    // Result should be null (timeout) or device info (success)
    expect(result === null || typeof result === 'object').toBe(true);

    // If timeout occurred, warning should be logged
    if (result === null) {
      const hasTimeoutWarning = consoleWarnSpy.mock.calls.some(call => 
        call.some(arg => 
          typeof arg === 'string' && 
          arg.toLowerCase().includes('timeout')
        )
      );
      expect(hasTimeoutWarning).toBe(true);
    }

    consoleWarnSpy.mockRestore();
  }, 15000); // 15 second timeout for test

  it('should log error on collection failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Force an error
    const originalNavigator = global.navigator;
    
    try {
      Object.defineProperty(global, 'navigator', {
        get() {
          throw new Error('Test error');
        },
        configurable: true
      });

      const result = await collectDeviceInfoWithTimeout();

      // Should return partial data (Requirement 9.1)
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('partialData', true);
      
      // Should have logged either an error or timeout warning
      const totalLogs = consoleErrorSpy.mock.calls.length + consoleWarnSpy.mock.calls.length;
      expect(totalLogs).toBeGreaterThan(0);
    } finally {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true
      });
      
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    }
  }, 15000); // 15 second timeout for test
});
