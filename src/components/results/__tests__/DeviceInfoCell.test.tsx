/**
 * Unit tests for DeviceInfoCell component
 * 
 * Tests device info display, usage count badge, automation risk indicator,
 * and handling of various device info formats.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeviceInfoCell } from '../DeviceInfoCell';
import { generateDeviceFingerprint } from '@/lib/results/deviceParser';
import type { DeviceInfo } from '@/lib/results/types';

describe('DeviceInfoCell', () => {
  describe('Device Type and Model Display', () => {
    it('displays mobile device with model', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone 13 Pro',
        allIPs: { local: ['192.168.1.100'] },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.getByText('iPhone 13 Pro')).toBeInTheDocument();
      expect(screen.getByLabelText('Mobile device')).toBeInTheDocument();
    });

    it('displays tablet device with model', () => {
      const deviceInfo = JSON.stringify({
        type: 'tablet',
        friendlyName: 'iPad Air',
        allIPs: { local: ['192.168.1.101'] },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.2"
        />
      );

      expect(screen.getByText('iPad Air')).toBeInTheDocument();
      expect(screen.getByLabelText('Tablet device')).toBeInTheDocument();
    });

    it('displays desktop device with model', () => {
      const deviceInfo = JSON.stringify({
        type: 'desktop',
        friendlyName: 'Windows PC',
        allIPs: { local: ['192.168.1.102'] },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.3"
        />
      );

      expect(screen.getByText('Windows PC')).toBeInTheDocument();
      expect(screen.getByLabelText('Desktop computer')).toBeInTheDocument();
    });

    it('displays unknown device type', () => {
      const deviceInfo = JSON.stringify({
        type: 'unknown',
        friendlyName: 'Unknown Device',
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.4"
        />
      );

      expect(screen.getByText('Unknown Device')).toBeInTheDocument();
      expect(screen.getByLabelText('Unknown device')).toBeInTheDocument();
    });

    it('displays device model from oem brand and model', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        oem: {
          brand: 'Samsung',
          model: 'Galaxy S21',
        },
        allIPs: { local: ['192.168.1.103'] },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.5"
        />
      );

      expect(screen.getByText('Samsung Galaxy S21')).toBeInTheDocument();
    });

    it('handles null device info gracefully', () => {
      render(
        <DeviceInfoCell
          deviceInfo={null}
          ipAddress="203.0.113.6"
        />
      );

      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByLabelText('Unknown device')).toBeInTheDocument();
    });
  });

  describe('IP Address Display', () => {
    it('displays local IP address', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
        allIPs: { local: ['192.168.1.100'] },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.getByText(/Local: 192\.168\.1\.100/)).toBeInTheDocument();
    });

    it('displays server IP from device info', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
        allIPs: {
          local: ['192.168.1.100'],
          public: ['203.0.113.1'],
        },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.getByText(/Server: 203\.0\.113\.1/)).toBeInTheDocument();
    });

    it('falls back to ipAddress prop when server IP not in device info', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
        allIPs: { local: ['192.168.1.100'] },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.getByText(/Server: 203\.0\.113\.1/)).toBeInTheDocument();
    });

    it('does not display IP section when no IPs available', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress={null}
        />
      );

      expect(screen.queryByText(/Local:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Server:/)).not.toBeInTheDocument();
    });
  });

  describe('Usage Count Badge', () => {
    it('displays usage count badge when count > 1', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
        allIPs: { local: ['192.168.1.100'] },
      });

      const parsedInfo: DeviceInfo = {
        type: 'mobile',
        model: 'iPhone',
        local_ip: '192.168.1.100',
        server_ip: '',
        automation_risk: false,
      };

      const fingerprint = generateDeviceFingerprint(parsedInfo);
      const usageMap = new Map([[fingerprint, 3]]);

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
          deviceUsageMap={usageMap}
        />
      );

      expect(screen.getByText('×3')).toBeInTheDocument();
      expect(screen.getByLabelText('Device used 3 times')).toBeInTheDocument();
    });

    it('does not display usage badge when count is 1', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
        allIPs: { local: ['192.168.1.100'] },
      });

      const parsedInfo: DeviceInfo = {
        type: 'mobile',
        model: 'iPhone',
        local_ip: '192.168.1.100',
        server_ip: '',
        automation_risk: false,
      };

      const fingerprint = generateDeviceFingerprint(parsedInfo);
      const usageMap = new Map([[fingerprint, 1]]);

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
          deviceUsageMap={usageMap}
        />
      );

      expect(screen.queryByText(/×/)).not.toBeInTheDocument();
    });

    it('does not display usage badge when no usage map provided', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
        allIPs: { local: ['192.168.1.100'] },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.queryByText(/×/)).not.toBeInTheDocument();
    });
  });

  describe('Automation Risk Indicator', () => {
    it('displays bot risk warning when automation risk detected', () => {
      const deviceInfo = JSON.stringify({
        type: 'desktop',
        friendlyName: 'Chrome Browser',
        security: {
          automationRisk: true,
        },
        allIPs: { local: ['192.168.1.100'] },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.getByText('Bot Risk')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveAttribute(
        'aria-label',
        'Automation or bot risk detected'
      );
    });

    it('displays bot risk warning when webdriver detected', () => {
      const deviceInfo = JSON.stringify({
        type: 'desktop',
        friendlyName: 'Chrome Browser',
        security: {
          webdriver: true,
        },
        allIPs: { local: ['192.168.1.100'] },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.getByText('Bot Risk')).toBeInTheDocument();
    });

    it('does not display bot risk when no automation detected', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
        security: {
          automationRisk: false,
        },
        allIPs: { local: ['192.168.1.100'] },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.queryByText('Bot Risk')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Legacy Format Support', () => {
    it('handles legacy device info format', () => {
      const deviceInfo = JSON.stringify({
        device: {
          type: 'mobile',
          manufacturer: 'Apple',
          model: 'iPhone 12',
        },
        ips: {
          local: ['192.168.1.100'],
          public: ['203.0.113.1'],
        },
        automationRisk: false,
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.getByText('Apple iPhone 12')).toBeInTheDocument();
      expect(screen.getByText(/Local: 192\.168\.1\.100/)).toBeInTheDocument();
      expect(screen.getByText(/Server: 203\.0\.113\.1/)).toBeInTheDocument();
    });

    it('handles legacy automation risk field', () => {
      const deviceInfo = JSON.stringify({
        type: 'desktop',
        model: 'Chrome',
        automationRisk: true,
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.getByText('Bot Risk')).toBeInTheDocument();
    });
  });

  describe('Malformed Data Handling', () => {
    it('handles malformed JSON gracefully', () => {
      const deviceInfo = 'not valid json {';

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByLabelText('Unknown device')).toBeInTheDocument();
    });

    it('handles empty JSON object', () => {
      const deviceInfo = JSON.stringify({});

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('handles missing fields gracefully', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        // Missing friendlyName and other fields
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByLabelText('Mobile device')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for device type', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      const deviceIcon = screen.getByLabelText('Mobile device');
      expect(deviceIcon).toHaveAttribute('title', 'Mobile device');
    });

    it('has proper ARIA labels for usage count', () => {
      const deviceInfo = JSON.stringify({
        type: 'mobile',
        friendlyName: 'iPhone',
        allIPs: { local: ['192.168.1.100'] },
      });

      const parsedInfo: DeviceInfo = {
        type: 'mobile',
        model: 'iPhone',
        local_ip: '192.168.1.100',
        server_ip: '',
        automation_risk: false,
      };

      const fingerprint = generateDeviceFingerprint(parsedInfo);
      const usageMap = new Map([[fingerprint, 5]]);

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
          deviceUsageMap={usageMap}
        />
      );

      const usageBadge = screen.getByLabelText('Device used 5 times');
      expect(usageBadge).toHaveAttribute('title', 'Used 5 times');
    });

    it('has proper role and ARIA label for automation risk alert', () => {
      const deviceInfo = JSON.stringify({
        type: 'desktop',
        friendlyName: 'Chrome',
        security: { automationRisk: true },
      });

      render(
        <DeviceInfoCell
          deviceInfo={deviceInfo}
          ipAddress="203.0.113.1"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-label', 'Automation or bot risk detected');
    });
  });
});
