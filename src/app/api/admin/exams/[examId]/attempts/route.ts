import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getBearerToken } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { logDeviceInfo, validateDeviceInfo } from "@/lib/deviceInfoDiagnostics";
import { compressResponse } from "@/lib/compression-middleware";
import { shouldBypassCache, addCacheStatusHeaders } from "@/lib/cache-bypass";
import { caches, CacheKeys } from "@/lib/cache";

export async function GET(req: NextRequest, ctx: { params: Promise<{ examId: string }> }) {
  try {
    await requireAdmin(req);
    const { examId } = await ctx.params;
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    
    // Check if cache bypass is requested and allowed
    const bypassCache = await shouldBypassCache(req);
    
    // Parse pagination and field selection from query parameters
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const fieldsParam = searchParams.get('fields');
    const useV2 = searchParams.get('v2') === 'true' || searchParams.has('limit') || searchParams.has('offset') || searchParams.has('fields');
    
    let fields = null;
    if (fieldsParam) {
      try {
        if (fieldsParam.startsWith('[') || fieldsParam.startsWith('{')) {
          fields = JSON.parse(fieldsParam);
        } else {
          const fieldList = fieldsParam.split(',').map(f => f.trim());
          fields = { include: fieldList };
        }
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid fields parameter' },
          { status: 400 }
        );
      }
    }
    
    let fromCache = false;
    
    // Try cache first if not bypassing and using default parameters
    if (!bypassCache && useV2 && !fields && limit === 50 && offset === 0) {
      const cacheKey = CacheKeys.withRole(`exam:attempts:${examId}`, 'admin');
      const cached = caches.general.get(cacheKey);
      
      if (cached) {
        // Get Accept-Encoding header for compression detection
        const acceptEncoding = req.headers.get('accept-encoding');
        
        // Compress response if size > 1KB and client supports compression
        const response = await compressResponse({ items: cached }, acceptEncoding);
        
        // Add cache status headers
        addCacheStatusHeaders(response.headers, true, false);
        
        return response;
      }
    }
    
    // Log query execution start
    logDeviceInfo({
      stage: 'retrieval',
      success: true,
      hasData: true,
      details: {
        operation: 'query_start',
        examId,
        method: useV2 ? 'RPC admin_list_attempts_v2' : 'RPC admin_list_attempts',
        pagination: useV2 ? { limit, offset } : undefined,
        cacheBypass: bypassCache
      }
    });
    
    // Use v2 RPC if pagination or field selection is requested
    let rpc;
    if (useV2) {
      rpc = await svc.rpc("admin_list_attempts_v2", {
        p_exam_id: examId,
        p_limit: limit,
        p_offset: offset,
        p_fields: fields
      });
    } else {
      // Use original RPC for backward compatibility
      rpc = await svc.rpc("admin_list_attempts", { p_exam_id: examId });
    }
    if (!rpc.error && Array.isArray(rpc.data)) {
      // Log query execution success with result count
      logDeviceInfo({
        stage: 'retrieval',
        success: true,
        hasData: true,
        details: {
          operation: 'query_complete',
          method: 'RPC',
          resultCount: rpc.data.length,
          examId
        }
      });
      
      // Log sample device_info presence/absence
      const sampleAttempt = rpc.data[0];
      if (sampleAttempt) {
        const hasDeviceInfo = !!sampleAttempt.device_info;
        logDeviceInfo({
          stage: 'retrieval',
          attemptId: sampleAttempt.id,
          success: true,
          hasData: hasDeviceInfo,
          dataFormat: hasDeviceInfo ? undefined : 'null',
          details: {
            operation: 'sample_check',
            sampleIndex: 0,
            deviceInfoPresent: hasDeviceInfo
          }
        });
        
        // Validate retrieved device_info if present
        if (hasDeviceInfo) {
          const validation = validateDeviceInfo(sampleAttempt.device_info);
          logDeviceInfo({
            stage: 'retrieval',
            attemptId: sampleAttempt.id,
            success: validation.isValid,
            hasData: true,
            dataFormat: validation.format,
            details: {
              operation: 'validation',
              missingFields: validation.missingFields,
              warnings: validation.warnings
            }
          });
        }
      }
      
      // Log attempts with null device_info
      const nullDeviceInfoAttempts = rpc.data.filter((a: any) => !a.device_info);
      if (nullDeviceInfoAttempts.length > 0) {
        logDeviceInfo({
          stage: 'retrieval',
          success: true,
          hasData: false,
          dataFormat: 'null',
          details: {
            operation: 'null_device_info_count',
            nullCount: nullDeviceInfoAttempts.length,
            totalCount: rpc.data.length,
            percentage: ((nullDeviceInfoAttempts.length / rpc.data.length) * 100).toFixed(2) + '%',
            sampleAttemptIds: nullDeviceInfoAttempts.slice(0, 5).map((a: any) => a.id)
          }
        });
      }
      
      // eslint-disable-next-line no-console
      console.log("RPC SUCCESS - Sample device_info:", rpc.data[0]?.device_info ? "HAS DATA" : "NULL");
      
      // Cache the result if using default parameters and not bypassing
      if (!bypassCache && !fields && limit === 50 && offset === 0) {
        const cacheKey = CacheKeys.withRole(`exam:attempts:${examId}`, 'admin');
        caches.general.set(cacheKey, rpc.data, 60000); // 60 seconds TTL
      }
      
      // Get Accept-Encoding header for compression detection
      const acceptEncoding = req.headers.get('accept-encoding');
      
      // Compress response if size > 1KB and client supports compression
      const response = await compressResponse({ items: rpc.data }, acceptEncoding);
      
      // Add cache status headers
      addCacheStatusHeaders(response.headers, fromCache, bypassCache);
      
      return response;
    }
    // Log RPC failure for observability
    if (rpc.error) {
      logDeviceInfo({
        stage: 'retrieval',
        success: false,
        hasData: false,
        error: rpc.error.message || String(rpc.error),
        details: {
          operation: 'rpc_failed',
          examId,
          errorCode: rpc.error.code
        }
      });
      
      // eslint-disable-next-line no-console
      console.warn("admin_list_attempts RPC failed, using fallback query:", rpc.error.message || rpc.error);
    }

    // Log fallback query start
    logDeviceInfo({
      stage: 'retrieval',
      success: true,
      hasData: true,
      details: {
        operation: 'fallback_query_start',
        examId,
        method: 'direct table query'
      }
    });

    // Fallback: join exam_attempts with students via student_id
    const fb = await svc
      .from("exam_attempts")
      .select("id, exam_id, ip_address, device_info, started_at, submitted_at, completion_status, students(student_name, code), exam_results(score_percentage, final_score_percentage)")
      .eq("exam_id", examId)
      .order("started_at", { ascending: false, nullsFirst: true });
    if (!fb.error) {
      // Log fallback query success with result count
      logDeviceInfo({
        stage: 'retrieval',
        success: true,
        hasData: true,
        details: {
          operation: 'query_complete',
          method: 'fallback',
          resultCount: fb.data?.length || 0,
          examId
        }
      });
      
      // Log sample device_info presence/absence
      const sampleAttempt = fb.data?.[0];
      if (sampleAttempt) {
        const hasDeviceInfo = !!sampleAttempt.device_info;
        logDeviceInfo({
          stage: 'retrieval',
          attemptId: sampleAttempt.id,
          success: true,
          hasData: hasDeviceInfo,
          dataFormat: hasDeviceInfo ? undefined : 'null',
          details: {
            operation: 'sample_check',
            sampleIndex: 0,
            deviceInfoPresent: hasDeviceInfo
          }
        });
        
        // Validate retrieved device_info if present
        if (hasDeviceInfo) {
          const validation = validateDeviceInfo(sampleAttempt.device_info);
          logDeviceInfo({
            stage: 'retrieval',
            attemptId: sampleAttempt.id,
            success: validation.isValid,
            hasData: true,
            dataFormat: validation.format,
            details: {
              operation: 'validation',
              missingFields: validation.missingFields,
              warnings: validation.warnings
            }
          });
        }
      }
      
      // Log attempts with null device_info
      const nullDeviceInfoAttempts = (fb.data ?? []).filter((a: any) => !a.device_info);
      if (nullDeviceInfoAttempts.length > 0) {
        logDeviceInfo({
          stage: 'retrieval',
          success: true,
          hasData: false,
          dataFormat: 'null',
          details: {
            operation: 'null_device_info_count',
            nullCount: nullDeviceInfoAttempts.length,
            totalCount: fb.data?.length || 0,
            percentage: ((nullDeviceInfoAttempts.length / (fb.data?.length || 1)) * 100).toFixed(2) + '%',
            sampleAttemptIds: nullDeviceInfoAttempts.slice(0, 5).map((a: any) => a.id)
          }
        });
      }
      
      // eslint-disable-next-line no-console
      console.log("FALLBACK SUCCESS - Sample device_info:", fb.data[0]?.device_info ? "HAS DATA" : "NULL");
      const items = (fb.data ?? []).map((a: any) => ({
        id: a.id,
        exam_id: a.exam_id,
        started_at: a.started_at,
        submitted_at: a.submitted_at,
        completion_status: a.completion_status,
        ip_address: a.ip_address,
        device_info: a.device_info,
        student_name: a?.students?.student_name ?? a?.student_name ?? null,
        code: a?.students?.code ?? null,
        score_percentage: a?.exam_results?.score_percentage ?? null,
        final_score_percentage: a?.exam_results?.final_score_percentage ?? null,
      }));
      
      // Get Accept-Encoding header for compression detection
      const acceptEncoding = req.headers.get('accept-encoding');
      
      // Compress response if size > 1KB and client supports compression
      const response = await compressResponse({ items }, acceptEncoding);
      
      // Add cache status headers (fallback never uses cache)
      addCacheStatusHeaders(response.headers, false, bypassCache);
      
      return response;
    }

    // Log fallback query failure
    logDeviceInfo({
      stage: 'retrieval',
      success: false,
      hasData: false,
      error: fb.error?.message || String(fb.error),
      details: {
        operation: 'fallback_query_failed',
        examId,
        errorCode: fb.error?.code
      }
    });

    // If neither RPC nor table exists, surface a clear signal to configure backend
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  } catch (e: any) {
    // Log unexpected errors
    logDeviceInfo({
      stage: 'retrieval',
      success: false,
      hasData: false,
      error: e?.message || 'unexpected_error',
      details: {
        operation: 'exception',
        errorType: e?.constructor?.name
      }
    });
    
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
