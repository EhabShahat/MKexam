import { supabaseServer } from "@/lib/supabase/server";

export async function auditLog(actor: string, action: string, meta: Record<string, unknown> = {}) {
  try {
    const svc = supabaseServer();
    await svc.from("audit_logs").insert({ actor, action, meta });
  } catch {
    // best effort
  }
}

/**
 * Log security-related events with enhanced metadata
 * @param event - The security event type
 * @param details - Event details and metadata
 * @param severity - Event severity level
 */
export async function securityLog(
  event: string,
  details: Record<string, unknown> = {},
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
) {
  try {
    const svc = supabaseServer();
    
    // Enhanced metadata for security events
    const securityMeta = {
      ...details,
      event_type: 'security',
      severity,
      timestamp: new Date().toISOString(),
      user_agent: typeof window !== 'undefined' ? navigator.userAgent : null,
      ip_address: null, // Will be populated by server if available
    };

    await svc.from("audit_logs").insert({
      actor: 'system',
      action: `security.${event}`,
      meta: securityMeta
    });
  } catch (error) {
    // Log to console as fallback for security events
    console.warn('Security event logging failed:', { event, details, severity, error });
  }
}

/**
 * Log client-side security events (stored locally and synced when possible)
 * @param event - The security event type
 * @param details - Event details and metadata
 * @param severity - Event severity level
 */
export function clientSecurityLog(
  event: string,
  details: Record<string, unknown> = {},
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
) {
  try {
    // Store locally for immediate availability
    const logEntry = {
      event,
      details,
      severity,
      timestamp: Date.now(),
      user_agent: navigator.userAgent,
      synced: false,
    };

    // Get existing logs
    const existingLogs = getClientSecurityLogs();
    existingLogs.push(logEntry);

    // Keep only last 100 entries to prevent storage bloat
    const trimmedLogs = existingLogs.slice(-100);
    
    localStorage.setItem('security_logs', JSON.stringify(trimmedLogs));

    // Attempt to sync to server in background
    syncSecurityLogs();
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

/**
 * Get client-side security logs
 * @returns Array of security log entries
 */
function getClientSecurityLogs(): Array<{
  event: string;
  details: Record<string, unknown>;
  severity: string;
  timestamp: number;
  user_agent: string;
  synced: boolean;
}> {
  try {
    const stored = localStorage.getItem('security_logs');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Sync client-side security logs to server
 */
async function syncSecurityLogs() {
  try {
    // Skip sync in test environment
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
      return;
    }

    const logs = getClientSecurityLogs();
    const unsyncedLogs = logs.filter(log => !log.synced);

    if (unsyncedLogs.length === 0) {
      return;
    }

    // Attempt to send to server
    const response = await fetch('/api/security/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ logs: unsyncedLogs }),
    });

    if (response.ok) {
      // Mark logs as synced
      const updatedLogs = logs.map(log => ({ ...log, synced: true }));
      localStorage.setItem('security_logs', JSON.stringify(updatedLogs));
    }
  } catch (error) {
    // Sync will be retried on next security event
    console.debug('Security log sync failed:', error);
  }
}
