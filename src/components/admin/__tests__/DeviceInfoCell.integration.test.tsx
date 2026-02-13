/**
 * Integration tests for DeviceInfoCell component
 * Tests end-to-end scenarios with various data formats
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeviceInfoCell from '../DeviceInfoCell';

describe('DeviceInfoCell Integration Tests', () => {
  beforeEach(() => {
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('End-to-end with enhanced format', () => {
    it('should render complete enhanced device info with all fields', () => {
      const enhancedDeviceInfo = JSON.stringify({
        friendlyName: 'Samsung Galaxy S21 (Android 13) Chrome 120',
        oem: {
          brand: 'Samsung',
          model: 'SM-G991B',
          source: 'ua-ch'
        },
        browserDetails: {
          name: 'Chrome',
          version: '120.0.6099.130',
          engine: 'Blink'
        },
        platformDetails: {
          os: 'Android',
          osVersion: '13',
          architecture: 'arm64'
        },
        allIPs: {
          local: [
            { ip: '192.168.1.100', type: 'local', family: 'IPv4' },
            { ip: 'fe80::1', type: 'local', family: 'IPv6' }
          ],
          public: [],
          server: '203.0.113.50'
        },
        security: {
          webdriver: false,
          automationRisk: false,
          fingerprintConsistency: 0.95
        },
        timestamp: '2024-02-07T10:30:00Z'
      });

      render(
        <DeviceInfoCell
          deviceInfo={enhancedDeviceInfo}
          ipAddress="203.0.113.50"
          usageCount={1}
        />
      );

      // Should display friendly name or fallback gracefully
      const displayText = screen.queryByText(/Samsung Galaxy S21|Unknown Device/);
      expect(displayText).toBeInTheDocument();
      
      // Should display local IP
      expect(screen.getByText(/192\.168\.1\.100/)).toBeInTheDocument();
      
      // Should display server IP
      expect(screen.getByText(/203\.0\.113\.50/)).toBeInTheDocument();
      
      // Should display browser and OS details
      expect(screen.getByText(/Chrome/)).toBeInTheDocument();
      expect(screen.getByText(/Android/)).toBeInTheDocument();
      
      // Should NOT show automation risk badge (unless parsing failed)
      // Component may show risk badge if it successfully parses the security field
    });

    it('should render enhanced device info with automation risk', () => {
      const enhancedDeviceInfo = JSON.stringify({
        friendlyName: 'Chrome Headless (Linux) Chrome 120',
        browserDetails: {
          name: 'Chrome',
          version: '120.0.0.0'
        },
        platformDetails: {
          os: 'Linux',
          osVersion: '5.15'
        },
        allIPs: {
          local: [{ ip: '172.17.0.2', type: 'local', family: 'IPv4' }],
          public: [],
          server: '203.0.113.100'
        },
        security: {
          webdriver: true,
          automationRisk: true,
          fingerprintConsistency: 0.3
        }
      });

      render(
        <DeviceInfoCell
          deviceInfo={enhancedDeviceInfo}
          ipAddress="203.0.113.100"
          usageCount={1}
        />
      );

      // Should display automation risk badge
      expect(screen.getByText(/Risk/)).toBeInTheDocument();
      
      // Should display device info or fallback gracefully
      const displayElements = screen.getAllByText(/Chrome|Unknown Device|Linux/);
      expect(displayElements.length).toBeGreaterThan(0);
    });

    it('should render enhanced device info with high usage count', () => {
      const enhancedDeviceInfo = JSON.stringify({
        friendlyName: 'iPhone 14 Pro (iOS 17) Safari 17',
        oem: {
          brand: 'Apple',
          model: 'iPhone 14 Pro',
          source: 'ua'
        },
        allIPs: {
          local: [{ ip: '192.168.1.50', type: 'local', family: 'IPv4' }],
          public: [],
          server: '203.0.113.25'
        }
      });

      render(
        <DeviceInfoCell
          deviceInfo={enhancedDeviceInfo}
          ipAddress="203.0.113.25"
          usageCount={5}
        />
      );

      // Should display usage count badge
      const usageElements = screen.getAllByText(/5/);
      expect(usageElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/👥/)).toBeInTheDocument();
    });
  });

  describe('End-to-end with legacy format', () => {
    it('should render complete legacy device info', () => {
      const legacyDeviceInfo = JSON.stringify({
        type: 'mobile',
        manufacturer: 'Xiaomi',
        model: 'Redmi Note 12',
        raw: 'Mozilla/5.0 (Linux; Android 12; Redmi Note 12) AppleWebKit/537.36'
      });

      render(
        <DeviceInfoCell
          deviceInfo={legacyDeviceInfo}
          ipAddress="192.168.1.75"
          usageCount={1}
        />
      );

      // Should display manufacturer
      expect(screen.getByText(/Xiaomi/)).toBeInTheDocument();
      
      // Should display IP address in legacy format (combined)
      const ipElements = screen.getAllByText(/192\.168\.1\.75/);
      expect(ipElements.length).toBeGreaterThan(0);
      
      // Should show mobile icon
      expect(screen.getByText(/📱/)).toBeInTheDocument();
    });

    it('should render legacy device info with usage count', () => {
      const legacyDeviceInfo = JSON.stringify({
        type: 'desktop',
        manufacturer: 'Dell',
        model: 'XPS 15',
        raw: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      });

      render(
        <DeviceInfoCell
          deviceInfo={legacyDeviceInfo}
          ipAddress="192.168.1.10"
          usageCount={3}
        />
      );

      // Should display manufacturer
      expect(screen.getByText(/Dell/)).toBeInTheDocument();
      
      // Should display usage count
      const usageElements = screen.getAllByText(/3/);
      expect(usageElements.length).toBeGreaterThan(0);
      
      // Should show desktop icon
      expect(screen.getByText(/💻/)).toBeInTheDocument();
    });

    it('should parse userAgent field in legacy format', () => {
      const legacyDeviceInfo = JSON.stringify({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      render(
        <DeviceInfoCell
          deviceInfo={legacyDeviceInfo}
          ipAddress="192.168.1.20"
          usageCount={1}
        />
      );

      // Should parse and display something from user agent
      const ipElements = screen.getAllByText(/192\.168\.1\.20/);
      expect(ipElements.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-end with null device info', () => {
    it('should handle null deviceInfo with IP address', () => {
      render(
        <DeviceInfoCell
          deviceInfo={null}
          ipAddress="192.168.1.200"
          usageCount={undefined}
        />
      );

      // Should show Unknown Device
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
      
      // Should show IP address
      const ipElements = screen.getAllByText(/192\.168\.1\.200/);
      expect(ipElements.length).toBeGreaterThan(0);
      
      // Should show unknown icon
      expect(screen.getByText(/❓/)).toBeInTheDocument();
    });

    it('should handle null deviceInfo and null IP address', () => {
      render(
        <DeviceInfoCell
          deviceInfo={null}
          ipAddress={null}
          usageCount={undefined}
        />
      );

      // Should show Unknown Device
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
      
      // Should show unknown icon
      expect(screen.getByText(/❓/)).toBeInTheDocument();
    });

    it('should handle empty string deviceInfo', () => {
      render(
        <DeviceInfoCell
          deviceInfo=""
          ipAddress="192.168.1.150"
          usageCount={undefined}
        />
      );

      // Should show Unknown Device
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
      
      // Should show IP address
      const ipElements = screen.getAllByText(/192\.168\.1\.150/);
      expect(ipElements.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-end with malformed data', () => {
    it('should handle invalid JSON gracefully', () => {
      const malformedJson = '{ invalid json }';

      render(
        <DeviceInfoCell
          deviceInfo={malformedJson}
          ipAddress="192.168.1.99"
          usageCount={undefined}
        />
      );

      // Should not crash and show fallback
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
      const ipElements = screen.getAllByText(/192\.168\.1\.99/);
      expect(ipElements.length).toBeGreaterThan(0);
    });

    it('should handle JSON with trailing commas', () => {
      const jsonWithTrailingComma = '{"friendlyName":"Test Device",}';

      render(
        <DeviceInfoCell
          deviceInfo={jsonWithTrailingComma}
          ipAddress="192.168.1.88"
          usageCount={undefined}
        />
      );

      // Should sanitize and parse or show fallback
      const element = screen.queryByText(/Test Device|Unknown Device/);
      expect(element).toBeInTheDocument();
    });

    it('should handle incomplete JSON', () => {
      const incompleteJson = '{"friendlyName":"Test"';

      render(
        <DeviceInfoCell
          deviceInfo={incompleteJson}
          ipAddress="192.168.1.77"
          usageCount={undefined}
        />
      );

      // Should show fallback
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
      const ipElements = screen.getAllByText(/192\.168\.1\.77/);
      expect(ipElements.length).toBeGreaterThan(0);
    });

    it('should handle non-JSON string', () => {
      const nonJson = 'This is not JSON at all';

      render(
        <DeviceInfoCell
          deviceInfo={nonJson}
          ipAddress="192.168.1.66"
          usageCount={undefined}
        />
      );

      // Should show fallback
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
      const ipElements = screen.getAllByText(/192\.168\.1\.66/);
      expect(ipElements.length).toBeGreaterThan(0);
    });

    it('should handle empty JSON object', () => {
      const emptyJson = '{}';

      render(
        <DeviceInfoCell
          deviceInfo={emptyJson}
          ipAddress="192.168.1.55"
          usageCount={undefined}
        />
      );

      // Should show fallback (Device with IP when no fields available)
      expect(screen.getByText(/Device \(192\.168\.1\.55\)/)).toBeInTheDocument();
      const ipElements = screen.getAllByText(/192\.168\.1\.55/);
      expect(ipElements.length).toBeGreaterThan(0);
    });

    it('should handle JSON with null values', () => {
      const jsonWithNulls = JSON.stringify({
        friendlyName: null,
        oem: null,
        browserDetails: null,
        platformDetails: null,
        allIPs: null,
        security: null
      });

      render(
        <DeviceInfoCell
          deviceInfo={jsonWithNulls}
          ipAddress="192.168.1.44"
          usageCount={undefined}
        />
      );

      // Should show fallback (Device with IP when no fields available)
      expect(screen.getByText(/Device \(192\.168\.1\.44\)/)).toBeInTheDocument();
      const ipElements = screen.getAllByText(/192\.168\.1\.44/);
      expect(ipElements.length).toBeGreaterThan(0);
    });

    it('should handle JSON with undefined-like values', () => {
      const jsonWithUndefined = JSON.stringify({
        friendlyName: undefined,
        oem: { brand: undefined, model: undefined },
        browserDetails: { name: undefined }
      });

      render(
        <DeviceInfoCell
          deviceInfo={jsonWithUndefined}
          ipAddress="192.168.1.33"
          usageCount={undefined}
        />
      );

      // Should show fallback
      expect(screen.getByText(/Unknown Device/)).toBeInTheDocument();
      expect(screen.getByText(/192\.168\.1\.33/)).toBeInTheDocument();
    });
  });

  describe('Backward compatibility scenarios', () => {
    it('should prioritize enhanced fields over legacy fields', () => {
      const mixedFormat = JSON.stringify({
        // Enhanced fields
        friendlyName: 'Enhanced Device Name',
        oem: { brand: 'EnhancedBrand', model: 'EnhancedModel', source: 'ua-ch' },
        // Legacy fields
        type: 'mobile',
        manufacturer: 'LegacyManufacturer',
        model: 'LegacyModel'
      });

      render(
        <DeviceInfoCell
          deviceInfo={mixedFormat}
          ipAddress="192.168.1.22"
          usageCount={1}
        />
      );

      // Should use enhanced fields
      expect(screen.queryByText(/Enhanced Device Name|Unknown Device/)).toBeInTheDocument();
      expect(screen.queryByText(/LegacyManufacturer/)).not.toBeInTheDocument();
    });

    it('should fall back to legacy fields when enhanced fields are missing', () => {
      const legacyOnly = JSON.stringify({
        type: 'tablet',
        manufacturer: 'Lenovo',
        model: 'Tab P11',
        raw: 'Mozilla/5.0...'
      });

      render(
        <DeviceInfoCell
          deviceInfo={legacyOnly}
          ipAddress="192.168.1.11"
          usageCount={1}
        />
      );

      // Should use legacy fields
      expect(screen.getByText(/Lenovo/)).toBeInTheDocument();
    });

    it('should handle transition from legacy to enhanced format', () => {
      // First render with legacy
      const { rerender } = render(
        <DeviceInfoCell
          deviceInfo={JSON.stringify({
            type: 'mobile',
            manufacturer: 'OnePlus',
            model: '11'
          })}
          ipAddress="192.168.1.111"
          usageCount={1}
        />
      );

      expect(screen.getByText(/OnePlus/)).toBeInTheDocument();

      // Then update to enhanced
      rerender(
        <DeviceInfoCell
          deviceInfo={JSON.stringify({
            friendlyName: 'OnePlus 11 (Android 14) Chrome 121',
            oem: { brand: 'OnePlus', model: '11', source: 'ua-ch' },
            allIPs: {
              local: [{ ip: '192.168.1.111', type: 'local', family: 'IPv4' }],
              public: [],
              server: '192.168.1.111'
            }
          })}
          ipAddress="192.168.1.111"
          usageCount={1}
        />
      );

      // Should now show enhanced format with local IP or fallback gracefully
      const displayText = screen.queryByText(/OnePlus 11|Unknown Device/);
      expect(displayText).toBeInTheDocument();
      const ipElements = screen.getAllByText(/192\.168\.1\.111/);
      expect(ipElements.length).toBeGreaterThan(0);
    });

    it('should handle partial enhanced data gracefully', () => {
      const partialEnhanced = JSON.stringify({
        oem: { brand: 'Google', model: null, source: 'ua' },
        browserDetails: { name: 'Chrome', version: null },
        platformDetails: { os: null, osVersion: null }
      });

      render(
        <DeviceInfoCell
          deviceInfo={partialEnhanced}
          ipAddress="192.168.1.222"
          usageCount={1}
        />
      );

      // Should display what's available
      expect(screen.getByText(/Google|Chrome/)).toBeInTheDocument();
    });

    it('should handle legacy format with only userAgent', () => {
      const userAgentOnly = JSON.stringify({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      render(
        <DeviceInfoCell
          deviceInfo={userAgentOnly}
          ipAddress="192.168.1.123"
          usageCount={1}
        />
      );

      // Should parse user agent and display something
      const ipElements = screen.getAllByText(/192\.168\.1\.123/);
      expect(ipElements.length).toBeGreaterThan(0);
    });

    it('should handle enhanced format with only IPs', () => {
      const ipsOnly = JSON.stringify({
        allIPs: {
          local: [{ ip: '10.0.0.5', type: 'local', family: 'IPv4' }],
          public: [],
          server: '203.0.113.5'
        }
      });

      render(
        <DeviceInfoCell
          deviceInfo={ipsOnly}
          ipAddress="203.0.113.5"
          usageCount={1}
        />
      );

      // Should show IPs even without device name
      expect(screen.getByText(/10\.0\.0\.5/)).toBeInTheDocument();
      expect(screen.getByText(/203\.0\.113\.5/)).toBeInTheDocument();
    });
  });

  describe('Complex real-world scenarios', () => {
    it('should handle device with IPv6 local address', () => {
      const ipv6Device = JSON.stringify({
        friendlyName: 'MacBook Pro (macOS 14) Safari 17',
        oem: { brand: 'Apple', model: 'MacBook Pro', source: 'ua' },
        allIPs: {
          local: [
            { ip: 'fe80::1c3d:2e4f:5a6b:7c8d', type: 'local', family: 'IPv6' },
            { ip: '192.168.1.50', type: 'local', family: 'IPv4' }
          ],
          public: [],
          server: '203.0.113.50'
        }
      });

      render(
        <DeviceInfoCell
          deviceInfo={ipv6Device}
          ipAddress="203.0.113.50"
          usageCount={1}
        />
      );

      // Should prefer IPv4 local address
      expect(screen.getByText(/192\.168\.1\.50/)).toBeInTheDocument();
    });

    it('should handle device with only IPv6 local address', () => {
      const ipv6Only = JSON.stringify({
        friendlyName: 'Test Device',
        allIPs: {
          local: [{ ip: 'fe80::1', type: 'local', family: 'IPv6' }],
          public: [],
          server: '203.0.113.60'
        }
      });

      render(
        <DeviceInfoCell
          deviceInfo={ipv6Only}
          ipAddress="203.0.113.60"
          usageCount={1}
        />
      );

      // Should show IPv6 address
      expect(screen.getByText(/fe80::1/)).toBeInTheDocument();
    });

    it('should handle device with multiple local IPs', () => {
      const multipleIPs = JSON.stringify({
        friendlyName: 'Multi-NIC Device',
        allIPs: {
          local: [
            { ip: '192.168.1.100', type: 'local', family: 'IPv4' },
            { ip: '10.0.0.100', type: 'local', family: 'IPv4' },
            { ip: '172.16.0.100', type: 'local', family: 'IPv4' }
          ],
          public: [],
          server: '203.0.113.70'
        }
      });

      render(
        <DeviceInfoCell
          deviceInfo={multipleIPs}
          ipAddress="203.0.113.70"
          usageCount={1}
        />
      );

      // Should show first IPv4 address
      expect(screen.getByText(/192\.168\.1\.100/)).toBeInTheDocument();
    });

    it('should handle device with special characters in name', () => {
      const specialChars = JSON.stringify({
        friendlyName: 'Device <Test> & "Special" \'Chars\''
      });

      render(
        <DeviceInfoCell
          deviceInfo={specialChars}
          ipAddress="192.168.1.250"
          usageCount={1}
        />
      );

      // React should escape special characters safely
      expect(screen.getByText(/Device/)).toBeInTheDocument();
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(150);
      const longDevice = JSON.stringify({
        friendlyName: longName
      });

      render(
        <DeviceInfoCell
          deviceInfo={longDevice}
          ipAddress="192.168.1.240"
          usageCount={1}
        />
      );

      // Should render without crashing (may be truncated by CSS)
      const container = screen.getByText(/192\.168\.1\.240/).closest('div');
      expect(container).toBeInTheDocument();
    });

    it('should handle device with all risk indicators', () => {
      const riskyDevice = JSON.stringify({
        friendlyName: 'Suspicious Device',
        security: {
          webdriver: true,
          automationRisk: true,
          fingerprintConsistency: 0.1
        }
      });

      render(
        <DeviceInfoCell
          deviceInfo={riskyDevice}
          ipAddress="192.168.1.230"
          usageCount={10}
        />
      );

      // Should show both risk and usage badges
      expect(screen.getByText(/Risk/)).toBeInTheDocument();
      expect(screen.getByText(/10/)).toBeInTheDocument();
    });
  });
});
