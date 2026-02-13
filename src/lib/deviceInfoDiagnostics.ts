/**
 * Device Info Diagnostic Logging Utilities
 * 
 * Provides comprehensive logging and validation for the device info pipeline:
 * collection → merge → storage → retrieval → display
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Stages in the device info pipeline
 */
export type DeviceInfoStage = 
  | 'collection'  // Client-side device info gathering
  | 'merge'       // Server-side merge with IP
  | 'storage'     // Database persistence
  | 'retrieval'   // Database query
  | 'display';    // UI component rendering

/**
 * Device info format types
 */
export type DeviceInfoFormat = 
  | 'enhanced'  // New format with friendlyName, oem, allIPs
  | 'legacy'    // Old format with type, manufacturer, model
  | 'null'      // No device info present
  | 'invalid';  // Malformed or incomplete data

/**
 * Structured log entry for device info operations
 */
export interface DeviceInfoLog {
  /** Pipeline stage where logging occurs */
  stage: DeviceInfoStage;
  
  /** Exam attempt ID for traceability */
  attemptId?: string;
  
  /** Whether the operation succeeded */
  success: boolean;
  
  /** Whether device info data is present */
  hasData: boolean;
  
  /** Detected format of device info */
  dataFormat?: DeviceInfoFormat;
  
  /** Error message if operation failed */
  error?: string;
  
  /** Additional context-specific details */
  details?: Record<string, any>;
}

/**
 * Result of device info validation
 */
export interface DeviceInfoValidation {
  /** Whether the device info structure is valid */
  isValid: boolean;
  
  /** Detected format type */
  format: DeviceInfoFormat;
  
  /** List of missing required fields */
  missingFields: string[];
  
  /** Additional validation warnings */
  warnings?: string[];
}

/**
 * Device info health check result for a single attempt
 */
export interface DeviceInfoHealth {
  attemptId: string;
  hasDeviceInfo: boolean;
  format: DeviceInfoFormat;
  isValid: boolean;
  missingFields: string[];
  warnings?: string[];
}

/**
 * Aggregated device info statistics
 */
