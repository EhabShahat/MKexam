/**
 * End-to-End Tests: Enhanced Device Tracking
 * 
 * These tests verify the complete flow from exam entry to database storage,
 * ensuring device information is collected, merged, and stored correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectDeviceInfoWithTimeout } from '../collectDeviceInfoWithTimeout';
import { mergeDeviceInfo } from '../mergeDeviceInfo';

describe('E2E Tests: Enhanced Device Tracking Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Flow: Exam Entry to Storage', () => {
    it('should collect device info, merge with server IP, and prepare for storage', async () => {
      // Step 1: Simulate exam entry - collect device info on client
      const clientDeviceInfo = await collectDeviceInfoWithTimeout();
      
      // Verify device info was collected
      expect(clientDeviceInfo).toBeDefined();
      expect(clientDeviceInfo).toHaveProperty('collectedAt');
      expect(clientDeviceInfo).toHaveProperty('friendlyName');
      expect(clientDeviceInfo).toHaveProperty('ips');
      
      // Step 2: Simulate server receiving the device info
      const serverIP = '203.0.113.45';
      
      // Step 3: Merge client device info with server-detected IP
      const mergedDeviceInfo = mergeDeviceInfo(clientDeviceInfo, serverIP);
      
      // Verify merged structure
      expect(mergedDeviceInfo).toHaveProperty('serverDetectedIP', serverIP);
      expect(mergedDeviceInfo).toHaveProperty('serverDetectedAt');
      expect(mergedDeviceInfo).toHaveProperty('allIPs');
      expect(mergedDeviceInfo.allIPs).toHaveProperty('server', serverIP);
      
      // Step 4: Verify data is ready for database storage
      const jsonString = JSON.stringify(mergedDeviceInfo);
      expect(() => JSON.parse(jsonString)).not.toThrow();
      
      // Verify all required sections exist
      expect(mergedDeviceInfo).toHaveProperty('browserDetails');
      expect(mergedDeviceInfo).toHaveProperty('platformDetails');
      expect(mergedDeviceInfo).toHaveProperty('security');
      expect(mergedDeviceInfo).toHaveProperty('timezone'); // locale info
      expect(mergedDeviceInfo).toHaveProperty('screen'); // hardware info
    });

    it('should handle WebRTC IP discovery in the flow', async () => {
      // Collect device info with potential WebRTC IPs
      const deviceInfo = await collectDeviceInfoWithTimeout();
      
      // Check if WebRTC discovery was attempted
      expect(deviceInfo.ips).toBeDefined();
      expect(deviceInfo.ips).toHaveProperty('completedAt');
      
      // Merge with server IP
      const serverIP = '198.51.100.42';
      const merged = mergeDeviceInfo(deviceInfo, serverIP);
      
      // Verify allIPs structure contains all IP sources
      expect(merged.allIPs).toHaveProperty('local');
      expect(merged.allIPs).toHaveProperty('public');
      expect(merged.allIPs).toHaveProperty('server', serverIP);
      
      // Verify local IPs are arrays
      expect(Array.isArray(merged.allIPs.local)).toBe(true);
      expect(Array.isArray(merged.allIPs.public)).toBe(true);
    });

    it('should maintain backward compatibility with old format', async () => {
      // Simulate old client that doesn't send device info
      const clientDeviceInfo = null;
      const serverIP = '192.0.2.100';
      
      // Server should handle null gracefully
      const merged = mergeDeviceInfo(clientDeviceInfo, serverIP);
      
      // Verify fallback structure
      expect(merged).toHaveProperty('serverDetectedIP', serverIP);
      expect(merged).toHaveProperty('allIPs');
      expect(merged.allIPs.server).toBe(serverIP);
      expect(merged.allIPs.local).toEqual([]);
      expect(merged.allIPs.public).toEqual([]);
    });
  });

  describe('IP Capture Verification', () => {
    it('should capture local IPs when WebRTC succeeds', async () => {
      const deviceInfo = await collectDeviceInfoWithTimeout();
      
      // WebRTC may or may not succeed in test environment
      // But the structure should always be present
      expect(deviceInfo.ips).toBeDefined();
      expect(deviceInfo.ips.ips).toBeDefined();
      expect(Array.isArray(deviceInfo.ips.ips)).toBe(true);
      
      // If IPs were discovered, verify structure
      if (deviceInfo.ips.ips.length > 0) {
        const ip = deviceInfo.ips.ips[0];
        expect(ip).toHaveProperty('ip');
        expect(ip).toHaveProperty('type');
        expect(ip).toHaveProperty('family');
        expect(ip).toHaveProperty('source', 'webrtc');
        expect(['local', 'public']).toContain(ip.type);
        expect(['IPv4', 'IPv6']).toContain(ip.family);
      }
    });

    it('should always have server IP after merging', async () => {
      const deviceInfo = await collectDeviceInfoWithTimeout();
      const serverIP = '203.0.113.99';
      const merged = mergeDeviceInfo(deviceInfo, serverIP);
      
      // Server IP should always be present
      expect(merged.serverDetectedIP).toBe(serverIP);
      expect(merged.allIPs.server).toBe(serverIP);
    });

    it('should handle both IPv4 and IPv6 server IPs', async () => {
      const deviceInfo = await collectDeviceInfoWithTimeout();
      
      // Test IPv4
      const ipv4 = '192.168.1.1';
      const merged4 = mergeDeviceInfo(deviceInfo, ipv4);
      expect(merged4.allIPs.server).toBe(ipv4);
      
      // Test IPv6
      const ipv6 = '2001:db8::1';
      const merged6 = mergeDeviceInfo(deviceInfo, ipv6);
      expect(merged6.allIPs.server).toBe(ipv6);
    });
  });

  describe('Data Structure Verification', () => {
    it('should have all required sections after collection', async () => {
      const deviceInfo = await collectDeviceInfoWithTimeout();
      
      // Required top-level fields
      expect(deviceInfo).toHaveProperty('collectedAt');
      expect(deviceInfo).toHaveProperty('friendlyName');
      expect(deviceInfo).toHaveProperty('ips');
      
      // Required sections
      expect(deviceInfo).toHaveProperty('browserDetails');
      expect(deviceInfo).toHaveProperty('platformDetails');
      expect(deviceInfo).toHaveProperty('security');
      expect(deviceInfo).toHaveProperty('timezone'); // locale info
      expect(deviceInfo).toHaveProperty('location');
      expect(deviceInfo).toHaveProperty('screen'); // hardware info
      expect(deviceInfo).toHaveProperty('deviceMemory'); // hardware info
      expect(deviceInfo).toHaveProperty('hardwareConcurrency'); // hardware info
      
      // Optional sections (may be null)
      expect(deviceInfo).toHaveProperty('network');
      expect(deviceInfo).toHaveProperty('battery');
      expect(deviceInfo).toHaveProperty('gpu');
    });

    it('should use null for unavailable data, not undefined', async () => {
      const deviceInfo = await collectDeviceInfoWithTimeout();
      
      // Check that no values are undefined
      const checkNoUndefined = (obj: any, path: string = 'root') => {
        for (const key in obj) {
          const value = obj[key];
          const currentPath = `${path}.${key}`;
          
          // undefined is not allowed, null is fine
          if (value === undefined) {
            throw new Error(`Found undefined at ${currentPath}`);
          }
          
          // Recursively check objects
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            checkNoUndefined(value, currentPath);
          }
        }
      };
      
      expect(() => checkNoUndefined(deviceInfo)).not.toThrow();
    });

    it('should be JSON serializable', async () => {
      const deviceInfo = await collectDeviceInfoWithTimeout();
      const serverIP = '198.51.100.1';
      const merged = mergeDeviceInfo(deviceInfo, serverIP);
      
      // Should serialize without errors
      const json = JSON.stringify(merged);
      expect(json).toBeDefined();
      expect(json.length).toBeGreaterThan(0);
      
      // Should deserialize correctly
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(merged);
    });
  });

  describe('Timeout and Error Handling', () => {
    it('should complete within timeout period', async () => {
      const startTime = Date.now();
      const deviceInfo = await collectDeviceInfoWithTimeout();
      const duration = Date.now() - startTime;
      
      // Should complete within 10 seconds (with some buffer)
      expect(duration).toBeLessThan(12000);
      expect(deviceInfo).toBeDefined();
    });

    it('should return partial data if collection times out', async () => {
      // Use very short timeout to force partial data
      const deviceInfo = await collectDeviceInfoWithTimeout({ timeout: 100 });
      
      // Should still return a valid structure
      expect(deviceInfo).toBeDefined();
      expect(deviceInfo).toHaveProperty('collectedAt');
      expect(deviceInfo).toHaveProperty('friendlyName');
    });

    it('should not throw errors even with minimal browser APIs', async () => {
      // This test runs in jsdom which has limited APIs
      // Should handle gracefully
      await expect(collectDeviceInfoWithTimeout()).resolves.toBeDefined();
    });
  });

  describe('Security and Fingerprinting', () => {
    it('should include security indicators', async () => {
      const deviceInfo = await collectDeviceInfoWithTimeout();
      
      expect(deviceInfo.security).toBeDefined();
      expect(deviceInfo.security).toHaveProperty('webdriver');
      expect(deviceInfo.security).toHaveProperty('cookiesEnabled');
      expect(deviceInfo.security).toHaveProperty('automationRisk');
      
      // Values should be booleans
      expect(typeof deviceInfo.security.webdriver).toBe('boolean');
      expect(typeof deviceInfo.security.cookiesEnabled).toBe('boolean');
      expect(typeof deviceInfo.security.automationRisk).toBe('boolean');
    });

    it('should generate fingerprint', async () => {
      const deviceInfo = await collectDeviceInfoWithTimeout();
      
      // Fingerprint may be null in test environment (no canvas)
      // But the field should exist
      expect(deviceInfo).toHaveProperty('fingerprint');
      
      if (deviceInfo.fingerprint !== null) {
        // If generated, should be a string
        expect(typeof deviceInfo.fingerprint).toBe('string');
        expect(deviceInfo.fingerprint.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Browser Compatibility', () => {
    it('should work without WebRTC support', async () => {
      // jsdom doesn't have RTCPeerConnection
      const deviceInfo = await collectDeviceInfoWithTimeout();
      
      // Should still collect other information
      expect(deviceInfo).toBeDefined();
      expect(deviceInfo.ips).toBeDefined();
      
      // WebRTC error should be noted
      if (deviceInfo.ips.ips.length === 0) {
        expect(deviceInfo.ips.error).toBeDefined();
      }
    });

    it('should work without geolocation support', async () => {
      // jsdom doesn't have geolocation
      const deviceInfo = await collectDeviceInfoWithTimeout();
      
      // Should still collect other information
      expect(deviceInfo).toBeDefined();
      expect(deviceInfo.location).toBeDefined();
      
      // Location should have error or be null
      if (deviceInfo.location.latitude === null) {
        expect(deviceInfo.location.error).toBeDefined();
      }
    });

    it('should work without Client Hints support', async () => {
      // jsdom doesn't have userAgentData
      const deviceInfo = await collectDeviceInfoWithTimeout();
      
      // Should still collect other information
      expect(deviceInfo).toBeDefined();
      
      // Client hints will be null
      expect(deviceInfo.clientHints).toBeNull();
      
      // But should still have browser/platform details from UA parsing
      expect(deviceInfo.browserDetails).toBeDefined();
      expect(deviceInfo.platformDetails).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should collect device info efficiently', async () => {
      const iterations = 5;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await collectDeviceInfoWithTimeout();
        times.push(Date.now() - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      // Average should be reasonable (under 5 seconds in test environment)
      expect(avgTime).toBeLessThan(5000);
    });

    it('should handle concurrent collections', async () => {
      // Simulate multiple students starting exams simultaneously
      const promises = Array(3).fill(null).map(() => 
        collectDeviceInfoWithTimeout()
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result).toHaveProperty('collectedAt');
      });
    });
  });
});
