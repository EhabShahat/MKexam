/**
 * Utility to collect comprehensive device information, 
 * including a simple browser fingerprint and geolocation.
 */

export interface GpuInfo {
  vendor: string | null;
  renderer: string | null;
}

export interface GeolocationData {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: number | null;
  error?: string | null;
}

export async function collectDetailedDeviceInfo(submitClicks?: { count: number; firstAt: string | null; lastAt: string | null; timestamps: string[] }) {
  try {
    const nav = typeof navigator !== "undefined" ? (navigator as any) : ({} as any);
    const scr = typeof screen !== "undefined" ? (screen as any) : ({} as any);
    const win = typeof window !== "undefined" ? (window as any) : ({} as any);

    // 1. Basic Fingerprint (Canvas based)
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

    // 2. Geolocation (Returns a promise)
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

    // 3. Hardware / Environment Info
    const tz = (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
    })();

    const ua = typeof nav.userAgent === "string" ? nav.userAgent : "";

    // User-Agent Client Hints (Chromium)
    const uaData = nav.userAgentData ? {
      platform: nav.userAgentData.platform ?? null,
      mobile: typeof nav.userAgentData.mobile === "boolean" ? nav.userAgentData.mobile : null,
      brands: Array.isArray(nav.userAgentData.brands) ? nav.userAgentData.brands : null,
    } : null;

    let uaHigh: any = null;
    try {
      if (nav.userAgentData && typeof nav.userAgentData.getHighEntropyValues === "function") {
        uaHigh = await nav.userAgentData.getHighEntropyValues(["model", "platformVersion", "uaFullVersion"]);
      }
    } catch { }

    const parsed = parseUA(ua, uaData);
    const modelFromUA = extractModelFromUA(ua);
    const deviceModel = (uaHigh?.model && typeof uaHigh.model === "string") ? uaHigh.model : (modelFromUA || null);
    const deviceBrand = inferVendor(parsed?.os?.name || null, deviceModel, ua);

    // Derived Name
    const friendlyName = (() => {
      const parts = [];
      if (deviceBrand) parts.push(deviceBrand);
      if (deviceModel && deviceModel !== deviceBrand) parts.push(deviceModel);
      if (parsed?.os?.name) parts.push(`(${parsed.os.name})`);
      if (parsed?.browser?.name) parts.push(parsed.browser.name);
      return parts.join(" ") || "Unknown Device";
    })();

    // Security / Anti-Cheat Signals
    let isExtended = null;
    try {
      if ('isExtended' in win.screen) {
        isExtended = (win.screen as any).isExtended;
      }
    } catch { }

    const security = {
      webdriver: nav.webdriver ?? false,
      pdfViewer: nav.pdfViewerEnabled ?? false,
      doNotTrack: nav.doNotTrack === "1" || nav.doNotTrack === "yes",
      pluginsCount: nav.plugins?.length ?? 0,
      cookiesEnabled: nav.cookieEnabled ?? null,
      isExtended, // Detects multiple monitors
      maxTouchPoints: nav.maxTouchPoints ?? 0,
      automationRisk: (nav.webdriver) || (nav.plugins?.length === 0 && parsed.browser.name !== "Firefox"),
    };

    // Network
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection || null;
    const network = conn ? {
      type: conn.type ?? null,
      effectiveType: conn.effectiveType ?? null,
      downlink: typeof conn.downlink === "number" ? conn.downlink : null,
      rtt: typeof conn.rtt === "number" ? conn.rtt : null,
      saveData: typeof conn.saveData === "boolean" ? conn.saveData : null,
    } : null;

    // Battery
    let battery: any = null;
    try {
      if (typeof nav.getBattery === "function") {
        const b = await nav.getBattery();
        battery = {
          level: typeof b.level === "number" ? Math.round(b.level * 100) : null,
          charging: typeof b.charging === "boolean" ? b.charging : null,
        };
      }
    } catch { }

    // GPU
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
        }
      }
    } catch { }

    return {
      collectedAt: new Date().toISOString(),
      friendlyName,
      fingerprint,
      location,
      security,
      userAgent: ua || null,
      platform: nav.platform ?? null,
      language: nav.language ?? null,
      languages: Array.isArray(nav.languages) ? nav.languages : null,
      vendor: nav.vendor ?? null,
      deviceMemory: nav.deviceMemory ?? null,
      hardwareConcurrency: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
      pixelRatio: typeof win.devicePixelRatio === "number" ? win.devicePixelRatio : null,
      timezone: tz,
      timezoneOffset: new Date().getTimezoneOffset(),
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
      parsed,
      oem: {
        brand: deviceBrand,
        model: deviceModel,
        source: uaHigh?.model ? "ua-ch" : (modelFromUA ? "ua" : null),
      },
      network,
      battery,
      gpu,
      entrySubmit: submitClicks || null,
    };
  } catch (err) {
    console.error("Failed to collect device info:", err);
    return null;
  }
}

function parseUA(uaStr: string, uaData?: any) {
  const b: any = { name: null, version: null };
  const o: any = { name: null, version: null };
  const d: any = { type: null };

  // Simple Browser Detection
  if (uaStr.includes("Edg/")) { b.name = "Edge"; }
  else if (uaStr.includes("OPR/")) { b.name = "Opera"; }
  else if (uaStr.includes("Chrome/")) { b.name = "Chrome"; }
  else if (uaStr.includes("Firefox/")) { b.name = "Firefox"; }
  else if (uaStr.includes("Safari/")) { b.name = "Safari"; }

  // Simple OS Detection
  if (uaStr.includes("Windows NT")) o.name = "Windows";
  else if (uaStr.includes("Android")) o.name = "Android";
  else if (uaStr.includes("iPhone") || uaStr.includes("iPad")) o.name = "iOS";
  else if (uaStr.includes("Mac OS X")) o.name = "macOS";
  else if (uaStr.includes("CrOS")) o.name = "ChromeOS";
  else if (uaStr.includes("Linux")) o.name = "Linux";

  // Device type
  if (uaData?.mobile === true || /Mobi|Android/.test(uaStr)) d.type = "mobile";
  else if (/iPad|Tablet/.test(uaStr)) d.type = "tablet";
  else d.type = "desktop";

  return { browser: b, os: o, device: d };
}

function extractModelFromUA(ua: string) {
  const m1 = ua.match(/;\s*([A-Za-z0-9_\- ]+)\s+Build\//);
  if (m1 && m1[1]) return m1[1].trim();
  const mPixel = ua.match(/(Pixel\s+[A-Za-z0-9 ]+)/);
  if (mPixel && mPixel[1]) return mPixel[1].trim();
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  return null;
}

function inferVendor(osName: string | null, model: string | null, uaStr: string): string | null {
  const m = (model || "").toUpperCase();
  const u = (uaStr || "").toUpperCase();
  const os = (osName || "").toUpperCase();

  if (os.includes("IOS") || /IPHONE|IPAD|IPOD/.test(u)) return "Apple";
  if (u.includes("SAMSUNG")) return "Samsung";
  if (u.includes("OPPO")) return "OPPO";
  if (u.includes("REALME")) return "realme";
  if (u.includes("XIAOMI") || u.includes("REDMI") || u.includes("POCO")) return "Xiaomi";
  if (u.includes("HUAWEI")) return "Huawei";
  if (u.includes("HONOR")) return "Honor";
  if (u.includes("VIVO")) return "vivo";
  if (u.includes("MOTOROLA")) return "Motorola";
  return null;
}
