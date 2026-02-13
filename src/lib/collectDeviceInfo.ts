/**
 * Enhanced Device Information Collection Module
 * 
 * This module collects comprehensive device information for exam security and tracking.
 * It gathers data from multiple sources including:
 * - WebRTC for local IP discovery
 * - User-Agent Client Hints API (Chromium browsers)
 * - Canvas fingerprinting for device identification
 * - Hardware APIs (CPU, memory, screen, GPU)
 * - Optional APIs (geolocation, network, battery)
 * - Security indicators (automation detection)
 * 
 * All collection is non-blocking and gracefully handles API unavailability.
 * 
 * @module collectDeviceInfo
 * @see Requirements 2.1-2.5, 3.1-3.6, 4.1-4.4, 5.1-5.5, 6.1-6.5, 7.1-7.2, 8.1-8.4
 */

import { discoverIPs, type IPDiscoveryResult } from './webrtcIpDiscovery';

/**
 * GPU (Graphics Processing Unit) information
 * Extracted from WebGL debug renderer info extension
 */
export interface GpuInfo {
  vendor: string | null;
  renderer: string | null;
}

/**
 * Geolocation data from browser Geolocation API
 * Requires user permission - gracefully handles denial
 */
export interface GeolocationData {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: number | null;
  error?: string | null;
}

/**
 * User-Agent Client Hints information
 * 
 * Available in Chromium-based browsers (Chrome, Edge, Opera).
 * Provides more detailed and accurate device information than User-Agent string.
 * 
 * Browser Support:
 * - Chrome/Edge 89+: Full support
 * - Firefox: Not supported
 * - Safari: Not supported
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/User-Agent_Client_Hints_API
 */
export interface ClientHintsInfo {
  architecture: string | null;  // e.g., "x86", "arm"
  bitness: string | null;        // e.g., "64", "32"
  model: string | null;          // Device model (e.g., "SM-G991B" for Samsung Galaxy S21)
  platform: string | null;       // OS name (e.g., "Android", "Windows")
  platformVersion: string | null; // OS version (e.g., "13.0.0")
  uaFullVersion: string | null;  // Full browser version (e.g., "120.0.6099.129")
  mobile: boolean | null;        // Whether device is mobile
  brands: Array<{ brand: string; version: string }> | null; // Browser brands
}

/**
 * Enhanced browser information
 * Extracted from User-Agent string and Client Hints
 */
export interface BrowserDetails {
  name: string | null;         // Browser name (e.g., "Chrome", "Firefox", "Safari")
  version: string | null;      // Major version (e.g., "120")
  fullVersion: string | null;  // Full version (e.g., "120.0.6099.129")
  engine: string | null;       // Rendering engine (e.g., "Blink", "Gecko", "WebKit")
  engineVersion: string | null; // Engine version
}

/**
 * Enhanced platform/operating system information
 * Extracted from User-Agent string and Client Hints
 */
export interface PlatformDetails {
  os: string | null;           // OS name (e.g., "Windows", "Android", "iOS", "macOS")
  osVersion: string | null;    // OS version (e.g., "13", "10/11")
  architecture: string | null; // CPU architecture (e.g., "x86", "arm")
  bitness: string | null;      // Architecture bitness (e.g., "64", "32")
}

/**
 * Screen hardware information
 */
export interface ScreenInfo {
  width: number | null;      // Screen width in pixels
  height: number | null;     // Screen height in pixels
  colorDepth: number | null; // Color depth in bits
  pixelDepth: number | null; // Pixel depth in bits
}

/**
 * Browser viewport information
 */
export interface ViewportInfo {
  width: number | null;  // Viewport width in pixels
  height: number | null; // Viewport height in pixels
}

/**
 * Network connection information
 * From Network Information API (experimental)
 * 
 * Browser Support:
 * - Chrome/Edge: Supported
 * - Firefox: Not supported
 * - Safari: Not supported
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 */
export interface NetworkInfo {
  type: string | null;          // Connection type (e.g., "wifi", "cellular")
  effectiveType: string | null; // Effective connection type (e.g., "4g", "3g")
  downlink: number | null;      // Downlink speed in Mbps
  rtt: number | null;           // Round-trip time in ms
  saveData: boolean | null;     // Whether data saver is enabled
}

/**
 * Battery status information
 * From Battery Status API (deprecated in some browsers)
 * 
 * Browser Support:
 * - Chrome/Edge: Deprecated (removed in Chrome 103+)
 * - Firefox: Supported
 * - Safari: Not supported
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API
 */
