import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { validateDeviceInfo, type DeviceInfoHealth } from '@/lib/deviceInfoDiagnostics';

/**
 * GET /api/admin/device-info/health
 * 
 * Performs bulk health check on device info across all attempts
 * Query parameters:
 * - examId: Filter by specific exam (optional)
 * - limit: Maximum number of attempts to check (default: 100)
 * 
 * Admin authentication required
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    await requireAdmin(request);

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const examId = searchParams.get('examId');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Fetch attempts with device info
    const supabase = await supabaseServer();
    let query = supabase
      .from('exam_attempts')
      .select('id, device_info, exam_id, student_id')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (examId) {
      query = query.eq('exam_id', examId);
    }

    const { data: attempts, error } = await query;

    if (error) {
      console.error('Error fetching attempts for health check:', error);
      return NextResponse.json(
        { error: 'Failed to fetch attempts' },
        { status: 500 }
      );
    }

    // Perform health check on each attempt
    const healthResults: DeviceInfoHealth[] = (attempts || []).map((attempt: any) => {
      let deviceInfo = null;
      let hasDeviceInfo = false;

      // Parse device info if present
      if (attempt.device_info) {
        try {
          deviceInfo = typeof attempt.device_info === 'string'
            ? JSON.parse(attempt.device_info)
            : attempt.device_info;
          hasDeviceInfo = true;
        } catch (e) {
          // Failed to parse - treat as invalid
          hasDeviceInfo = false;
        }
      }

      // Validate device info
      const validation = validateDeviceInfo(deviceInfo);

      return {
        attemptId: attempt.id,
        hasDeviceInfo,
        format: validation.format,
        isValid: validation.isValid,
        missingFields: validation.missingFields,
        warnings: validation.warnings
      };
    });

    // Calculate statistics
    const stats = {
      total: healthResults.length,
      withDeviceInfo: healthResults.filter(h => h.hasDeviceInfo).length,
      withoutDeviceInfo: healthResults.filter(h => !h.hasDeviceInfo).length,
      enhanced: healthResults.filter(h => h.format === 'enhanced').length,
      legacy: healthResults.filter(h => h.format === 'legacy').length,
      invalid: healthResults.filter(h => h.format === 'invalid').length,
      null: healthResults.filter(h => h.format === 'null').length,
      healthPercentage: healthResults.length > 0
        ? Math.round((healthResults.filter(h => h.hasDeviceInfo).length / healthResults.length) * 100)
        : 0
    };

    return NextResponse.json({
      stats,
      results: healthResults,
      examId: examId || 'all',
      limit
    });
  } catch (error) {
    console.error('Error in device-info health check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
