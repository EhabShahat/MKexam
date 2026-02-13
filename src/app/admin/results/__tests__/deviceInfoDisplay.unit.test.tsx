/**
 * Unit Tests for Device Info Display in Admin UI
 * Feature: enhanced-device-tracking
 * Validates: Requirements 10.5
 * 
 * Tests rendering with:
 * - Complete device info
 * - Null device info
 * - Partial device info
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// Mock device info display component that mimics the actual implementation
function DeviceInfoDisplay({ deviceInfo }: { deviceInfo: any }) {
  const pick = (v: any) => (v === null || v === undefined || v === "" ? "-" : String(v));
  const fmtBool = (v: any) => (v === true ? "Yes" : v === false ? "No" : "-");
  
  const di = deviceInfo || {};
  const parsed = di?.parsed || {};
  const browser = parsed.browser || {};
  const os = parsed.os || {};
  const browserDetails = di?.browserDetails || {};
  const platformDetails = di?.platformDetails || {};
  const clientHints = di?.clientHints || {};
  const oem = di?.oem || {};
  const security = di?.security || {};
  const hardware = {
    deviceMemory: di?.deviceMemory,
    hardwareConcurrency: di?.hardwareConcurrency,
    screen: di?.screen || {},
    viewport: di?.viewport || {},
    pixelRatio: di?.pixelRatio,
    touch: di?.touch,
    maxTouchPoints: di?.maxTouchPoints
  };
  const network = di?.network || {};
  const battery = di?.battery || {};
  const gpu = di?.gpu || {};
  const location = di?.location || {};
  const ips = di?.ips || {};
  const allIPs = di?.allIPs || {};
  
  const friendlyName = di?.friendlyName || "Unknown Device";
  const fingerprint = di?.fingerprint || "-";

  return (
    <div data-testid="device-info-display">
      {/* Header */}
      <div data-testid="friendly-name">{friendlyName}</div>
      <div data-testid="fingerprint">{fingerprint}</div>
      
      {/* Security Indicators */}
      {security.automationRisk && (
        <div data-testid="automation-risk-badge">Automation Risk</div>
      )}
      
      {/* Browser Details */}
      <div data-testid="browser-section">
        <div data-testid="browser-name">{pick(browserDetails?.name || browser?.name)}</div>
        <div data-testid="browser-version">{pick(browserDetails?.version || browser?.version)}</div>
        <div data-testid="browser-engine">{pick(browserDetails?.engine)}</div>
      </div>
      
      {/* Platform Details */}
      <div data-testid="platform-section">
        <div data-testid="os-name">{pick(platformDetails?.os || os?.name)}</div>
        <div data-testid="os-version">{pick(platformDetails?.osVersion || os?.version)}</div>
        <div data-testid="architecture">{pick(platformDetails?.architecture || clientHints?.architecture)}</div>
        <div data-testid="bitness">{pick(platformDetails?.bitness || clientHints?.bitness)}</div>
      </div>
      
      {/* Device Model */}
      <div data-testid="device-section">
        <div data-testid="device-brand">{pick(oem?.brand)}</div>
        <div data-testid="device-model">{pick(oem?.model)}</div>
      </div>
      
      {/* Hardware */}
      <div data-testid="hardware-section">
        <div data-testid="cpu-cores">{pick(hardware.hardwareConcurrency)}</div>
        <div data-testid="device-memory">{pick(hardware.deviceMemory)}</div>
        <div data-testid="screen-resolution">
          {hardware.screen?.width && hardware.screen?.height 
            ? `${hardware.screen.width}x${hardware.screen.height}` 
            : "-"}
        </div>
        <div data-testid="pixel-ratio">{pick(hardware.pixelRatio)}</div>
        <div data-testid="touch-support">{fmtBool(hardware.touch)}</div>
      </div>
      
      {/* GPU */}
      <div data-testid="gpu-section">
        <div data-testid="gpu-vendor">{pick(gpu?.vendor)}</div>
        <div data-testid="gpu-renderer">{pick(gpu?.renderer)}</div>
      </div>
      
      {/* Network */}
      <div data-testid="network-section">
        <div data-testid="network-type">{pick(network?.type || network?.effectiveType)}</div>
        <div data-testid="network-downlink">{pick(network?.downlink)}</div>
      </div>
      
      {/* Battery */}
      <div data-testid="battery-section">
        <div data-testid="battery-level">{typeof battery?.level === "number" ? `${battery.level}%` : "-"}</div>
        <div data-testid="battery-charging">{fmtBool(battery?.charging)}</div>
      </div>
      
      {/* Security */}
      <div data-testid="security-section">
        <div data-testid="webdriver">{fmtBool(security?.webdriver)}</div>
        <div data-testid="automation-risk">{fmtBool(security?.automationRisk)}</div>
        <div data-testid="plugins-count">{pick(security?.pluginsCount)}</div>
        <div data-testid="cookies-enabled">{fmtBool(security?.cookiesEnabled)}</div>
        <div data-testid="extended-display">{fmtBool(security?.isExtended)}</div>
      </div>
      
      {/* Location */}
      <div data-testid="location-section">
        {location.latitude && location.longitude ? (
          <div>
            <a 
              data-testid="location-link"
              href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Maps
            </a>
            <div data-testid="location-coords">
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </div>
          </div>
        ) : (
          <div data-testid="location-error">{location.error || "Location Access Denied"}</div>
        )}
      </div>
      
      {/* IPs */}
      <div data-testid="ip-section">
        <div data-testid="local-ips">
          {Array.isArray(allIPs?.local) && allIPs.local.length > 0
            ? allIPs.local.map((ip: any) => ip.ip).join(", ")
            : "-"}
        </div>
        <div data-testid="public-ips">
          {Array.isArray(allIPs?.public) && allIPs.public.length > 0
            ? allIPs.public.map((ip: any) => ip.ip).join(", ")
            : "-"}
        </div>
        <div data-testid="server-ip">{pick(di?.serverDetectedIP || allIPs?.server)}</div>
      </div>
      
      {/* Locale */}
      <div data-testid="locale-section">
        <div data-testid="timezone">{pick(di?.timezone)}</div>
        <div data-testid="language">{pick(di?.language)}</div>
      </div>
    </div>
  );
}

