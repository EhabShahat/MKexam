/**
 * Property-Based Tests for WebRTC IP Discovery
 * Feature: enhanced-device-tracking
 * 
 * Property 1: WebRTC IP Discovery Attempt
 * Property 2: Complete IP Capture
 * Property 5: IP Discovery Timeout
 * 
 * Validates: Requirements 1.1, 1.2, 1.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { discoverIPs, parseICECandidate, type DiscoveredIP } from '../webrtcIpDiscovery';

describe('WebRTC IP Discovery - Property-Based Tests', () => {
  describe('Property 1: WebRTC IP Discovery Attempt', () => {
    it('should always return a result with completedAt timestamp regardless of success or failure', async () => {
      // Test with various timeout values
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 5000 }),
          async (timeout) => {
            const result = await discoverIPs(timeout);
            
            // Should always have these fields
            expect(result).toHaveProperty('ips');
            expect(result).toHaveProperty('error');
            expect(result).toHaveProperty('completedAt');
            
            // completedAt should be a valid ISO timestamp
            expect(result.completedAt).toBeDefined();
            expect(typeof result.completedAt).toBe('string');
            const date = new Date(result.completedAt);
            expect(isNaN(date.getTime())).toBe(false);
            
            // ips should be an array (may be empty)
            expect(Array.isArray(result.ips)).toBe(true);
            
            // error should be string or null
            expect(result.error === null || typeof result.error === 'string').toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should complete within reasonable time even with varying timeouts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 500, max: 3000 }),
          async (timeout) => {
            const startTime = Date.now();
            const result = await discoverIPs(timeout);
            const elapsed = Date.now() - startTime;
            
            // Should complete within timeout + 500ms buffer
            expect(elapsed).toBeLessThan(timeout + 500);
            
            // Should have completed timestamp
            expect(result.completedAt).toBeDefined();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return consistent structure across multiple calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(1000),
          async (timeout) => {
            const result1 = await discoverIPs(timeout);
            const result2 = await discoverIPs(timeout);
            
            // Both should have same structure
            expect(typeof result1).toBe(typeof result2);
            expect(Array.isArray(result1.ips)).toBe(Array.isArray(result2.ips));
            expect(result1.error === null || typeof result1.error === 'string').toBe(true);
            expect(result2.error === null || typeof result2.error === 'string').toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 2: Complete IP Capture', () => {
    it('should categorize all discovered IPs with correct type and family', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(3000),
          async (timeout) => {
            const result = await discoverIPs(timeout);
            
            // For each discovered IP
            result.ips.forEach((ip: DiscoveredIP) => {
              // Should have all required fields
              expect(ip).toHaveProperty('ip');
              expect(ip).toHaveProperty('type');
              expect(ip).toHaveProperty('family');
              expect(ip).toHaveProperty('source');
              
              // Type should be valid
              expect(['local', 'public']).toContain(ip.type);
              
              // Family should be valid
              expect(['IPv4', 'IPv6']).toContain(ip.family);
              
              // Source should be webrtc
              expect(ip.source).toBe('webrtc');
              
              // IP should be non-empty string
              expect(typeof ip.ip).toBe('string');
              expect(ip.ip.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should not contain duplicate IP addresses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(3000),
          async (timeout) => {
            const result = await discoverIPs(timeout);
            
            const ipAddresses = result.ips.map(ip => ip.ip);
            const uniqueIPs = new Set(ipAddresses);
            
            // No duplicates
            expect(ipAddresses.length).toBe(uniqueIPs.size);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should validate IP format for IPv4 addresses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(3000),
          async (timeout) => {
            const result = await discoverIPs(timeout);
            
            const ipv4Addresses = result.ips.filter(ip => ip.family === 'IPv4');
            
            ipv4Addresses.forEach(ip => {
              // IPv4 format: xxx.xxx.xxx.xxx
              const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
              expect(ipv4Regex.test(ip.ip)).toBe(true);
              
              // Each octet should be 0-255
              const octets = ip.ip.split('.').map(Number);
              octets.forEach(octet => {
                expect(octet).toBeGreaterThanOrEqual(0);
                expect(octet).toBeLessThanOrEqual(255);
              });
            });
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should validate IP format for IPv6 addresses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(3000),
          async (timeout) => {
            const result = await discoverIPs(timeout);
            
            const ipv6Addresses = result.ips.filter(ip => ip.family === 'IPv6');
            
            ipv6Addresses.forEach(ip => {
              // IPv6 should contain colons
              expect(ip.ip).toContain(':');
              
              // Should be valid hex characters and colons
              const ipv6Regex = /^[a-f0-9:]+$/i;
              expect(ipv6Regex.test(ip.ip)).toBe(true);
            });
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 5: IP Discovery Timeout', () => {
    it('should complete within specified timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 500, max: 2000 }),
          async (timeout) => {
            const startTime = Date.now();
            const result = await discoverIPs(timeout);
            const elapsed = Date.now() - startTime;
            
            // Should complete within timeout + 200ms buffer for processing
            expect(elapsed).toBeLessThan(timeout + 200);
            
            // Should have a result
            expect(result).toBeDefined();
            expect(result.completedAt).toBeDefined();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should complete within 5 seconds for default timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(undefined),
          async () => {
            const startTime = Date.now();
            const result = await discoverIPs(); // Default timeout
            const elapsed = Date.now() - startTime;
            
            // Default is 5000ms, should complete within 5200ms
            expect(elapsed).toBeLessThan(5200);
            
            // Should have a result
            expect(result).toBeDefined();
            expect(result.completedAt).toBeDefined();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle very short timeouts gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }),
          async (timeout) => {
            const startTime = Date.now();
            const result = await discoverIPs(timeout);
            const elapsed = Date.now() - startTime;
            
            // Should complete quickly
            expect(elapsed).toBeLessThan(timeout + 200);
            
            // Should still return valid structure
            expect(result).toHaveProperty('ips');
            expect(result).toHaveProperty('error');
            expect(result).toHaveProperty('completedAt');
            
            // May have timeout error or WebRTC not supported error (in Node.js environment)
            if (result.ips.length === 0) {
              expect(result.error).toBeTruthy();
              // In Node.js environment, WebRTC is not supported
              // In browser environment, would get timeout error
              expect(
                result.error.includes('timeout') || 
                result.error.includes('WebRTC not supported')
              ).toBe(true);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return partial results if timeout occurs during gathering', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 500 }),
          async (timeout) => {
            const result = await discoverIPs(timeout);
            
            // If we have IPs but also an error, it's partial results
            if (result.ips.length > 0 && result.error) {
              expect(result.error).toContain('timeout');
            }
            
            // Structure should always be valid
            expect(Array.isArray(result.ips)).toBe(true);
            expect(result.completedAt).toBeDefined();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should not hang indefinitely regardless of timeout value', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          async (timeout) => {
            const maxWait = Math.max(timeout + 1000, 11000);
            
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Test timeout - function hung')), maxWait);
            });
            
            const discoveryPromise = discoverIPs(timeout);
            
            // Should resolve before test timeout
            const result = await Promise.race([discoveryPromise, timeoutPromise]);
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('completedAt');
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
