/**
 * DeviceInfoCell Component
 * Displays enhanced device information with usage count in admin results table
 * Shows local IPs, device model, and automation risk indicators
 */

import { parseUserAgent, formatDeviceInfo, type DeviceInfo } from '@/lib/userAgent';
import { 
  logDeviceInfo, 
  logJsonParsing, 
  logDisplayFallback, 
  validateDeviceInfo,
  type DeviceInfoFormat 
} from '@/lib/deviceInfoDiagnostics';

export interface DeviceInfoCellProps {
  deviceInfo: string | null; // JSON string from database
  ipAddress: string | null;
  usageCount?: number;
}

interface EnhancedDeviceInfo {
  // Enhanced fields
  friendlyName?: string;
  oem?: {
    brand?: string;
    model?: string;
  };
  browserDetails?: {
    name?: string;
    version?: string;
  };
  platformDetails?: {
    os?: string;
    osVersion?: string;
  };
  allIPs?: {
    local?: Array<{ ip: string; type: string; family: string }>;
    public?: Array<{ ip: string; type: string; family: string }>;
    server?: string;
  };
  ips?: {
    ips?: Array<{ ip: string; type: string; family: string }>;
  };
  security?: {
    webdriver?: boolean;
    automationRisk?: boolean;
  };
  // Legacy fields
  userAgent?: string;
  raw?: string;
  type?: string;
  manufacturer?: string;
  model?: string;
}

/**
 * Display enhanced device model, local IP, and automation risk
 * Shows fallback for missing or invalid device info
 */
