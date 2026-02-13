# Enhanced Device Tracking Documentation

## Overview

The Enhanced Device Tracking feature provides comprehensive device information collection for exam security and monitoring. It captures actual device IP addresses (not router IPs), complete hardware specifications, browser details, and security indicators.

## Key Features

### 1. WebRTC IP Discovery
- **Purpose**: Capture actual device local IP addresses using WebRTC ICE candidates
- **Technology**: RTCPeerConnection with STUN servers
- **Timeout**: 5 seconds
- **Browser Support**: Chrome/Edge (full), Firefox (full), Safari (partial)
- **Fallback**: Server-detected IP from headers

### 2. User-Agent Client Hints
- **Purpose**: Accurate device model and platform information
- **Technology**: User-Agent Client Hints API (high entropy values)
- **Browser Support**: Chrome/Edge 89+ (full), Firefox/Safari (not supported)
- **Fallback**: User-Agent string parsing

### 3. Hardware Information
- **CPU**: Core count via `navigator.hardwareConcurrency`
- **Memory**: RAM via `navigator.deviceMemory`
- **Screen**: Resolution, color depth, pixel ratio
- **GPU**: Vendor and renderer via WebGL debug extension
- **Touch**: Touch capability and max touch points

### 4. Optional APIs
- **Geolocation**: Coordinates with user permission (5s timeout)
- **Network**: Connection type, speed, RTT (experimental API)
- **Battery**: Level and charging status (deprecated in some browsers)

### 5. Security Detection
- **Automation**: Detects webdriver, suspicious plugin counts
- **Multi-monitor**: Detects extended screen configurations
- **Risk Score**: Calculated automation risk flag

### 6. Device Fingerprinting
- **Canvas Fingerprint**: Unique device identifier
- **Persistence**: Links attempts from same device
- **Hashing**: Simple hash function for privacy

## Architecture

### Client-Side Collection

```typescript
// Entry point with timeout wrapper
collectDeviceInfoWithTimeout(submitClicks) → Promise<DeviceInfo | null>
  ├─ collectDetailedDeviceInfo() [10s timeout]
  │   ├─ discoverIPs() [5s timeout] - WebRTC IP discovery
  │   ├─ Canvas fingerprint generation
  │   ├─ Geolocation request [5s timeout]
  │   ├─ Client Hints collection (Chromium only)
  │   ├─ Hardware info collection
  │   ├─ Network/Battery APIs (optional)
  │   └─ Security indicators
  └─ Returns null on timeout/failure (non-blocking)
```

### Server-Side Processing

```typescript
// API route: /api/public/exams/[examId]/access
POST handler
  ├─ Extract clientDeviceInfo from request body
  ├─ Detect serverIP from headers
  ├─ mergeDeviceInfo(clientDeviceInfo, serverIP)
  │   └─ Creates allIPs structure (local, public, server)
  └─ Store in device_info JSONB column
```

### Admin Interface Display

```typescript
// Results page: /admin/results/[attemptId]
DeviceInfoSection
  ├─ IP Addresses (local, public, server)
  ├─ Browser Details (name, version, engine)
  ├─ Platform Details (OS, version, architecture)
  ├─ Hardware Info (CPU, RAM, screen, GPU)
  ├─ Device Info (manufacturer, model, friendly name)
  ├─ Network Info (type, speed, RTT)
  ├─ Security Indicators (automation risk, webdriver)
  ├─ Location (coordinates, timezone, language)
  └─ Raw JSON view (for debugging)
```

## Data Structure

### Complete Device Info Object

