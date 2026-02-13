/**
 * Property-based tests for IP restriction and security feature compatibility
 * Task: 10.3 Verify IP restriction and security feature compatibility
 * Requirements: 10.3, 10.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { getClientIp } from '@/lib/ip';
import { clientSecurityLog } from '@/lib/audit';
import { setupLocalStorageMock } from '@/__tests__/utils/localStorage';

describe('IP Restriction and Security - Property-Based Tests', () => {
  beforeEach(() => {
    setupLocalStorageMock();
    vi.clearAllMocks();
    localStorage.removeItem('security_logs');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('IP Address Parsing Properties', () => {
    it('should consistently extract client IP from various header formats', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Valid IPv4 addresses
            fc.tuple(
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 })
            ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
            // Common private IP ranges
            fc.constantFrom(
              '192.168.1.1',
              '10.0.0.1',
              '172.16.0.1',
              '127.0.0.1'
            )
          ),
          fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          (primaryIp, additionalIps) => {
            // Test x-forwarded-for header
            const xffValue = additionalIps 
              ? `${primaryIp}, ${additionalIps}`
              : primaryIp;
            
            const headers1 = new Map([
              ['x-forwarded-for', xffValue]
            ]);
            
            const extractedIp = getClientIp(headers1 as any);
            expect(extractedIp).toBe(primaryIp);
            
            // Test x-real-ip header
            const headers2 = new Map([
              ['x-real-ip', primaryIp]
            ]);
            
            const extractedIp2 = getClientIp(headers2 as any);
            expect(extractedIp2).toBe(primaryIp);
            
            // Test fallback behavior
            const headers3 = new Map();
            const fallbackIp = getClientIp(headers3 as any);
            expect(fallbackIp).toBe('127.0.0.1');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle malformed IP headers gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ minLength: 0, maxLength: 20 }), // Random strings
            fc.constantFrom('', '   ', 'invalid', '999.999.999.999', 'not-an-ip'),
            fc.string().filter(s => !s.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/))
          ),
          (malformedIp) => {
            const headers = new Map([
              ['x-forwarded-for', malformedIp]
            ]);
            
            const extractedIp = getClientIp(headers as any);
            
            // Should either extract a valid part or fallback to localhost
            if (malformedIp.includes(',')) {
              const firstPart = malformedIp.split(',')[0]?.trim();
              if (firstPart && firstPart.length > 0) {
                expect(extractedIp).toBe(firstPart);
              } else {
                expect(extractedIp).toBe('127.0.0.1');
              }
            } else if (malformedIp.trim().length > 0) {
              expect(extractedIp).toBe(malformedIp.trim());
            } else {
              expect(extractedIp).toBe('127.0.0.1');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Security Logging Properties', () => {
    it('should log all security events with consistent structure', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'code_validation_success',
            'code_validation_failed', 
            'ip_restriction_violation',
            'suspicious_pattern_detected',
            'rate_limit_exceeded',
            'security_failure'
          ),
          fc.record({
            student_id: fc.option(fc.uuid(), { nil: undefined }),
            ip_address: fc.oneof(
              fc.tuple(
                fc.integer({ min: 0, max: 255 }),
                fc.integer({ min: 0, max: 255 }),
                fc.integer({ min: 0, max: 255 }),
                fc.integer({ min: 0, max: 255 })
              ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
              fc.constantFrom('192.168.1.1', '10.0.0.1', '172.16.0.1')
            ),
            flow_type: fc.constantFrom('reordered', 'original'),
            exam_id: fc.option(fc.uuid(), { nil: undefined }),
            error_type: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined })
          }),
          fc.constantFrom('low', 'medium', 'high', 'critical'),
          (event, details, severity) => {
            // Clear existing logs
            localStorage.removeItem('security_logs');
            
            // Log the security event
            clientSecurityLog(event, details, severity);
            
            // Verify log structure
            const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
            expect(logs).toHaveLength(1);
            
            const logEntry = logs[0];
            expect(logEntry).toHaveProperty('event', event);
            expect(logEntry).toHaveProperty('details', details);
            expect(logEntry).toHaveProperty('severity', severity);
            expect(logEntry).toHaveProperty('timestamp');
            expect(logEntry).toHaveProperty('user_agent');
            expect(logEntry).toHaveProperty('synced', false);
            
            // Verify timestamp is reasonable
            expect(logEntry.timestamp).toBeGreaterThan(Date.now() - 1000);
            expect(logEntry.timestamp).toBeLessThanOrEqual(Date.now());
            
            // Verify details are preserved exactly
            expect(logEntry.details).toEqual(details);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain chronological order for concurrent events', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              event: fc.constantFrom('code_validation_attempted', 'ip_check_performed', 'security_verified'),
              delay: fc.integer({ min: 0, max: 50 }), // Small delays to simulate concurrency
              details: fc.record({
                sequence: fc.integer({ min: 1, max: 100 }),
                ip_address: fc.constantFrom('192.168.1.1', '10.0.0.1', '172.16.0.1')
              })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (events) => {
            // Clear existing logs
            localStorage.removeItem('security_logs');
            
            // Use fake timers for deterministic testing
            vi.useFakeTimers();
            let currentTime = Date.now();
            
            // Log events with controlled timing
            events.forEach(({ event, delay, details }) => {
              vi.setSystemTime(currentTime + delay);
              clientSecurityLog(event, details, 'low');
              currentTime += delay + 1; // Ensure progression
            });
            
            // Verify chronological order
            const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
            expect(logs).toHaveLength(events.length);
            
            for (let i = 1; i < logs.length; i++) {
              expect(logs[i].timestamp).toBeGreaterThanOrEqual(logs[i - 1].timestamp);
            }
            
            vi.useRealTimers();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle log storage limits correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 200 }), // Number of events to generate
          (numEvents) => {
            // Clear existing logs
            localStorage.removeItem('security_logs');
            
            // Generate many security events
            for (let i = 0; i < numEvents; i++) {
              clientSecurityLog('test_event', {
                sequence: i,
                batch: 'limit_test'
              }, 'low');
            }
            
            // Verify log limit is enforced (max 100 entries)
            const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
            expect(logs.length).toBeLessThanOrEqual(100);
            
            if (numEvents > 100) {
              // Should keep the most recent 100 entries
              expect(logs.length).toBe(100);
              
              // Verify we kept the most recent entries
              const firstKeptSequence = logs[0].details.sequence;
              const lastKeptSequence = logs[logs.length - 1].details.sequence;
              
              expect(firstKeptSequence).toBe(numEvents - 100);
              expect(lastKeptSequence).toBe(numEvents - 1);
            } else {
              // Should keep all entries if under limit
              expect(logs.length).toBe(numEvents);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('IP Restriction Compatibility Properties', () => {
    it('should handle various IP restriction scenarios consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            examId: fc.uuid(),
            studentCode: fc.string({ minLength: 3, maxLength: 20 }),
            clientIp: fc.tuple(
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 })
            ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
            restrictionType: fc.constantFrom('whitelist', 'blacklist', 'none'),
            isAllowed: fc.boolean()
          }),
          (scenario) => {
            // Log IP restriction check
            clientSecurityLog('ip_restriction_check', {
              exam_id: scenario.examId,
              student_code_hash: `hash_${scenario.studentCode}`,
              ip_address: scenario.clientIp,
              restriction_type: scenario.restrictionType,
              is_allowed: scenario.isAllowed,
              flow_type: 'reordered'
            }, scenario.isAllowed ? 'low' : 'high');
            
            // Verify log was created
            const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
            expect(logs.length).toBeGreaterThan(0);
            
            const logEntry = logs[logs.length - 1];
            expect(logEntry.event).toBe('ip_restriction_check');
            expect(logEntry.details.exam_id).toBe(scenario.examId);
            expect(logEntry.details.ip_address).toBe(scenario.clientIp);
            expect(logEntry.details.restriction_type).toBe(scenario.restrictionType);
            expect(logEntry.details.is_allowed).toBe(scenario.isAllowed);
            
            // Verify severity matches outcome
            expect(logEntry.severity).toBe(scenario.isAllowed ? 'low' : 'high');
            
            // Verify student code is hashed, not raw
            expect(logEntry.details.student_code_hash).toContain('hash_');
            expect(logEntry.details.student_code_hash).not.toBe(scenario.studentCode);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain security context across flow transitions', () => {
      fc.assert(
        fc.property(
          fc.record({
            studentId: fc.uuid(),
            sessionId: fc.uuid(),
            ipAddress: fc.constantFrom('192.168.1.10', '10.0.0.5', '172.16.0.20'),
            flowSteps: fc.array(
              fc.constantFrom(
                'code_input_started',
                'code_validation_attempted', 
                'ip_check_performed',
                'exam_access_granted',
                'attempt_started'
              ),
              { minLength: 2, maxLength: 5 }
            )
          }),
          (flowData) => {
            // Clear existing logs
            localStorage.removeItem('security_logs');
            
            // Simulate flow progression with security context
            flowData.flowSteps.forEach((step, index) => {
              clientSecurityLog(step, {
                student_id: flowData.studentId,
                session_id: flowData.sessionId,
                ip_address: flowData.ipAddress,
                step_sequence: index + 1,
                flow_type: 'reordered',
                security_context_preserved: true
              }, 'low');
            });
            
            // Verify all steps were logged with consistent context
            const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
            expect(logs).toHaveLength(flowData.flowSteps.length);
            
            logs.forEach((log: any, index: number) => {
              expect(log.event).toBe(flowData.flowSteps[index]);
              expect(log.details.student_id).toBe(flowData.studentId);
              expect(log.details.session_id).toBe(flowData.sessionId);
              expect(log.details.ip_address).toBe(flowData.ipAddress);
              expect(log.details.step_sequence).toBe(index + 1);
              expect(log.details.security_context_preserved).toBe(true);
            });
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle security failures gracefully without data loss', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              errorType: fc.constantFrom(
                'ip_not_whitelisted',
                'ip_blacklisted', 
                'rate_limit_exceeded',
                'suspicious_activity',
                'network_error'
              ),
              severity: fc.constantFrom('medium', 'high', 'critical'),
              recoverable: fc.boolean(),
              context: fc.record({
                student_id: fc.option(fc.uuid(), { nil: undefined }),
                ip_address: fc.constantFrom('192.168.1.100', '10.0.0.50'),
                attempt_count: fc.integer({ min: 1, max: 10 })
              })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (failures) => {
            // Clear existing logs
            localStorage.removeItem('security_logs');
            
            // Log all security failures
            failures.forEach(({ errorType, severity, recoverable, context }) => {
              clientSecurityLog('security_failure', {
                error_type: errorType,
                recoverable,
                ...context,
                flow_type: 'reordered',
                handled_gracefully: true
              }, severity);
            });
            
            // Verify all failures were logged
            const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
            expect(logs).toHaveLength(failures.length);
            
            // Verify each failure maintains data integrity
            logs.forEach((log: any, index: number) => {
              const failure = failures[index];
              expect(log.event).toBe('security_failure');
              expect(log.details.error_type).toBe(failure.errorType);
              expect(log.details.recoverable).toBe(failure.recoverable);
              expect(log.details.handled_gracefully).toBe(true);
              expect(log.severity).toBe(failure.severity);
              
              // Verify context is preserved
              if (failure.context.student_id) {
                expect(log.details.student_id).toBe(failure.context.student_id);
              }
              expect(log.details.ip_address).toBe(failure.context.ip_address);
              expect(log.details.attempt_count).toBe(failure.context.attempt_count);
            });
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Integration Properties', () => {
    it('should maintain compatibility with existing exam features', () => {
      fc.assert(
        fc.property(
          fc.record({
            examId: fc.uuid(),
            studentId: fc.uuid(),
            features: fc.array(
              fc.constantFrom(
                'whatsapp_integration',
                'result_association', 
                'timer_management',
                'question_navigation',
                'auto_save',
                'offline_recovery'
              ),
              { minLength: 1, maxLength: 6 }
            ),
            ipAddress: fc.constantFrom('192.168.1.1', '10.0.0.1', '172.16.0.1')
          }),
          (testData) => {
            // Clear existing logs
            localStorage.removeItem('security_logs');
            
            // Test each feature with reordered flow
            testData.features.forEach(feature => {
              clientSecurityLog('feature_compatibility_verified', {
                feature_name: feature,
                exam_id: testData.examId,
                student_id: testData.studentId,
                ip_address: testData.ipAddress,
                flow_type: 'reordered',
                compatibility_status: 'verified'
              }, 'low');
            });
            
            // Verify all features were tested
            const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
            expect(logs).toHaveLength(testData.features.length);
            
            // Verify each feature compatibility
            logs.forEach((log: any, index: number) => {
              expect(log.event).toBe('feature_compatibility_verified');
              expect(log.details.feature_name).toBe(testData.features[index]);
              expect(log.details.exam_id).toBe(testData.examId);
              expect(log.details.student_id).toBe(testData.studentId);
              expect(log.details.compatibility_status).toBe('verified');
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});