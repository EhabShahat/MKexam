/**
 * Cost Alerts API Route
 * 
 * GET /api/admin/alerts - Get recent cost alerts
 * POST /api/admin/alerts/check - Check budget limits and create alerts
 * 
 * Requirements: 12.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getRecentAlerts, 
  checkAndStoreAlerts, 
  generateAndStoreDailySummary,
  CostBudget 
} from '@/lib/costAlerting';

/**
 * GET /api/admin/alerts
 * 
 * Get recent cost alerts
 * 
 * Query parameters:
 * - limit: number (default: 10)
 * - severity: 'info' | 'warning' | 'critical' (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const severity = searchParams.get('severity') as 'info' | 'warning' | 'critical' | null;

    const alerts = await getRecentAlerts(
      limit,
      severity || undefined
    );

    return NextResponse.json({
      success: true,
      alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch alerts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/alerts/check
 * 
 * Check budget limits and create alerts if thresholds are exceeded
 * 
 * Body (optional):
 * - date: ISO date string (default: today)
 * - budget: CostBudget object (optional)
 * - generateSummary: boolean (default: false)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const date = body.date ? new Date(body.date) : new Date();
    const budget: CostBudget | undefined = body.budget;
    const generateSummary = body.generateSummary || false;

    // Check budget limits and store alerts
    const alertIds = await checkAndStoreAlerts(date, budget);

    // Generate daily summary if requested
    let summaryId: string | null = null;
    if (generateSummary) {
      summaryId = await generateAndStoreDailySummary(date);
    }

    return NextResponse.json({
      success: true,
      alertIds,
      summaryId,
      message: `Created ${alertIds.length} alert(s)${summaryId ? ' and 1 summary' : ''}`
    });
  } catch (error) {
    console.error('Error checking alerts:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check alerts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
