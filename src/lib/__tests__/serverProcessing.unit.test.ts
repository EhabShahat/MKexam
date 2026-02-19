/**
 * Unit Tests for Server-Side Device Info Processing
 * 
 * Tests specific examples and edge cases for:
 * - Client + server IP merging
 * - Null device info handling
 * - Invalid JSON handling
 */

import { describe, it, expect } from 'vitest';
import { mergeDeviceInfo } from '@/lib/mergeDeviceInfo';

describe('Unit Tests: Server-Side Device Info Processing', () => {
  describe('Client + Server IP Merging', () => {
    it('should merge local IPs from client with server IP', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        friendlyName: 'Test Device',
        ips: {
          ips: [
            { ip: '192.168.1.100', type: 'local', family: 'IPv4', source: 'webrtc' },
            { ip: '10.0.0.5', type: 'local', family: 'IPv4', source: 'webrtc' }
          ],
          error: null,
          completedAt: '2025-02-07T10:00:01.000Z'
        }
      };
      const serverIP = '203.0.113.45';

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      expect(merged.allIPs.local).toHaveLength(2);
      expect(merged.allIPs.local[0].ip).toBe('192.168.1.100');
      expect(merged.allIPs.local[1].ip).toBe('10.0.0.5');
      expect(merged.allIPs.public).toHaveLength(0);
      expect(merged.allIPs.server).toBe(serverIP);
      expect(merged.serverDetectedIP).toBe(serverIP);
    });

    it('should merge public IPs from client with server IP', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        friendlyName: 'Test Device',
        ips: {
          ips: [
            { ip: '203.0.113.100', type: 'public', family: 'IPv4', source: 'webrtc' }
          ],
          error: null,
          completedAt: '2025-02-07T10:00:01.000Z'
        }
      };
      const serverIP = '203.0.113.45';

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      expect(merged.allIPs.local).toHaveLength(0);
      expect(merged.allIPs.public).toHaveLength(1);
      expect(merged.allIPs.public[0].ip).toBe('203.0.113.100');
      expect(merged.allIPs.server).toBe(serverIP);
    });

    it('should merge both local and public IPs', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        friendlyName: 'Test Device',
        ips: {
          ips: [
            { ip: '192.168.1.100', type: 'local', family: 'IPv4', source: 'webrtc' },
            { ip: '203.0.113.100', type: 'public', family: 'IPv4', source: 'webrtc' },
            { ip: '10.0.0.5', type: 'local', family: 'IPv4', source: 'webrtc' }
          ],
          error: null,
          completedAt: '2025-02-07T10:00:01.000Z'
        }
      };
      const serverIP = '203.0.113.45';

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      expect(merged.allIPs.local).toHaveLength(2);
      expect(merged.allIPs.public).toHaveLength(1);
      expect(merged.allIPs.server).toBe(serverIP);
    });

    it('should handle IPv6 addresses', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        friendlyName: 'Test Device',
        ips: {
          ips: [
            { ip: '2001:0db8:85a3::8a2e:0370:7334', type: 'local', family: 'IPv6', source: 'webrtc' },
            { ip: 'fe80::1', type: 'local', family: 'IPv6', source: 'webrtc' }
          ],
          error: null,
          completedAt: '2025-02-07T10:00:01.000Z'
        }
      };
      const serverIP = '203.0.113.45';

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      expect(merged.allIPs.local).toHaveLength(2);
      expect(merged.allIPs.local[0].family).toBe('IPv6');
      expect(merged.allIPs.server).toBe(serverIP);
    });

    it('should preserve other client device info fields', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        friendlyName: 'Samsung Galaxy S21',
        ips: {
          ips: [{ ip: '192.168.1.100', type: 'local', family: 'IPv4', source: 'webrtc' }],
          error: null,
          completedAt: '2025-02-07T10:00:01.000Z'
        },
        browserDetails: {
          name: 'Chrome',
          version: '120'
        },
        platformDetails: {
          os: 'Android',
          osVersion: '13'
        },
        fingerprint: 'abc123'
      };
      const serverIP = '203.0.113.45';

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      expect(merged.friendlyName).toBe('Samsung Galaxy S21');
      expect(merged.browserDetails.name).toBe('Chrome');
      expect(merged.platformDetails.os).toBe('Android');
      expect(merged.fingerprint).toBe('abc123');
      expect(merged.collectedAt).toBe('2025-02-07T10:00:00.000Z');
    });
  });

  describe('Null Device Info Handling', () => {
    it('should handle null client device info', () => {
      const serverIP = '203.0.113.45';
      const merged = mergeDeviceInfo(null, serverIP);

      expect(merged.serverDetectedIP).toBe(serverIP);
      expect(merged.allIPs.local).toEqual([]);
      expect(merged.allIPs.public).toEqual([]);
      expect(merged.allIPs.server).toBe(serverIP);
      expect(merged.serverDetectedAt).toBeDefined();
    });

    it('should handle undefined client device info', () => {
      const serverIP = '203.0.113.45';
      const merged = mergeDeviceInfo(undefined, serverIP);

      expect(merged.serverDetectedIP).toBe(serverIP);
      expect(merged.allIPs.local).toEqual([]);
      expect(merged.allIPs.public).toEqual([]);
      expect(merged.allIPs.server).toBe(serverIP);
    });

    it('should handle empty object as client device info', () => {
      const serverIP = '203.0.113.45';
      const merged = mergeDeviceInfo({}, serverIP);

      expect(merged.serverDetectedIP).toBe(serverIP);
      expect(merged.allIPs.local).toEqual([]);
      expect(merged.allIPs.public).toEqual([]);
      expect(merged.allIPs.server).toBe(serverIP);
    });

    it('should handle client device info with no ips field', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        friendlyName: 'Test Device'
      };
      const serverIP = '203.0.113.45';

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      expect(merged.serverDetectedIP).toBe(serverIP);
      expect(merged.allIPs.local).toEqual([]);
      expect(merged.allIPs.public).toEqual([]);
      expect(merged.allIPs.server).toBe(serverIP);
      expect(merged.friendlyName).toBe('Test Device');
    });

    it('should handle client device info with empty ips array', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        friendlyName: 'Test Device',
        ips: {
          ips: [],
          error: 'WebRTC timeout',
          completedAt: '2025-02-07T10:00:01.000Z'
        }
      };
      const serverIP = '203.0.113.45';

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      expect(merged.serverDetectedIP).toBe(serverIP);
      expect(merged.allIPs.local).toEqual([]);
      expect(merged.allIPs.public).toEqual([]);
      expect(merged.allIPs.server).toBe(serverIP);
      expect(merged.ips.error).toBe('WebRTC timeout');
    });
  });

  describe('Invalid JSON Handling', () => {
    it('should handle malformed ips structure', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        ips: 'not an object'
      };
      const serverIP = '203.0.113.45';

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      expect(merged.serverDetectedIP).toBe(serverIP);
      expect(merged.allIPs.local).toEqual([]);
      expect(merged.allIPs.public).toEqual([]);
      expect(merged.allIPs.server).toBe(serverIP);
    });

    it('should handle ips.ips as non-array', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        ips: {
          ips: 'not an array',
          error: null,
          completedAt: '2025-02-07T10:00:01.000Z'
        }
      };
      const serverIP = '203.0.113.45';

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      expect(merged.serverDetectedIP).toBe(serverIP);
      expect(merged.allIPs.local).toEqual([]);
      expect(merged.allIPs.public).toEqual([]);
      expect(merged.allIPs.server).toBe(serverIP);
    });

    it('should filter out malformed IP objects', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        ips: {
          ips: [
            { ip: '192.168.1.100', type: 'local', family: 'IPv4', source: 'webrtc' },
            { ip: '10.0.0.5' }, // Missing type
            null, // Null entry
            { ip: '203.0.113.100', type: 'public', family: 'IPv4', source: 'webrtc' }
          ],
          error: null,
          completedAt: '2025-02-07T10:00:01.000Z'
        }
      };
      const serverIP = '203.0.113.45';

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      // Should only include valid IPs with type field
      expect(merged.allIPs.local).toHaveLength(1);
      expect(merged.allIPs.public).toHaveLength(1);
      expect(merged.allIPs.local[0].ip).toBe('192.168.1.100');
      expect(merged.allIPs.public[0].ip).toBe('203.0.113.100');
    });

    it('should handle circular references safely', () => {
      const clientInfo: any = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        ips: {
          ips: [],
          error: null,
          completedAt: '2025-02-07T10:00:01.000Z'
        }
      };
      // Create circular reference
      clientInfo.self = clientInfo;
      
      const serverIP = '203.0.113.45';

      // Should not throw
      expect(() => {
        const merged = mergeDeviceInfo(clientInfo, serverIP);
        expect(merged.serverDetectedIP).toBe(serverIP);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long IP arrays', () => {
      const manyIPs = Array.from({ length: 100 }, (_, i) => ({
        ip: `192.168.1.${i}`,
        type: i % 2 === 0 ? 'local' : 'public',
        family: 'IPv4',
        source: 'webrtc'
      }));

      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        ips: {
          ips: manyIPs,
          error: null,
          completedAt: '2025-02-07T10:00:01.000Z'
        }
      };
      const serverIP = '203.0.113.45';

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      expect(merged.allIPs.local).toHaveLength(50);
      expect(merged.allIPs.public).toHaveLength(50);
      expect(merged.allIPs.server).toBe(serverIP);
    });

    it('should handle special characters in server IP', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        ips: {
          ips: [],
          error: null,
          completedAt: '2025-02-07T10:00:01.000Z'
        }
      };
      const serverIP = '::1'; // IPv6 localhost

      const merged = mergeDeviceInfo(clientInfo, serverIP);

      expect(merged.serverDetectedIP).toBe('::1');
      expect(merged.allIPs.server).toBe('::1');
    });

    it('should add serverDetectedAt timestamp', () => {
      const clientInfo = {
        collectedAt: '2025-02-07T10:00:00.000Z',
        ips: {
          ips: [],
          error: null,
          completedAt: '2025-02-07T10:00:01.000Z'
        }
      };
      const serverIP = '203.0.113.45';

      const beforeMerge = Date.now();
      const merged = mergeDeviceInfo(clientInfo, serverIP);
      const afterMerge = Date.now();

      expect(merged.serverDetectedAt).toBeDefined();
      const detectedAt = new Date(merged.serverDetectedAt).getTime();
      expect(detectedAt).toBeGreaterThanOrEqual(beforeMerge);
      expect(detectedAt).toBeLessThanOrEqual(afterMerge);
    });
  });
});