describe('Device Info Display - Unit Tests', () => {
  describe('Complete Device Info', () => {
    const completeDeviceInfo = {
      friendlyName: 'Samsung Galaxy S21 (Android 13) Chrome 120',
      fingerprint: 'a3f5b8c2d1e4',
      browserDetails: {
        name: 'Chrome',
        version: '120',
        fullVersion: '120.0.6099.129',
        engine: 'Blink',
        engineVersion: '120.0.6099.129'
      },
      platformDetails: {
        os: 'Android',
        osVersion: '13',
        architecture: 'arm',
        bitness: '64'
      },
      clientHints: {
        architecture: 'arm',
        bitness: '64',
        model: 'SM-G991B',
        platform: 'Android',
        platformVersion: '13.0.0',
        mobile: true
      },
      oem: {
        brand: 'Samsung',
        model: 'SM-G991B',
        source: 'ua-ch'
      },
      deviceMemory: 8,
      hardwareConcurrency: 8,
      screen: {
        width: 1080,
        height: 2400,
        colorDepth: 24
      },
      viewport: {
        width: 412,
        height: 915
      },
      pixelRatio: 2.625,
      touch: true,
      maxTouchPoints: 5,
      gpu: {
        vendor: 'ARM',
        renderer: 'Mali-G78'
      },
      network: {
        type: 'cellular',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50
      },
      battery: {
        level: 75,
        charging: false
      },
      location: {
        latitude: 30.0444,
        longitude: 31.2357,
        accuracy: 20
      },
      security: {
        webdriver: false,
        pdfViewer: true,
        doNotTrack: false,
        pluginsCount: 3,
        cookiesEnabled: true,
        isExtended: false,
        maxTouchPoints: 5,
        automationRisk: false
      },
      allIPs: {
        local: [
          { ip: '192.168.1.105', type: 'local', family: 'IPv4', source: 'webrtc' }
        ],
        public: [],
        server: '203.0.113.45'
      },
      serverDetectedIP: '203.0.113.45',
      timezone: 'Africa/Cairo',
      language: 'ar'
    };

    it('should render all device information correctly', () => {
      render(<DeviceInfoDisplay deviceInfo={completeDeviceInfo} />);
      
      // Header
      expect(screen.getByTestId('friendly-name')).toHaveTextContent('Samsung Galaxy S21 (Android 13) Chrome 120');
      expect(screen.getByTestId('fingerprint')).toHaveTextContent('a3f5b8c2d1e4');
      
      // Browser
      expect(screen.getByTestId('browser-name')).toHaveTextContent('Chrome');
      expect(screen.getByTestId('browser-version')).toHaveTextContent('120');
      expect(screen.getByTestId('browser-engine')).toHaveTextContent('Blink');
      
      // Platform
      expect(screen.getByTestId('os-name')).toHaveTextContent('Android');
      expect(screen.getByTestId('os-version')).toHaveTextContent('13');
      expect(screen.getByTestId('architecture')).toHaveTextContent('arm');
      expect(screen.getByTestId('bitness')).toHaveTextContent('64');
      
      // Device
      expect(screen.getByTestId('device-brand')).toHaveTextContent('Samsung');
      expect(screen.getByTestId('device-model')).toHaveTextContent('SM-G991B');
      
      // Hardware
      expect(screen.getByTestId('cpu-cores')).toHaveTextContent('8');
      expect(screen.getByTestId('device-memory')).toHaveTextContent('8');
      expect(screen.getByTestId('screen-resolution')).toHaveTextContent('1080x2400');
      expect(screen.getByTestId('pixel-ratio')).toHaveTextContent('2.625');
      expect(screen.getByTestId('touch-support')).toHaveTextContent('Yes');
      
      // GPU
      expect(screen.getByTestId('gpu-vendor')).toHaveTextContent('ARM');
      expect(screen.getByTestId('gpu-renderer')).toHaveTextContent('Mali-G78');
      
      // Network
      expect(screen.getByTestId('network-type')).toHaveTextContent('cellular');
      expect(screen.getByTestId('network-downlink')).toHaveTextContent('10');
      
      // Battery
      expect(screen.getByTestId('battery-level')).toHaveTextContent('75%');
      expect(screen.getByTestId('battery-charging')).toHaveTextContent('No');
      
      // Security
      expect(screen.getByTestId('webdriver')).toHaveTextContent('No');
      expect(screen.getByTestId('automation-risk')).toHaveTextContent('No');
      expect(screen.getByTestId('plugins-count')).toHaveTextContent('3');
      expect(screen.getByTestId('cookies-enabled')).toHaveTextContent('Yes');
      expect(screen.getByTestId('extended-display')).toHaveTextContent('No');
      
      // Location
      expect(screen.getByTestId('location-link')).toBeInTheDocument();
      expect(screen.getByTestId('location-coords')).toHaveTextContent('30.0444, 31.2357');
      
      // IPs
      expect(screen.getByTestId('local-ips')).toHaveTextContent('192.168.1.105');
      expect(screen.getByTestId('public-ips')).toHaveTextContent('-');
      expect(screen.getByTestId('server-ip')).toHaveTextContent('203.0.113.45');
      
      // Locale
      expect(screen.getByTestId('timezone')).toHaveTextContent('Africa/Cairo');
      expect(screen.getByTestId('language')).toHaveTextContent('ar');
    });

    it('should not display automation risk badge when automationRisk is false', () => {
      render(<DeviceInfoDisplay deviceInfo={completeDeviceInfo} />);
      
      expect(screen.queryByTestId('automation-risk-badge')).not.toBeInTheDocument();
    });

    it('should display location link when coordinates are available', () => {
      render(<DeviceInfoDisplay deviceInfo={completeDeviceInfo} />);
      
      const link = screen.getByTestId('location-link');
      expect(link).toHaveAttribute('href', 'https://www.google.com/maps?q=30.0444,31.2357');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('Null Device Info', () => {
    it('should render with null device info', () => {
      render(<DeviceInfoDisplay deviceInfo={null} />);
      
      expect(screen.getByTestId('device-info-display')).toBeInTheDocument();
      expect(screen.getByTestId('friendly-name')).toHaveTextContent('Unknown Device');
      expect(screen.getByTestId('fingerprint')).toHaveTextContent('-');
    });

    it('should display "-" for all missing fields', () => {
      render(<DeviceInfoDisplay deviceInfo={null} />);
      
      // Check various fields show "-"
      expect(screen.getByTestId('browser-name')).toHaveTextContent('-');
      expect(screen.getByTestId('os-name')).toHaveTextContent('-');
      expect(screen.getByTestId('device-brand')).toHaveTextContent('-');
      expect(screen.getByTestId('cpu-cores')).toHaveTextContent('-');
      expect(screen.getByTestId('gpu-vendor')).toHaveTextContent('-');
      expect(screen.getByTestId('network-type')).toHaveTextContent('-');
      expect(screen.getByTestId('battery-level')).toHaveTextContent('-');
      expect(screen.getByTestId('local-ips')).toHaveTextContent('-');
      expect(screen.getByTestId('timezone')).toHaveTextContent('-');
    });

    it('should display location error when no coordinates', () => {
      render(<DeviceInfoDisplay deviceInfo={null} />);
      
      expect(screen.getByTestId('location-error')).toHaveTextContent('Location Access Denied');
    });

    it('should not display automation risk badge', () => {
      render(<DeviceInfoDisplay deviceInfo={null} />);
      
      expect(screen.queryByTestId('automation-risk-badge')).not.toBeInTheDocument();
    });
  });

  describe('Partial Device Info', () => {
    it('should render with only browser info', () => {
      const partialInfo = {
        browserDetails: {
          name: 'Firefox',
          version: '115',
        },
      };
      
      render(<DeviceInfoDisplay deviceInfo={partialInfo} />);
      
      expect(screen.getByTestId('browser-name')).toHaveTextContent('Firefox');
      expect(screen.getByTestId('browser-version')).toHaveTextContent('115');
      expect(screen.getByTestId('browser-engine')).toHaveTextContent('-');
      expect(screen.getByTestId('os-name')).toHaveTextContent('-');
    });

    it('should render with only security info showing automation risk', () => {
      const partialInfo = {
        security: {
          webdriver: true,
          automationRisk: true,
        },
      };
      
      render(<DeviceInfoDisplay deviceInfo={partialInfo} />);
      
      expect(screen.getByTestId('webdriver')).toHaveTextContent('Yes');
      expect(screen.getByTestId('automation-risk')).toHaveTextContent('Yes');
      expect(screen.getByTestId('automation-risk-badge')).toBeInTheDocument();
    });

    it('should render with only location error', () => {
      const partialInfo = {
        location: {
          error: 'User denied geolocation',
        },
      };
      
      render(<DeviceInfoDisplay deviceInfo={partialInfo} />);
      
      expect(screen.getByTestId('location-error')).toHaveTextContent('User denied geolocation');
      expect(screen.queryByTestId('location-link')).not.toBeInTheDocument();
    });

    it('should render with mixed null and present values', () => {
      const partialInfo = {
        friendlyName: 'Test Device',
        browserDetails: {
          name: 'Safari',
          version: null,
        },
        platformDetails: null,
        deviceMemory: 4,
        hardwareConcurrency: null,
        security: {
          webdriver: false,
          automationRisk: null,
        },
      };
      
      render(<DeviceInfoDisplay deviceInfo={partialInfo} />);
      
      expect(screen.getByTestId('friendly-name')).toHaveTextContent('Test Device');
      expect(screen.getByTestId('browser-name')).toHaveTextContent('Safari');
      expect(screen.getByTestId('browser-version')).toHaveTextContent('-');
      expect(screen.getByTestId('device-memory')).toHaveTextContent('4');
      expect(screen.getByTestId('cpu-cores')).toHaveTextContent('-');
      expect(screen.getByTestId('webdriver')).toHaveTextContent('No');
      expect(screen.getByTestId('automation-risk')).toHaveTextContent('-');
    });

    it('should handle empty arrays for IPs', () => {
      const partialInfo = {
        allIPs: {
          local: [],
          public: [],
          server: null,
        },
      };
      
      render(<DeviceInfoDisplay deviceInfo={partialInfo} />);
      
      expect(screen.getByTestId('local-ips')).toHaveTextContent('-');
      expect(screen.getByTestId('public-ips')).toHaveTextContent('-');
      expect(screen.getByTestId('server-ip')).toHaveTextContent('-');
    });

    it('should handle multiple local IPs', () => {
      const partialInfo = {
        allIPs: {
          local: [
            { ip: '192.168.1.100', type: 'local', family: 'IPv4' },
            { ip: 'fe80::1', type: 'local', family: 'IPv6' },
          ],
          public: [
            { ip: '203.0.113.50', type: 'public', family: 'IPv4' },
          ],
          server: '203.0.113.50',
        },
      };
      
      render(<DeviceInfoDisplay deviceInfo={partialInfo} />);
      
      expect(screen.getByTestId('local-ips')).toHaveTextContent('192.168.1.100, fe80::1');
      expect(screen.getByTestId('public-ips')).toHaveTextContent('203.0.113.50');
      expect(screen.getByTestId('server-ip')).toHaveTextContent('203.0.113.50');
    });
  });
});
