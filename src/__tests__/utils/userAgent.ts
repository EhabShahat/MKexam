/**
 * Test utilities for user agent generation and mocking
 * Used for testing device model display functionality
 */

/**
 * Common user agent strings for testing
 */
export const USER_AGENTS = {
  // iOS devices
  iPhone14Pro: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  iPhone13: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  iPhoneSE: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
  iPadPro: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  iPadAir: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',

  // Android devices - Samsung
  samsungGalaxyS23: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
  samsungGalaxyS22: 'Mozilla/5.0 (Linux; Android 12; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  samsungGalaxyS21: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
  samsungGalaxyA53: 'Mozilla/5.0 (Linux; Android 12; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  
  // Android devices - Google Pixel
  googlePixel7: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
  googlePixel6: 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  googlePixel5: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
  
  // Android devices - Xiaomi/Redmi/POCO
  xiaomiRedmi: 'Mozilla/5.0 (Linux; Android 11; Redmi Note 10 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
  xiaomiRedmiNote11: 'Mozilla/5.0 (Linux; Android 11; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
  xiaomiPoco: 'Mozilla/5.0 (Linux; Android 12; POCO X4 Pro 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  xiaomiMi11: 'Mozilla/5.0 (Linux; Android 11; Mi 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
  
  // Android devices - OnePlus
  onePlus9: 'Mozilla/5.0 (Linux; Android 11; OnePlus 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
  onePlus10Pro: 'Mozilla/5.0 (Linux; Android 12; ONEPLUS A9010) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  
  // Android devices - OPPO
  oppoFindX5: 'Mozilla/5.0 (Linux; Android 12; CPH2305) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  oppoReno8: 'Mozilla/5.0 (Linux; Android 12; CPH2481) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  
  // Android devices - Realme
  realme9Pro: 'Mozilla/5.0 (Linux; Android 12; RMX3471) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  realmeGT: 'Mozilla/5.0 (Linux; Android 11; RMX2202) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
  
  // Android devices - Huawei
  huaweiP50: 'Mozilla/5.0 (Linux; Android 11; ANA-NX9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
  huaweiMate40: 'Mozilla/5.0 (Linux; Android 10; NOH-NX9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
  
  // Android devices - Vivo
  vivoX80: 'Mozilla/5.0 (Linux; Android 12; V2183A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  vivoY73: 'Mozilla/5.0 (Linux; Android 11; vivo 2031) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
  
  // Android devices - Motorola
  motorolaEdge30: 'Mozilla/5.0 (Linux; Android 12; moto edge 30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  motorolaG82: 'Mozilla/5.0 (Linux; Android 12; moto g82 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',

  // Tablets
  samsungTab: 'Mozilla/5.0 (Linux; Android 12; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
  
  // Desktop browsers
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
  firefoxWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/112.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36 Edg/112.0.1722.48',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/112.0',

  // Edge cases
  unknown: 'UnknownBrowser/1.0',
  empty: '',
  malformed: 'Mozilla/5.0 ()',
  oldBrowser: 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)',
  
  // Aliases for compatibility with design document
  IPHONE_SAFARI: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  ANDROID_CHROME: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
  SAMSUNG_INTERNET: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/20.0 Chrome/106.0.5249.126 Mobile Safari/537.36',
  CHROME_WINDOWS: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
  FIREFOX_LINUX: 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/112.0',
  SAFARI_MACOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15',
} as const;

/**
 * Device type categories
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

/**
 * Expected device info for common user agents
 */
export const EXPECTED_DEVICE_INFO: Record<string, { type: DeviceType; manufacturer: string; model: string }> = {
  iPhone14Pro: { type: 'mobile', manufacturer: 'Apple', model: 'iPhone' },
  iPhone13: { type: 'mobile', manufacturer: 'Apple', model: 'iPhone' },
  iPhoneSE: { type: 'mobile', manufacturer: 'Apple', model: 'iPhone' },
  iPadPro: { type: 'tablet', manufacturer: 'Apple', model: 'iPad' },
  iPadAir: { type: 'tablet', manufacturer: 'Apple', model: 'iPad' },
  samsungGalaxyS23: { type: 'mobile', manufacturer: 'Samsung', model: 'SM-S911B' },
  samsungGalaxyS22: { type: 'mobile', manufacturer: 'Samsung', model: 'SM-S901B' },
  googlePixel7: { type: 'mobile', manufacturer: 'Google', model: 'Pixel 7' },
  googlePixel6: { type: 'mobile', manufacturer: 'Google', model: 'Pixel 6' },
  xiaomiRedmi: { type: 'mobile', manufacturer: 'Xiaomi', model: 'Redmi Note 10 Pro' },
  onePlus9: { type: 'mobile', manufacturer: 'OnePlus', model: 'OnePlus 9' },
  samsungTab: { type: 'tablet', manufacturer: 'Samsung', model: 'SM-T870' },
  chromeWindows: { type: 'desktop', manufacturer: 'Unknown', model: 'Chrome' },
  chromeMac: { type: 'desktop', manufacturer: 'Apple', model: 'Chrome' },
  firefoxWindows: { type: 'desktop', manufacturer: 'Unknown', model: 'Firefox' },
  firefoxMac: { type: 'desktop', manufacturer: 'Apple', model: 'Firefox' },
  safariMac: { type: 'desktop', manufacturer: 'Apple', model: 'Safari' },
  edgeWindows: { type: 'desktop', manufacturer: 'Unknown', model: 'Edge' },
  unknown: { type: 'unknown', manufacturer: 'Unknown', model: 'Unknown' },
  empty: { type: 'unknown', manufacturer: 'Unknown', model: 'Unknown' },
  malformed: { type: 'unknown', manufacturer: 'Unknown', model: 'Unknown' },
  oldBrowser: { type: 'desktop', manufacturer: 'Unknown', model: 'MSIE 6.0' },
};

/**
 * Mock navigator.userAgent
 */
export function mockUserAgent(userAgent: string): void {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    writable: true,
    configurable: true,
  });
}

