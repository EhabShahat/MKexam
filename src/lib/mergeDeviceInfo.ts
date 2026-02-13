/**
 * Server-side utility to merge client device info with server-detected IP
 * 
 * This function combines device information collected on the client side
 * with the IP address detected by the server, creating a comprehensive
 * device tracking record.
 */

import { logDeviceInfo, validateDeviceInfo, logValidation } from './deviceInfoDiagnostics';

export interface MergedDeviceInfo {
  serverDetectedIP: string;
  serverDetectedAt: string;
  allIPs: {
    local: any[];
    public: any[];
    server: string;
  };
  [key: string]: any;
}

/**
 * Merges client-collected device information with server-detected IP address
 * 
 * Requirements: 2.1, 2.2, 2.3, 7.1, 9.2
 * 
 * @param clientDeviceInfo - Device info collected on the client (may be null)
 * @param serverIP - IP address detected by the server
 * @param attemptId - Optional attempt ID for logging traceability
 * @returns Merged device info with allIPs structure
 */
export function mergeDeviceInfo(
  clientDeviceInfo: any,
  serverIP: string,
  attemptId?: string
): MergedDeviceInfo {
  try {
    // Ensure serverIP is valid
    const safeServerIP = serverIP || 'unknown';
    
    // Handle null or missing client device info
    if (!clientDeviceInfo || typeof clientDeviceInfo !== 'object') {
      logDeviceInfo({
        stage: 'merge',
        attemptId,
        success: true,
        hasData: false,
        dataFormat: 'null',
        details: {
          reason: 'Client device info is null or invalid',
          serverIP: safeServerIP,
          action: 'Creating minimal structure with server IP only'
        }
      });

      const minimalInfo: MergedDeviceInfo = {
        serverDetectedIP: safeServerIP,
        serverDetectedAt: new Date().toISOString(),
        allIPs: {
          local: [],
          public: [],
          server: safeServerIP
        }
      };

      return minimalInfo;
    }

    // Validate client device info before merging
    const validation = validateDeviceInfo(clientDeviceInfo);
    logValidation('merge', attemptId, validation);

    // Safely extract IPs with comprehensive null checks
    const ipsArray = Array.isArray(clientDeviceInfo?.ips?.ips) 
      ? clientDeviceInfo.ips.ips 
      : [];
    
    // Filter IPs with null checks on each IP object
    const localIPs = ipsArray.filter((ip: any) => 
      ip && typeof ip === 'object' && ip.type === 'local'
    );
    const publicIPs = ipsArray.filter((ip: any) => 
      ip && typeof ip === 'object' && ip.type === 'public'
    );

    // Add default values for missing fields
    const safeClientInfo = {
      ...clientDeviceInfo,
      // Ensure friendlyName has a fallback (but preserve empty string)
      friendlyName: clientDeviceInfo.friendlyName !== undefined 
        ? clientDeviceInfo.friendlyName
        : (clientDeviceInfo.oem?.brand && clientDeviceInfo.oem?.model 
          ? `${clientDeviceInfo.oem.brand} ${clientDeviceInfo.oem.model}` 
          : undefined),
      // Ensure oem structure exists
      oem: clientDeviceInfo.oem || {
        brand: null,
        model: null,
        source: null
      },
      // Ensure browserDetails structure exists
      browserDetails: clientDeviceInfo.browserDetails || {
        name: null,
        version: null,
        fullVersion: null,
        engine: null,
        engineVersion: null
      },
      // Ensure platformDetails structure exists
      platformDetails: clientDeviceInfo.platformDetails || {
        os: null,
        osVersion: null,
        architecture: null,
        bitness: null
      },
      // Ensure security structure exists
      security: clientDeviceInfo.security || {
        webdriver: false,
        automationRisk: false
      }
    };

    // Merge client info with server data - always create allIPs structure
    const mergedInfo: MergedDeviceInfo = {
      ...safeClientInfo,
      serverDetectedIP: safeServerIP,
      serverDetectedAt: new Date().toISOString(),
      allIPs: {
        local: localIPs,
        public: publicIPs,
        server: safeServerIP
      }
    };

    // Log successful merge with IP counts
    logDeviceInfo({
      stage: 'merge',
      attemptId,
      success: true,
      hasData: true,
      dataFormat: validation.format,
      details: {
        localIPCount: localIPs.length,
        publicIPCount: publicIPs.length,
        serverIP: safeServerIP,
        hasFingerprint: !!mergedInfo.fingerprint,
        hasFriendlyName: !!mergedInfo.friendlyName,
        hasOem: !!(mergedInfo.oem?.brand || mergedInfo.oem?.model),
        validationWarnings: validation.warnings,
        addedDefaults: {
          friendlyName: !clientDeviceInfo.friendlyName && !!mergedInfo.friendlyName,
          oem: !clientDeviceInfo.oem,
          browserDetails: !clientDeviceInfo.browserDetails,
          platformDetails: !clientDeviceInfo.platformDetails,
          security: !clientDeviceInfo.security
        }
      }
    });

    // Validate merged data structure
    const mergedValidation = isValidDeviceInfo(mergedInfo);
    if (!mergedValidation) {
      logDeviceInfo({
        stage: 'merge',
        attemptId,
        success: false,
        hasData: true,
        dataFormat: validation.format,
        error: 'Merged device info failed validation',
        details: {
          hasServerDetectedIP: !!mergedInfo.serverDetectedIP,
          hasAllIPs: !!mergedInfo.allIPs,
          allIPsStructure: mergedInfo.allIPs ? {
            hasLocal: Array.isArray(mergedInfo.allIPs.local),
            hasPublic: Array.isArray(mergedInfo.allIPs.public),
            hasServer: !!mergedInfo.allIPs.server
          } : null
        }
      });
    }

    return mergedInfo;

  } catch (error) {
    // Log merge failure with error details
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logDeviceInfo({
      stage: 'merge',
      attemptId,
      success: false,
      hasData: !!clientDeviceInfo,
      error: `Merge operation failed: ${errorMessage}`,
      details: {
        serverIP,
        errorStack,
        clientDeviceInfoType: typeof clientDeviceInfo,
        clientDeviceInfoKeys: clientDeviceInfo && typeof clientDeviceInfo === 'object' 
          ? Object.keys(clientDeviceInfo) 
          : []
      }
    });

    // Return minimal structure on error to prevent complete failure
    const safeServerIP = serverIP || 'unknown';
    return {
      serverDetectedIP: safeServerIP,
      serverDetectedAt: new Date().toISOString(),
      allIPs: {
        local: [],
        public: [],
        server: safeServerIP
      }
    };
  }
}

/**
 * Validates that device info has the required structure
 * 
 * @param deviceInfo - Device info to validate
 * @returns true if valid, false otherwise
 */
export function isValidDeviceInfo(deviceInfo: any): boolean {
  if (!deviceInfo || typeof deviceInfo !== 'object') return false;
  
  // Must have serverDetectedIP
  if (!deviceInfo.serverDetectedIP) return false;
  
  // Must have allIPs structure
  if (!deviceInfo.allIPs || typeof deviceInfo.allIPs !== 'object') return false;
  if (!Array.isArray(deviceInfo.allIPs.local)) return false;
  if (!Array.isArray(deviceInfo.allIPs.public)) return false;
  if (!deviceInfo.allIPs.server) return false;
  
  return true;
}
