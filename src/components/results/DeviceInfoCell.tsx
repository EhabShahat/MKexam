/**
 * DeviceInfoCell Component
 * 
 * Displays parsed device information with icons, model, IP addresses,
 * automation risk indicator, and usage count badge.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */

'use client';

import { parseDeviceInfo, getDeviceUsageCount } from '@/lib/results/deviceParser';
import type { DeviceInfo } from '@/lib/results/types';

export interface DeviceInfoCellProps {
  /** Device information JSON string */
  deviceInfo: string | null;
  /** IP address from attempt */
  ipAddress: string | null;
  /** Device usage map for calculating usage count */
  deviceUsageMap?: Map<string, number>;
}

/**
 * Get device type icon
 */
function getDeviceIcon(type: DeviceInfo['type']): React.ReactElement {
  switch (type) {
    case 'mobile':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    case 'tablet':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    case 'desktop':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      );
    default:
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

/**
 * Get device type label for accessibility
 */
function getDeviceTypeLabel(type: DeviceInfo['type']): string {
  switch (type) {
    case 'mobile':
      return 'Mobile device';
    case 'tablet':
      return 'Tablet device';
    case 'desktop':
      return 'Desktop computer';
    default:
      return 'Unknown device';
  }
}

/**
 * DeviceInfoCell component
 */
export function DeviceInfoCell({
  deviceInfo,
  ipAddress,
  deviceUsageMap,
}: DeviceInfoCellProps) {
  // Parse device information
  const parsed = parseDeviceInfo(deviceInfo);
  
  // Calculate usage count if map provided
  const usageCount = deviceUsageMap 
    ? getDeviceUsageCount(parsed, deviceUsageMap)
    : 0;

  // Show usage badge if count > 1
  const showUsageBadge = usageCount > 1;

  return (
    <div className="flex flex-col gap-1 text-sm">
      {/* Device Type and Model */}
      <div className="flex items-center gap-2">
        <span
          className="text-[var(--muted-foreground)]"
          title={getDeviceTypeLabel(parsed.type)}
          aria-label={getDeviceTypeLabel(parsed.type)}
        >
          {getDeviceIcon(parsed.type)}
        </span>
        <span className="font-medium">{parsed.model}</span>
        {showUsageBadge && (
          <span
            className="badge badge-outline text-xs"
            title={`Used ${usageCount} times`}
            aria-label={`Device used ${usageCount} times`}
          >
            ×{usageCount}
          </span>
        )}
      </div>

      {/* IP Addresses */}
      <div className="flex flex-col gap-0.5 text-xs text-[var(--muted-foreground)]">
        {parsed.local_ip && (
          <div className="flex items-center gap-1">
            <span className="font-mono" title="Local IP address">
              Local: {parsed.local_ip}
            </span>
          </div>
        )}
        {(parsed.server_ip || ipAddress) && (
          <div className="flex items-center gap-1">
            <span className="font-mono" title="Server IP address">
              Server: {parsed.server_ip || ipAddress}
            </span>
          </div>
        )}
      </div>

      {/* Automation Risk Indicator */}
      {parsed.automation_risk && (
        <div
          className="flex items-center gap-1 text-xs text-[var(--warning)]"
          role="alert"
          aria-label="Automation or bot risk detected"
        >
          <svg
            className="w-3 h-3"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>Bot Risk</span>
        </div>
      )}
    </div>
  );
}
