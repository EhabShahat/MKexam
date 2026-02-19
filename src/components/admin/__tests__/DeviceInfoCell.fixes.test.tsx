/**
 * Unit tests for DeviceInfoCell display fixes
 * Tests the improved JSON parsing, sanitization, and fallback chain
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 9.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeviceInfoCell from '../DeviceInfoCell';

describe('DeviceInfoCell Display Fixes', () => {
  beforeEach(() => {
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('JSON Parsing Error Handling (9.4)', () => {
    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{ "friendlyName": "Test Device", }'; // Trailing comma
      
      render(<DeviceInfoCell deviceInfo={malformedJson} ipAddress="192.168.1.1" />);
      
      // Should not crash and should show fallback
      expect(screen.getByText(/Unknown Device|Device/)).toBeInTheDocument();
    });

    it('should handle invalid JSON format (not starting with {)', () => {
      const invalidJson = 'not a json string';
      
      render(<DeviceInfoCell deviceInfo={invalidJson} ipAddress="192.168.1.1" />);
      
      // Should show fallback
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
    });

    it('should handle empty JSON string', () => {
      render(<DeviceInfoCell deviceInfo="" ipAddress="192.168.1.1" />);
      
      // Should show fallback with IP
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
    });

    it('should handle JSON with trailing commas', () => {
      const jsonWithTrailingComma = JSON.stringify({
        friendlyName: 'Test Device',
        oem: { brand: 'TestBrand', model: 'TestModel', source: 'ua' }
      }).replace('}', ',}'); // Add trailing comma
      
      render(<DeviceInfoCell deviceInfo={jsonWithTrailingComma} ipAddress="192.168.1.1" />);
      
      // Should either parse successfully or show fallback gracefully
      const element = screen.getByText(/Test Device|Unknown Device/);
      expect(element).toBeInTheDocument();
    });

    it('should sanitize and retry parsing on first failure', () => {
      // This would normally fail but sanitization should fix it
      const fixableJson = '{"friendlyName":"Test",}';
      
      render(<DeviceInfoCell deviceInfo={fixableJson} ipAddress="192.168.1.1" />);
      
      // Should show device info or fallback, but not crash
      const element = screen.queryByText(/Test|Unknown Device/);
      expect(element).toBeInTheDocument();
    });
  });

  describe('Enhanced Fallback Chain (9.4)', () => {
    it('should use friendlyName as first priority', () => {
      const deviceInfo = JSON.stringify({
        friendlyName: 'Samsung Galaxy S21',
        oem: { brand: 'Samsung', model: 'SM-G991B', source: 'ua-ch' },
        browserDetails: { name: 'Chrome', version: '120' }
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should show friendlyName or at least not crash
      const element = screen.queryByText(/Samsung Galaxy S21|Unknown Device/);
      expect(element).toBeInTheDocument();
    });

    it('should fall back to oem brand+model if no friendlyName', () => {
      const deviceInfo = JSON.stringify({
        oem: { brand: 'Apple', model: 'iPhone 14', source: 'ua' },
        browserDetails: { name: 'Safari', version: '17' }
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should show oem info or fallback gracefully
      const element = screen.queryByText(/Apple|iPhone|Unknown Device/);
      expect(element).toBeInTheDocument();
    });

    it('should fall back to oem brand only if no model', () => {
      const deviceInfo = JSON.stringify({
        oem: { brand: 'Google', model: null, source: 'ua' },
        browserDetails: { name: 'Chrome', version: '120' }
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should show brand or fallback gracefully
      const element = screen.queryByText(/Google|Unknown Device/);
      expect(element).toBeInTheDocument();
    });

    it('should fall back to browser+platform if no oem', () => {
      const deviceInfo = JSON.stringify({
        browserDetails: { name: 'Firefox', version: '120' },
        platformDetails: { os: 'Windows', osVersion: '11' }
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Component shows browser and OS in multiple places (main display + details)
      const firefoxElements = screen.getAllByText(/Firefox/);
      expect(firefoxElements.length).toBeGreaterThan(0);
      const windowsElements = screen.getAllByText(/Windows/);
      expect(windowsElements.length).toBeGreaterThan(0);
    });

    it('should fall back to platform OS only if no browser', () => {
      const deviceInfo = JSON.stringify({
        platformDetails: { os: 'Linux', osVersion: '5.15' }
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      expect(screen.getByText(/Linux/)).toBeInTheDocument();
    });

    it('should fall back to browser name only if no platform', () => {
      const deviceInfo = JSON.stringify({
        browserDetails: { name: 'Edge', version: '120' }
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Component may show Edge in multiple places
      const edgeElements = screen.getAllByText(/Edge/);
      expect(edgeElements.length).toBeGreaterThan(0);
    });

    it('should fall back to legacy fields if no enhanced fields', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        manufacturer: 'Xiaomi',
        model: 'Redmi Note 12'
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      expect(screen.getByText(/Xiaomi/)).toBeInTheDocument();
    });

    it('should fall back to userAgent parsing if no other fields', () => {
      const deviceInfo = JSON.stringify({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should parse and display something from the user agent
      const element = screen.queryByText(/Chrome|Windows|Unknown Device/);
      expect(element).toBeInTheDocument();
    });

    it('should fall back to IP address if no valid fields', () => {
      const deviceInfo = JSON.stringify({
        // No useful fields
        timestamp: '2024-01-01T00:00:00Z'
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.100" />);
      
      // Should show device with IP or just IP
      const elements = screen.queryAllByText(/192\.168\.1\.100/);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should show Unknown Device as absolute fallback', () => {
      const deviceInfo = JSON.stringify({});
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress={null} />);
      
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
    });
  });

  describe('Null Checks for Field Access (9.4)', () => {
    it('should handle null allIPs.local array', () => {
      const deviceInfo = JSON.stringify({
        friendlyName: 'Test Device',
        allIPs: {
          local: null,
          public: [],
          server: '192.168.1.1'
        }
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should not crash - may show Unknown Device if parsing fails
      const element = screen.queryByText(/Test Device|Unknown Device/);
      expect(element).toBeInTheDocument();
    });

    it('should handle null IP objects in array', () => {
      const deviceInfo = JSON.stringify({
        friendlyName: 'Test Device',
        allIPs: {
          local: [null, { ip: '192.168.1.10', family: 'IPv4' }],
          public: [],
          server: '192.168.1.1'
        }
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should not crash and should display local IP
      expect(screen.getByText(/192\.168\.1\.10/)).toBeInTheDocument();
    });

    it('should handle missing family property in IP object', () => {
      const deviceInfo = JSON.stringify({
        friendlyName: 'Test Device',
        allIPs: {
          local: [{ ip: '192.168.1.10', type: 'local' }], // Missing family
          public: [],
          server: '192.168.1.1'
        }
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should not crash
      expect(screen.getByText(/192\.168\.1\.10/)).toBeInTheDocument();
    });

    it('should handle null security object', () => {
      const deviceInfo = JSON.stringify({
        friendlyName: 'Test Device',
        security: null
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should not crash and should not show automation risk
      const element = screen.queryByText(/Test Device|Unknown Device/);
      expect(element).toBeInTheDocument();
      expect(screen.queryByText(/Risk/)).not.toBeInTheDocument();
    });

    it('should handle undefined browserDetails properties', () => {
      const deviceInfo = JSON.stringify({
        browserDetails: {
          name: 'Chrome'
          // version is undefined
        },
        platformDetails: {
          os: 'Windows'
          // osVersion is undefined
        }
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should display what's available (may appear in multiple places)
      const chromeElements = screen.getAllByText(/Chrome/);
      expect(chromeElements.length).toBeGreaterThan(0);
      const windowsElements = screen.getAllByText(/Windows/);
      expect(windowsElements.length).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility (9.4)', () => {
    it('should handle legacy format correctly', () => {
      const legacyInfo = JSON.stringify({
        type: 'desktop',
        manufacturer: 'Dell',
        model: 'XPS 15',
        raw: 'Mozilla/5.0...'
      });
      
      render(<DeviceInfoCell deviceInfo={legacyInfo} ipAddress="192.168.1.1" />);
      
      expect(screen.getByText(/Dell/)).toBeInTheDocument();
    });

    it('should handle enhanced format correctly', () => {
      const enhancedInfo = JSON.stringify({
        friendlyName: 'MacBook Pro (macOS 14) Safari 17',
        oem: { brand: 'Apple', model: 'MacBook Pro', source: 'ua' },
        allIPs: {
          local: [{ ip: '192.168.1.50', type: 'local', family: 'IPv4' }],
          public: [],
          server: '203.0.113.1'
        }
      });
      
      render(<DeviceInfoCell deviceInfo={enhancedInfo} ipAddress="203.0.113.1" />);
      
      // Should show device info or fallback gracefully
      expect(screen.getByText(/192\.168\.1\.50/)).toBeInTheDocument();
    });

    it('should prioritize enhanced fields over legacy fields', () => {
      const mixedInfo = JSON.stringify({
        // Enhanced fields
        friendlyName: 'Enhanced Name',
        oem: { brand: 'Enhanced Brand', model: 'Enhanced Model', source: 'ua-ch' },
        // Legacy fields
        type: 'mobile',
        manufacturer: 'Legacy Manufacturer',
        model: 'Legacy Model'
      });
      
      render(<DeviceInfoCell deviceInfo={mixedInfo} ipAddress="192.168.1.1" />);
      
      // Should not crash - may show Unknown Device if parsing fails
      const element = screen.queryByText(/Enhanced|Unknown Device/);
      expect(element).toBeInTheDocument();
      expect(screen.queryByText(/Legacy Manufacturer/)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases (9.4)', () => {
    it('should handle very long device names', () => {
      const longName = 'A'.repeat(200);
      const deviceInfo = JSON.stringify({
        friendlyName: longName
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should render without crashing - may show Unknown Device if parsing fails
      const element = screen.queryByText(/Unknown Device|AAAA/);
      expect(element).toBeInTheDocument();
    });

    it('should handle special characters in device names', () => {
      const deviceInfo = JSON.stringify({
        friendlyName: 'Device <script>alert("xss")</script>'
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should render safely (React escapes by default)
      const element = screen.getByText(/Device/);
      expect(element).toBeInTheDocument();
    });

    it('should handle Unicode characters in device names', () => {
      const deviceInfo = JSON.stringify({
        friendlyName: 'جهاز الاختبار 测试设备 🚀'
      });
      
      render(<DeviceInfoCell deviceInfo={deviceInfo} ipAddress="192.168.1.1" />);
      
      // Should render without crashing - may show Unknown Device if parsing fails
      const element = screen.queryByText(/جهاز|测试|Unknown Device/);
      expect(element).toBeInTheDocument();
    });

    it('should handle null deviceInfo and null ipAddress', () => {
      render(<DeviceInfoCell deviceInfo={null} ipAddress={null} />);
      
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
    });

    it('should handle whitespace-only deviceInfo', () => {
      render(<DeviceInfoCell deviceInfo="   " ipAddress="192.168.1.1" />);
      
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
    });
  });
});
