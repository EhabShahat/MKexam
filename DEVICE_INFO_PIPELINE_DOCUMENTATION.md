# Device Info Pipeline Documentation

## Overview

The Device Info Pipeline is a comprehensive system for collecting, storing, and displaying device information for exam attempts. It provides security tracking, device identification, and diagnostic capabilities for the Advanced Exam Application.

## Architecture

The pipeline consists of five main stages:

```
┌─────────────┐    ┌────────┐    ┌─────────┐    ┌───────────┐    ┌─────────┐
│ Collection  │ -> │ Merge  │ -> │ Storage │ -> │ Retrieval │ -> │ Display │
│  (Client)   │    │(Server)│    │  (DB)   │    │  (API)    │    │  (UI)   │
└─────────────┘    └────────┘    └─────────┘    └───────────┘    └─────────┘
```

### Stage 1: Collection (Client-Side)

**Location**: `src/lib/collectDeviceInfo.ts`

**Function**: `collectDetailedDeviceInfo()`

**Purpose**: Gathers comprehensive device information from the browser

**Data Sources**:
- WebRTC for local/public IP discovery (5s timeout)
- Canvas fingerprinting for device identification
- User-Agent Client Hints API (Chromium browsers)
- Hardware APIs (CPU, memory, screen, GPU)
- Geolocation API (requires permission, 5s timeout)
- Network Information API (experimental)
- Battery Status API (deprecated in some browsers)
- Security indicators (automation detection)

**Output Format** (Enhanced):
```typescript
{
  collectedAt: string;           // ISO timestamp
  friendlyName: string;          // Human-readable device name
  fingerprint: string;           // Canvas-based fingerprint hash
  
  // Browser information
  browserDetails: {
    name: string;                // "Chrome", "Firefox", "Safari", etc.
    version: string;             // Major version
    fullVersion: string;         // Full version string
    engine: string;              // "Blink", "Gecko", "WebKit"
    engineVersion: string;
  };
  
  // Platform/OS information
  platformDetails: {
    os: string;                  // "Windows", "Android", "iOS", etc.
    osVersion: string;           // OS version
    architecture: string;        // "x86", "arm"
    bitness: string;             // "32", "64"
  };
  
  // Device identification
  oem: {
    brand: string;               // "Samsung", "Apple", "Xiaomi", etc.
    model: string;               // Device model
    source: string;              // "ua-ch" or "ua"
  };
  
  // IP addresses
  ips: {
    ips: Array<{
      ip: string;
      type: "local" | "public";
      family: "IPv4" | "IPv6";
    }>;
    error?: string;
    completedAt: string;
  };
  
  // Security indicators
  security: {
    webdriver: boolean;          // Automation tool detected
    automationRisk: boolean;     // Calculated risk flag
    pdfViewer: boolean;
    doNotTrack: boolean;
    pluginsCount: number;
    cookiesEnabled: boolean;
    isExtended: boolean;         // Multiple monitors
    maxTouchPoints: number;
  };
  
  // Hardware information
  deviceMemory: number;
  hardwareConcurrency: number;
  pixelRatio: number;
  touch: boolean;
  screen: { width, height, colorDepth, pixelDepth };
  viewport: { width, height };
  gpu: { vendor, renderer };
  
  // Optional APIs
  network: { type, effectiveType, downlink, rtt, saveData };
  battery: { level, charging };
  location: { latitude, longitude, accuracy, timestamp, error };
  
  // Locale
  timezone: string;
  timezoneOffset: number;
  language: string;
  languages: string[];
  
  // Legacy compatibility
  userAgent: string;
  platform: string;
  vendor: string;
  parsed: { browser, os, device };
}
```

**Error Handling**:
- Returns `null` if collection fails completely
- Gracefully handles API unavailability
- Logs all failures with detailed error information
- Supports unsupported browsers with minimal fallback data


### Stage 2: Merge (Server-Side)

**Location**: `src/lib/mergeDeviceInfo.ts`

**Function**: `mergeDeviceInfo(clientDeviceInfo, serverIP, attemptId?)`

**Purpose**: Combines client-collected device info with server-detected IP address

**Process**:
1. Validates client device info structure
2. Extracts local and public IPs from client data
3. Adds default values for missing fields
4. Creates `allIPs` structure combining all IP sources
5. Validates merged data before returning

