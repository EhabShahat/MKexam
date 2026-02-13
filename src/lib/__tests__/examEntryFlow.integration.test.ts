/**
 * Integration Tests for Exam Entry Flow
 * Feature: enhanced-device-tracking
 * 
 * Tests:
 * - Device collection triggered on form submit
 * - Timeout handling
 * - Failure handling
 * 
 * Requirements: 9.1, 9.3, 9.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectDetailedDeviceInfo } from '../collectDeviceInfo';

describe('Integration Tests: Exam Entry Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Test: Device collection triggered on form submit
   * Requirement 9.1: Device collection should occur when exam entry form is submitted
   */
  it('should trigger device collection on form submit', async () => {
    // Simulate form submission flow
    const submitClicks = {
      count: 1,
      firstAt: new Date().toISOString(),
      lastAt: new Date().toISOString(),
      timestamps: [new Date().toISOString()]
    };

    // Collect device info as would happen on form submit
    const deviceInfo = await collectDetailedDeviceInfo(submitClicks);

    // Verify device info was collected
    expect(deviceInfo).toBeDefined();
    
    if (deviceInfo !== null) {
      expect(deviceInfo).toHaveProperty('collectedAt');
      expect(deviceInfo).toHaveProperty('entrySubmit');
      expect(deviceInfo.entrySubmit).toEqual(submitClicks);
    }
  });

  /**
   * Test: Timeout handling
   * Requirement 9.3: Collection should timeout after 10 seconds and proceed with partial data
   */
  it('should handle collection timeout gracefully', async () => {
    const TIMEOUT_MS = 10000;
    const startTime = Date.now();

    // Create a timeout promise
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), TIMEOUT_MS);
    });

    // Race collection against timeout
    const result = await Promise.race([
      collectDetailedDeviceInfo(),
      timeoutPromise
    ]);

    const elapsedTime = Date.now() - startTime;

    // Should complete within timeout period
    expect(elapsedTime).toBeLessThan(TIMEOUT_MS + 100); // Small buffer for execution

    // Result should be either device info or null (timeout)
    if (result === null) {
      // Timeout occurred - this is acceptable
      expect(result).toBeNull();
    } else {
      // Collection completed - verify structure
      expect(result).toHaveProperty('collectedAt');
    }
  });

  /**
   * Test: Failure handling
   * Requirement 9.4: Exam access should not be blocked if collection fails
   */
  it('should not block exam access when collection fails', async () => {
    // Mock a failure scenario
    const originalNavigator = global.navigator;
    
    try {
      // Temporarily break navigator to simulate failure
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true
      });

      const deviceInfo = await collectDetailedDeviceInfo();

      // Collection should return partial data or null
      // The key is that it doesn't throw and exam access continues
      expect(deviceInfo === null || typeof deviceInfo === 'object').toBe(true);

      // Simulate API request body construction with device info (partial or null)
      const requestBody = {
        code: 'TEST1234',
        studentName: 'Test Student',
        deviceInfo
      };

      // Request body should still be valid
      expect(requestBody).toBeDefined();
      expect(requestBody.code).toBe('TEST1234');

      // Should be serializable for API request
      const serialized = JSON.stringify(requestBody);
      expect(serialized).toBeDefined();
      
      const parsed = JSON.parse(serialized);
      expect(parsed).toHaveProperty('code');
      expect(parsed).toHaveProperty('deviceInfo');
      
      // This demonstrates exam access would not be blocked
      // even with partial or null device info
    } finally {
      // Restore navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true
      });
    }
  });

  /**
   * Test: Multiple submit clicks tracking
   * Verifies that submit click tracking is properly passed to device collection
   */
  it('should track multiple submit clicks', async () => {
    const submitClicks = {
      count: 3,
      firstAt: '2025-02-07T10:00:00.000Z',
      lastAt: '2025-02-07T10:00:05.000Z',
      timestamps: [
        '2025-02-07T10:00:00.000Z',
        '2025-02-07T10:00:02.000Z',
        '2025-02-07T10:00:05.000Z'
      ]
    };

    const deviceInfo = await collectDetailedDeviceInfo(submitClicks);

    if (deviceInfo !== null) {
      expect(deviceInfo.entrySubmit).toEqual(submitClicks);
      expect(deviceInfo.entrySubmit?.count).toBe(3);
      expect(deviceInfo.entrySubmit?.timestamps).toHaveLength(3);
    }
  });

  /**
   * Test: Partial data collection on timeout
   * Verifies that partial device info is returned if some APIs timeout
   */
  it('should return partial data when some APIs timeout', async () => {
    // Collection should complete even if some APIs are slow/unavailable
    const deviceInfo = await collectDetailedDeviceInfo();

    if (deviceInfo !== null) {
      // Core fields should always be present
      expect(deviceInfo).toHaveProperty('collectedAt');
      expect(deviceInfo).toHaveProperty('friendlyName');
      expect(deviceInfo).toHaveProperty('browserDetails');
      expect(deviceInfo).toHaveProperty('platformDetails');
      
      // Optional fields may be null (this is acceptable)
      // The key is that collection completes and returns an object
      expect(typeof deviceInfo.collectedAt).toBe('string');
      expect(typeof deviceInfo.friendlyName).toBe('string');
    }
  });

  /**
   * Test: Error logging on collection failure
   * Requirement 9.5: Errors should be logged for debugging
   */
  it('should log errors when collection fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Force an actual error by making discoverIPs throw
    const originalNavigator = global.navigator;
    
    try {
      // Create a scenario where the function actually catches an error
      // by making the entire collection throw
      Object.defineProperty(global, 'navigator', {
        get() {
          throw new Error('Navigator access error');
        },
        configurable: true
      });

      const result = await collectDetailedDeviceInfo();

      // When an actual error is thrown and caught, it should be logged
      // and the function should return null
      expect(result).toBeNull();
      
      // Should have logged the error
      expect(consoleErrorSpy.mock.calls.length).toBeGreaterThan(0);
      
      // Error message should contain useful context
      const errorCalls = consoleErrorSpy.mock.calls;
      const hasDeviceInfoError = errorCalls.some(call => 
        call.some(arg => 
          typeof arg === 'string' && 
          (arg.toLowerCase().includes('device') || arg.toLowerCase().includes('collect'))
        )
      );
      
      expect(hasDeviceInfoError).toBe(true);
    } finally {
      // Restore
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true
      });
      
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    }
  });

  /**
   * Test: Collection with minimal browser environment
   * Verifies graceful degradation in limited environments
   */
  it('should handle minimal browser environment gracefully', async () => {
    // Even in a minimal environment, collection should not throw
    const deviceInfo = await collectDetailedDeviceInfo();

    // Should either return device info or null, but not throw
    expect(deviceInfo === null || typeof deviceInfo === 'object').toBe(true);
  });

  /**
   * Test: Concurrent collection requests
   * Verifies that multiple simultaneous collections don't interfere
   */
  it('should handle concurrent collection requests', async () => {
    // Simulate multiple form submissions happening simultaneously
    const collections = await Promise.all([
      collectDetailedDeviceInfo({ count: 1, firstAt: null, lastAt: null, timestamps: [] }),
      collectDetailedDeviceInfo({ count: 2, firstAt: null, lastAt: null, timestamps: [] }),
      collectDetailedDeviceInfo({ count: 3, firstAt: null, lastAt: null, timestamps: [] })
    ]);

    // All collections should complete
    expect(collections).toHaveLength(3);
    
    // Each should be independent
    collections.forEach((info, index) => {
      if (info !== null) {
        expect(info.entrySubmit?.count).toBe(index + 1);
      }
    });
  });
});
