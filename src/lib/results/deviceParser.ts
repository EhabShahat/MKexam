/**
 * Device Info Parser Module
 * 
 * Functions for parsing device information from JSON strings and calculating
 * device usage statistics. Handles both modern and legacy device info formats.
 * 
 * Requirements: 12.1-12.9, 3.10
 */

import type { DeviceInfo, Attempt } from './types';

/**
 * Parse device_info JSON string into structured DeviceInfo object
 * Handles both modern and legacy formats gracefully
 * 
 * @param deviceInfoJson - JSON string from device_info field
 * @returns Parsed device information
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8
 */
export function parseDeviceInfo(deviceInfoJson: string | null): DeviceInfo {
  // Default fallback for null or invalid input
  const defaultInfo: DeviceInfo = {
    type: 'unknown',
    model: 'Unknown',
    local_ip: '',
    server_ip: '',
    automation_risk: false,
  };

  if (!deviceInfoJson) {
    return defaultInfo;
  }

  try {
    // Parse JSON string
    const parsed = typeof deviceInfoJson === 'string' 
      ? JSON.parse(deviceInfoJson) 
      : deviceInfoJson;

    // Extract device type
    let deviceType: DeviceInfo['type'] = 'unknown';
    if (parsed.type) {
      const typeStr = String(parsed.type).toLowerCase();
      if (['mobile', 'tablet', 'desktop'].includes(typeStr)) {
        deviceType = typeStr as DeviceInfo['type'];
      }
    } else if (parsed.device?.type) {
      // Legacy format: device.type
      const typeStr = String(parsed.device.type).toLowerCase();
      if (['mobile', 'tablet', 'desktop'].includes(typeStr)) {
        deviceType = typeStr as DeviceInfo['type'];
      }
    }

    // Extract device model
    let deviceModel = 'Unknown';
    
    // Try modern format: friendlyName
    if (parsed.friendlyName && typeof parsed.friendlyName === 'string') {
      deviceModel = parsed.friendlyName;
    }
    // Try modern format: oem.brand + oem.model
    else if (parsed.oem?.brand || parsed.oem?.model) {
      const brand = parsed.oem.brand || '';
      const model = parsed.oem.model || '';
      deviceModel = `${brand} ${model}`.trim() || 'Unknown';
    }
    // Try legacy format: device.manufacturer + device.model
    else if (parsed.device?.manufacturer || parsed.device?.model) {
      const manufacturer = parsed.device.manufacturer || '';
      const model = parsed.device.model || '';
      deviceModel = `${manufacturer} ${model}`.trim() || 'Unknown';
    }
    // Try legacy format: model field
    else if (parsed.model && typeof parsed.model === 'string') {
      deviceModel = parsed.model;
    }

    // Extract local IP address
    let localIP = '';
    
    // Try modern format: allIPs.local array
    if (parsed.allIPs?.local && Array.isArray(parsed.allIPs.local)) {
      localIP = parsed.allIPs.local[0] || '';
    }
    // Try legacy format: ips.local array
    else if (parsed.ips?.local && Array.isArray(parsed.ips.local)) {
      localIP = parsed.ips.local[0] || '';
    }
    // Try legacy format: localIP field
    else if (parsed.localIP && typeof parsed.localIP === 'string') {
      localIP = parsed.localIP;
    }

    // Extract server IP address (from allIPs.public or top-level ip_address)
    let serverIP = '';
    
    // Try modern format: allIPs.public array
    if (parsed.allIPs?.public && Array.isArray(parsed.allIPs.public)) {
      serverIP = parsed.allIPs.public[0] || '';
    }
    // Try legacy format: ips.public array
    else if (parsed.ips?.public && Array.isArray(parsed.ips.public)) {
      serverIP = parsed.ips.public[0] || '';
    }
    // Try legacy format: ip field
    else if (parsed.ip && typeof parsed.ip === 'string') {
      serverIP = parsed.ip;
    }

    // Extract automation risk
    let automationRisk = false;
    
    // Try modern format: security.automationRisk
    if (parsed.security?.automationRisk === true) {
      automationRisk = true;
    }
    // Try modern format: security.webdriver
    else if (parsed.security?.webdriver === true) {
      automationRisk = true;
    }
    // Try legacy format: automationRisk field
    else if (parsed.automationRisk === true) {
      automationRisk = true;
    }
    // Try legacy format: webdriver field
    else if (parsed.webdriver === true) {
      automationRisk = true;
    }

    return {
      type: deviceType,
      model: deviceModel,
      local_ip: localIP,
      server_ip: serverIP,
      automation_risk: automationRisk,
    };
  } catch (error) {
    // Handle malformed JSON gracefully
    console.warn('Failed to parse device_info:', error);
    return defaultInfo;
  }
}

/**
 * Generate device fingerprint for matching duplicate devices
 * Uses combination of device type, model, and local IP
 * 
 * @param deviceInfo - Parsed device information
 * @returns Fingerprint string for matching
 * 
 * Requirements: 12.7
 */
export function generateDeviceFingerprint(deviceInfo: DeviceInfo): string {
  // Combine key identifying fields
  const parts = [
    deviceInfo.type,
    deviceInfo.model.toLowerCase(),
    deviceInfo.local_ip,
  ];
  
  return parts.filter(Boolean).join('|');
}

/**
 * Calculate device usage counts across all attempts
 * Groups attempts by device fingerprint
 * 
 * @param attempts - Array of attempts to analyze
 * @returns Map of fingerprint to usage count
 * 
 * Requirements: 12.7, 3.10
 */
export function calculateDeviceUsage(
  attempts: Attempt[]
): Map<string, number> {
  const usageMap = new Map<string, number>();

  for (const attempt of attempts) {
    const deviceInfo = parseDeviceInfo(attempt.device_info);
    const fingerprint = generateDeviceFingerprint(deviceInfo);
    
    if (fingerprint) {
      const currentCount = usageMap.get(fingerprint) || 0;
      usageMap.set(fingerprint, currentCount + 1);
    }
  }

  return usageMap;
}

/**
 * Get usage count for a specific device
 * 
 * @param deviceInfo - Parsed device information
 * @param usageMap - Map of fingerprint to usage count
 * @returns Usage count for this device
 * 
 * Requirements: 12.7, 3.10
 */
export function getDeviceUsageCount(
  deviceInfo: DeviceInfo,
  usageMap: Map<string, number>
): number {
  const fingerprint = generateDeviceFingerprint(deviceInfo);
  return usageMap.get(fingerprint) || 0;
}

/**
 * Calculate IP address usage counts across all attempts
 * 
 * @param attempts - Array of attempts to analyze
 * @returns Map of IP address to usage count
 * 
 * Requirements: 3.8
 */
export function calculateIPUsage(
  attempts: Attempt[]
): Map<string, number> {
  const usageMap = new Map<string, number>();

  for (const attempt of attempts) {
    if (attempt.ip_address) {
      const currentCount = usageMap.get(attempt.ip_address) || 0;
      usageMap.set(attempt.ip_address, currentCount + 1);
    }
  }

  return usageMap;
}

/**
 * Get usage count for a specific IP address
 * 
 * @param ipAddress - IP address to check
 * @param usageMap - Map of IP address to usage count
 * @returns Usage count for this IP
 * 
 * Requirements: 3.8
 */
export function getIPUsageCount(
  ipAddress: string | null,
  usageMap: Map<string, number>
): number {
  if (!ipAddress) {
    return 0;
  }
  return usageMap.get(ipAddress) || 0;
}