**Output Format**:
```typescript
{
  ...clientDeviceInfo,           // All client-collected fields
  serverDetectedIP: string;      // Server-detected IP
  serverDetectedAt: string;      // ISO timestamp
  allIPs: {
    local: Array<IPInfo>;        // Local IPs from WebRTC
    public: Array<IPInfo>;       // Public IPs from WebRTC
    server: string;              // Server-detected IP
  }
}
```

**Null Handling**:
- If client device info is null, creates minimal structure with server IP only
- Ensures `allIPs` structure always exists
- Adds default values for missing `oem`, `browserDetails`, `platformDetails`, `security`

**Error Recovery**:
- Returns minimal structure on exception
- Never throws errors (prevents exam access blocking)
- Logs all failures with detailed context

### Stage 3: Storage (Database)

**Location**: `src/app/api/public/exams/[examId]/access/route.ts`

**Table**: `exam_attempts`

**Columns**:
- `device_info`: JSONB column storing merged device info
- `ip_address`: TEXT column for backward compatibility

**Process**:
1. Receives client device info in POST body
2. Calls `mergeDeviceInfo()` to combine with server IP
3. Validates merged data structure
4. Updates database with retry logic (max 2 retries)
5. Falls back to IP-only storage if device info fails

**Retry Logic**:
- Maximum 2 retry attempts
- 500ms delay between retries (exponential: 500ms, 1000ms)
- Logs each retry attempt

**Fallback Strategy**:
```
1. Try to store device_info + ip_address
2. If fails, retry up to 2 times
3. If still fails, try to store ip_address only
4. If that fails, log error but don't block exam access
```

**Error Handling**:
- Never blocks exam access due to device info storage failure
- Logs all errors with attempt ID for traceability
- Ensures IP is stored even if device info fails


### Stage 4: Retrieval (API)

**Location**: `src/app/admin/results/[attemptId]/page.tsx` and various admin API routes

**Process**:
1. Query `exam_attempts` table for device_info
2. Parse JSON string to object (if stored as string)
3. Validate structure and format
4. Return to UI components

**Common Queries**:
```sql
-- Single attempt
SELECT device_info, ip_address FROM exam_attempts WHERE id = ?

-- Bulk health check
SELECT id, device_info, exam_id FROM exam_attempts 
ORDER BY started_at DESC LIMIT 100
```

**Error Handling**:
- Handles both string and object formats
- Gracefully handles JSON parse errors
- Logs retrieval failures with sample data

### Stage 5: Display (UI)

**Location**: `src/components/admin/DeviceInfoCell.tsx`

**Component**: `DeviceInfoCell`

**Purpose**: Renders device information in admin results table

**Display Priority** (Fallback Chain):
1. `friendlyName` (e.g., "Samsung Galaxy S21 (Android 13) Chrome 120")
2. `oem.brand + oem.model` (e.g., "Samsung SM-G991B")
3. `oem.brand` only (e.g., "Samsung")
4. `platformDetails.os + browserDetails.name` (e.g., "Android - Chrome")
5. `platformDetails.os` only (e.g., "Android")
6. `browserDetails.name` only (e.g., "Chrome")
7. Legacy fields (`type`, `manufacturer`, `model`)
8. User-Agent parsing
9. IP address (e.g., "Device (192.168.1.1)")
10. "Unknown Device"

**Features**:
- Device type icon (📱 mobile, 💻 desktop, ❓ unknown)
- Local IP display (🏠 icon)
- Server IP display (🌐 icon)
- Automation risk badge (⚠️ Risk)
- Usage count badge (👥 count)
- Missing data indicator (⚠️ No Data)
- Comprehensive tooltip with all details
- Browser and OS information in third row

**JSON Sanitization**:
- Removes leading/trailing whitespace
- Validates JSON format
- Fixes trailing commas before closing braces
- Logs sanitization attempts and results

**Error Handling**:
- Catches JSON parse errors
- Falls back to "Unknown Device" on error
- Logs all parsing failures with error details
- Never crashes on malformed data


## Data Formats

### Enhanced Format (Current)

The enhanced format provides comprehensive device information with structured categories:

```typescript
{
  collectedAt: "2026-02-07T10:30:00.000Z",
  friendlyName: "Samsung Galaxy S21 (Android 13) Chrome 120",
  fingerprint: "a1b2c3d4",
  
  browserDetails: {
    name: "Chrome",
    version: "120",
    fullVersion: "120.0.6099.129",
    engine: "Blink",
    engineVersion: "537.36"
  },
  
  platformDetails: {
    os: "Android",
    osVersion: "13",
    architecture: "arm",
    bitness: "64"
  },
  
  oem: {
    brand: "Samsung",
    model: "SM-G991B",
    source: "ua-ch"
  },
  
  allIPs: {
    local: [{ ip: "192.168.1.100", type: "local", family: "IPv4" }],
    public: [{ ip: "203.0.113.1", type: "public", family: "IPv4" }],
    server: "203.0.113.1"
  },
  
  security: {
    webdriver: false,
    automationRisk: false
  },
  
  serverDetectedIP: "203.0.113.1",
  serverDetectedAt: "2026-02-07T10:30:01.000Z"
}
```

**Required Fields**:
- `friendlyName` OR `oem` (at least one)
- `allIPs` structure with `local`, `public`, `server`
- `serverDetectedIP`
- `serverDetectedAt`

**Optional but Recommended**:
- `browserDetails`
- `platformDetails`
- `security`
- `fingerprint`

### Legacy Format (Backward Compatibility)

The legacy format is maintained for backward compatibility with older clients:

```typescript
{
  type: "mobile",
  manufacturer: "Samsung",
  model: "Galaxy S21",
  userAgent: "Mozilla/5.0...",
  capturedAt: "2026-02-07T10:30:00.000Z",
  serverDetectedIP: "203.0.113.1",
  serverDetectedAt: "2026-02-07T10:30:01.000Z",
  allIPs: {
    local: [],
    public: [],
    server: "203.0.113.1"
  }
}
```

**Required Fields**:
- `type`
- `manufacturer`
- `model`
- `userAgent` (optional but recommended)


## Diagnostic Logging

### Logging Utility

**Location**: `src/lib/deviceInfoDiagnostics.ts`

**Functions**:
- `logDeviceInfo(log: DeviceInfoLog)` - Main logging function
- `validateDeviceInfo(deviceInfo)` - Structure validation
- `logValidation(stage, attemptId, validation)` - Validation logging
- `logJsonParsing(attemptId, rawString, success, error?)` - Parse logging
- `logDisplayFallback(attemptId, reason, displayValue)` - Fallback logging

### Log Format

All logs follow a structured format for easy filtering and analysis:

```typescript
{
  stage: "collection" | "merge" | "storage" | "retrieval" | "display",
  attemptId?: string,
  success: boolean,
  hasData: boolean,
  dataFormat?: "enhanced" | "legacy" | "null" | "invalid",
  error?: string,
  details?: {
    // Stage-specific details
  }
}
```

### Log Levels

- **Success**: `console.log()` - Normal operations
- **Failure**: `console.error()` - Errors and failures
- **Warning**: `console.warn()` - Non-critical issues

### Log Examples

**Collection Success**:
```javascript
[Device Collection] Device info collected successfully: {
  duration: "1234ms",
  hasFingerprint: true,
  hasLocation: true,
  hasClientHints: true,
  ipCount: 2,
  friendlyName: "Samsung Galaxy S21 (Android 13) Chrome 120",
  timestamp: "2026-02-07T10:30:00.000Z"
}
```

**Merge with Null Client Data**:
```javascript
[Device Info merge] Success {
  attemptId: "abc123",
  hasData: false,
  dataFormat: "null",
  reason: "Client device info is null or invalid",
  serverIP: "203.0.113.1",
  action: "Creating minimal structure with server IP only"
}
```

**Storage Failure with Retry**:
```javascript
[Device Info storage] Failure {
  attemptId: "abc123",
  hasData: true,
  dataFormat: "enhanced",
  error: "Database connection timeout",
  operation: "database-update",
  retriesAttempted: 2
}
```

**Display Fallback**:
```javascript
[Device Info display] Success {
  hasData: false,
  dataFormat: "null",
  operation: "fallback",
  reason: "No valid display fields found, using IP address",
  displayValue: "Device (203.0.113.1)"
}
```


