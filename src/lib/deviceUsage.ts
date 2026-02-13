/**
 * Device usage counting utilities
 * Aggregates device information across exam attempts to track device usage patterns
 */

import { DeviceInfo, getDeviceIdentifier, parseUserAgent } from './userAgent';

export interface DeviceUsage {
  deviceInfo: DeviceInfo;
  studentCount: number;
  studentIds: string[];
}

export interface AttemptWithDevice {
  id: string;
  student_id?: string;
  device_info?: string | null;
}

/**
 * Calculate device usage statistics for a set of exam attempts
 * Groups attempts by device identifier and counts unique students per device
 * 
 * @param attempts - Array of exam attempts with device_info field
 * @param examId - Optional exam ID to filter attempts (not used in current implementation)
 * @returns Map of device identifier to usage statistics
 * 
 * @example
 * const attempts = [
 *   { id: '1', student_id: 's1', device_info: '{"type":"mobile","manufacturer":"Apple","model":"iPhone","raw":"..."}' },
 *   { id: '2', student_id: 's2', device_info: '{"type":"mobile","manufacturer":"Apple","model":"iPhone","raw":"..."}' }
 * ];
 * const usage = getDeviceUsageCount(attempts);
 * // Returns: Map { 'Apple:iPhone' => { deviceInfo: {...}, studentCount: 2, studentIds: ['s1', 's2'] } }
 */
export function getDeviceUsageCount(
  attempts: AttemptWithDevice[],
  examId?: string
): Map<string, DeviceUsage> {
  const usageMap = new Map<string, DeviceUsage>();

  for (const attempt of attempts) {
    // Skip attempts without device info or student ID
    if (!attempt.device_info || !attempt.student_id) {
      continue;
    }

    let deviceInfo: DeviceInfo;
    
    try {
      // Parse device_info JSON string
      const parsed = JSON.parse(attempt.device_info);
      
      // Handle both direct DeviceInfo objects and nested structures
      if (parsed.type && parsed.manufacturer && parsed.model) {
        deviceInfo = parsed as DeviceInfo;
      } else if (parsed.userAgent) {
        // If we have a raw user agent, parse it
        deviceInfo = parseUserAgent(parsed.userAgent);
      } else {
        // Fallback: try to parse from raw field
        deviceInfo = parseUserAgent(parsed.raw || '');
      }
    } catch (error) {
      // If parsing fails, create unknown device info
      deviceInfo = {
        type: 'unknown',
        manufacturer: 'Unknown',
        model: 'Unknown',
        raw: attempt.device_info,
      };
    }

    // Get unique identifier for this device
    const identifier = getDeviceIdentifier(deviceInfo);

    // Get or create usage entry
    let usage = usageMap.get(identifier);
    
    if (!usage) {
      usage = {
        deviceInfo,
        studentCount: 0,
        studentIds: [],
      };
      usageMap.set(identifier, usage);
    }

    // Add student if not already counted
    if (!usage.studentIds.includes(attempt.student_id)) {
      usage.studentIds.push(attempt.student_id);
      usage.studentCount = usage.studentIds.length;
    }
  }

  return usageMap;
}

/**
 * Get usage count for a specific device from the usage map
 * 
 * @param usageMap - Map of device identifiers to usage statistics
 * @param deviceInfo - Device info to look up
 * @returns Number of unique students using this device, or 1 if not found
 */
export function getUsageCountForDevice(
  usageMap: Map<string, DeviceUsage>,
  deviceInfo: DeviceInfo
): number {
  const identifier = getDeviceIdentifier(deviceInfo);
  const usage = usageMap.get(identifier);
  return usage?.studentCount || 1;
}