export default function DeviceInfoCell({ deviceInfo, ipAddress, usageCount }: DeviceInfoCellProps) {
  // Log component render entry point
  logDeviceInfo({
    stage: 'display',
    success: true,
    hasData: !!deviceInfo,
    details: {
      operation: 'render',
      hasDeviceInfo: !!deviceInfo,
      hasIpAddress: !!ipAddress,
      usageCount
    }
  });

  let parsedDevice: DeviceInfo | null = null;
  let enhancedInfo: EnhancedDeviceInfo | null = null;
  let displayText = 'Unknown Device';
  let tooltipContent = '';
  let hasAutomationRisk = false;
  let localIP: string | null = null;
  let isEnhanced = false;
  let detectedFormat: DeviceInfoFormat = 'null';

  // Parse device info if available
  if (deviceInfo) {
    try {
      // Sanitize JSON string before parsing
      let sanitizedDeviceInfo = deviceInfo;
      
      // Remove any leading/trailing whitespace
      sanitizedDeviceInfo = sanitizedDeviceInfo.trim();
      
      // Check if it's already a valid JSON string
      if (!sanitizedDeviceInfo.startsWith('{') && !sanitizedDeviceInfo.startsWith('[')) {
        logJsonParsing(undefined, deviceInfo, false, 'Invalid JSON format: does not start with { or [');
        throw new Error('Invalid JSON format');
      }
      
      // Try to fix common JSON issues
      try {
        // First attempt: parse as-is
        const parsed = JSON.parse(sanitizedDeviceInfo) as EnhancedDeviceInfo;
        enhancedInfo = parsed;
      } catch (firstError) {
        // Second attempt: try to fix common issues
        logDeviceInfo({
          stage: 'display',
          success: true,
          hasData: true,
          details: {
            operation: 'json_sanitization',
            reason: 'First parse attempt failed, trying sanitization',
            error: firstError instanceof Error ? firstError.message : String(firstError)
          }
        });
        
        // Remove any trailing commas before closing braces/brackets
        sanitizedDeviceInfo = sanitizedDeviceInfo.replace(/,(\s*[}\]])/g, '$1');
        
        // Try parsing again
        const parsed = JSON.parse(sanitizedDeviceInfo) as EnhancedDeviceInfo;
        enhancedInfo = parsed;
        
        logDeviceInfo({
          stage: 'display',
          success: true,
          hasData: true,
          details: {
            operation: 'json_sanitization',
            result: 'Sanitization successful, JSON parsed'
          }
        });
      }
      
      // Log successful JSON parsing
      logJsonParsing(undefined, deviceInfo, true);
      
      // Validate and detect format
      const validation = validateDeviceInfo(enhancedInfo);
      detectedFormat = validation.format;
      
      // Log format detection results
      logDeviceInfo({
        stage: 'display',
        success: true,
        hasData: true,
        dataFormat: detectedFormat,
        details: {
          operation: 'format_detection',
          isValid: validation.isValid,
          missingFields: validation.missingFields,
          warnings: validation.warnings
        }
      });
      
      // Check if this is enhanced device info (has new fields)
      isEnhanced = !!(enhancedInfo.friendlyName || enhancedInfo.oem || enhancedInfo.browserDetails || enhancedInfo.allIPs || enhancedInfo.ips);
      
      // Extract automation risk with null checks
      hasAutomationRisk = enhancedInfo.security?.automationRisk === true || enhancedInfo.security?.webdriver === true;
      
      // Extract local IP (prefer first local IPv4) with comprehensive null checks
      if (enhancedInfo.allIPs?.local && Array.isArray(enhancedInfo.allIPs.local) && enhancedInfo.allIPs.local.length > 0) {
        const ipv4Local = enhancedInfo.allIPs.local.find(ip => ip && ip.family === 'IPv4');
        localIP = ipv4Local?.ip || enhancedInfo.allIPs.local[0]?.ip || null;
      } else if (enhancedInfo.ips?.ips && Array.isArray(enhancedInfo.ips.ips) && enhancedInfo.ips.ips.length > 0) {
        const localIPs = enhancedInfo.ips.ips.filter(ip => ip && ip.type === 'local');
        const ipv4Local = localIPs.find(ip => ip && ip.family === 'IPv4');
        localIP = ipv4Local?.ip || localIPs[0]?.ip || null;
      }
      
      // Build display text from enhanced info with improved fallback chain
      // Priority: friendlyName → oem → browser+platform → legacy fields → userAgent → IP → Unknown
      if (enhancedInfo.friendlyName) {
        displayText = enhancedInfo.friendlyName;
        logDeviceInfo({
          stage: 'display',
          success: true,
          hasData: true,
          dataFormat: detectedFormat,
          details: {
            operation: 'display_path',
            path: 'friendlyName',
            value: displayText
          }
        });
      } else if (enhancedInfo.oem?.brand && enhancedInfo.oem?.model) {
        displayText = `${enhancedInfo.oem.brand} ${enhancedInfo.oem.model}`;
        logDeviceInfo({
          stage: 'display',
          success: true,
          hasData: true,
          dataFormat: detectedFormat,
          details: {
            operation: 'display_path',
            path: 'oem',
            value: displayText
          }
        });
      } else if (enhancedInfo.oem?.brand) {
        // Brand only
        displayText = enhancedInfo.oem.brand;
        logDeviceInfo({
          stage: 'display',
          success: true,
          hasData: true,
          dataFormat: detectedFormat,
          details: {
            operation: 'display_path',
            path: 'oem_brand_only',
            value: displayText
          }
        });
      } else if (enhancedInfo.browserDetails?.name && enhancedInfo.platformDetails?.os) {
        displayText = `${enhancedInfo.platformDetails.os} - ${enhancedInfo.browserDetails.name}`;
        logDeviceInfo({
          stage: 'display',
          success: true,
          hasData: true,
          dataFormat: detectedFormat,
          details: {
            operation: 'display_path',
            path: 'browser_platform',
            value: displayText
          }
        });
      } else if (enhancedInfo.platformDetails?.os) {
        // OS only
        displayText = enhancedInfo.platformDetails.os;
        logDeviceInfo({
          stage: 'display',
          success: true,
          hasData: true,
          dataFormat: detectedFormat,
          details: {
            operation: 'display_path',
            path: 'platform_os_only',
            value: displayText
          }
        });
      } else if (enhancedInfo.browserDetails?.name) {
        // Browser only
        displayText = enhancedInfo.browserDetails.name;
        logDeviceInfo({
          stage: 'display',
          success: true,
          hasData: true,
          dataFormat: detectedFormat,
          details: {
            operation: 'display_path',
            path: 'browser_name_only',
            value: displayText
          }
        });
      } else {
        // Fall back to legacy parsing
        if (enhancedInfo.type && enhancedInfo.manufacturer && enhancedInfo.model) {
          parsedDevice = enhancedInfo as unknown as DeviceInfo;
          displayText = formatDeviceInfo(parsedDevice, usageCount);
          logDeviceInfo({
            stage: 'display',
            success: true,
            hasData: true,
            dataFormat: 'legacy',
            details: {
              operation: 'display_path',
              path: 'legacy_fields',
              value: displayText
            }
          });
        } else if (enhancedInfo.userAgent) {
          parsedDevice = parseUserAgent(enhancedInfo.userAgent);
          displayText = formatDeviceInfo(parsedDevice, usageCount);
          logDeviceInfo({
            stage: 'display',
            success: true,
            hasData: true,
            dataFormat: 'legacy',
            details: {
              operation: 'display_path',
              path: 'userAgent_parsing',
              value: displayText
            }
          });
        } else if (enhancedInfo.raw) {
          parsedDevice = parseUserAgent(enhancedInfo.raw);
          displayText = formatDeviceInfo(parsedDevice, usageCount);
          logDeviceInfo({
            stage: 'display',
            success: true,
            hasData: true,
            dataFormat: 'legacy',
            details: {
              operation: 'display_path',
              path: 'raw_parsing',
              value: displayText
            }
          });
        } else if (ipAddress) {
          // Last resort: show IP as device identifier
          displayText = `Device (${ipAddress})`;
          logDisplayFallback(
            undefined,
            'No valid display fields found, using IP address',
            displayText
          );
        } else {
          // Absolute fallback
          logDisplayFallback(
            undefined,
            'No valid display fields found in parsed device info',
            displayText
          );
        }
      }
      
      // Build tooltip with enhanced details
      const tooltipParts: string[] = [];
      
      if (isEnhanced) {
        // Enhanced tooltip
        if (enhancedInfo.oem?.brand && enhancedInfo.oem?.model) {
          tooltipParts.push(`Device: ${enhancedInfo.oem.brand} ${enhancedInfo.oem.model}`);
        }
        
        if (enhancedInfo.browserDetails?.name && enhancedInfo.browserDetails?.version) {
          tooltipParts.push(`Browser: ${enhancedInfo.browserDetails.name} ${enhancedInfo.browserDetails.version}`);
        }
        
        if (enhancedInfo.platformDetails?.os && enhancedInfo.platformDetails?.osVersion) {
          tooltipParts.push(`OS: ${enhancedInfo.platformDetails.os} ${enhancedInfo.platformDetails.osVersion}`);
        }
        
        if (localIP) {
          tooltipParts.push(`Local IP: ${localIP}`);
        }
        
        if (ipAddress) {
          tooltipParts.push(`Server IP: ${ipAddress}`);
        }
        
        if (hasAutomationRisk) {
          tooltipParts.push('⚠️ Automation detected');
        }
        
        if (usageCount && usageCount > 1) {
          tooltipParts.push(`Used by ${usageCount} students`);
        }
      } else if (parsedDevice) {
        // Legacy tooltip
        tooltipParts.push(`Type: ${parsedDevice.type}`);
        tooltipParts.push(`Manufacturer: ${parsedDevice.manufacturer}`);
        tooltipParts.push(`Model: ${parsedDevice.model}`);
        if (ipAddress) {
          tooltipParts.push(`IP: ${ipAddress}`);
        }
        if (usageCount && usageCount > 1) {
          tooltipParts.push(`Used by ${usageCount} students`);
        }
      }
      
      tooltipContent = tooltipParts.join('\n');
      
    } catch (error) {
      // Log JSON parsing failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      logJsonParsing(undefined, deviceInfo, false, errorMessage);
      
      // If parsing fails, show fallback
      displayText = 'Unknown Device';
      tooltipContent = ipAddress ? `IP: ${ipAddress}` : '';
      
      // Log fallback trigger
      logDisplayFallback(
        undefined,
        `JSON parsing failed: ${errorMessage}`,
        displayText
      );
    }
  } else if (ipAddress) {
    // No device info but have IP
    displayText = 'Unknown Device';
    tooltipContent = `IP: ${ipAddress}`;
    
    // Log fallback trigger
    logDisplayFallback(
      undefined,
      'No device info provided, only IP address available',
      displayText
    );
  } else {
    // No device info and no IP
    // Log fallback trigger
    logDisplayFallback(
      undefined,
      'No device info or IP address available',
      displayText
    );
  }

  // Determine device type for icon
  const deviceType = enhancedInfo?.type || parsedDevice?.type || 'unknown';
  
  // For legacy format, add IP to display text (backward compatibility)
  const fullDisplay = !isEnhanced && ipAddress && !displayText.includes(ipAddress)
    ? `${displayText} • ${ipAddress}`
    : displayText;

  // Check if device info is missing or invalid
  const isMissingDeviceInfo = !deviceInfo || detectedFormat === 'null' || detectedFormat === 'invalid';

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Device type icon */}
          <span 
            className="text-base flex-shrink-0"
            title={`Device type: ${deviceType}`}
          >
            {deviceType === 'mobile' && '📱'}
            {deviceType === 'tablet' && '📱'}
            {deviceType === 'desktop' && '💻'}
            {deviceType === 'unknown' && '❓'}
          </span>
          
          {/* Device name/model */}
          <span 
            className="text-sm font-medium text-gray-900 truncate"
            title={tooltipContent || undefined}
          >
            {isEnhanced ? displayText : fullDisplay}
          </span>
          
          {/* Missing device info indicator */}
          {isMissingDeviceInfo && (
            <span 
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 flex-shrink-0"
              title="Device information not collected or invalid"
            >
              ⚠️ No Data
            </span>
          )}
          
          {/* Automation risk indicator */}
          {hasAutomationRisk && (
            <span 
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 flex-shrink-0"
              title="Automation tool detected"
            >
              ⚠️ Risk
            </span>
          )}
          
          {/* Usage count badge */}
          {usageCount && usageCount > 1 && (
            <span 
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 flex-shrink-0"
              title={`This device was used by ${usageCount} students`}
            >
              👥 {usageCount}
            </span>
          )}
        </div>
        
        {/* Second row: IPs */}
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-600">
          {/* Local IP (enhanced info) */}
          {isEnhanced && localIP && (
            <span className="font-mono" title="Local device IP (WebRTC)">
              🏠 {localIP}
            </span>
          )}
          
          {/* Server IP */}
          {ipAddress && (
            <span className="font-mono" title="Server-detected IP">
              {isEnhanced && localIP && '• '}
              🌐 {ipAddress}
            </span>
          )}
        </div>
        
        {/* Third row: Browser and OS (enhanced info only) */}
        {isEnhanced && (enhancedInfo?.browserDetails?.name || enhancedInfo?.platformDetails?.os) && (
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
            {enhancedInfo?.browserDetails?.name && (
              <span title={`Browser: ${enhancedInfo.browserDetails.name} ${enhancedInfo.browserDetails.version || ''}`}>
                {enhancedInfo.browserDetails.name} {enhancedInfo.browserDetails.version}
              </span>
            )}
            {enhancedInfo?.platformDetails?.os && (
              <span title={`OS: ${enhancedInfo.platformDetails.os} ${enhancedInfo.platformDetails.osVersion || ''}`}>
                {enhancedInfo?.browserDetails?.name && '•'} {enhancedInfo.platformDetails.os} {enhancedInfo.platformDetails.osVersion}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
