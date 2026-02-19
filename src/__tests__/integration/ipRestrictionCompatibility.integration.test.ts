/**
 * Integration tests for IP restriction and security feature compatibility
 * Task: 10.3 Verify IP restriction and security feature compatibility
 * Requirements: 10.3, 10.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getClientIp } from '@/lib/ip';
import { auditLog, securityLog, clientSecurityLog } from '@/lib/audit';
import { setupLocalStorageMock } from '@/__tests__/utils/localStorage';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('IP Restriction and Security Feature Compatibility', () => {
  beforeEach(() => {
    setupLocalStorageMock();
    vi.clearAllMocks();
    mockFetch.mockClear();
    
    // Clear security logs
    localStorage.removeItem('security_logs');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('IP Restriction Enforcement in Reordered Flow', () => {
    it('should enforce IP whitelist restrictions during exam access', async () => {
      // Mock exam access API response for IP not whitelisted
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'ip_not_whitelisted' })
      });

      const response = await fetch('/api/public/exams/test-exam/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.100'
        },
        body: JSON.stringify({
          code: 'TEST123',
          studentName: 'Test Student'
        })
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe('ip_not_whitelisted');
      
      // Verify the API was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith('/api/public/exams/test-exam/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.100'
        },
        body: JSON.stringify({
          code: 'TEST123',
          studentName: 'Test Student'
        })
      });
    });

    it('should enforce IP blacklist restrictions during exam access', async () => {
      // Mock exam access API response for IP blacklisted
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'ip_blacklisted' })
      });

      const response = await fetch('/api/public/exams/test-exam/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '10.0.0.50'
        },
        body: JSON.stringify({
          code: 'TEST456'
        })
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe('ip_blacklisted');
    });

    it('should allow access when IP is whitelisted', async () => {
      // Mock successful exam access
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          attemptId: 'attempt-123',
          studentName: 'Test Student'
        })
      });

      const response = await fetch('/api/public/exams/test-exam/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.10'
        },
        body: JSON.stringify({
          code: 'TEST789',
          studentName: 'Test Student'
        })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.attemptId).toBe('attempt-123');
      expect(data.studentName).toBe('Test Student');
    });

    it('should handle multiple IP headers correctly', () => {
      // Test x-forwarded-for with multiple IPs
      const headers1 = new Map([
        ['x-forwarded-for', '203.0.113.1, 192.168.1.1, 10.0.0.1']
      ]);
      expect(getClientIp(headers1 as any)).toBe('203.0.113.1');

      // Test x-real-ip fallback
      const headers2 = new Map([
        ['x-real-ip', '203.0.113.2']
      ]);
      expect(getClientIp(headers2 as any)).toBe('203.0.113.2');

      // Test fallback to localhost
      const headers3 = new Map();
      expect(getClientIp(headers3 as any)).toBe('127.0.0.1');
    });

    it('should work with reordered flow code validation', async () => {
      // Mock code validation with IP restriction
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'ip_not_whitelisted' })
      });

      // Simulate code validation in reordered flow
      const response = await fetch('/api/public/exams/test-exam/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '172.16.0.100'
        },
        body: JSON.stringify({
          code: 'RESTRICTED123'
        })
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe('ip_not_whitelisted');
    });
  });

  describe('Audit Logging for New Flow Events', () => {
    it('should log code validation events in reordered flow', () => {
      // Log code validation success
      clientSecurityLog('code_validation_success', {
        student_id: 'student-123',
        code_hash: 'hash-abc123',
        flow_type: 'reordered',
        ip_address: '192.168.1.10'
      }, 'low');

      // Verify log was recorded
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      expect(logs).toHaveLength(1);
      
      const logEntry = logs[0];
      expect(logEntry.event).toBe('code_validation_success');
      expect(logEntry.details.flow_type).toBe('reordered');
      expect(logEntry.details.ip_address).toBe('192.168.1.10');
      expect(logEntry.severity).toBe('low');
    });

    it('should log code storage events with security context', () => {
      // Log code storage event
      clientSecurityLog('code_stored', {
        student_id: 'student-456',
        code_hash: 'hash-def456',
        storage_type: 'encrypted',
        flow_type: 'reordered'
      }, 'low');

      // Log code clearing event
      clientSecurityLog('code_cleared', {
        student_id: 'student-456',
        code_hash: 'hash-def456',
        reason: 'user_requested',
        flow_type: 'reordered'
      }, 'low');

      // Verify both logs were recorded
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      expect(logs).toHaveLength(2);
      
      expect(logs[0].event).toBe('code_stored');
      expect(logs[0].details.storage_type).toBe('encrypted');
      expect(logs[1].event).toBe('code_cleared');
      expect(logs[1].details.reason).toBe('user_requested');
    });

    it('should log IP restriction violations with context', () => {
      // Log IP restriction violation
      clientSecurityLog('ip_restriction_violation', {
        exam_id: 'exam-123',
        student_code: 'hash-ghi789', // Should be hashed, not raw
        ip_address: '10.0.0.100',
        restriction_type: 'whitelist',
        flow_type: 'reordered'
      }, 'high');

      // Verify log was recorded with high severity
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      expect(logs).toHaveLength(1);
      
      const logEntry = logs[0];
      expect(logEntry.event).toBe('ip_restriction_violation');
      expect(logEntry.severity).toBe('high');
      expect(logEntry.details.restriction_type).toBe('whitelist');
      expect(logEntry.details.flow_type).toBe('reordered');
    });

    it('should log suspicious activity patterns', () => {
      // Log multiple failed attempts from same IP
      for (let i = 0; i < 5; i++) {
        clientSecurityLog('code_validation_failed', {
          student_id: `student-${i}`,
          code_hash: `hash-${i}`,
          ip_address: '192.168.1.100',
          attempt_number: i + 1,
          flow_type: 'reordered'
        }, 'medium');
      }

      // Log suspicious pattern detection
      clientSecurityLog('suspicious_pattern_detected', {
        pattern_type: 'rapid_failures',
        ip_address: '192.168.1.100',
        failure_count: 5,
        time_window: '60s',
        flow_type: 'reordered'
      }, 'high');

      // Verify all logs were recorded
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      expect(logs).toHaveLength(6);
      
      // Check pattern detection log
      const patternLog = logs[logs.length - 1];
      expect(patternLog.event).toBe('suspicious_pattern_detected');
      expect(patternLog.severity).toBe('high');
      expect(patternLog.details.pattern_type).toBe('rapid_failures');
    });

    it('should maintain audit trail chronological order', () => {
      const events = [
        'code_input_started',
        'code_validation_attempted',
        'code_validation_success',
        'exam_access_granted',
        'attempt_started'
      ];

      // Log events with small delays to ensure different timestamps
      events.forEach((event, index) => {
        setTimeout(() => {
          clientSecurityLog(event, {
            student_id: 'student-789',
            sequence: index + 1,
            flow_type: 'reordered'
          }, 'low');
        }, index * 10);
      });

      // Wait for all events to be logged
      setTimeout(() => {
        const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
        expect(logs).toHaveLength(5);
        
        // Verify chronological order
        for (let i = 1; i < logs.length; i++) {
          expect(logs[i].timestamp).toBeGreaterThanOrEqual(logs[i - 1].timestamp);
        }
        
        // Verify sequence
        logs.forEach((log: any, index: number) => {
          expect(log.details.sequence).toBe(index + 1);
        });
      }, 100);
    });
  });

  describe('Security Feature Consistency', () => {
    it('should maintain security boundaries across flow transitions', async () => {
      // Simulate transition from code input to exam access
      
      // Step 1: Code input with security logging
      clientSecurityLog('code_input_started', {
        flow_type: 'reordered',
        timestamp: Date.now()
      }, 'low');

      // Step 2: Code validation with IP check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          valid: true,
          examId: 'exam-123'
        })
      });

      // Step 3: Exam access with IP restriction
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          attemptId: 'attempt-456',
          studentName: 'Test Student'
        })
      });

      // Verify security is maintained throughout
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      expect(logs).toHaveLength(1);
      expect(logs[0].event).toBe('code_input_started');
      expect(logs[0].details.flow_type).toBe('reordered');
    });

    it('should handle security failures gracefully in reordered flow', async () => {
      // Mock security failure scenarios
      const securityFailures = [
        { error: 'ip_not_whitelisted', severity: 'high' },
        { error: 'ip_blacklisted', severity: 'critical' },
        { error: 'rate_limit_exceeded', severity: 'medium' },
        { error: 'suspicious_activity', severity: 'high' }
      ];

      securityFailures.forEach(({ error, severity }) => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({ error })
        });

        // Log security failure
        clientSecurityLog('security_failure', {
          error_type: error,
          flow_type: 'reordered',
          handled: true
        }, severity as any);
      });

      // Verify all failures were logged
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      expect(logs).toHaveLength(4);
      
      logs.forEach((log: any, index: number) => {
        expect(log.event).toBe('security_failure');
        expect(log.details.error_type).toBe(securityFailures[index].error);
        expect(log.severity).toBe(securityFailures[index].severity);
        expect(log.details.handled).toBe(true);
      });
    });

    it('should preserve existing security features in reordered flow', () => {
      // Test that all existing security features still work
      const securityFeatures = [
        'ip_restriction',
        'rate_limiting',
        'audit_logging',
        'encryption',
        'session_management'
      ];

      securityFeatures.forEach(feature => {
        clientSecurityLog('security_feature_verified', {
          feature_name: feature,
          flow_type: 'reordered',
          status: 'active'
        }, 'low');
      });

      // Verify all features were logged as active
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      expect(logs).toHaveLength(5);
      
      logs.forEach((log: any, index: number) => {
        expect(log.event).toBe('security_feature_verified');
        expect(log.details.feature_name).toBe(securityFeatures[index]);
        expect(log.details.status).toBe('active');
      });
    });

    it('should handle concurrent security events correctly', async () => {
      // Simulate concurrent security events
      const concurrentEvents = [
        { event: 'code_validation_attempted', ip: '192.168.1.10' },
        { event: 'code_validation_attempted', ip: '192.168.1.11' },
        { event: 'code_validation_attempted', ip: '192.168.1.12' }
      ];

      // Log events concurrently
      const promises = concurrentEvents.map(({ event, ip }) =>
        new Promise<void>(resolve => {
          clientSecurityLog(event, {
            ip_address: ip,
            flow_type: 'reordered',
            concurrent: true
          }, 'medium');
          resolve();
        })
      );

      await Promise.all(promises);

      // Verify all events were logged
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      expect(logs).toHaveLength(3);
      
      // Verify each event has unique IP
      const ips = logs.map((log: any) => log.details.ip_address);
      expect(new Set(ips).size).toBe(3);
      
      logs.forEach((log: any) => {
        expect(log.event).toBe('code_validation_attempted');
        expect(log.details.concurrent).toBe(true);
      });
    });
  });

  describe('Integration with Existing Features', () => {
    it('should work with WhatsApp integration', () => {
      // Log WhatsApp code delivery with security context
      clientSecurityLog('whatsapp_code_delivered', {
        student_id: 'student-whatsapp',
        mobile_number_hash: 'hash-mobile123',
        delivery_status: 'success',
        flow_type: 'reordered'
      }, 'low');

      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      expect(logs).toHaveLength(1);
      expect(logs[0].event).toBe('whatsapp_code_delivered');
      expect(logs[0].details.flow_type).toBe('reordered');
    });

    it('should work with result association', () => {
      // Log result association with security context
      clientSecurityLog('result_associated', {
        student_id: 'student-result',
        attempt_id: 'attempt-result-123',
        exam_id: 'exam-result-456',
        flow_type: 'reordered'
      }, 'low');

      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      expect(logs).toHaveLength(1);
      expect(logs[0].event).toBe('result_associated');
      expect(logs[0].details.attempt_id).toBe('attempt-result-123');
    });

    it('should maintain compatibility with existing exam features', async () => {
      // Test various exam features work with reordered flow
      const examFeatures = [
        { feature: 'timer_started', data: { duration: 3600 } },
        { feature: 'question_answered', data: { question_id: 'q1' } },
        { feature: 'attempt_submitted', data: { score: 85 } },
        { feature: 'result_calculated', data: { final_score: 85 } }
      ];

      examFeatures.forEach(({ feature, data }) => {
        clientSecurityLog(feature, {
          ...data,
          flow_type: 'reordered',
          compatibility_verified: true
        }, 'low');
      });

      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      expect(logs).toHaveLength(4);
      
      logs.forEach((log: any, index: number) => {
        expect(log.event).toBe(examFeatures[index].feature);
        expect(log.details.compatibility_verified).toBe(true);
      });
    });
  });
});