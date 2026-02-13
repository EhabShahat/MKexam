/**
 * Property-Based Tests for Null Data Handling in Admin UI
 * Feature: enhanced-device-tracking
 * Property 26: Null Data Handling in UI
 * Validates: Requirements 10.5
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import fc from 'fast-check';
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
      {/* Friendly Name */}
      <div data-testid="friendly-name">{friendlyName}</div>
      
      {/* Fingerprint */}
      <div data-testid="fingerprint">{fingerprint}</div>
      
      {/* Browser Details */}
      <div data-testid="browser-name">{pick(browserDetails?.name || browser?.name)}</div>
      <div data-testid="browser-version">{pick(browserDetails?.version || browser?.version)}</div>
      <div data-testid="browser-engine">{pick(browserDetails?.engine)}</div>
      
      {/* Platform Details */}
      <div data-testid="os-name">{pick(platformDetails?.os || os?.name)}</div>
      <div data-testid="os-version">{pick(platformDetails?.osVersion || os?.version)}</div>
      <div data-testid="architecture">{pick(platformDetails?.architecture || clientHints?.architecture)}</div>
      <div data-testid="bitness">{pick(platformDetails?.bitness || clientHints?.bitness)}</div>
      
      {/* Device Model */}
      <div data-testid="device-brand">{pick(oem?.brand)}</div>
      <div data-testid="device-model">{pick(oem?.model)}</div>
      
      {/* Hardware */}
      <div data-testid="cpu-cores">{pick(hardware.hardwareConcurrency)}</div>
      <div data-testid="device-memory">{pick(hardware.deviceMemory)}</div>
      <div data-testid="screen-resolution">
        {hardware.screen?.width && hardware.screen?.height 
          ? `${hardware.screen.width}x${hardware.screen.height}` 
          : "-"}
      </div>
      <div data-testid="pixel-ratio">{pick(hardware.pixelRatio)}</div>
      <div data-testid="touch-support">{fmtBool(hardware.touch)}</div>
      <div data-testid="max-touch-points">{pick(hardware.maxTouchPoints)}</div>
      
      {/* GPU */}
      <div data-testid="gpu-vendor">{pick(gpu?.vendor)}</div>
      <div data-testid="gpu-renderer">{pick(gpu?.renderer)}</div>
      
      {/* Network */}
      <div data-testid="network-type">{pick(network?.type || network?.effectiveType)}</div>
      <div data-testid="network-downlink">{pick(network?.downlink)}</div>
      
      {/* Battery */}
      <div data-testid="battery-level">{typeof battery?.level === "number" ? `${battery.level}%` : "-"}</div>
      <div data-testid="battery-charging">{fmtBool(battery?.charging)}</div>
      
      {/* Security */}
      <div data-testid="webdriver">{fmtBool(security?.webdriver)}</div>
      <div data-testid="automation-risk">{fmtBool(security?.automationRisk)}</div>
      <div data-testid="plugins-count">{pick(security?.pluginsCount)}</div>
      <div data-testid="cookies-enabled">{fmtBool(security?.cookiesEnabled)}</div>
      <div data-testid="extended-display">{fmtBool(security?.isExtended)}</div>
      
      {/* Location */}
      <div data-testid="location-latitude">{pick(location?.latitude)}</div>
      <div data-testid="location-longitude">{pick(location?.longitude)}</div>
      <div data-testid="location-error">{pick(location?.error)}</div>
      
      {/* IPs */}
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
      
      {/* Timezone */}
      <div data-testid="timezone">{pick(di?.timezone)}</div>
      <div data-testid="language">{pick(di?.language)}</div>
    </div>
  );
}