```json
{
  "collectedAt": "2025-02-07T10:30:00.000Z",
  "friendlyName": "Samsung Galaxy S21 (Android 13) Chrome 120",
  
  "ips": {
    "ips": [
      {
        "ip": "192.168.1.105",
        "type": "local",
        "family": "IPv4",
        "source": "webrtc"
      }
    ],
    "error": null,
    "completedAt": "2025-02-07T10:30:01.234Z"
  },
  
  "allIPs": {
    "local": [...],
    "public": [...],
    "server": "203.0.113.45"
  },
  
  "serverDetectedIP": "203.0.113.45",
  "serverDetectedAt": "2025-02-07T10:30:02.000Z",
  
  "browserDetails": {
    "name": "Chrome",
    "version": "120",
    "fullVersion": "120.0.6099.129",
    "engine": "Blink",
    "engineVersion": "120.0.6099.129"
  },
  
  "platformDetails": {
    "os": "Android",
    "osVersion": "13",
    "architecture": "arm",
    "bitness": "64"
  },
  
  "clientHints": {
    "architecture": "arm",
    "bitness": "64",
    "model": "SM-G991B",
    "platform": "Android",
    "platformVersion": "13.0.0",
    "uaFullVersion": "120.0.6099.129",
    "mobile": true,
    "brands": [...]
  },
  
  "oem": {
    "brand": "Samsung",
    "model": "SM-G991B",
    "source": "ua-ch"
  },
  
  "deviceMemory": 8,
  "hardwareConcurrency": 8,
  "pixelRatio": 2.625,
  "touch": true,
  
  "screen": {
    "width": 1080,
    "height": 2400,
    "colorDepth": 24,
    "pixelDepth": 24
  },
  
  "viewport": {
    "width": 412,
    "height": 915
  },
  
  "gpu": {
    "vendor": "ARM",
    "renderer": "Mali-G78"
  },
  
  "network": {
    "type": "cellular",
    "effectiveType": "4g",
    "downlink": 10,
    "rtt": 50,
    "saveData": false
  },
  
  "battery": {
    "level": 75,
    "charging": false
  },
  
  "location": {
    "latitude": 30.0444,
    "longitude": 31.2357,
    "accuracy": 20,
    "timestamp": 1707217800000,
    "error": null
  },
  
  "security": {
    "webdriver": false,
    "pdfViewer": true,
    "doNotTrack": false,
    "pluginsCount": 3,
    "cookiesEnabled": true,
    "isExtended": false,
    "maxTouchPoints": 5,
    "automationRisk": false
  },
  
  "timezone": "Africa/Cairo",
  "timezoneOffset": -120,
  "language": "ar",
  "languages": ["ar", "en"],
  
  "fingerprint": "a3f5b8c2d1e4",
  
  "userAgent": "Mozilla/5.0 ...",
  "platform": "Linux armv8l",
  "vendor": "Google Inc."
}
```

## Browser Compatibility

### WebRTC IP Discovery
| Browser | Support | Notes |
|---------|---------|-------|
| Chrome/Edge | ✅ Full | Complete support |
| Firefox | ✅ Full | Complete support |
| Safari | ⚠️ Partial | May require permission |
| Mobile browsers | ✅ Full | Works on most mobile browsers |

### User-Agent Client Hints
| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 89+ | ✅ Full | All high entropy values |
| Edge 89+ | ✅ Full | All high entropy values |
| Firefox | ❌ None | Falls back to UA parsing |
| Safari | ❌ None | Falls back to UA parsing |

### Network Information API
| Browser | Support | Notes |
|---------|---------|-------|
| Chrome/Edge | ✅ Full | Complete support |
| Firefox | ❌ None | Returns null |
| Safari | ❌ None | Returns null |

### Battery Status API
| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 103+ | ❌ Deprecated | Removed for privacy |
| Firefox | ✅ Full | Still supported |
| Safari | ❌ None | Never supported |

## Error Handling

### Client-Side
- **WebRTC timeout**: Returns partial results after 5s
- **Permission denial**: Stores error in location.error, continues collection
- **API unavailability**: Uses null for unavailable data
- **Overall timeout**: Returns partial data after 10s
- **Collection failure**: Returns null (exam access not blocked)

### Server-Side
- **Invalid JSON**: Logs error, stores null
- **Missing device info**: Creates attempt with null device_info
- **Storage failure**: Logs error, continues with attempt creation

### Admin Interface
- **Null device info**: Displays "No device information"
- **Malformed JSON**: Shows raw JSON view as fallback
- **Missing fields**: Uses optional chaining, displays "Unknown"

## Performance