/**
 * Restore original navigator.userAgent
 */
export function restoreUserAgent(): void {
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Test Environment)',
    writable: true,
    configurable: true,
  });
}

/**
 * Generate random user agent for property-based testing
 */
export function generateRandomUserAgent(): string {
  const userAgents = Object.values(USER_AGENTS);
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Generate user agent with specific device type
 */
export function generateUserAgentByType(type: DeviceType): string {
  const userAgentsByType: Record<DeviceType, string[]> = {
    mobile: [
      USER_AGENTS.iPhone14Pro,
      USER_AGENTS.iPhone13,
      USER_AGENTS.samsungGalaxyS23,
      USER_AGENTS.googlePixel7,
      USER_AGENTS.xiaomiRedmi,
      USER_AGENTS.onePlus9,
    ],
    tablet: [
      USER_AGENTS.iPadPro,
      USER_AGENTS.iPadAir,
      USER_AGENTS.samsungTab,
    ],
    desktop: [
      USER_AGENTS.chromeWindows,
      USER_AGENTS.chromeMac,
      USER_AGENTS.firefoxWindows,
      USER_AGENTS.safariMac,
      USER_AGENTS.edgeWindows,
    ],
    unknown: [
      USER_AGENTS.unknown,
      USER_AGENTS.empty,
      USER_AGENTS.malformed,
    ],
  };

  const agents = userAgentsByType[type];
  return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Create mock Request with user agent
 */
export function createMockRequest(userAgent: string, overrides?: Partial<Request>): Request {
  return {
    headers: new Headers({
      'user-agent': userAgent,
    }),
    ...overrides,
  } as Request;
}

/**
 * Get all mobile user agents
 */
export function getMobileUserAgents(): string[] {
  return [
    USER_AGENTS.iPhone14Pro,
    USER_AGENTS.iPhone13,
    USER_AGENTS.iPhoneSE,
    USER_AGENTS.samsungGalaxyS23,
    USER_AGENTS.samsungGalaxyS22,
    USER_AGENTS.googlePixel7,
    USER_AGENTS.googlePixel6,
    USER_AGENTS.xiaomiRedmi,
    USER_AGENTS.onePlus9,
  ];
}

/**
 * Get all tablet user agents
 */
export function getTabletUserAgents(): string[] {
  return [
    USER_AGENTS.iPadPro,
    USER_AGENTS.iPadAir,
    USER_AGENTS.samsungTab,
  ];
}

/**
 * Get all desktop user agents
 */
export function getDesktopUserAgents(): string[] {
  return [
    USER_AGENTS.chromeWindows,
    USER_AGENTS.chromeMac,
    USER_AGENTS.firefoxWindows,
    USER_AGENTS.firefoxMac,
    USER_AGENTS.safariMac,
    USER_AGENTS.edgeWindows,
  ];
}

/**
 * Get all edge case user agents
 */
export function getEdgeCaseUserAgents(): string[] {
  return [
    USER_AGENTS.unknown,
    USER_AGENTS.empty,
    USER_AGENTS.malformed,
    USER_AGENTS.oldBrowser,
  ];
}