export interface DeviceInfoStats {
  total: number;
  withDeviceInfo: number;
  withoutDeviceInfo: number;
  enhanced: number;
  legacy: number;
  invalid: number;
  healthPercentage: number;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates device info structure and identifies format
 * 
 * Checks for:
 * - Enhanced format: friendlyName, oem, browserDetails, allIPs
 * - Legacy format: type, manufacturer, model, userAgent
 * - Invalid: null, malformed, or missing required fields
 * 
 * @param deviceInfo - Device info object to validate
 * @returns Validation result with format and missing fields
 */
export function validateDeviceInfo(deviceInfo: any): DeviceInfoValidation {
  // Handle null or non-object input
  if (!deviceInfo || typeof deviceInfo !== 'object') {
    return {
      isValid: false,
      format: 'null',
      missingFields: ['all'],
      warnings: ['Device info is null or not an object']
    };
  }

  const missingFields: string[] = [];
  const warnings: string[] = [];

  // Check for enhanced format fields
  const hasEnhanced = !!(
    deviceInfo.friendlyName ||
    deviceInfo.oem ||
    deviceInfo.browserDetails ||
    deviceInfo.platformDetails ||
    deviceInfo.allIPs
  );

  if (hasEnhanced) {
    // Validate enhanced format requirements
    if (!deviceInfo.friendlyName && !deviceInfo.oem) {
      missingFields.push('friendlyName or oem');
    }
    
    if (!deviceInfo.allIPs) {
      missingFields.push('allIPs');
    } else if (typeof deviceInfo.allIPs !== 'object') {
      warnings.push('allIPs is not an object');
    }
    
    if (!deviceInfo.browserDetails) {
      warnings.push('browserDetails missing (optional but recommended)');
    }
    
    if (!deviceInfo.platformDetails) {
      warnings.push('platformDetails missing (optional but recommended)');
    }

    return {
      isValid: missingFields.length === 0,
      format: 'enhanced',
      missingFields,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // Check for legacy format fields
  const hasLegacy = !!(
    deviceInfo.type ||
    deviceInfo.manufacturer ||
    deviceInfo.model ||
    deviceInfo.userAgent
  );

  if (hasLegacy) {
    // Validate legacy format requirements
    if (!deviceInfo.type) {
      missingFields.push('type');
    }
    
    if (!deviceInfo.manufacturer) {
      missingFields.push('manufacturer');
    }
    
    if (!deviceInfo.model) {
      missingFields.push('model');
    }
    
    if (!deviceInfo.userAgent) {
      warnings.push('userAgent missing (optional but recommended)');
    }

    return {
      isValid: missingFields.length === 0,
      format: 'legacy',
      missingFields,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // No recognizable format found
  return {
    isValid: false,
    format: 'invalid',
    missingFields: ['all required fields'],
    warnings: ['Device info does not match enhanced or legacy format']
  };
}

// ============================================================================
// Logging Functions
// ============================================================================

/**
 * Logs device info processing at each pipeline stage
 * 
 * Uses console.log for success and console.error for failures.
 * Includes structured data for easy filtering and analysis.
 * 
 * @param log - Structured log entry
 */
export function logDeviceInfo(log: DeviceInfoLog): void {
  const prefix = `[Device Info ${log.stage}]`;
  const message = log.success ? 'Success' : 'Failure';
  
  const logData = {
    attemptId: log.attemptId,
    hasData: log.hasData,
    dataFormat: log.dataFormat,
    ...log.details
  };

  if (log.success) {
    console.log(prefix, message, logData);
  } else {
    console.error(prefix, message, {
      ...logData,
      error: log.error
    });
  }
}

/**
 * Logs device info validation results
 * 
 * Helper function to log validation outcomes with appropriate detail.
 * 
 * @param stage - Pipeline stage where validation occurs
 * @param attemptId - Exam attempt ID
 * @param validation - Validation result
 */
export function logValidation(
  stage: DeviceInfoStage,
  attemptId: string | undefined,
  validation: DeviceInfoValidation
): void {
  logDeviceInfo({
    stage,
    attemptId,
    success: validation.isValid,
    hasData: validation.format !== 'null',
    dataFormat: validation.format,
    details: {
      missingFields: validation.missingFields,
      warnings: validation.warnings
    }
  });
}

/**
 * Logs JSON parsing attempts and results
 * 
 * Helper function for display stage when parsing stored JSON strings.
 * 
 * @param attemptId - Exam attempt ID
 * @param rawString - Raw JSON string being parsed
 * @param success - Whether parsing succeeded
 * @param error - Error message if parsing failed
 */
export function logJsonParsing(
  attemptId: string | undefined,
  rawString: string | null | undefined,
  success: boolean,
  error?: string
): void {
  // Ensure rawString is actually a string before calling substring
  const rawStr = typeof rawString === 'string' ? rawString : String(rawString || '');
  
  logDeviceInfo({
    stage: 'display',
    attemptId,
    success,
    hasData: !!rawString,
    error,
    details: {
      operation: 'JSON.parse',
      rawStringLength: rawStr.length,
      rawStringPreview: rawStr.substring(0, 100)
    }
  });
}

/**
 * Logs display fallback decisions
 * 
 * Helper function to track which display path is taken.
 * 
 * @param attemptId - Exam attempt ID
 * @param fallbackReason - Why fallback was triggered
 * @param displayValue - What will be displayed
 */
export function logDisplayFallback(
  attemptId: string | undefined,
  fallbackReason: string,
  displayValue: string
): void {
  logDeviceInfo({
    stage: 'display',
    attemptId,
    success: true,
    hasData: false,
    dataFormat: 'null',
    details: {
      operation: 'fallback',
      reason: fallbackReason,
      displayValue
    }
  });
}

// ============================================================================
// Console Diagnostic Commands
// ============================================================================

/**
 * Inspects device info for a specific attempt
 * Available as window.inspectDeviceInfo(attemptId) in browser console
 * 
 * @param attemptId - Exam attempt ID to inspect
 */
export async function inspectDeviceInfo(attemptId: string): Promise<void> {
  console.group(`🔍 Device Info Inspector - Attempt ${attemptId}`);
  
  try {
    // Fetch attempt data from API
    const response = await fetch(`/api/admin/attempts/${attemptId}/device-info`);
    
    if (!response.ok) {
      console.error('❌ Failed to fetch attempt data:', response.statusText);
      console.groupEnd();
      return;
    }
    
    const data = await response.json();
    
    // Display raw data
    console.log('📦 Raw Data:', data);
    
    // Parse and validate device info
    let deviceInfo = null;
    if (data.device_info) {
      try {
        deviceInfo = typeof data.device_info === 'string' 
          ? JSON.parse(data.device_info) 
          : data.device_info;
        console.log('✅ Parsed Device Info:', deviceInfo);
      } catch (e) {
        console.error('❌ Failed to parse device_info:', e);
      }
    } else {
      console.warn('⚠️ No device_info field found');
    }
    
    // Validate device info
    const validation = validateDeviceInfo(deviceInfo);
    console.log('🔬 Validation Result:', {
      isValid: validation.isValid,
      format: validation.format,
      missingFields: validation.missingFields,
      warnings: validation.warnings
    });
    
    // Display IP information
    if (data.ip_address) {
      console.log('🌐 IP Address:', data.ip_address);
    }
    
    // Display timestamps
    console.log('⏰ Timestamps:', {
      started: data.started_at,
      submitted: data.submitted_at
    });
    
  } catch (error) {
    console.error('❌ Error inspecting device info:', error);
  }
  
  console.groupEnd();
}

/**
 * Calculates device info statistics from health check results
 * 
 * @param healthResults - Array of health check results
 * @returns Aggregated statistics
 */
export function calculateDeviceInfoStats(healthResults: DeviceInfoHealth[]): DeviceInfoStats {
  const total = healthResults.length;
  const withDeviceInfo = healthResults.filter(h => h.hasDeviceInfo).length;
  const withoutDeviceInfo = total - withDeviceInfo;
  const enhanced = healthResults.filter(h => h.format === 'enhanced').length;
  const legacy = healthResults.filter(h => h.format === 'legacy').length;
  const invalid = healthResults.filter(h => h.format === 'invalid').length;
  const healthPercentage = total > 0 ? Math.round((withDeviceInfo / total) * 100) : 0;
  
  return {
    total,
    withDeviceInfo,
    withoutDeviceInfo,
    enhanced,
    legacy,
    invalid,
    healthPercentage
  };
}

// ============================================================================
// Browser Console Integration
// ============================================================================

/**
 * Registers diagnostic commands in browser console
 * Call this in client-side code to enable console commands
 */
export function registerConsoleCommands(): void {
  if (typeof window !== 'undefined') {
    (window as any).inspectDeviceInfo = inspectDeviceInfo;
    console.log('🔧 Device Info Diagnostics loaded. Use: inspectDeviceInfo(attemptId)');
  }
}