## Diagnostic Logging Format

### Log Structure

All device info logs follow a consistent structure:

```typescript
{
  stage: "collection" | "merge" | "storage" | "retrieval" | "display",
  attemptId?: string,
  success: boolean,
  hasData: boolean,
  dataFormat?: "enhanced" | "legacy" | "null" | "invalid",
  error?: string,
  details?: Record<string, any>
}
```

### Log Examples by Stage

#### Collection Stage

**Success**:
```javascript
[Device Collection] Device info collected successfully: {
  duration: "1234ms",
  hasFingerprint: true,
  hasLocation: true,
  hasClientHints: true,
  hasNetwork: true,
  hasBattery: false,
  hasGPU: true,
  ipCount: 2,
  ipError: null,
  friendlyName: "Samsung Galaxy S21 (Android 13) Chrome 120",
  deviceBrand: "Samsung",
  deviceModel: "SM-G991B",
  browserName: "Chrome",
  browserVersion: "120",
  osName: "Android",
  osVersion: "13",
  automationRisk: false,
  webdriver: false,
  timestamp: "2026-02-07T10:30:00.000Z"
}
```

**Failure**:
```javascript
[Device Collection] Failed to collect device info: {
  duration: "234ms",
  error: "Promise is not defined",
  name: "ReferenceError",
  stack: "...",
  userAgent: "Mozilla/5.0...",
  timestamp: "2026-02-07T10:30:00.000Z"
}
```

#### Merge Stage

**Success with Data**:
```javascript
[Device Info merge] Success {
  attemptId: "abc123",
  hasData: true,
  dataFormat: "enhanced",
  localIPCount: 1,
  publicIPCount: 1,
  serverIP: "203.0.113.1",
  hasFingerprint: true,
  hasFriendlyName: true,
  hasOem: true,
  validationWarnings: [],
  addedDefaults: {
    friendlyName: false,
    oem: false,
    browserDetails: false,
    platformDetails: false,
    security: false
  }
}
```

**Success with Null Data**:
```javascript
[Device Info merge] Success {
  attemptId: "abc123",
  hasData: false,
  dataFormat: "null",
  reason: "Client device info is null or invalid",
  serverIP: "203.0.113.1",
  action: "Creating minimal structure with server IP only"
}
```

#### Storage Stage

**Success**:
```javascript
[Device Info storage] Success {
  attemptId: "abc123",
  hasData: true,
  dataFormat: "enhanced",
  operation: "post-update",
  stored: "device_info + ip_address",
  ipCount: 2,
  hasFingerprint: true,
  hasFriendlyName: true,
  hasOem: true,
  allIPsStructure: {
    local: 1,
    public: 1,
    server: "203.0.113.1"
  }
}
```

**Failure with Retry**:
```javascript
[Device Info storage] Failure {
  attemptId: "abc123",
  hasData: true,
  dataFormat: "enhanced",
  error: "Database connection timeout",
  operation: "database-update",
  errorCode: "ETIMEDOUT",
  retriesAttempted: 2
}
```

#### Display Stage

**Success with Enhanced Format**:
```javascript
[Device Info display] Success {
  hasData: true,
  dataFormat: "enhanced",
  operation: "display_path",
  path: "friendlyName",
  value: "Samsung Galaxy S21 (Android 13) Chrome 120"
}
```

**Fallback to Unknown**:
```javascript
[Device Info display] Success {
  hasData: false,
  dataFormat: "null",
  operation: "fallback",
  reason: "No device info or IP address available",
  displayValue: "Unknown Device"
}
```


## Browser Compatibility

### Supported Browsers

| Browser | Version | Collection Support | Client Hints | WebRTC | Notes |
|---------|---------|-------------------|--------------|--------|-------|
| Chrome | 89+ | Full | ✅ Yes | ✅ Yes | Recommended |
| Edge | 89+ | Full | ✅ Yes | ✅ Yes | Recommended |
| Firefox | 88+ | Partial | ❌ No | ✅ Yes | UA parsing fallback |
| Safari | 14+ | Partial | ❌ No | ✅ Yes | UA parsing fallback |
| Chrome Mobile | 89+ | Full | ✅ Yes | ✅ Yes | Recommended |
| Safari iOS | 14+ | Partial | ❌ No | ⚠️ Limited | UA parsing fallback |
| Samsung Internet | 15+ | Partial | ❌ No | ✅ Yes | UA parsing fallback |

