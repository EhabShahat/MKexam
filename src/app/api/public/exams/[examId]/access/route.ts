import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/ip";
import { parseUserAgent } from "@/lib/userAgent";
import { mergeDeviceInfo } from "@/lib/mergeDeviceInfo";
import { logDeviceInfo, validateDeviceInfo, logValidation } from "@/lib/deviceInfoDiagnostics";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const code: string | null = body?.code ?? null;
    const studentName: string | null = body?.studentName ?? null;
    const clientDeviceInfo = body?.deviceInfo ?? null;  // Enhanced device info from client
    
    const hdrs = await headers();
    const ip = getClientIp(hdrs);
    
    // Capture device information from user agent (fallback for old clients)
    const userAgent = hdrs.get('user-agent') || '';
    const deviceInfo = parseUserAgent(userAgent);

    const supabase = supabaseServer();

    // Get student data if code is provided (for mobile number blocking check)
    let studentData = null;
    if (code) {
      const { data } = await supabase
        .from("students")
        .select("student_name, mobile_number")
        .eq("code", code)
        .single();
      studentData = data;
    }

    // Check if IP, student name, or mobile number is blocked (Easter Egg feature)
    const blockedChecks = [];
    if (ip) {
      blockedChecks.push(
        supabase
          .from("blocked_entries")
          .select("value, reason")
          .eq("type", "ip")
          .eq("value", ip)
          .single()
      );
    }
    if (studentName) {
      blockedChecks.push(
        supabase
          .from("blocked_entries")
          .select("value, reason")
          .eq("type", "name")
          .ilike("value", studentName.trim())
          .single()
      );
    }
    if (studentData?.mobile_number) {
      blockedChecks.push(
        supabase
          .from("blocked_entries")
          .select("value, reason")
          .eq("type", "mobile")
          .eq("value", studentData.mobile_number.trim())
          .single()
      );
    }

    if (blockedChecks.length > 0) {
      const results = await Promise.all(blockedChecks);
      const blocked = results.find(result => result.data && !result.error);
      
      if (blocked?.data) {
        return NextResponse.json(
          { 
            error: "access_denied",
            message: blocked.data.reason || "Access has been restricted for this entry."
          },
          { status: 403 }
        );
      }
    }
    const { data, error } = await supabase.rpc("start_attempt_v2", {
      p_exam_id: examId,
      p_code: code,
      p_student_name: studentName,
      p_ip: ip,
    });
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    const attemptId: string | undefined = row?.attempt_id;
    if (!attemptId) {
      return NextResponse.json({ error: "no_attempt" }, { status: 400 });
    }

    // Store enhanced device information in the attempt
    if (clientDeviceInfo || deviceInfo) {
      try {
        // Log when device info is received from client
        logDeviceInfo({
          stage: 'storage',
          attemptId,
          success: true,
          hasData: !!clientDeviceInfo,
          dataFormat: clientDeviceInfo ? 'enhanced' : 'legacy',
          details: {
            operation: 'received',
            hasClientDeviceInfo: !!clientDeviceInfo,
            hasFallbackDeviceInfo: !!deviceInfo,
            serverIP: ip,
            clientIPCount: clientDeviceInfo?.ips?.ips?.length || 0,
            hasFingerprint: !!clientDeviceInfo?.fingerprint
          }
        });
        
        // Merge client device info with server-detected IP
        const mergedDeviceInfo = clientDeviceInfo 
          ? mergeDeviceInfo(clientDeviceInfo, ip, attemptId)
          : {
              // Fallback to old format for backward compatibility
              type: deviceInfo.type,
              manufacturer: deviceInfo.manufacturer,
              model: deviceInfo.model,
              userAgent: deviceInfo.raw,
              capturedAt: new Date().toISOString(),
              serverDetectedIP: ip,
              serverDetectedAt: new Date().toISOString(),
              allIPs: {
                local: [],
                public: [],
                server: ip
              }
            };

        // Validate merged device info before database update
        const validation = validateDeviceInfo(mergedDeviceInfo);
        logValidation('storage', attemptId, validation);
        
        // Additional validation: ensure critical fields exist
        if (!mergedDeviceInfo.serverDetectedIP) {
          logDeviceInfo({
            stage: 'storage',
            attemptId,
            success: false,
            hasData: true,
            dataFormat: validation.format,
            error: 'Validation failed: missing serverDetectedIP',
            details: {
              operation: 'pre-update-validation',
              mergedDeviceInfoKeys: Object.keys(mergedDeviceInfo)
            }
          });
          
          // Add serverDetectedIP if missing
          mergedDeviceInfo.serverDetectedIP = ip;
        }
        
        if (!mergedDeviceInfo.allIPs || typeof mergedDeviceInfo.allIPs !== 'object') {
          logDeviceInfo({
            stage: 'storage',
            attemptId,
            success: false,
            hasData: true,
            dataFormat: validation.format,
            error: 'Validation failed: missing or invalid allIPs structure',
            details: {
              operation: 'pre-update-validation',
              hasAllIPs: !!mergedDeviceInfo.allIPs,
              allIPsType: typeof mergedDeviceInfo.allIPs
            }
          });
          
          // Add allIPs structure if missing
          mergedDeviceInfo.allIPs = {
            local: [],
            public: [],
            server: ip
          };
        }
        
        // Log before database update
        logDeviceInfo({
          stage: 'storage',
          attemptId,
          success: true,
          hasData: true,
          dataFormat: validation.format,
          details: {
            operation: 'pre-update',
            isValid: validation.isValid,
            missingFields: validation.missingFields,
            warnings: validation.warnings,
            hasServerDetectedIP: !!mergedDeviceInfo.serverDetectedIP,
            hasAllIPs: !!mergedDeviceInfo.allIPs
          }
        });

        // Retry logic for database update
        let updateError: any = null;
        let updateSuccess = false;
        const maxRetries = 2;
        
        for (let attempt = 0; attempt <= maxRetries && !updateSuccess; attempt++) {
          if (attempt > 0) {
            logDeviceInfo({
              stage: 'storage',
              attemptId,
              success: true,
              hasData: true,
              dataFormat: validation.format,
              details: {
                operation: 'retry-attempt',
                attempt,
                maxRetries,
                previousError: updateError?.message
              }
            });
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
          
          const { error } = await supabase
            .from("exam_attempts")
            .update({ 
              device_info: mergedDeviceInfo,
              ip_address: ip  // Maintain backward compatibility
            })
            .eq("id", attemptId);
          
          if (error) {
            updateError = error;
          } else {
            updateSuccess = true;
          }
        }
        
        if (updateError) {
          // Log database update errors with attempt ID
          logDeviceInfo({
            stage: 'storage',
            attemptId,
            success: false,
            hasData: true,
            dataFormat: validation.format,
            error: updateError.message,
            details: {
              operation: 'database-update',
              errorCode: updateError.code,
              errorDetails: updateError.details,
              errorHint: updateError.hint,
              retriesAttempted: maxRetries
            }
          });
          
          // Even if device info storage fails, ensure IP is stored
          try {
            const { error: ipError } = await supabase
              .from("exam_attempts")
              .update({ ip_address: ip })
              .eq("id", attemptId);
            
            if (!ipError) {
              logDeviceInfo({
                stage: 'storage',
                attemptId,
                success: true,
                hasData: false,
                dataFormat: 'null',
                details: {
                  operation: 'fallback-ip-only',
                  reason: 'Device info update failed, stored IP only',
                  serverIP: ip
                }
              });
            }
          } catch (ipErr) {
            logDeviceInfo({
              stage: 'storage',
              attemptId,
              success: false,
              hasData: false,
              error: ipErr instanceof Error ? ipErr.message : String(ipErr),
              details: {
                operation: 'fallback-ip-only-failed',
                reason: 'Both device info and IP-only updates failed'
              }
            });
          }
        } else {
          // Log successful storage with data summary
          logDeviceInfo({
            stage: 'storage',
            attemptId,
            success: true,
            hasData: true,
            dataFormat: validation.format,
            details: {
              operation: 'post-update',
              stored: 'device_info + ip_address',
              ipCount: clientDeviceInfo?.ips?.ips?.length || 0,
              hasFingerprint: !!clientDeviceInfo?.fingerprint,
              hasFriendlyName: !!mergedDeviceInfo.friendlyName,
              hasOem: !!(mergedDeviceInfo.oem?.brand || mergedDeviceInfo.oem?.model),
              allIPsStructure: {
                local: mergedDeviceInfo.allIPs?.local?.length || 0,
                public: mergedDeviceInfo.allIPs?.public?.length || 0,
                server: mergedDeviceInfo.allIPs?.server || ip
              }
            }
          });
        }
      } catch (e) {
        // Log unexpected errors during storage
        logDeviceInfo({
          stage: 'storage',
          attemptId,
          success: false,
          hasData: !!clientDeviceInfo,
          error: e instanceof Error ? e.message : String(e),
          details: {
            operation: 'exception',
            errorName: e instanceof Error ? e.name : undefined,
            errorStack: e instanceof Error ? e.stack : undefined
          }
        });
        
        // Attempt to store IP even if exception occurred
        try {
          const { error: ipError } = await supabase
            .from("exam_attempts")
            .update({ ip_address: ip })
            .eq("id", attemptId);
          
          if (!ipError) {
            logDeviceInfo({
              stage: 'storage',
              attemptId,
              success: true,
              hasData: false,
              dataFormat: 'null',
              details: {
                operation: 'exception-recovery-ip-only',
                reason: 'Exception during device info storage, stored IP only',
                serverIP: ip
              }
            });
          }
        } catch (ipErr) {
          // Silent fail - exam access should not be blocked
        }
      }
    } else {
      // No device info available, just store IP
      logDeviceInfo({
        stage: 'storage',
        attemptId,
        success: true,
        hasData: false,
        dataFormat: 'null',
        details: {
          operation: 'ip-only',
          serverIP: ip,
          reason: 'No client or fallback device info available'
        }
      });
      
      try {
        // Log before IP-only update
        logDeviceInfo({
          stage: 'storage',
          attemptId,
          success: true,
          hasData: false,
          dataFormat: 'null',
          details: {
            operation: 'pre-update',
            updateType: 'ip_address_only'
          }
        });

        const { error: updateError } = await supabase
          .from("exam_attempts")
          .update({ 
            ip_address: ip
          })
          .eq("id", attemptId);
        
        if (updateError) {
          // Log database update errors for IP-only case
          logDeviceInfo({
            stage: 'storage',
            attemptId,
            success: false,
            hasData: false,
            dataFormat: 'null',
            error: updateError.message,
            details: {
              operation: 'database-update',
              updateType: 'ip_address_only',
              errorCode: updateError.code,
              errorDetails: updateError.details
            }
          });
        } else {
          // Log successful IP-only storage
          logDeviceInfo({
            stage: 'storage',
            attemptId,
            success: true,
            hasData: false,
            dataFormat: 'null',
            details: {
              operation: 'post-update',
              stored: 'ip_address_only',
              serverIP: ip
            }
          });
        }
      } catch (e) {
        // Log unexpected errors during IP-only storage
        logDeviceInfo({
          stage: 'storage',
          attemptId,
          success: false,
          hasData: false,
          dataFormat: 'null',
          error: e instanceof Error ? e.message : String(e),
          details: {
            operation: 'exception',
            updateType: 'ip_address_only',
            errorName: e instanceof Error ? e.name : undefined
          }
        });
      }
    }

    // Get student name for the response (reuse studentData if already fetched)
    let finalStudentName = studentName;
    if (code && studentData?.student_name) {
      finalStudentName = studentData.student_name;
    } else if (code && !studentData) {
      // Fallback if studentData wasn't fetched earlier
      const { data: fallbackData } = await supabase
        .from("students")
        .select("student_name")
        .eq("code", code)
        .single();
      
      if (fallbackData?.student_name) {
        finalStudentName = fallbackData.student_name;
      }
    }

    // Set a session cookie with attemptId
    const cookieStore = await cookies();
    cookieStore.set("attemptId", attemptId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only secure in production (HTTPS)
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 3, // 3h safe default
    });

    return NextResponse.json({ 
      attemptId,
      studentName: finalStudentName 
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
  }
}