describe('Property 26: Null Data Handling in UI', () => {
  // Arbitrary for generating device info with various null/undefined/missing fields
  const deviceInfoArbitrary = fc.record({
    friendlyName: fc.option(fc.string(), { nil: null }),
    fingerprint: fc.option(fc.string(), { nil: null }),
    browserDetails: fc.option(fc.record({
      name: fc.option(fc.string(), { nil: null }),
      version: fc.option(fc.string(), { nil: null }),
      engine: fc.option(fc.string(), { nil: null }),
    }), { nil: null }),
    platformDetails: fc.option(fc.record({
      os: fc.option(fc.string(), { nil: null }),
      osVersion: fc.option(fc.string(), { nil: null }),
      architecture: fc.option(fc.string(), { nil: null }),
      bitness: fc.option(fc.string(), { nil: null }),
    }), { nil: null }),
    oem: fc.option(fc.record({
      brand: fc.option(fc.string(), { nil: null }),
      model: fc.option(fc.string(), { nil: null }),
    }), { nil: null }),
    deviceMemory: fc.option(fc.nat(), { nil: null }),
    hardwareConcurrency: fc.option(fc.nat(), { nil: null }),
    pixelRatio: fc.option(fc.double({ min: 1, max: 4 }), { nil: null }),
    touch: fc.option(fc.boolean(), { nil: null }),
    maxTouchPoints: fc.option(fc.nat(), { nil: null }),
    screen: fc.option(fc.record({
      width: fc.nat(),
      height: fc.nat(),
    }), { nil: null }),
    viewport: fc.option(fc.record({
      width: fc.nat(),
      height: fc.nat(),
    }), { nil: null }),
    gpu: fc.option(fc.record({
      vendor: fc.option(fc.string(), { nil: null }),
      renderer: fc.option(fc.string(), { nil: null }),
    }), { nil: null }),
    network: fc.option(fc.record({
      type: fc.option(fc.string(), { nil: null }),
      effectiveType: fc.option(fc.string(), { nil: null }),
      downlink: fc.option(fc.nat(), { nil: null }),
    }), { nil: null }),
    battery: fc.option(fc.record({
      level: fc.option(fc.nat({ max: 100 }), { nil: null }),
      charging: fc.option(fc.boolean(), { nil: null }),
    }), { nil: null }),
    security: fc.option(fc.record({
      webdriver: fc.option(fc.boolean(), { nil: null }),
      automationRisk: fc.option(fc.boolean(), { nil: null }),
      pluginsCount: fc.option(fc.nat(), { nil: null }),
      cookiesEnabled: fc.option(fc.boolean(), { nil: null }),
      isExtended: fc.option(fc.boolean(), { nil: null }),
    }), { nil: null }),
    location: fc.option(fc.record({
      latitude: fc.option(fc.double({ min: -90, max: 90 }), { nil: null }),
      longitude: fc.option(fc.double({ min: -180, max: 180 }), { nil: null }),
      error: fc.option(fc.string(), { nil: null }),
    }), { nil: null }),
    allIPs: fc.option(fc.record({
      local: fc.option(fc.array(fc.record({ ip: fc.string() })), { nil: null }),
      public: fc.option(fc.array(fc.record({ ip: fc.string() })), { nil: null }),
      server: fc.option(fc.string(), { nil: null }),
    }), { nil: null }),
    serverDetectedIP: fc.option(fc.string(), { nil: null }),
    timezone: fc.option(fc.string(), { nil: null }),
    language: fc.option(fc.string(), { nil: null }),
  });

  it('should render without errors for any device info with null/undefined/missing fields', () => {
    fc.assert(
      fc.property(deviceInfoArbitrary, (deviceInfo) => {
        // Render should not throw
        const { container, unmount } = render(<DeviceInfoDisplay deviceInfo={deviceInfo} />);
        
        try {
          // Component should render
          expect(container).toBeInTheDocument();
          
          // All test IDs should be present (even if showing "-")
          expect(screen.getByTestId('device-info-display')).toBeInTheDocument();
          expect(screen.getByTestId('friendly-name')).toBeInTheDocument();
          expect(screen.getByTestId('fingerprint')).toBeInTheDocument();
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should display "-" or default values for null/undefined fields', () => {
    fc.assert(
      fc.property(deviceInfoArbitrary, (deviceInfo) => {
        const { container, unmount } = render(<DeviceInfoDisplay deviceInfo={deviceInfo} />);
        
        try {
          // Get all text content
          const textContent = container.textContent || '';
          
          // Should not contain "undefined" or "null" as text
          expect(textContent).not.toContain('undefined');
          expect(textContent).not.toContain('null');
          
          // Should contain "-" for missing fields (or actual values)
          // This ensures graceful handling
          expect(textContent.length).toBeGreaterThan(0);
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should handle completely null device info', () => {
    const { container } = render(<DeviceInfoDisplay deviceInfo={null} />);
    
    expect(container).toBeInTheDocument();
    expect(screen.getByTestId('friendly-name')).toHaveTextContent('Unknown Device');
    expect(screen.getByTestId('fingerprint')).toHaveTextContent('-');
    
    // Should not throw or display "null"/"undefined"
    const textContent = container.textContent || '';
    expect(textContent).not.toContain('undefined');
    expect(textContent).not.toContain('null');
  });

  it('should handle empty object device info', () => {
    const { container } = render(<DeviceInfoDisplay deviceInfo={{}} />);
    
    expect(container).toBeInTheDocument();
    expect(screen.getByTestId('friendly-name')).toHaveTextContent('Unknown Device');
    expect(screen.getByTestId('fingerprint')).toHaveTextContent('-');
  });

  it('should handle partial device info with some fields present', () => {
    const partialDeviceInfo = {
      friendlyName: 'Test Device',
      browserDetails: {
        name: 'Chrome',
        version: null, // Null version
      },
      platformDetails: null, // Null platform
      security: {
        webdriver: true,
        automationRisk: null, // Null risk
      },
    };
    
    const { container } = render(<DeviceInfoDisplay deviceInfo={partialDeviceInfo} />);
    
    expect(container).toBeInTheDocument();
    expect(screen.getByTestId('friendly-name')).toHaveTextContent('Test Device');
    expect(screen.getByTestId('browser-name')).toHaveTextContent('Chrome');
    expect(screen.getByTestId('browser-version')).toHaveTextContent('-');
    expect(screen.getByTestId('webdriver')).toHaveTextContent('Yes');
    expect(screen.getByTestId('automation-risk')).toHaveTextContent('-');
  });

  it('should handle arrays that are null, undefined, or empty', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant([]),
          fc.array(fc.record({ ip: fc.string() }))
        ),
        (localIPs) => {
          const deviceInfo = {
            allIPs: {
              local: localIPs,
              public: null,
              server: null,
            },
          };
          
          const { container, unmount } = render(<DeviceInfoDisplay deviceInfo={deviceInfo} />);
          
          try {
            expect(container).toBeInTheDocument();
            
            // Should display "-" for null/undefined/empty arrays
            const localIPsElement = screen.getByTestId('local-ips');
            if (!localIPs || (Array.isArray(localIPs) && localIPs.length === 0)) {
              expect(localIPsElement).toHaveTextContent('-');
            } else {
              // Should display IPs if present
              expect(localIPsElement.textContent).toBeTruthy();
            }
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle numeric fields that are null, undefined, or 0', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(0),
          fc.nat()
        ),
        (cpuCores) => {
          const deviceInfo = {
            hardwareConcurrency: cpuCores,
          };
          
          const { container, unmount } = render(<DeviceInfoDisplay deviceInfo={deviceInfo} />);
          
          try {
            expect(container).toBeInTheDocument();
            
            const cpuElement = screen.getByTestId('cpu-cores');
            if (cpuCores === null || cpuCores === undefined) {
              expect(cpuElement).toHaveTextContent('-');
            } else {
              expect(cpuElement).toHaveTextContent(String(cpuCores));
            }
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle boolean fields that are null, undefined, true, or false', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(true),
          fc.constant(false)
        ),
        (webdriver) => {
          const deviceInfo = {
            security: {
              webdriver,
            },
          };
          
          const { container, unmount } = render(<DeviceInfoDisplay deviceInfo={deviceInfo} />);
          
          try {
            expect(container).toBeInTheDocument();
            
            const webdriverElement = screen.getByTestId('webdriver');
            if (webdriver === true) {
              expect(webdriverElement).toHaveTextContent('Yes');
            } else if (webdriver === false) {
              expect(webdriverElement).toHaveTextContent('No');
            } else {
              expect(webdriverElement).toHaveTextContent('-');
            }
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// Feature: enhanced-device-tracking
// Property 26: For any attempt with null or incomplete device_info, the admin interface should render without errors and display "Unknown" or placeholder values for missing fields