### Feature Support Matrix

| Feature | Chrome/Edge | Firefox | Safari | Impact if Unavailable |
|---------|-------------|---------|--------|----------------------|
| Client Hints | ✅ Full | ❌ None | ❌ None | Falls back to UA parsing |
| WebRTC | ✅ Full | ✅ Full | ⚠️ Limited | No local/public IPs |
| Geolocation | ✅ Full | ✅ Full | ✅ Full | Optional, no impact |
| Network Info | ✅ Full | ❌ None | ❌ None | Optional, no impact |
| Battery API | ❌ Removed | ✅ Full | ❌ None | Optional, no impact |
| GPU Info | ✅ Full | ✅ Full | ⚠️ Limited | Optional, no impact |

### Minimum Requirements

**Hard Requirements** (exam access blocked if not met):
- JavaScript enabled
- Cookies enabled
- Modern browser with Promise support

**Soft Requirements** (degraded experience if not met):
- WebRTC support (for IP discovery)
- User-Agent Client Hints (for accurate device info)
- Canvas support (for fingerprinting)

### Unsupported Browsers

The following browsers are not supported and will receive minimal fallback data:
- Internet Explorer (all versions)
- Opera Mini
- UC Browser (old versions)
- Android Browser (pre-4.4)

## Performance Characteristics

### Collection Performance

**Typical Duration**: 1-3 seconds
**Maximum Duration**: 10 seconds (with timeouts)

**Breakdown**:
- WebRTC IP Discovery: 0-5s (timeout at 5s)
- Canvas Fingerprint: < 100ms
- Client Hints: < 50ms
- Hardware APIs: < 100ms
- Geolocation: 0-5s (timeout at 5s, optional)
- Other APIs: < 200ms

**Optimization Tips**:
- Run IP discovery in parallel with other collection
- Use reasonable timeouts (5s for WebRTC, 5s for geolocation)
- Make all optional APIs non-blocking
- Cache fingerprint if possible

### Storage Performance

**Typical Duration**: 100-300ms
**Maximum Duration**: 5s (with retries)

**Breakdown**:
- Merge operation: < 50ms
- Validation: < 10ms
- Database write: 50-200ms
- Retry logic: +500ms per retry

**Optimization Tips**:
- Use database indexes on frequently queried columns
- Batch updates if possible
- Use connection pooling
- Monitor database performance

### Display Performance

**Typical Duration**: < 50ms
**Maximum Duration**: 200ms

**Breakdown**:
- JSON parsing: < 10ms
- Validation: < 5ms
- Format detection: < 5ms
- Component render: < 30ms

**Optimization Tips**:
- Parse JSON once and cache
- Use React.memo for DeviceInfoCell
- Minimize re-renders
- Optimize fallback chain logic


## Security Considerations

### Data Privacy

**Personal Information Collected**:
- IP addresses (local and public)
- Device fingerprint (canvas-based hash)
- Geolocation (optional, requires permission)
- Hardware specifications
- Browser and OS information

**Privacy Protections**:
- Geolocation requires explicit user permission
- No personally identifiable information (PII) collected
- Data used only for exam security and analytics
- Complies with educational institution privacy policies

**Data Retention**:
- Device info stored with exam attempt
- Retained according to institution's data retention policy
- Can be anonymized or deleted per privacy requirements

### Security Features

**Automation Detection**:
```typescript
security: {
  webdriver: boolean,        // Selenium/Puppeteer detected
  automationRisk: boolean,   // Calculated risk score
  pluginsCount: number,      // Suspicious if 0 in non-Firefox
  isExtended: boolean        // Multiple monitors detected
}
```

**Fingerprinting**:
- Canvas-based fingerprint for device identification
- Helps detect device sharing between students
- Not foolproof but adds security layer

**IP Tracking**:
- Local IPs help identify network location
- Public IPs track geographic location
- Server IP provides authoritative source

### Threat Mitigation

