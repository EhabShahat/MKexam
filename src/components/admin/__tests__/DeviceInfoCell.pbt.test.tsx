/**
 * Property-based tests for DeviceInfoCell component
 * Feature: student-experience-and-admin-enhancements
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fc from 'fast-check';
import DeviceInfoCell from '../DeviceInfoCell';
import type { DeviceInfo } from '@/lib/userAgent';

describe('DeviceInfoCell - Property-Based Tests', () => {
  // Arbitrary for device info
  const deviceInfoArb = fc.record({
    type: fc.constantFrom('mobile', 'tablet', 'desktop', 'unknown'),
    manufacturer: fc.oneof(
      fc.constant('Apple'),
      fc.constant('Samsung'),
      fc.constant('Google'),
      fc.constant('Microsoft'),
      fc.constant('Unknown')
    ),
    model: fc.string({ minLength: 1, maxLength: 50 }),
    raw: fc.string(),
  }) as fc.Arbitrary<DeviceInfo>;

  // Arbitrary for IP addresses
  const ipAddressArb = fc.oneof(
    // IPv4
    fc.tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 })
    ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
    // IPv6 (simplified)
    fc.constant('2001:0db8:85a3:0000:0000:8a2e:0370:7334'),
    fc.constant('::1')
  );

  /**
   * Property 8: Device Info Display Completeness
   * For any exam attempt with device information, the results page should 
   * display device type, model name, and IP address in a single formatted string.
   * 
   * Validates: Requirements 2.3, 2.4
   */
  it('Property 8: Device Info Display Completeness - displays all device information', () => {
    fc.assert(
      fc.property(
        deviceInfoArb,
        ipAddressArb,
        fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
        (deviceInfo, ipAddress, usageCount) => {
          const deviceInfoJson = JSON.stringify(deviceInfo);
          
          const { container } = render(
            <DeviceInfoCell 
              deviceInfo={deviceInfoJson}
              ipAddress={ipAddress}
              usageCount={usageCount}
            />
          );

          const text = container.textContent || '';

          // Should contain manufacturer or model
          const hasManufacturer = text.includes(deviceInfo.manufacturer);
          const hasModel = text.includes(deviceInfo.model);
          expect(hasManufacturer || hasModel).toBe(true);

          // Should contain IP address
          expect(text.includes(ipAddress)).toBe(true);

          // If usage count > 1, should display it
          if (usageCount && usageCount > 1) {
            expect(text.includes(`(${usageCount})`)).toBe(true);
          }

          // Should have device type icon
          const hasIcon = text.includes('📱') || text.includes('💻') || text.includes('❓');
          expect(hasIcon).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: Device Info Display Completeness - handles missing device info gracefully', () => {
    fc.assert(
      fc.property(
        fc.option(ipAddressArb, { nil: null }),
        (ipAddress) => {
          const { container } = render(
            <DeviceInfoCell 
              deviceInfo={null}
              ipAddress={ipAddress}
              usageCount={undefined}
            />
          );

          const text = container.textContent || '';

          // Should show fallback
          expect(text.includes('Unknown Device')).toBe(true);

          // Should show IP if available
          if (ipAddress) {
            expect(text.includes(ipAddress)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: Device Info Display Completeness - handles malformed device info JSON', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('invalid json'),
          fc.constant('{"incomplete":'),
          fc.constant('null'),
          fc.constant(''),
          fc.constant('{}')
        ),
        ipAddressArb,
        (malformedJson, ipAddress) => {
          // Should not throw
          expect(() => {
            const { container } = render(
              <DeviceInfoCell 
                deviceInfo={malformedJson}
                ipAddress={ipAddress}
                usageCount={undefined}
              />
            );

            const text = container.textContent || '';

            // Should show fallback
            expect(text.includes('Unknown Device')).toBe(true);

            // Should still show IP
            expect(text.includes(ipAddress)).toBe(true);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: Device Info Display Completeness - tooltip contains full device details', () => {
    fc.assert(
      fc.property(
        deviceInfoArb,
        ipAddressArb,
        fc.option(fc.integer({ min: 2, max: 50 }), { nil: undefined }),
        (deviceInfo, ipAddress, usageCount) => {
          const deviceInfoJson = JSON.stringify(deviceInfo);
          
          const { container } = render(
            <DeviceInfoCell 
              deviceInfo={deviceInfoJson}
              ipAddress={ipAddress}
              usageCount={usageCount}
            />
          );

          // Find element with title attribute
          const elementWithTooltip = container.querySelector('[title]');
          expect(elementWithTooltip).toBeTruthy();

          const tooltip = elementWithTooltip?.getAttribute('title') || '';

          // Tooltip should contain device details
          expect(tooltip.includes(deviceInfo.type)).toBe(true);
          expect(tooltip.includes(deviceInfo.manufacturer)).toBe(true);
          expect(tooltip.includes(deviceInfo.model)).toBe(true);
          expect(tooltip.includes(ipAddress)).toBe(true);

          // If usage count > 1, should be in tooltip
          if (usageCount && usageCount > 1) {
            expect(tooltip.includes(`${usageCount}`)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: Device Info Display Completeness - displays correct device type icon', () => {
    fc.assert(
      fc.property(
        deviceInfoArb,
        ipAddressArb,
        (deviceInfo, ipAddress) => {
          const deviceInfoJson = JSON.stringify(deviceInfo);
          
          const { container } = render(
            <DeviceInfoCell 
              deviceInfo={deviceInfoJson}
              ipAddress={ipAddress}
              usageCount={undefined}
            />
          );

          const text = container.textContent || '';

          // Check correct icon for device type
          if (deviceInfo.type === 'mobile' || deviceInfo.type === 'tablet') {
            expect(text.includes('📱')).toBe(true);
          } else if (deviceInfo.type === 'desktop') {
            expect(text.includes('💻')).toBe(true);
          } else if (deviceInfo.type === 'unknown') {
            expect(text.includes('❓')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: Device Info Display Completeness - handles nested device info structures', () => {
    fc.assert(
      fc.property(
        deviceInfoArb,
        ipAddressArb,
        (deviceInfo, ipAddress) => {
          // Test with nested structure (userAgent field)
          const nestedJson = JSON.stringify({
            userAgent: deviceInfo.raw,
            timestamp: new Date().toISOString(),
          });
          
          const { container } = render(
            <DeviceInfoCell 
              deviceInfo={nestedJson}
              ipAddress={ipAddress}
              usageCount={undefined}
            />
          );

          const text = container.textContent || '';

          // Should parse and display device info
          expect(text.length).toBeGreaterThan(0);
          expect(text.includes(ipAddress)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
