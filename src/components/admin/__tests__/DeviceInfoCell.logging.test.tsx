/**
 * Unit Tests for DeviceInfoCell Logging
 * 
 * Tests that the DeviceInfoCell component logs correctly at each stage:
 * - Component render entry point
 * - JSON parsing attempts and failures
 * - Format detection results (enhanced/legacy/invalid)
 * - Display path selection (friendlyName/oem/fallback)
 * - "Unknown Device" fallback triggers
 */

import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DeviceInfoCell from '../DeviceInfoCell';
import * as diagnostics from '@/lib/deviceInfoDiagnostics';

// Mock the diagnostic logging functions
vi.mock('@/lib/deviceInfoDiagnostics', () => ({
  logDeviceInfo: vi.fn(),
  logJsonParsing: vi.fn(),
  logDisplayFallback: vi.fn(),
  validateDeviceInfo: vi.fn((deviceInfo) => {
    // Default mock implementation
    if (!deviceInfo || typeof deviceInfo !== 'object') {
      return { isValid: false, format: 'null', missingFields: ['all'] };
    }
    if (deviceInfo.friendlyName || deviceInfo.oem) {
      return { isValid: true, format: 'enhanced', missingFields: [] };
    }
    if (deviceInfo.type || deviceInfo.manufacturer) {
      return { isValid: true, format: 'legacy', missingFields: [] };
    }
    return { isValid: false, format: 'invalid', missingFields: ['all required fields'] };
  })
}));

