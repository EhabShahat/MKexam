/**
 * User agent parsing utilities for device model detection
 * Extracts device type, manufacturer, and model information from user agent strings
 */

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export interface DeviceInfo {
  type: DeviceType;
  manufacturer: string;
  model: string;
  raw: string;
}

/**
 * Parse user agent string to extract device information
 * 
 * @param userAgent - The user agent string from the request
 * @returns DeviceInfo object with type, manufacturer, model, and raw user agent
 * 
 * @example
 * const deviceInfo = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0...');
 * // Returns: { type: 'mobile', manufacturer: 'Apple', model: 'iPhone', raw: '...' }
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  // Handle empty or invalid user agents
  if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
    return {
      type: 'unknown',
      manufacturer: 'Unknown',
      model: 'Unknown',
      raw: userAgent || '',
    };
  }

  const ua = userAgent.trim();

  // Detect device type and extract information
  const deviceInfo: DeviceInfo = {
    type: 'unknown',
    manufacturer: 'Unknown',
    model: 'Unknown',
    raw: userAgent, // Preserve original input
  };

  // iOS devices (iPhone, iPad, iPod)
  if (/iPhone/i.test(ua)) {
    deviceInfo.type = 'mobile';
    deviceInfo.manufacturer = 'Apple';
    deviceInfo.model = 'iPhone';
    
    // Try to extract iOS version for more detail
    const iosMatch = ua.match(/iPhone OS (\d+)_/);
    if (iosMatch) {
      deviceInfo.model = `iPhone (iOS ${iosMatch[1]})`;
    }
  } else if (/iPad/i.test(ua)) {
    deviceInfo.type = 'tablet';
    deviceInfo.manufacturer = 'Apple';
    deviceInfo.model = 'iPad';
    
    // Try to extract iOS version
    const iosMatch = ua.match(/OS (\d+)_/);
    if (iosMatch) {
      deviceInfo.model = `iPad (iOS ${iosMatch[1]})`;
    }
  } else if (/iPod/i.test(ua)) {
    deviceInfo.type = 'mobile';
    deviceInfo.manufacturer = 'Apple';
    deviceInfo.model = 'iPod Touch';
  }
  // Android devices
  else if (/Android/i.test(ua)) {
    // Determine if tablet or mobile
    const isTablet = /tablet|tab/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
    deviceInfo.type = isTablet ? 'tablet' : 'mobile';

    // Extract manufacturer and model
    // Samsung devices
    if (/Samsung|SM-/i.test(ua)) {
      deviceInfo.manufacturer = 'Samsung';
      
      // Try to extract model number (e.g., SM-S911B, SM-T870)
      const modelMatch = ua.match(/SM-[A-Z0-9]+/i);
      if (modelMatch) {
        deviceInfo.model = modelMatch[0];
      } else {
        deviceInfo.model = 'Galaxy';
      }
    }
    // Google Pixel devices
    else if (/Pixel/i.test(ua)) {
      deviceInfo.manufacturer = 'Google';
      
      // Extract Pixel model (e.g., Pixel 7, Pixel 6 Pro)
      const pixelMatch = ua.match(/Pixel( \d+)?( Pro| XL)?/i);
      if (pixelMatch) {
        deviceInfo.model = pixelMatch[0];
      } else {
        deviceInfo.model = 'Pixel';
      }
    }
    // Xiaomi devices
    else if (/Xiaomi|Redmi|Mi /i.test(ua)) {
      deviceInfo.manufacturer = 'Xiaomi';
      
      // Extract model (e.g., Redmi Note 10 Pro, Mi 11)
      const xiaomiMatch = ua.match(/(Redmi|Mi)( Note)?( \d+)?( Pro)?/i);
      if (xiaomiMatch) {
        deviceInfo.model = xiaomiMatch[0];
      } else {
        deviceInfo.model = 'Xiaomi';
      }
    }
    // OnePlus devices
    else if (/OnePlus/i.test(ua)) {
      deviceInfo.manufacturer = 'OnePlus';
      
      // Extract model (e.g., OnePlus 9, OnePlus 10 Pro)
      const onePlusMatch = ua.match(/OnePlus( \d+)?( Pro)?/i);
      if (onePlusMatch) {
        deviceInfo.model = onePlusMatch[0];
      } else {
        deviceInfo.model = 'OnePlus';
      }
    }
    // Huawei devices
    else if (/Huawei|Honor/i.test(ua)) {
      deviceInfo.manufacturer = 'Huawei';
      
      const huaweiMatch = ua.match(/(Huawei|Honor)( [A-Z0-9]+)?/i);
      if (huaweiMatch) {
        deviceInfo.model = huaweiMatch[0];
      } else {
        deviceInfo.model = 'Huawei';
      }
    }
    // Generic Android
    else {
      deviceInfo.manufacturer = 'Android';
      
      // Try to extract any model information
      const androidMatch = ua.match(/Android[^;)]+;[^;)]+\)?\s*([^)]+)/);
      if (androidMatch && androidMatch[1]) {
        deviceInfo.model = androidMatch[1].trim();
      } else {
        deviceInfo.model = 'Android Device';
      }
    }
  }
  // Desktop browsers
  else if (/Windows|Macintosh|Linux|X11/i.test(ua)) {
    deviceInfo.type = 'desktop';

    // Determine OS manufacturer
    if (/Macintosh|Mac OS X/i.test(ua)) {
      deviceInfo.manufacturer = 'Apple';
    } else if (/Windows/i.test(ua)) {
      deviceInfo.manufacturer = 'Microsoft';
    } else if (/Linux|X11/i.test(ua)) {
      deviceInfo.manufacturer = 'Linux';
    }

    // Determine browser
    if (/Edg\//i.test(ua)) {
      deviceInfo.model = 'Edge';
    } else if (/Chrome/i.test(ua)) {
      deviceInfo.model = 'Chrome';
    } else if (/Firefox/i.test(ua)) {
      deviceInfo.model = 'Firefox';
    } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
      deviceInfo.model = 'Safari';
    } else if (/MSIE|Trident/i.test(ua)) {
      // Extract IE version
      const ieMatch = ua.match(/MSIE (\d+\.\d+)/);
      if (ieMatch) {
        deviceInfo.model = `MSIE ${ieMatch[1]}`;
      } else {
        deviceInfo.model = 'Internet Explorer';
      }
    } else {
      deviceInfo.model = 'Desktop Browser';
    }
  }

  return deviceInfo;
}

/**
 * Format device info for display
 * 
 * @param deviceInfo - The parsed device information
 * @param usageCount - Optional count of students using this device
 * @returns Formatted string for display (e.g., "iPhone (3)" or "Samsung SM-S911B")
 */
export function formatDeviceInfo(deviceInfo: DeviceInfo, usageCount?: number): string {
  const baseInfo = deviceInfo.manufacturer === 'Unknown' 
    ? deviceInfo.model 
    : `${deviceInfo.manufacturer} ${deviceInfo.model}`;
  
  if (usageCount && usageCount > 1) {
    return `${baseInfo} (${usageCount})`;
  }
  
  return baseInfo;
}

/**
 * Get device identifier for grouping
 * Used to count unique devices across attempts
 * 
 * @param deviceInfo - The parsed device information
 * @returns A unique identifier string for the device
 */
export function getDeviceIdentifier(deviceInfo: DeviceInfo): string {
  return `${deviceInfo.manufacturer}:${deviceInfo.model}`;
}