export interface BatteryInfo {
  level: number | null;    // Battery level (0-100)
  charging: boolean | null; // Whether device is charging
}

/**
 * Security and automation detection indicators
 * Used to identify potential cheating or automated exam attempts
 */
export interface SecurityInfo {
  webdriver: boolean;          // Whether browser is controlled by automation (Selenium, Puppeteer)
  pdfViewer: boolean;          // Whether PDF viewer is enabled
  doNotTrack: boolean;         // Whether Do Not Track is enabled
  pluginsCount: number;        // Number of browser plugins
  cookiesEnabled: boolean | null; // Whether cookies are enabled
  isExtended: boolean | null;  // Whether multiple monitors are detected
  maxTouchPoints: number;      // Maximum number of simultaneous touch points
  automationRisk: boolean;     // Calculated risk flag (true if suspicious patterns detected)
}

/**
 * Parsed User-Agent information (legacy format)
 * Maintained for backward compatibility
 */
export interface ParsedUA {
  browser: {
    name: string | null;    // Browser name
    version: string | null; // Browser version
  };
  os: {
    name: string | null;    // OS name
    version: string | null; // OS version
  };
  device: {
    type: string | null;    // Device type ("mobile", "tablet", "desktop")
  };
}

/**
 * OEM (Original Equipment Manufacturer) device information
 * Identifies device manufacturer and model
 */
export interface OEMInfo {
  brand: string | null;  // Manufacturer (e.g., "Samsung", "Apple", "Xiaomi")
  model: string | null;  // Device model (e.g., "SM-G991B", "iPhone")
  source: string | null; // Data source ("ua-ch" for Client Hints, "ua" for User-Agent)
}

/**
 * Collects comprehensive device information for exam tracking and security
 * 
 * This is the main entry point for device information collection. It gathers data from
 * multiple sources in parallel and organizes it into structured categories.
 * 
 * Collection Process:
 * 1. WebRTC IP Discovery (5s timeout)
 * 2. Canvas Fingerprint Generation
 * 3. Geolocation Request (5s timeout, requires permission)
 * 4. User-Agent Client Hints (Chromium only)
 * 5. Hardware Info (CPU, RAM, Screen, GPU)
 * 6. Network Info (experimental API)
 * 7. Battery Info (deprecated API)
 * 8. Security Indicators (automation detection)
 * 
 * All collection is non-blocking and gracefully handles:
 * - API unavailability
 * - Permission denials
 * - Timeouts
 * - Browser incompatibilities
 * 
 * @param submitClicks - Optional tracking data for form submission attempts
 * @returns Complete device info object or null if collection fails
 * 
 * @see Requirements 1.1-1.5, 2.1-2.5, 3.1-3.6, 4.1-4.4, 5.1-5.5, 6.1-6.5, 7.1-7.2, 8.1-8.4
 */