describe('DeviceInfoCell - Logging Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Render Logging', () => {
    it('should log render entry point with device info present', () => {
      const enhancedDeviceInfo = JSON.stringify({
        friendlyName: 'iPhone 14 Pro',
        oem: { brand: 'Apple', model: 'iPhone 14 Pro' },
        allIPs: { local: [], public: [], server: '1.2.3.4' }
      });

      render(
        <DeviceInfoCell 
          deviceInfo={enhancedDeviceInfo} 
          ipAddress="1.2.3.4" 
          usageCount={1}
        />
      );

      expect(diagnostics.logDeviceInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'display',
          success: true,
          hasData: true,
          details: expect.objectContaining({
            operation: 'render',
            hasDeviceInfo: true,
            hasIpAddress: true,
            usageCount: 1
          })
        })
      );
    });

    it('should log render entry point with no device info', () => {
      render(
        <DeviceInfoCell 
          deviceInfo={null} 
          ipAddress="1.2.3.4" 
          usageCount={undefined}
        />
      );

      expect(diagnostics.logDeviceInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'display',
          success: true,
          hasData: false,
          details: expect.objectContaining({
            operation: 'render',
            hasDeviceInfo: false,
            hasIpAddress: true
          })
        })
      );
    });
  });

  describe('JSON Parsing Logging', () => {
    it('should log successful JSON parsing for enhanced format', () => {
      const enhancedDeviceInfo = JSON.stringify({
        friendlyName: 'Samsung Galaxy S23',
        oem: { brand: 'Samsung', model: 'Galaxy S23' },
        allIPs: { local: [], public: [], server: '1.2.3.4' }
      });

      render(
        <DeviceInfoCell 
          deviceInfo={enhancedDeviceInfo} 
          ipAddress="1.2.3.4"
        />
      );

      expect(diagnostics.logJsonParsing).toHaveBeenCalledWith(
        undefined,
        enhancedDeviceInfo,
        true
      );
    });

    it('should log JSON parsing failure with malformed JSON', () => {
      const malformedJson = '{ invalid json }';

      render(
        <DeviceInfoCell 
          deviceInfo={malformedJson} 
          ipAddress="1.2.3.4"
        />
      );

      // Check that the second call (failure) was made with error
      const calls = (diagnostics.logJsonParsing as any).mock.calls;
      const failureCall = calls.find((call: any[]) => call[2] === false);
      
      expect(failureCall).toBeDefined();
      expect(failureCall[0]).toBeUndefined(); // attemptId
      expect(failureCall[1]).toBe(malformedJson); // rawString
      expect(failureCall[2]).toBe(false); // success
      expect(failureCall[3]).toContain('JSON'); // error message
    });

    it('should log JSON parsing failure with error details', () => {
      const malformedJson = '{"friendlyName": "Test"'; // Missing closing brace

      render(
        <DeviceInfoCell 
          deviceInfo={malformedJson} 
          ipAddress="1.2.3.4"
        />
      );

      expect(diagnostics.logJsonParsing).toHaveBeenCalledWith(
        undefined,
        malformedJson,
        false,
        expect.any(String)
      );
    });
  });

  describe('Format Detection Logging', () => {
    it('should log enhanced format detection correctly', () => {
      const enhancedDeviceInfo = JSON.stringify({
        friendlyName: 'MacBook Pro',
        oem: { brand: 'Apple', model: 'MacBook Pro' },
        browserDetails: { name: 'Chrome', version: '120' },
        allIPs: { local: [], public: [], server: '1.2.3.4' }
      });

      render(
        <DeviceInfoCell 
          deviceInfo={enhancedDeviceInfo} 
          ipAddress="1.2.3.4"
        />
      );

      expect(diagnostics.logDeviceInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'display',
          success: true,
          hasData: true,
          dataFormat: 'enhanced',
          details: expect.objectContaining({
            operation: 'format_detection',
            isValid: true,
            missingFields: []
          })
        })
      );
    });

    it('should log legacy format detection correctly', () => {
      const legacyDeviceInfo = JSON.stringify({
        type: 'mobile',
        manufacturer: 'Samsung',
        model: 'Galaxy S20',
        userAgent: 'Mozilla/5.0...'
      });

      render(
        <DeviceInfoCell 
          deviceInfo={legacyDeviceInfo} 
          ipAddress="1.2.3.4"
        />
      );

      expect(diagnostics.logDeviceInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'display',
          success: true,
          hasData: true,
          dataFormat: 'legacy',
          details: expect.objectContaining({
            operation: 'format_detection',
            isValid: true
          })
        })
      );
    });

    it('should log invalid format with missing fields', () => {
      // Mock validateDeviceInfo to return invalid format
      (diagnostics.validateDeviceInfo as any).mockReturnValueOnce({
        isValid: false,
        format: 'invalid',
        missingFields: ['friendlyName or oem', 'allIPs'],
        warnings: ['Device info does not match enhanced or legacy format']
      });

      const invalidDeviceInfo = JSON.stringify({
        someField: 'value'
      });

      render(
        <DeviceInfoCell 
          deviceInfo={invalidDeviceInfo} 
          ipAddress="1.2.3.4"
        />
      );

      expect(diagnostics.logDeviceInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'display',
          dataFormat: 'invalid',
          details: expect.objectContaining({
            operation: 'format_detection',
            isValid: false,
            missingFields: expect.arrayContaining(['friendlyName or oem', 'allIPs'])
          })
        })
      );
    });
  });

  describe('Display Path Logging', () => {
    it('should log friendlyName display path', () => {
      const deviceInfo = JSON.stringify({
        friendlyName: 'iPhone 15 Pro Max',
        oem: { brand: 'Apple', model: 'iPhone 15 Pro Max' },
        allIPs: { local: [], public: [], server: '1.2.3.4' }
      });

      render(
        <DeviceInfoCell 
          deviceInfo={deviceInfo} 
          ipAddress="1.2.3.4"
        />
      );

      expect(diagnostics.logDeviceInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'display',
          success: true,
          hasData: true,
          details: expect.objectContaining({
            operation: 'display_path',
            path: 'friendlyName',
            value: 'iPhone 15 Pro Max'
          })
        })
      );
    });

    it('should log oem display path when friendlyName is missing', () => {
      const deviceInfo = JSON.stringify({
        oem: { brand: 'Google', model: 'Pixel 8' },
        allIPs: { local: [], public: [], server: '1.2.3.4' }
      });

      render(
        <DeviceInfoCell 
          deviceInfo={deviceInfo} 
          ipAddress="1.2.3.4"
        />
      );

      expect(diagnostics.logDeviceInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'display',
          details: expect.objectContaining({
            operation: 'display_path',
            path: 'oem',
            value: 'Google Pixel 8'
          })
        })
      );
    });

    it('should log browser_platform display path as fallback', () => {
      const deviceInfo = JSON.stringify({
        browserDetails: { name: 'Firefox', version: '120' },
        platformDetails: { os: 'Windows', osVersion: '11' },
        allIPs: { local: [], public: [], server: '1.2.3.4' }
      });

      render(
        <DeviceInfoCell 
          deviceInfo={deviceInfo} 
          ipAddress="1.2.3.4"
        />
      );

      expect(diagnostics.logDeviceInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'display',
          details: expect.objectContaining({
            operation: 'display_path',
            path: 'browser_platform',
            value: 'Windows - Firefox'
          })
        })
      );
    });

    it('should log legacy_fields display path', () => {
      const deviceInfo = JSON.stringify({
        type: 'tablet',
        manufacturer: 'Apple',
        model: 'iPad Pro'
      });

      render(
        <DeviceInfoCell 
          deviceInfo={deviceInfo} 
          ipAddress="1.2.3.4"
        />
      );

      expect(diagnostics.logDeviceInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'display',
          details: expect.objectContaining({
            operation: 'display_path',
            path: 'legacy_fields'
          })
        })
      );
    });
  });

  describe('Fallback Logging', () => {
    it('should log fallback when device info is null', () => {
      render(
        <DeviceInfoCell 
          deviceInfo={null} 
          ipAddress="1.2.3.4"
        />
      );

      expect(diagnostics.logDisplayFallback).toHaveBeenCalledWith(
        undefined,
        'No device info provided, only IP address available',
        'Unknown Device'
      );
    });

    it('should log fallback when JSON parsing fails', () => {
      const malformedJson = '{ bad json }';

      render(
        <DeviceInfoCell 
          deviceInfo={malformedJson} 
          ipAddress="1.2.3.4"
        />
      );

      expect(diagnostics.logDisplayFallback).toHaveBeenCalledWith(
        undefined,
        expect.stringContaining('JSON parsing failed'),
        'Unknown Device'
      );
    });

    it('should log fallback when no valid display fields found', () => {
      const deviceInfo = JSON.stringify({
        security: { webdriver: false }
      });

      render(
        <DeviceInfoCell 
          deviceInfo={deviceInfo} 
          ipAddress="1.2.3.4"
        />
      );

      // When IP is available, component shows "Device (IP)" not "Unknown Device"
      expect(diagnostics.logDisplayFallback).toHaveBeenCalledWith(
        undefined,
        'No valid display fields found, using IP address',
        'Device (1.2.3.4)'
      );
    });

    it('should log fallback when neither device info nor IP available', () => {
      render(
        <DeviceInfoCell 
          deviceInfo={null} 
          ipAddress={null}
        />
      );

      expect(diagnostics.logDisplayFallback).toHaveBeenCalledWith(
        undefined,
        'No device info or IP address available',
        'Unknown Device'
      );
    });

    it('should log fallback reason with missing fields details', () => {
      const incompleteDeviceInfo = JSON.stringify({
        oem: { brand: 'Unknown' } // Missing model
      });

      render(
        <DeviceInfoCell 
          deviceInfo={incompleteDeviceInfo} 
          ipAddress="1.2.3.4"
        />
      );

      // When oem.brand is present, it displays the brand (not a fallback)
      // So logDisplayFallback should NOT be called
      expect(diagnostics.logDisplayFallback).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Logging Calls', () => {
    it('should log render, parsing, format detection, and display path for valid enhanced format', () => {
      const deviceInfo = JSON.stringify({
        friendlyName: 'Test Device',
        oem: { brand: 'Test', model: 'Device' },
        allIPs: { local: [], public: [], server: '1.2.3.4' }
      });

      render(
        <DeviceInfoCell 
          deviceInfo={deviceInfo} 
          ipAddress="1.2.3.4"
        />
      );

      // Should have at least 4 logDeviceInfo calls:
      // 1. Render entry
      // 2. Format detection
      // 3. Display path
      expect(diagnostics.logDeviceInfo).toHaveBeenCalledTimes(3);
      
      // Should have 1 logJsonParsing call
      expect(diagnostics.logJsonParsing).toHaveBeenCalledTimes(1);
      
      // Should NOT have fallback logging
      expect(diagnostics.logDisplayFallback).not.toHaveBeenCalled();
    });

    it('should log render, parsing failure, and fallback for malformed JSON', () => {
      const malformedJson = '{ invalid }';

      render(
        <DeviceInfoCell 
          deviceInfo={malformedJson} 
          ipAddress="1.2.3.4"
        />
      );

      // Should have render log
      expect(diagnostics.logDeviceInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            operation: 'render'
          })
        })
      );
      
      // Should have parsing failure log
      expect(diagnostics.logJsonParsing).toHaveBeenCalledWith(
        undefined,
        malformedJson,
        false,
        expect.any(String)
      );
      
      // Should have fallback log
      expect(diagnostics.logDisplayFallback).toHaveBeenCalledWith(
        undefined,
        expect.stringContaining('JSON parsing failed'),
        'Unknown Device'
      );
    });
  });
});