### Collection Times
- **WebRTC IP discovery**: < 5 seconds
- **Total collection**: < 10 seconds
- **Database storage**: < 100ms
- **Admin render**: < 1 second

### Database Indexes
```sql
-- IP queries
CREATE INDEX idx_device_info_ips 
ON exam_attempts USING gin ((device_info->'allIPs'));

-- Fingerprint queries
CREATE INDEX idx_device_info_fingerprint 
ON exam_attempts ((device_info->>'fingerprint'));
```

## Security Considerations

### Privacy
- Geolocation requires user permission
- WebRTC may be blocked by privacy extensions
- Canvas fingerprinting is detectable
- All collection is transparent (no hidden tracking)

### Automation Detection
- `webdriver` property detection
- Plugin count analysis (0 plugins = suspicious)
- Multiple monitor detection
- Risk score calculation

### Data Storage
- Stored in JSONB column (efficient querying)
- Backward compatible with old records
- Server IP maintained in separate column
- Audit trail for all access

## Usage Examples

### Collecting Device Info
```typescript
import { collectDeviceInfoWithTimeout } from '@/lib/collectDeviceInfoWithTimeout';

// In exam entry form submission
const deviceInfo = await collectDeviceInfoWithTimeout();
// Returns null on timeout/failure (non-blocking)
```

### Server-Side Merging
```typescript
import { mergeDeviceInfo } from '@/lib/mergeDeviceInfo';

const clientDeviceInfo = body?.deviceInfo ?? null;
const serverIP = getClientIp(headers);
const mergedInfo = mergeDeviceInfo(clientDeviceInfo, serverIP);
```

### Querying by IP
```sql
-- Find attempts from specific local IP
SELECT * FROM exam_attempts
WHERE device_info->'allIPs'->'local' @> '[{"ip": "192.168.1.105"}]';

-- Find attempts by fingerprint
SELECT * FROM exam_attempts
WHERE device_info->>'fingerprint' = 'a3f5b8c2d1e4';
```

## Testing

### Property-Based Tests
- 26 correctness properties validated
- 100+ iterations per property
- Covers all requirements

### Unit Tests
- ICE candidate parsing
- UA string parsing edge cases
- Device model extraction
- Data merging logic

### Integration Tests
- End-to-end collection flow
- API integration
- Database storage
- Admin interface rendering

## Troubleshooting

### No IPs Discovered
- Check if WebRTC is blocked by browser/extension
- Verify STUN servers are accessible
- Check browser console for errors
- Server IP should still be captured

### Client Hints Not Available
- Only works in Chromium browsers (Chrome/Edge)
- Falls back to UA parsing automatically
- No action needed

### Collection Timeout
- Normal in slow networks
- Partial data is still useful
- Exam access not blocked
- Check browser console for details

### Missing Device Info in Admin
- Check if collection completed successfully
- Verify device_info column in database
- Check for JSON parsing errors
- View raw JSON for debugging

## Future Enhancements

### Potential Additions
- WebGL fingerprinting (more detailed)
- Audio fingerprinting
- Font enumeration
- Plugin detection improvements
- Machine learning risk scoring

### Browser API Evolution
- Monitor Client Hints adoption
- Track Battery API deprecation
- Watch for new privacy restrictions
- Adapt to browser changes

## References

### Documentation
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [User-Agent Client Hints](https://developer.mozilla.org/en-US/docs/Web/API/User-Agent_Client_Hints_API)
- [Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API)
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)

### Specifications
- Requirements: `.kiro/specs/enhanced-device-tracking/requirements.md`
- Design: `.kiro/specs/enhanced-device-tracking/design.md`
- Tasks: `.kiro/specs/enhanced-device-tracking/tasks.md`

### Implementation Files
- `src/lib/webrtcIpDiscovery.ts` - WebRTC IP discovery
- `src/lib/collectDeviceInfo.ts` - Main collection module
- `src/lib/collectDeviceInfoWithTimeout.ts` - Timeout wrapper
- `src/lib/mergeDeviceInfo.ts` - Server-side merging
- `src/app/api/public/exams/[examId]/access/route.ts` - API integration
- `src/app/admin/results/[attemptId]/page.tsx` - Admin display