export async function collectDetailedDeviceInfo(submitClicks?: { count: number; firstAt: string | null; lastAt: string | null; timestamps: string[] }) {
  const startTime = Date.now();
  
  // Log entry point
  console.log('[Device Collection] Starting device info collection:', {
    hasSubmitClicks: !!submitClicks,
    submitClickCount: submitClicks?.count,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Browser compatibility check
    const nav = typeof navigator !== "undefined" ? (navigator as any) : ({} as any);
    const scr = typeof screen !== "undefined" ? (screen as any) : ({} as any);
    const win = typeof window !== "undefined" ? (window as any) : ({} as any);
    
    // Check for unsupported browsers (very old browsers without basic APIs)
    const isUnsupportedBrowser = !nav.userAgent || typeof Promise === 'undefined';
    if (isUnsupportedBrowser) {
      console.warn('[Device Collection] Unsupported browser detected, returning minimal data:', {
        hasUserAgent: !!nav.userAgent,
        hasPromise: typeof Promise !== 'undefined',
        timestamp: new Date().toISOString()
      });
      
      // Return minimal fallback data for unsupported browsers
      return {
        collectedAt: new Date().toISOString(),
        friendlyName: "Unsupported Browser",
        userAgent: nav.userAgent || "Unknown",
        platform: nav.platform || null,
        browserDetails: { name: "Unknown", version: null, fullVersion: null, engine: null, engineVersion: null },
        platformDetails: { os: null, osVersion: null, architecture: null, bitness: null },
        unsupportedBrowser: true,
        entrySubmit: submitClicks || null
      };
    }

    // 1. WebRTC IP Discovery (new - run in parallel with other collection)
    const ipDiscoveryPromise = discoverIPs(5000).catch((err) => {
      console.warn('[Device Collection] WebRTC IP discovery failed:', {
        error: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : undefined
      });
      return {
        ips: [],
        error: err?.message || 'IP discovery failed',
        completedAt: new Date().toISOString()
      } as IPDiscoveryResult;
    });

    // 2. Basic Fingerprint (Canvas based)
    const fingerprint = (() => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.textBaseline = 'top';
        ctx.font = '14px "Arial"';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('fingerprint', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('fingerprint', 4, 17);
        const b64 = canvas.toDataURL().replace("data:image/png;base64,", "");
        // Hash the b64 string (simple hash function)
        let hash = 0;
        for (let i = 0; i < b64.length; i++) {
          const char = b64.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash |= 0;
        }
        return Math.abs(hash).toString(16);
      } catch {
        return null;
      }
    })();

    // 3. Geolocation (Returns a promise)
    const getGeolocation = (): Promise<GeolocationData> => {
      return new Promise((resolve) => {
        if (!nav.geolocation) {
          resolve({ latitude: null, longitude: null, accuracy: null, timestamp: null, error: "not_supported" });
          return;
        }
        nav.geolocation.getCurrentPosition(
          (pos: GeolocationPosition) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp,
            });
          },
          (err: GeolocationPositionError) => {
            resolve({ latitude: null, longitude: null, accuracy: null, timestamp: null, error: err.message });
          },
          { timeout: 5000, enableHighAccuracy: false }
        );
      });
    };

    const location = await getGeolocation();

    // 4. Hardware / Environment Info
    const tz = (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
    })();

    const ua = typeof nav.userAgent === "string" ? nav.userAgent : "";

    // 5. User-Agent Client Hints (Enhanced - Chromium)
    let clientHints: ClientHintsInfo | null = null;
    try {
      if (nav.userAgentData && typeof nav.userAgentData.getHighEntropyValues === "function") {
        const hints = await nav.userAgentData.getHighEntropyValues([
          'architecture',
          'bitness',
          'model',
          'platform',
          'platformVersion',
          'uaFullVersion'
        ]);
        clientHints = {
          architecture: hints.architecture ?? null,
          bitness: hints.bitness ?? null,
          model: hints.model ?? null,
          platform: hints.platform ?? null,
          platformVersion: hints.platformVersion ?? null,
          uaFullVersion: hints.uaFullVersion ?? null,
          mobile: nav.userAgentData.mobile ?? null,
          brands: nav.userAgentData.brands ?? null
        };
        console.log('[Device Collection] Client Hints collected successfully');
      } else {
        console.warn('[Device Collection] Client Hints API not available');
      }
    } catch (e) {
      console.warn('[Device Collection] Client Hints collection failed:', {
        error: e instanceof Error ? e.message : String(e),
        name: e instanceof Error ? e.name : undefined
      });
    }

    // 6. Enhanced Browser and Platform Detection
    const parsed = parseUA(ua, nav.userAgentData);
    const browserDetails = extractBrowserDetails(ua, clientHints);
    const platformDetails = extractPlatformDetails(ua, clientHints);
    
    // 7. Enhanced Device Model Detection
    const modelFromUA = extractModelFromUA(ua);
    const deviceModel = clientHints?.model || modelFromUA || null;
    const deviceBrand = inferVendor(platformDetails.os || null, deviceModel, ua);

    // 8. Derived Friendly Name
    const friendlyName = generateFriendlyName({
      brand: deviceBrand,
      model: deviceModel,
      os: platformDetails.os,
      osVersion: platformDetails.osVersion,
      browser: browserDetails.name,
      browserVersion: browserDetails.version
    });

    // 9. Security / Anti-Cheat Signals
    let isExtended = null;
    try {
      if ('isExtended' in win.screen) {
        isExtended = (win.screen as any).isExtended;
      }
    } catch { }

    const security: SecurityInfo = {
      webdriver: nav.webdriver ?? false,
      pdfViewer: nav.pdfViewerEnabled ?? false,
      doNotTrack: nav.doNotTrack === "1" || nav.doNotTrack === "yes",
      pluginsCount: nav.plugins?.length ?? 0,
      cookiesEnabled: nav.cookieEnabled ?? null,
      isExtended, // Detects multiple monitors
      maxTouchPoints: nav.maxTouchPoints ?? 0,
      automationRisk: (nav.webdriver) || (nav.plugins?.length === 0 && browserDetails.name !== "Firefox"),
    };

    // 10. Network
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection || null;
    const network: NetworkInfo | null = conn ? {
      type: conn.type ?? null,
      effectiveType: conn.effectiveType ?? null,
      downlink: typeof conn.downlink === "number" ? conn.downlink : null,
      rtt: typeof conn.rtt === "number" ? conn.rtt : null,
      saveData: typeof conn.saveData === "boolean" ? conn.saveData : null,
    } : null;

    // 11. Battery
    let battery: BatteryInfo | null = null;
    try {
      if (typeof nav.getBattery === "function") {
        const b = await nav.getBattery();
        battery = {
          level: typeof b.level === "number" ? Math.round(b.level * 100) : null,
          charging: typeof b.charging === "boolean" ? b.charging : null,
        };
        console.log('[Device Collection] Battery info collected successfully');
      } else {
        console.warn('[Device Collection] Battery API not available');
      }
    } catch (e) {
      console.warn('[Device Collection] Battery API collection failed:', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    // 12. GPU
    let gpu: GpuInfo | null = null;
    try {
      const canvas = document.createElement("canvas");
      const gl: any = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        if (dbg) {
          gpu = {
            vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL),
            renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
          };
          console.log('[Device Collection] GPU info collected successfully');
        } else {
          console.warn('[Device Collection] WEBGL_debug_renderer_info extension not available');
        }
      } else {
        console.warn('[Device Collection] WebGL not available');
      }
    } catch (e) {
      console.warn('[Device Collection] GPU info collection failed:', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    // 13. Wait for IP discovery to complete
    const ips = await ipDiscoveryPromise;

    const duration = Date.now() - startTime;

    // Log successful collection with comprehensive data summary
    console.log('[Device Collection] Device info collected successfully:', {
      duration: `${duration}ms`,
      hasFingerprint: !!fingerprint,
      hasLocation: !!(location.latitude && location.longitude),
      hasClientHints: !!clientHints,
      hasNetwork: !!network,
      hasBattery: !!battery,
      hasGPU: !!gpu,
      ipCount: ips.ips.length,
      ipError: ips.error,
      friendlyName,
      deviceBrand,
      deviceModel,
      browserName: browserDetails.name,
      browserVersion: browserDetails.version,
      osName: platformDetails.os,
      osVersion: platformDetails.osVersion,
      automationRisk: security.automationRisk,
      webdriver: security.webdriver,
      timestamp: new Date().toISOString()
    });

    // Organize data into structured categories as per Requirements 8.1, 8.2, 8.3, 8.4
    return {
      // Timestamp (Requirement 8.3)
      collectedAt: new Date().toISOString(),
      
      // Identification
      friendlyName,
      fingerprint,
      
      // Enhanced browser and platform details
      browserDetails,
      platformDetails,
      clientHints,
      
      // Hardware section (organized category - Requirement 8.2)
      deviceMemory: nav.deviceMemory ?? null,
      hardwareConcurrency: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
      pixelRatio: typeof win.devicePixelRatio === "number" ? win.devicePixelRatio : null,
      touch: ("ontouchstart" in win || nav.maxTouchPoints > 0),
      screen: {
        width: scr.width ?? null,
        height: scr.height ?? null,
        colorDepth: scr.colorDepth ?? null,
        pixelDepth: scr.pixelDepth ?? null,
      },
      viewport: {
        width: typeof win.innerWidth === "number" ? win.innerWidth : null,
        height: typeof win.innerHeight === "number" ? win.innerHeight : null,
      },
      gpu,
      
      // Network section (organized category - Requirement 8.2)
      network,
      ips,
      
      // Security section (organized category - Requirement 8.2)
      security,
      
      // Location section (organized category - Requirement 8.2)
      location,
      
      // Locale section (organized category - Requirement 8.2)
      timezone: tz,
      timezoneOffset: new Date().getTimezoneOffset(),
      language: nav.language ?? null,
      languages: Array.isArray(nav.languages) ? nav.languages : null,
      
      // Device identification
      parsed,
      oem: {
        brand: deviceBrand,
        model: deviceModel,
        source: clientHints?.model ? "ua-ch" : (modelFromUA ? "ua" : null),
      },
      
      // Battery (optional API)
      battery,
      
      // Original fields (maintained for compatibility)
      userAgent: ua || null,
      platform: nav.platform ?? null,
      vendor: nav.vendor ?? null,
      
      // Entry submission tracking
      entrySubmit: submitClicks || null,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    
    // Log collection failure with comprehensive error details
    console.error("[Device Collection] Failed to collect device info:", {
      duration: `${duration}ms`,
      error: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : undefined,
      stack: err instanceof Error ? err.stack : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unavailable',
      timestamp: new Date().toISOString()
    });
    return null;
  }
}

/**
 * Extracts enhanced browser details from User-Agent string and Client Hints
 * 
 * Detects:
 * - Browser name (Chrome, Firefox, Safari, Edge, Opera)
 * - Browser version (major and full version)
 * - Rendering engine (Blink, Gecko, WebKit)
 * - Engine version
 * 
 * Prioritizes Client Hints data when available for accuracy.
 * 
 * @param uaStr - User-Agent string
 * @param clientHints - Client Hints data (may be null)
 * @returns Enhanced browser details
 * 
 * @see Requirement 2.1
 */
function extractBrowserDetails(uaStr: string, clientHints: ClientHintsInfo | null): BrowserDetails {
  const details: BrowserDetails = {
    name: null,
    version: null,
    fullVersion: null,
    engine: null,
    engineVersion: null
  };

  // Use Client Hints full version if available
  if (clientHints?.uaFullVersion) {
    details.fullVersion = clientHints.uaFullVersion;
  }

  // Browser detection with version extraction
  if (uaStr.includes("Edg/")) {
    details.name = "Edge";
    const match = uaStr.match(/Edg\/([0-9.]+)/);
    if (match) {
      details.version = match[1].split('.')[0];
      details.fullVersion = details.fullVersion || match[1];
    }
    details.engine = "Blink";
  } else if (uaStr.includes("OPR/") || uaStr.includes("Opera/")) {
    details.name = "Opera";
    const match = uaStr.match(/(?:OPR|Opera)\/([0-9.]+)/);
    if (match) {
      details.version = match[1].split('.')[0];
      details.fullVersion = details.fullVersion || match[1];
    }
    details.engine = "Blink";
  } else if (uaStr.includes("Chrome/")) {
    details.name = "Chrome";
    const match = uaStr.match(/Chrome\/([0-9.]+)/);
    if (match) {
      details.version = match[1].split('.')[0];
      details.fullVersion = details.fullVersion || match[1];
    }
    details.engine = "Blink";
  } else if (uaStr.includes("Firefox/")) {
    details.name = "Firefox";
    const match = uaStr.match(/Firefox\/([0-9.]+)/);
    if (match) {
      details.version = match[1].split('.')[0];
      details.fullVersion = details.fullVersion || match[1];
    }
    details.engine = "Gecko";
  } else if (uaStr.includes("Safari/") && !uaStr.includes("Chrome")) {
    details.name = "Safari";
    const versionMatch = uaStr.match(/Version\/([0-9.]+)/);
    if (versionMatch) {
      details.version = versionMatch[1].split('.')[0];
      details.fullVersion = details.fullVersion || versionMatch[1];
    }
    details.engine = "WebKit";
  }

  // Extract engine version
  if (details.engine === "Blink" || details.engine === "WebKit") {
    const appleWebKitMatch = uaStr.match(/AppleWebKit\/([0-9.]+)/);
    if (appleWebKitMatch) {
      details.engineVersion = appleWebKitMatch[1];
    }
  } else if (details.engine === "Gecko") {
    const geckoMatch = uaStr.match(/rv:([0-9.]+)/);
    if (geckoMatch) {
      details.engineVersion = geckoMatch[1];
    }
  }

  return details;
}

/**
 * Extracts enhanced platform/OS details from User-Agent string and Client Hints
 * 
 * Detects:
 * - OS name (Windows, Android, iOS, macOS, Linux, ChromeOS)
 * - OS version with proper mapping (e.g., Windows NT 10.0 → Windows 10/11)
 * - CPU architecture (x86, arm)
 * - Architecture bitness (32, 64)
 * 
 * Prioritizes Client Hints data when available for accuracy.
 * Falls back to User-Agent parsing for non-Chromium browsers.
 * 
 * @param uaStr - User-Agent string
 * @param clientHints - Client Hints data (may be null)
 * @returns Enhanced platform details
 * 
 * @see Requirement 2.2
 */
function extractPlatformDetails(uaStr: string, clientHints: ClientHintsInfo | null): PlatformDetails {
  const details: PlatformDetails = {
    os: null,
    osVersion: null,
    architecture: clientHints?.architecture || null,
    bitness: clientHints?.bitness || null
  };

  // Use Client Hints platform info if available
  if (clientHints?.platform) {
    details.os = clientHints.platform;
    if (clientHints.platformVersion) {
      details.osVersion = clientHints.platformVersion;
    }
  }

  // OS Detection from UA string (fallback or enhancement)
  if (uaStr.includes("Windows NT")) {
    details.os = details.os || "Windows";
    const match = uaStr.match(/Windows NT ([0-9.]+)/);
    if (match && !details.osVersion) {
      const ntVersion = match[1];
      // Map NT version to Windows version
      const versionMap: Record<string, string> = {
        '10.0': '10/11', // Windows 10 and 11 both use NT 10.0
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7',
        '6.0': 'Vista'
      };
      details.osVersion = versionMap[ntVersion] || ntVersion;
    }
  } else if (uaStr.includes("Android")) {
    details.os = details.os || "Android";
    const match = uaStr.match(/Android ([0-9.]+)/);
    if (match && !details.osVersion) {
      details.osVersion = match[1];
    }
  } else if (uaStr.includes("iPhone") || uaStr.includes("iPad")) {
    details.os = details.os || "iOS";
    const match = uaStr.match(/OS ([0-9_]+)/);
    if (match && !details.osVersion) {
      details.osVersion = match[1].replace(/_/g, '.');
    }
  } else if (uaStr.includes("Mac OS X")) {
    details.os = details.os || "macOS";
    const match = uaStr.match(/Mac OS X ([0-9_]+)/);
    if (match && !details.osVersion) {
      details.osVersion = match[1].replace(/_/g, '.');
    }
  } else if (uaStr.includes("CrOS")) {
    details.os = details.os || "ChromeOS";
    const match = uaStr.match(/CrOS [^ ]+ ([0-9.]+)/);
    if (match && !details.osVersion) {
      details.osVersion = match[1];
    }
  } else if (uaStr.includes("Linux")) {
    details.os = details.os || "Linux";
  }

  // Infer architecture from UA if not available from Client Hints
  if (!details.architecture) {
    if (uaStr.includes("x86_64") || uaStr.includes("x64") || uaStr.includes("Win64") || uaStr.includes("WOW64")) {
      details.architecture = "x86";
      details.bitness = details.bitness || "64";
    } else if (uaStr.includes("arm64") || uaStr.includes("aarch64")) {
      details.architecture = "arm";
      details.bitness = details.bitness || "64";
    } else if (uaStr.includes("armv7") || uaStr.includes("armv8")) {
      details.architecture = "arm";
    }
  }

  return details;
}

/**
 * Generates a human-readable device name from available information
 * 
 * Format: "[Brand] [Model] ([OS Version]) [Browser Version]"
 * Example: "Samsung Galaxy S21 (Android 13) Chrome 120"
 * 
 * Gracefully handles missing information by omitting unavailable parts.
 * Always returns a non-empty string (defaults to "Unknown Device").
 * 
 * @param parts - Device information components
 * @returns Friendly device name string
 * 
 * @see Requirement 4.4
 */
function generateFriendlyName(parts: {
  brand: string | null;
  model: string | null;
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
}): string {
  const nameParts: string[] = [];

  // Add brand and model
  if (parts.brand) {
    nameParts.push(parts.brand);
  }
  if (parts.model && parts.model !== parts.brand) {
    nameParts.push(parts.model);
  }

  // Add OS with version
  if (parts.os) {
    if (parts.osVersion) {
      nameParts.push(`(${parts.os} ${parts.osVersion})`);
    } else {
      nameParts.push(`(${parts.os})`);
    }
  }

  // Add browser with version
  if (parts.browser) {
    if (parts.browserVersion) {
      nameParts.push(`${parts.browser} ${parts.browserVersion}`);
    } else {
      nameParts.push(parts.browser);
    }
  }

  return nameParts.length > 0 ? nameParts.join(" ") : "Unknown Device";
}

/**
 * Parses User-Agent string into structured format (legacy function)
 * 
 * This is a simplified parser maintained for backward compatibility.
 * For enhanced parsing, use extractBrowserDetails() and extractPlatformDetails().
 * 
 * @param uaStr - User-Agent string
 * @param uaData - Optional User-Agent Client Hints data
 * @returns Parsed UA information
 * 
 * @deprecated Use extractBrowserDetails() and extractPlatformDetails() instead
 */
function parseUA(uaStr: string, uaData?: any): ParsedUA {
  const b: any = { name: null, version: null };
  const o: any = { name: null, version: null };
  const d: any = { type: null };

  // Simple Browser Detection
  if (uaStr.includes("Edg/")) { 
    b.name = "Edge";
    const match = uaStr.match(/Edg\/([0-9]+)/);
    if (match) b.version = match[1];
  }
  else if (uaStr.includes("OPR/")) { 
    b.name = "Opera";
    const match = uaStr.match(/OPR\/([0-9]+)/);
    if (match) b.version = match[1];
  }
  else if (uaStr.includes("Chrome/")) { 
    b.name = "Chrome";
    const match = uaStr.match(/Chrome\/([0-9]+)/);
    if (match) b.version = match[1];
  }
  else if (uaStr.includes("Firefox/")) { 
    b.name = "Firefox";
    const match = uaStr.match(/Firefox\/([0-9]+)/);
    if (match) b.version = match[1];
  }
  else if (uaStr.includes("Safari/")) { 
    b.name = "Safari";
    const match = uaStr.match(/Version\/([0-9]+)/);
    if (match) b.version = match[1];
  }

  // Simple OS Detection
  if (uaStr.includes("Windows NT")) {
    o.name = "Windows";
    const match = uaStr.match(/Windows NT ([0-9.]+)/);
    if (match) o.version = match[1];
  }
  else if (uaStr.includes("Android")) {
    o.name = "Android";
    const match = uaStr.match(/Android ([0-9.]+)/);
    if (match) o.version = match[1];
  }
  else if (uaStr.includes("iPhone") || uaStr.includes("iPad")) {
    o.name = "iOS";
    const match = uaStr.match(/OS ([0-9_]+)/);
    if (match) o.version = match[1].replace(/_/g, '.');
  }
  else if (uaStr.includes("Mac OS X")) {
    o.name = "macOS";
    const match = uaStr.match(/Mac OS X ([0-9_]+)/);
    if (match) o.version = match[1].replace(/_/g, '.');
  }
  else if (uaStr.includes("CrOS")) {
    o.name = "ChromeOS";
  }
  else if (uaStr.includes("Linux")) {
    o.name = "Linux";
  }

  // Device type
  if (uaData?.mobile === true || /Mobi|Android/.test(uaStr)) d.type = "mobile";
  else if (/iPad|Tablet/.test(uaStr)) d.type = "tablet";
  else d.type = "desktop";

  return { browser: b, os: o, device: d };
}

/**
 * Extracts device model from User-Agent string using pattern matching
 * 
 * Supports major manufacturers:
 * - Samsung (SM-XXXX format)
 * - Apple (iPhone, iPad, iPod)
 * - Google (Pixel devices)
 * - Xiaomi/Redmi/POCO
 * - OPPO (CPH models)
 * - Realme (RMX models)
 * - Huawei/Honor
 * - Vivo
 * - Motorola
 * - OnePlus
 * - And others via generic Android Build format
 * 
 * Falls back to generic patterns when specific manufacturer patterns don't match.
 * 
 * @param ua - User-Agent string
 * @returns Device model string or null if not detected
 * 
 * @see Requirements 4.1, 4.2
 */
function extractModelFromUA(ua: string): string | null {
  // Samsung devices (SM-XXXX format)
  const samsungMatch = ua.match(/SM-[A-Z0-9]+/);
  if (samsungMatch) return samsungMatch[0];

  // Generic Android Build format
  const buildMatch = ua.match(/;\s*([A-Za-z0-9_\-\s]+)\s+Build\//);
  if (buildMatch && buildMatch[1]) {
    const model = buildMatch[1].trim();
    // Filter out generic/non-specific model names
    if (model && !['Android', 'Linux', 'Mobile'].includes(model)) {
      return model;
    }
  }

  // Google Pixel devices
  const pixelMatch = ua.match(/(Pixel\s+[A-Za-z0-9\s]+)/);
  if (pixelMatch && pixelMatch[1]) return pixelMatch[1].trim();

  // Xiaomi/Redmi/POCO devices
  const xiaomiMatch = ua.match(/((?:Redmi|POCO|Mi)\s+[A-Za-z0-9\s]+)/);
  if (xiaomiMatch && xiaomiMatch[1]) {
    const model = xiaomiMatch[1].trim();
    // Remove trailing "Build" if present
    return model.replace(/\s+Build$/, '');
  }

  // OPPO devices
  const oppoMatch = ua.match(/(CPH[0-9]+|OPPO\s+[A-Za-z0-9]+)/);
  if (oppoMatch && oppoMatch[1]) return oppoMatch[1].trim();

  // Realme devices
  const realmeMatch = ua.match(/(RMX[0-9]+|realme\s+[A-Za-z0-9\s]+)/);
  if (realmeMatch && realmeMatch[1]) return realmeMatch[1].trim();

  // Huawei/Honor devices
  const huaweiMatch = ua.match(/((?:HW|MAR|ELE|VOG|ALP|ANE|FIG|INE|LYA|SEA|STK|VTR|WAS)-[A-Z0-9]+)/);
  if (huaweiMatch && huaweiMatch[1]) return huaweiMatch[1];

  // Vivo devices
  const vivoMatch = ua.match(/(V[0-9]{4}[A-Z]*|vivo\s+[A-Za-z0-9\s]+)/);
  if (vivoMatch && vivoMatch[1]) return vivoMatch[1].trim();

  // Motorola devices
  const motorolaMatch = ua.match(/(moto\s+[a-z0-9\s]+)/i);
  if (motorolaMatch && motorolaMatch[1]) return motorolaMatch[1].trim();

  // OnePlus devices
  const oneplusMatch = ua.match(/((?:OnePlus|ONEPLUS)\s*[A-Z0-9]+)/);
  if (oneplusMatch && oneplusMatch[1]) return oneplusMatch[1].trim();

  // Apple devices
  if (/iPhone/.test(ua)) {
    // Try to extract iPhone model from iOS version context
    const iphoneMatch = ua.match(/iPhone\s*([0-9,]+)?/);
    return iphoneMatch ? 'iPhone' : 'iPhone';
  }
  if (/iPad/.test(ua)) {
    const ipadMatch = ua.match(/iPad([0-9,]+)?/);
    return ipadMatch ? 'iPad' : 'iPad';
  }
  if (/iPod/.test(ua)) return 'iPod';

  return null;
}

/**
 * Infers device manufacturer/brand from OS, model, and User-Agent string
 * 
 * Uses multiple signals to identify manufacturer:
 * - OS name (iOS → Apple)
 * - Model prefixes (SM- → Samsung, CPH → OPPO)
 * - User-Agent keywords
 * 
 * Supports major manufacturers:
 * - Apple, Samsung, Google, Xiaomi, OPPO, Realme, Huawei, Honor
 * - Vivo, Motorola, OnePlus, Nokia, Sony, LG, HTC, Asus, Lenovo
 * 
 * @param osName - Operating system name
 * @param model - Device model string
 * @param uaStr - User-Agent string
 * @returns Manufacturer name or null if not detected
 * 
 * @see Requirement 4.3
 */
function inferVendor(osName: string | null, model: string | null, uaStr: string): string | null {
  const m = (model || "").toUpperCase();
  const u = (uaStr || "").toUpperCase();
  const os = (osName || "").toUpperCase();

  // Apple devices
  if (os.includes("IOS") || /IPHONE|IPAD|IPOD|MACINTOSH|MAC OS/.test(u)) {
    return "Apple";
  }

  // Samsung devices
  if (u.includes("SAMSUNG") || m.startsWith("SM-") || m.startsWith("GT-")) {
    return "Samsung";
  }

  // Google Pixel
  if (m.includes("PIXEL") || u.includes("PIXEL")) {
    return "Google";
  }

  // Xiaomi family (Xiaomi, Redmi, POCO, Mi)
  if (u.includes("XIAOMI") || u.includes("REDMI") || u.includes("POCO") || 
      m.includes("REDMI") || m.includes("POCO") || m.startsWith("MI ")) {
    return "Xiaomi";
  }

  // OPPO
  if (u.includes("OPPO") || m.startsWith("CPH")) {
    return "OPPO";
  }

  // Realme
  if (u.includes("REALME") || m.startsWith("RMX")) {
    return "realme";
  }

  // Huawei
  if (u.includes("HUAWEI") || /HW-|MAR-|ELE-|VOG-|ALP-|ANE-|FIG-|INE-|LYA-|SEA-|STK-|VTR-|WAS-/.test(m)) {
    return "Huawei";
  }

  // Honor
  if (u.includes("HONOR")) {
    return "Honor";
  }

  // Vivo
  if (u.includes("VIVO") || /^V[0-9]{4}/.test(m)) {
    return "vivo";
  }

  // Motorola
  if (u.includes("MOTOROLA") || m.includes("MOTO")) {
    return "Motorola";
  }

  // OnePlus
  if (u.includes("ONEPLUS") || m.includes("ONEPLUS")) {
    return "OnePlus";
  }

  // Nokia
  if (u.includes("NOKIA")) {
    return "Nokia";
  }

  // Sony
  if (u.includes("SONY") || m.startsWith("SO-") || m.startsWith("SOV")) {
    return "Sony";
  }

  // LG
  if (u.includes("LG-") || m.startsWith("LG-")) {
    return "LG";
  }

  // HTC
  if (u.includes("HTC")) {
    return "HTC";
  }

  // Asus
  if (u.includes("ASUS") || m.includes("ASUS")) {
    return "Asus";
  }

  // Lenovo
  if (u.includes("LENOVO")) {
    return "Lenovo";
  }

  return null;
}
