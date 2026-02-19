/**
 * API Route: Check Performance Alerts
 * 
 * Triggers performance threshold checks and returns any alerts.
 * Can be called manually or via cron job.
 * 
 * Requirements: 9.7, 12.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { runPerformanceChecks, getAlertSummary } from '@/lib/performanceAlerting';
import { verifyAdmin } from '@/lib/admin';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get budget parameters from request body
    const body = await request.json().catch(() => ({}));
    const budgets = {
      egressGB: body.egressGB || 10, // Default 10 GB budget
      functionHours: body.functionHours || 100 // Default 100 hours budget
    };

    // Run performance checks
    const alerts = await runPerformanceChecks(budgets);

    return NextResponse.json({
      success: true,
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking performance alerts:', error);
    return NextResponse.json(
      { error: 'Failed to check performance alerts' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get alert summary
    const summary = await getAlertSummary(24);

    return NextResponse.json({
      success: true,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting alert summary:', error);
    return NextResponse.json(
      { error: 'Failed to get alert summary' },
      { status: 500 }
    );
  }
}
