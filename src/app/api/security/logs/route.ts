import { NextRequest, NextResponse } from 'next/server';
import { securityLog } from '@/lib/audit';
import { recordAttempt, isRateLimited } from '@/lib/rateLimiter';

/**
 * POST /api/security/logs
 * Endpoint for syncing client-side security logs to server
 */
export async function POST(request: NextRequest) {
  // Extract IP address first for use in both success and error cases
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';

  try {
    // Rate limit security log submissions
    if (isRateLimited('securityLogSync')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for security log sync' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { logs } = body;

    if (!Array.isArray(logs)) {
      return NextResponse.json(
        { error: 'Invalid logs format' },
        { status: 400 }
      );
    }

    // Record the sync attempt
    await recordAttempt('securityLogSync', true, 'client_sync', {
      log_count: logs.length,
      ip,
    });

    // Process each log entry
    for (const log of logs) {
      if (!log.event || !log.severity || !log.timestamp) {
        continue; // Skip invalid log entries
      }

      // Add server-side metadata
      const serverDetails = {
        ...log.details,
        client_timestamp: log.timestamp,
        client_user_agent: log.user_agent,
        server_ip: ip,
        sync_timestamp: Date.now(),
      };

      // Log to server audit system
      await securityLog(
        `client.${log.event}`,
        serverDetails,
        log.severity
      );
    }

    return NextResponse.json({ 
      success: true, 
      processed: logs.length 
    });

  } catch (error) {
    console.error('Security log sync failed:', error);
    
    // Record failed sync attempt
    await recordAttempt('securityLogSync', false, 'client_sync', {
      error: error instanceof Error ? error.message : 'unknown error',
      ip,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/security/logs
 * Endpoint for retrieving security log status (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // This would typically require admin authentication
    // For now, return basic rate limit status
    
    const rateLimitStatus = {
      securityLogSync: isRateLimited('securityLogSync'),
      codeValidation: isRateLimited('codeValidation'),
      codeStorage: isRateLimited('codeStorage'),
    };

    return NextResponse.json({
      rateLimits: rateLimitStatus,
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('Security status check failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}