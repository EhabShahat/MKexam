import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateDeviceInfo,
  calculateDeviceInfoStats,
  inspectDeviceInfo,
  registerConsoleCommands,
  type DeviceInfoHealth
} from '../deviceInfoDiagnostics';

describe('deviceInfoDiagnostics', () => {
  describe('validateDeviceInfo', () => {
    it('should identify enhanced format with all required fields', () => {
      const deviceInfo = {
        friendlyName: 'iPhone 13',
        oem: { brand: 'Apple', model: 'iPhone 13' },
        browserDetails: { name: 'Safari', version: '15.0' },
        platformDetails: { os: 'iOS', osVersion: '15.0' },
        allIPs: { local: [], public: [], server: '1.2.3.4' }
      };

      const result = validateDeviceInfo(deviceInfo);

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('enhanced');
      expect(result.missingFields).toHaveLength(0);
    });

    it('should identify enhanced format with missing optional fields', () => {
      const deviceInfo = {
        friendlyName: 'iPhone 13',
        allIPs: { local: [], public: [], server: '1.2.3.4' }
      };

      const result = validateDeviceInfo(deviceInfo);

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('enhanced');
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('browserDetails missing (optional but recommended)');
    });

    it('should identify legacy format with all required fields', () => {
      const deviceInfo = {
        type: 'mobile',
        manufacturer: 'Apple',
        model: 'iPhone 13',
        userAgent: 'Mozilla/5.0...'
      };

      const result = validateDeviceInfo(deviceInfo);

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('legacy');
      expect(result.missingFields).toHaveLength(0);
    });

    it('should identify null format for missing device info', () => {
      const result = validateDeviceInfo(null);

      expect(result.isValid).toBe(false);
      expect(result.format).toBe('null');
      expect(result.missingFields).toContain('all');
    });

    it('should identify invalid format for incomplete data', () => {
      const deviceInfo = {
        someRandomField: 'value'
      };

      const result = validateDeviceInfo(deviceInfo);

      expect(result.isValid).toBe(false);
      expect(result.format).toBe('invalid');
    });

    it('should detect missing required fields in enhanced format', () => {
      const deviceInfo = {
        browserDetails: { name: 'Chrome', version: '100' }
        // Missing friendlyName/oem and allIPs
      };

      const result = validateDeviceInfo(deviceInfo);

      expect(result.isValid).toBe(false);
      expect(result.format).toBe('enhanced');
      expect(result.missingFields).toContain('friendlyName or oem');
      expect(result.missingFields).toContain('allIPs');
    });

    it('should detect missing required fields in legacy format', () => {
      const deviceInfo = {
        type: 'mobile'
        // Missing manufacturer and model
      };

      const result = validateDeviceInfo(deviceInfo);

      expect(result.isValid).toBe(false);
      expect(result.format).toBe('legacy');
      expect(result.missingFields).toContain('manufacturer');
      expect(result.missingFields).toContain('model');
    });
  });

  describe('calculateDeviceInfoStats', () => {
    it('should calculate correct statistics', () => {
      const healthResults: DeviceInfoHealth[] = [
        {
          attemptId: '1',
          hasDeviceInfo: true,
          format: 'enhanced',
          isValid: true,
          missingFields: []
        },
        {
          attemptId: '2',
          hasDeviceInfo: true,
          format: 'legacy',
          isValid: true,
          missingFields: []
        },
        {
          attemptId: '3',
          hasDeviceInfo: false,
          format: 'null',
          isValid: false,
          missingFields: ['all']
        },
        {
          attemptId: '4',
          hasDeviceInfo: true,
          format: 'invalid',
          isValid: false,
          missingFields: ['all required fields']
        }
      ];

      const stats = calculateDeviceInfoStats(healthResults);

      expect(stats.total).toBe(4);
      expect(stats.withDeviceInfo).toBe(3);
      expect(stats.withoutDeviceInfo).toBe(1);
      expect(stats.enhanced).toBe(1);
      expect(stats.legacy).toBe(1);
      expect(stats.invalid).toBe(1);
      expect(stats.healthPercentage).toBe(75); // 3 out of 4 have device info
    });

    it('should handle empty array', () => {
      const stats = calculateDeviceInfoStats([]);

      expect(stats.total).toBe(0);
      expect(stats.withDeviceInfo).toBe(0);
      expect(stats.withoutDeviceInfo).toBe(0);
      expect(stats.healthPercentage).toBe(0);
    });

    it('should calculate 100% health when all have device info', () => {
      const healthResults: DeviceInfoHealth[] = [
        {
          attemptId: '1',
          hasDeviceInfo: true,
          format: 'enhanced',
          isValid: true,
          missingFields: []
        },
        {
          attemptId: '2',
          hasDeviceInfo: true,
          format: 'enhanced',
          isValid: true,
          missingFields: []
        }
      ];

      const stats = calculateDeviceInfoStats(healthResults);

      expect(stats.healthPercentage).toBe(100);
    });
  });

  describe('inspectDeviceInfo', () => {
    let consoleGroupSpy: any;
    let consoleLogSpy: any;
    let consoleErrorSpy: any;
    let consoleGroupEndSpy: any;
    let fetchMock: any;

    beforeEach(() => {
      consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
      
      global.fetch = vi.fn();
      fetchMock = global.fetch as any;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch and display device info for valid attempt', async () => {
      const mockData = {
        id: 'attempt-123',
        device_info: JSON.stringify({
          friendlyName: 'iPhone 13',
          allIPs: { local: [], public: [], server: '1.2.3.4' }
        }),
        ip_address: '1.2.3.4',
        started_at: '2024-01-01T00:00:00Z',
        submitted_at: '2024-01-01T01:00:00Z'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      await inspectDeviceInfo('attempt-123');

      expect(fetchMock).toHaveBeenCalledWith('/api/admin/attempts/attempt-123/device-info');
      expect(consoleGroupSpy).toHaveBeenCalledWith('🔍 Device Info Inspector - Attempt attempt-123');
      expect(consoleLogSpy).toHaveBeenCalledWith('📦 Raw Data:', mockData);
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      await inspectDeviceInfo('invalid-attempt');

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to fetch attempt data:', 'Not Found');
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('should handle missing device info', async () => {
      const mockData = {
        id: 'attempt-123',
        device_info: null,
        ip_address: '1.2.3.4',
        started_at: '2024-01-01T00:00:00Z',
        submitted_at: null
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      await inspectDeviceInfo('attempt-123');

      // Should log validation result showing null format
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🔬 Validation Result:',
        expect.objectContaining({
          format: 'null',
          isValid: false
        })
      );
    });
  });

  describe('registerConsoleCommands', () => {
    it('should register inspectDeviceInfo on window object', () => {
      const mockWindow = { inspectDeviceInfo: undefined } as any;
      global.window = mockWindow;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      registerConsoleCommands();

      expect(mockWindow.inspectDeviceInfo).toBe(inspectDeviceInfo);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Device Info Diagnostics loaded')
      );

      consoleLogSpy.mockRestore();
    });

    it('should not register commands in non-browser environment', () => {
      const originalWindow = global.window;
      (global as any).window = undefined;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      registerConsoleCommands();

      expect(consoleLogSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
      global.window = originalWindow;
    });
  });
});