**Cheating Detection**:
- Automation tools (webdriver flag)
- Device sharing (fingerprint matching)
- Location changes (IP tracking)
- Multiple monitors (isExtended flag)

**False Positives**:
- VPN usage may change public IP
- Shared networks may have same local IP
- Browser updates may change fingerprint
- Multiple monitors are common for accessibility

**Recommendations**:
- Use device info as one signal among many
- Don't automatically flag based on single indicator
- Review suspicious cases manually
- Consider legitimate use cases

## Maintenance and Updates

### Regular Maintenance Tasks

**Weekly**:
- Run health check on production data
- Review error logs for patterns
- Check health percentage trend

**Monthly**:
- Update device model patterns
- Review browser compatibility
- Update User-Agent parsing logic
- Check for deprecated APIs

**Quarterly**:
- Review and update documentation
- Analyze format distribution trends
- Plan migrations if needed
- Update monitoring thresholds

### Updating Device Model Patterns

**Location**: `src/lib/collectDeviceInfo.ts`

**Functions to Update**:
- `extractModelFromUA()` - Add new device patterns
- `inferVendor()` - Add new manufacturer detection

**Example - Adding New Manufacturer**:
```typescript
// In extractModelFromUA()
const newBrandMatch = ua.match(/(NEWBRAND\s+[A-Za-z0-9\s]+)/);
if (newBrandMatch && newBrandMatch[1]) return newBrandMatch[1].trim();

// In inferVendor()
if (u.includes("NEWBRAND") || m.includes("NEWBRAND")) {
  return "NewBrand";
}
```

### API Deprecation Handling

**Current Deprecated APIs**:
- Battery Status API (removed in Chrome 103+)

**Handling Strategy**:
1. Check for API availability before use
2. Gracefully handle unavailability
3. Log when API is not available
4. Don't break collection if API missing

**Example**:
```typescript
if (typeof nav.getBattery === "function") {
  // Use API
} else {
  console.warn('[Device Collection] Battery API not available');
  battery = null;
}
```

### Version Migration

**When to Migrate**:
- Adding required fields to format
- Changing data structure significantly
- Deprecating legacy format support

**Migration Strategy**:
1. Maintain backward compatibility during transition
2. Support both old and new formats
3. Gradually migrate old data
4. Monitor migration progress
5. Remove old format support after 6+ months

**Example Migration Script**:
```sql
-- Add new field with default value
UPDATE exam_attempts
SET device_info = jsonb_set(
  device_info,
  '{newField}',
  '"default_value"'
)
WHERE device_info IS NOT NULL
  AND device_info->>'newField' IS NULL;
```

## Troubleshooting Resources

### Documentation Files

1. **DEVICE_INFO_PIPELINE_DOCUMENTATION.md** (this file)
   - Architecture overview
   - Data formats
   - Logging format
   - Browser compatibility

2. **DEVICE_INFO_TROUBLESHOOTING_GUIDE.md**
   - Step-by-step troubleshooting
   - Common scenarios
   - Diagnostic tools
   - Prevention best practices

3. **DEVICE_INFO_COMMON_FAILURES.md**
   - Catalog of known failures
   - Root causes and fixes
   - Quick reference table
   - Testing checklist

### Code Locations

**Collection**: `src/lib/collectDeviceInfo.ts`
**Merge**: `src/lib/mergeDeviceInfo.ts`
**Diagnostics**: `src/lib/deviceInfoDiagnostics.ts`
**Storage**: `src/app/api/public/exams/[examId]/access/route.ts`
**Display**: `src/components/admin/DeviceInfoCell.tsx`
**Health Check**: `src/app/api/admin/device-info/health/route.ts`

### Support Contacts

For issues with device info pipeline:
1. Review troubleshooting guide
2. Check browser console logs
3. Run diagnostic tools
4. Document findings
5. Escalate with complete information

## Changelog

### Version 2.0 (Enhanced Format)
- Added Client Hints support
- Added WebRTC IP discovery
- Added comprehensive hardware info
- Added security indicators
- Improved browser/OS detection
- Added structured categories
- Implemented diagnostic logging

### Version 1.0 (Legacy Format)
- Basic User-Agent parsing
- Simple device type detection
- Manufacturer and model extraction
- IP address tracking

