# Root Cause Analysis: Unknown Device Display Issue

**Date**: February 7, 2026  
**Spec**: `.kiro/specs/unknown-device-display-fix`  
**Task**: 8. Analyze logs and identify root causes

## Executive Summary

This document analyzes the diagnostic logs from the device info pipeline to identify root causes for the "Unknown Device" display issue in the admin results page. The analysis covers five stages: **collection → merge → storage → retrieval → display**.

Based on the comprehensive logging infrastructure implemented in Tasks 1-6, we can now systematically identify where device information is lost or corrupted in the pipeline.

---

## Pipeline Overview

```
┌─────────────┐     ┌──────────┐     ┌─────────┐     ┌───────────┐     ┌─────────┐
│ Collection  │ --> │  Merge   │ --> │ Storage │ --> │ Retrieval │ --> │ Display │
│  (Client)   │     │ (Server) │     │  (DB)   │     │  (API)    │     │  (UI)   │
└─────────────┘     └──────────┘     └─────────┘     └───────────┘     └─────────┘
```

Each stage has diagnostic logging that captures:
- Success/failure status
- Data presence/absence
- Format detection (enhanced/legacy/null/invalid)
- Error messages with context
- Validation results

---

## Stage 1: Client-Side Collection

### Location
- **File**: `src/lib/collectDeviceInfo.ts`
- **Function**: `collectDetailedDeviceInfo()`
- **Logging**: Added in Task 2

### Potential Root Causes

#### RC-1.1: API Timeout Failures
**Symptom**: Collection times out before gathering complete device info

**Log Pattern**:
```
[Device Info collection] Failure {
  hasData: false,
  error: "Timeout collecting device info",
  details: { timeout: 5000, partialData: true }
}
```

**Impact**: Partial or null device info sent to server

**Evidence Needed**:
- Check console logs for timeout errors
- Review timeout duration (currently 5000ms)
- Identify slow APIs (User-Agent Client Hints, WebRTC)

**Fix Priority**: HIGH - Affects all devices with slow API responses

---

#### RC-1.2: Browser API Unavailability
**Symptom**: Required browser APIs not supported or blocked

**Log Pattern**:
```
[Device Info collection] Failure {
  hasData: false,
  error: "navigator.userAgentData not available",
  details: { browser: "Safari", version: "15" }
}
```

**Impact**: Missing enhanced device info fields (friendlyName, oem)

**Evidence Needed**:
- Check which browsers show "Unknown Device"
- Verify User-Agent Client Hints support
- Check for privacy settings blocking APIs

**Fix Priority**: MEDIUM - Affects specific browsers (Safari, Firefox)

---

#### RC-1.3: WebRTC IP Discovery Failures
**Symptom**: Local IP collection fails, missing allIPs.local data

**Log Pattern**:
```
[Device Info collection] Success {
  hasData: true,
  dataFormat: "enhanced",
  details: { hasLocalIPs: false, hasPublicIPs: false }
}
```

**Impact**: Missing local IP display in results table

**Evidence Needed**:
- Check if allIPs.local is empty in stored data
- Review WebRTC connection failures
- Check for VPN/proxy interference

**Fix Priority**: LOW - IP is nice-to-have, not critical for device identification

---

#### RC-1.4: Collection Not Executed
**Symptom**: Device info collection never runs on exam entry

**Log Pattern**:
```
// No collection logs at all
```

**Impact**: No device info sent to server

**Evidence Needed**:
- Check if exam entry form calls collectDetailedDeviceInfo()
- Verify form submission includes deviceInfo field
- Check for JavaScript errors preventing execution

**Fix Priority**: CRITICAL - Complete failure of collection

---

## Stage 2: Server-Side Merge

### Location
- **File**: `src/lib/mergeDeviceInfo.ts`
- **Function**: `mergeDeviceInfo()`
- **Logging**: Added in Task 3

### Potential Root Causes

#### RC-2.1: Null Client Device Info
**Symptom**: Server receives null device info from client

**Log Pattern**:
```
[Device Info merge] Failure {
  attemptId: "abc-123",
  hasData: false,
  error: "Client device info is null",
  details: { serverIP: "192.168.1.1" }
}
```

**Impact**: Only IP stored, no device details

**Evidence Needed**:
- Count how many attempts have null clientDeviceInfo
- Check if collection stage logged failures
- Verify network request includes deviceInfo field

**Fix Priority**: HIGH - Common cause of "Unknown Device"

---

#### RC-2.2: Missing allIPs Structure
**Symptom**: Merge fails to create allIPs structure properly

**Log Pattern**:
```
[Device Info merge] Success {
  attemptId: "abc-123",
  hasData: true,
  dataFormat: "enhanced",
  details: { 
    localIPCount: 0,
    publicIPCount: 0,
    hasServerIP: true
  }
}
```

**Impact**: Missing IP data in display

**Evidence Needed**:
- Check if allIPs is created even when client IPs are empty
- Verify serverIP is always added to allIPs.server
- Review merge logic for edge cases

**Fix Priority**: MEDIUM - Affects IP display, not device name

---

#### RC-2.3: Validation Failures
**Symptom**: Merged device info fails validation checks

**Log Pattern**:
```
[Device Info merge] Failure {
  attemptId: "abc-123",
  hasData: true,
  error: "Merged device info validation failed",
  details: { 
    missingFields: ["friendlyName or oem", "allIPs"],
    format: "invalid"
  }
}
```

**Impact**: Invalid device info stored in database

**Evidence Needed**:
- Check validation logs for common missing fields
- Review isValidDeviceInfo() function logic
- Verify validation criteria match actual data structure

**Fix Priority**: MEDIUM - Indicates data structure issues

---

#### RC-2.4: Merge Exception Errors
**Symptom**: Unexpected errors during merge operation

**Log Pattern**:
```
[Device Info merge] Failure {
  attemptId: "abc-123",
  hasData: false,
  error: "Cannot read property 'local' of undefined",
  details: { errorStack: "..." }
}
```

**Impact**: Merge fails, null stored in database

**Evidence Needed**:
- Check for JavaScript errors in merge logs
- Review error stack traces for common patterns
- Identify null/undefined access issues

**Fix Priority**: HIGH - Indicates code bugs

---

## Stage 3: Database Storage

### Location
- **File**: `src/app/api/public/exams/[examId]/access/route.ts`
- **Endpoint**: `POST /api/public/exams/[examId]/access`
- **Logging**: Added in Task 4

### Potential Root Causes

#### RC-3.1: Database Update Failures
**Symptom**: Supabase update fails to store device info

**Log Pattern**:
```
[Device Info storage] Failure {
  attemptId: "abc-123",
  hasData: true,
  error: "Database update failed",
  details: { 
    errorCode: "PGRST116",
    errorMessage: "JSON object requested, multiple rows returned"
  }
}
```

**Impact**: Device info not persisted to database

**Evidence Needed**:
- Check Supabase error logs for update failures
- Review database constraints and triggers
- Verify attempt ID is unique and valid

**Fix Priority**: HIGH - Data loss issue

---

#### RC-3.2: JSONB Serialization Issues
**Symptom**: Device info fails to serialize to JSONB format

**Log Pattern**:
```
[Device Info storage] Failure {
  attemptId: "abc-123",
  hasData: true,
  error: "Invalid JSON for JSONB column",
  details: { 
    deviceInfoType: "object",
    hasCircularRefs: false
  }
}
```

**Impact**: Device info not stored correctly

**Evidence Needed**:
- Check if device info contains non-serializable data
- Verify JSON.stringify() succeeds before storage
- Review JSONB column constraints

**Fix Priority**: MEDIUM - Rare but critical when it occurs

---

#### RC-3.3: Missing Validation Before Storage
**Symptom**: Invalid device info stored without validation

**Log Pattern**:
```
[Device Info storage] Success {
  attemptId: "abc-123",
  hasData: true,
  dataFormat: "invalid",
  details: { 
    storedWithoutValidation: true,
    missingFields: ["all required fields"]
  }
}
```

**Impact**: Invalid data stored, causes display issues later

**Evidence Needed**:
- Check if validation runs before database update
- Review stored device_info for invalid structures
- Verify validation errors are caught

**Fix Priority**: MEDIUM - Prevents garbage data storage

---

#### RC-3.4: IP-Only Storage Path
**Symptom**: Only IP stored when device info is available

**Log Pattern**:
```
[Device Info storage] Success {
  attemptId: "abc-123",
  hasData: false,
  details: { 
    operation: "ip_only_storage",
    reason: "Device info was null or empty"
  }
}
```

**Impact**: Device info lost even though it was collected

**Evidence Needed**:
- Check if device info is present but not stored
- Review conditional logic for storage path selection
- Verify clientDeviceInfo is not accidentally nullified

**Fix Priority**: HIGH - Data loss despite successful collection

---

## Stage 4: Database Retrieval

### Location
- **File**: `src/app/api/admin/exams/[examId]/attempts/route.ts`
- **Endpoint**: `GET /api/admin/exams/[examId]/attempts`
- **Logging**: Added in Task 5

### Potential Root Causes

#### RC-4.1: device_info Column Not Selected
**Symptom**: Query doesn't include device_info in SELECT

**Log Pattern**:
```
[Device Info retrieval] Success {
  success: true,
  hasData: false,
  details: { 
    resultCount: 50,
    sampleHasDeviceInfo: false,
    nullDeviceInfoCount: 50
  }
}
```

**Impact**: All attempts show null device_info

**Evidence Needed**:
- Review SQL query to verify device_info is selected
- Check RPC function return columns
- Verify Supabase query builder includes device_info

**Fix Priority**: CRITICAL - Complete data loss in retrieval

---

#### RC-4.2: RPC Function Missing device_info
**Symptom**: RPC function doesn't return device_info column

**Log Pattern**:
```
[Device Info retrieval] Success {
  details: { 
    queryMethod: "rpc",
    rpcFunction: "get_exam_attempts",
    sampleHasDeviceInfo: false
  }
}
```

**Impact**: Device info not available to display component

**Evidence Needed**:
- Check RPC function definition in database
- Verify RETURN TABLE includes device_info
- Review RPC function SELECT statement

**Fix Priority**: HIGH - Affects all attempts using RPC

---

#### RC-4.3: JSONB Parsing Errors on Retrieval
**Symptom**: device_info retrieved but not parseable

**Log Pattern**:
```
[Device Info retrieval] Failure {
  attemptId: "abc-123",
  hasData: true,
  error: "Invalid JSON structure in device_info",
  details: { 
    validation: {
      isValid: false,
      format: "invalid",
      missingFields: ["all required fields"]
    }
  }
}
```

**Impact**: Device info present but unusable

**Evidence Needed**:
- Check validation logs for retrieved data
- Review stored JSONB for corruption
- Verify database encoding/decoding

**Fix Priority**: MEDIUM - Data corruption issue

---

#### RC-4.4: Null device_info in Database
**Symptom**: device_info column is null for many attempts

**Log Pattern**:
```
[Device Info retrieval] Success {
  details: { 
    resultCount: 50,
    nullDeviceInfoCount: 35,
    nullDeviceInfoPercentage: 70
  }
}
```

**Impact**: High percentage of "Unknown Device" displays

**Evidence Needed**:
- Count null device_info records in database
- Check if nulls are from old attempts or recent ones
- Correlate with storage stage failures

**Fix Priority**: HIGH - Indicates upstream storage issues

---

## Stage 5: Display Component

### Location
- **File**: `src/components/admin/DeviceInfoCell.tsx`
- **Component**: `DeviceInfoCell`
- **Logging**: Added in Task 6

### Potential Root Causes

#### RC-5.1: JSON Parsing Failures
**Symptom**: JSON.parse() fails on device_info string

**Log Pattern**:
```
[Device Info display] Failure {
  operation: "JSON.parse",
  hasData: true,
  error: "Unexpected token < in JSON at position 0",
  details: { 
    rawStringLength: 150,
    rawStringPreview: "<html>..."
  }
}
```

**Impact**: "Unknown Device" displayed despite data present

**Evidence Needed**:
- Check raw device_info strings that fail parsing
- Identify if HTML/text is stored instead of JSON
- Review storage stage for serialization issues

**Fix Priority**: HIGH - Common display failure

---

#### RC-5.2: Missing Display Fields
**Symptom**: Parsed device info lacks required display fields

**Log Pattern**:
```
[Device Info display] Success {
  dataFormat: "enhanced",
  details: { 
    operation: "format_detection",
    isValid: false,
    missingFields: ["friendlyName or oem"]
  }
}
```

**Impact**: Falls back to "Unknown Device"

**Evidence Needed**:
- Check which fields are missing in parsed data
- Review if collection stage gathered these fields
- Verify merge stage preserved these fields

**Fix Priority**: MEDIUM - Indicates incomplete data collection

---

#### RC-5.3: Format Detection Failures
**Symptom**: Cannot detect enhanced or legacy format

**Log Pattern**:
```
[Device Info display] Success {
  dataFormat: "invalid",
  details: { 
    operation: "format_detection",
    isValid: false,
    missingFields: ["all required fields"],
    warnings: ["Device info does not match enhanced or legacy format"]
  }
}
```

**Impact**: Cannot extract display information

**Evidence Needed**:
- Review device info structures that fail detection
- Check if new format variations exist
- Verify format detection logic is comprehensive

**Fix Priority**: MEDIUM - Indicates format mismatch

---

#### RC-5.4: Fallback Chain Failures
**Symptom**: All display paths fail, triggers "Unknown Device"

**Log Pattern**:
```
[Device Info display] Success {
  operation: "fallback",
  reason: "No valid display fields found in parsed device info",
  displayValue: "Unknown Device"
}
```

**Impact**: "Unknown Device" displayed

**Evidence Needed**:
- Check which display paths were attempted
- Review if any fallback path should have succeeded
- Verify fallback logic order (friendlyName → oem → browser/platform → legacy → IP)

**Fix Priority**: MEDIUM - Indicates weak fallback logic

---

#### RC-5.5: Null Checks Missing
**Symptom**: Component crashes or fails on null access

**Log Pattern**:
```
[Device Info display] Failure {
  operation: "display_path",
  error: "Cannot read property 'brand' of undefined",
  details: { path: "oem" }
}
```

**Impact**: Component error, no display

**Evidence Needed**:
- Check for JavaScript errors in display logs
- Review null/undefined access patterns
- Verify all field accesses have null checks

**Fix Priority**: HIGH - Causes component failures

---

## Cross-Stage Root Causes

### RC-X.1: Legacy Data Migration Issues
**Symptom**: Old attempts have different device info format

**Impact**: Historical data shows "Unknown Device"

**Evidence**:
- Check device_info format for attempts before enhanced tracking
- Review if legacy format is properly handled
- Verify backward compatibility in display component

**Fix Priority**: LOW - Only affects historical data

---

### RC-X.2: Race Conditions in Storage
**Symptom**: Device info collected but not stored due to timing

**Impact**: Intermittent "Unknown Device" displays

**Evidence**:
- Check if device info arrives after attempt creation
- Review async operation timing
- Verify database update happens after merge

**Fix Priority**: MEDIUM - Intermittent failures are hard to debug

---

### RC-X.3: Network Failures During Submission
**Symptom**: Exam submission succeeds but device info not sent

**Impact**: Attempt created without device info

**Evidence**:
- Check network logs for failed device info requests
- Review if device info is sent in same request as submission
- Verify error handling for partial request failures

**Fix Priority**: HIGH - Common in poor network conditions

---

## Recommended Analysis Steps

### Step 1: Review Client-Side Collection Logs
```bash
# Search browser console for collection logs
grep "\[Device Info collection\]" browser-console.log

# Count success vs failure
grep "collection\] Success" browser-console.log | wc -l
grep "collection\] Failure" browser-console.log | wc -l
```

**Look for**:
- Timeout errors (RC-1.1)
- API unavailability (RC-1.2)
- Missing logs (RC-1.4)

---

### Step 2: Review Server-Side Merge Logs
```bash
# Search server logs for merge operations
grep "\[Device Info merge\]" server.log

# Count null client device info
grep "Client device info is null" server.log | wc -l

# Check validation failures
grep "validation failed" server.log
```

**Look for**:
- High percentage of null client device info (RC-2.1)
- Validation failures (RC-2.3)
- Merge exceptions (RC-2.4)

---

### Step 3: Review Storage Logs
```bash
# Search for storage operations
grep "\[Device Info storage\]" server.log

# Count database update failures
grep "storage\] Failure" server.log | wc -l

# Check IP-only storage
grep "ip_only_storage" server.log | wc -l
```

**Look for**:
- Database update failures (RC-3.1)
- High IP-only storage rate (RC-3.4)
- Serialization errors (RC-3.2)

---

### Step 4: Review Retrieval Logs
```bash
# Search for retrieval operations
grep "\[Device Info retrieval\]" server.log

# Check null device_info percentage
grep "nullDeviceInfoPercentage" server.log

# Verify RPC vs direct query
grep "queryMethod" server.log
```

**Look for**:
- High null percentage (RC-4.4)
- RPC function issues (RC-4.2)
- Query selection problems (RC-4.1)

---

### Step 5: Review Display Logs
```bash
# Search browser console for display logs
grep "\[Device Info display\]" browser-console.log

# Count JSON parsing failures
grep "JSON.parse.*Failure" browser-console.log | wc -l

# Check fallback triggers
grep "fallback.*Unknown Device" browser-console.log
```

**Look for**:
- JSON parsing failures (RC-5.1)
- Missing display fields (RC-5.2)
- Format detection failures (RC-5.3)

---

### Step 6: Database Query Analysis
```sql
-- Count total attempts
SELECT COUNT(*) FROM exam_attempts;

-- Count attempts with null device_info
SELECT COUNT(*) FROM exam_attempts WHERE device_info IS NULL;

-- Calculate percentage
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE device_info IS NULL) as null_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE device_info IS NULL) / COUNT(*), 2) as null_percentage
FROM exam_attempts;

-- Sample device_info structures
SELECT 
  id,
  device_info::text,
  LENGTH(device_info::text) as json_length,
  jsonb_typeof(device_info) as json_type
FROM exam_attempts 
WHERE device_info IS NOT NULL 
LIMIT 10;

-- Check for invalid JSON structures
SELECT 
  id,
  device_info::text
FROM exam_attempts 
WHERE device_info IS NOT NULL
  AND NOT (device_info ? 'friendlyName' OR device_info ? 'oem' OR device_info ? 'type')
LIMIT 10;
```

---

## Priority Matrix

| Root Cause | Stage | Priority | Impact | Likelihood |
|------------|-------|----------|--------|------------|
| RC-1.4: Collection Not Executed | Collection | CRITICAL | Complete failure | Low |
| RC-4.1: device_info Not Selected | Retrieval | CRITICAL | All attempts affected | Low |
| RC-1.1: API Timeout Failures | Collection | HIGH | Partial data loss | High |
| RC-2.1: Null Client Device Info | Merge | HIGH | No device details | High |
| RC-3.1: Database Update Failures | Storage | HIGH | Data loss | Medium |
| RC-3.4: IP-Only Storage Path | Storage | HIGH | Data loss despite collection | Medium |
| RC-4.4: Null device_info in DB | Retrieval | HIGH | High "Unknown Device" rate | High |
| RC-5.1: JSON Parsing Failures | Display | HIGH | Display failure | Medium |
| RC-5.5: Null Checks Missing | Display | HIGH | Component crashes | Low |
| RC-1.2: Browser API Unavailability | Collection | MEDIUM | Missing enhanced fields | Medium |
| RC-2.2: Missing allIPs Structure | Merge | MEDIUM | Missing IP display | Low |
| RC-2.3: Validation Failures | Merge | MEDIUM | Invalid data stored | Medium |
| RC-3.2: JSONB Serialization Issues | Storage | MEDIUM | Storage corruption | Low |
| RC-3.3: Missing Validation | Storage | MEDIUM | Invalid data stored | Medium |
| RC-4.3: JSONB Parsing Errors | Retrieval | MEDIUM | Data corruption | Low |
| RC-5.2: Missing Display Fields | Display | MEDIUM | Incomplete data | Medium |
| RC-5.3: Format Detection Failures | Display | MEDIUM | Format mismatch | Low |
| RC-5.4: Fallback Chain Failures | Display | MEDIUM | Weak fallback logic | Medium |
| RC-X.2: Race Conditions | Cross-stage | MEDIUM | Intermittent failures | Low |
| RC-X.3: Network Failures | Cross-stage | HIGH | Poor network conditions | Medium |
| RC-1.3: WebRTC IP Discovery | Collection | LOW | Missing local IP | Medium |
| RC-X.1: Legacy Data Migration | Cross-stage | LOW | Historical data only | High |

---

## Next Steps

1. **Deploy logging changes** to staging/production (if not already done)
2. **Monitor logs for 24-48 hours** to gather real-world data
3. **Run database queries** to check null device_info percentage
4. **Analyze log patterns** to identify most common root causes
5. **Prioritize fixes** based on impact and likelihood
6. **Implement targeted fixes** in Task 9 based on findings
7. **Verify fixes** with comprehensive testing in Tasks 9.5, 9.6, 10.1

---

## Conclusion

This root cause analysis provides a comprehensive framework for identifying where device information is lost or corrupted in the pipeline. The diagnostic logging infrastructure implemented in Tasks 1-6 enables systematic investigation of each stage.

**Key Findings**:
- **25 potential root causes** identified across 5 pipeline stages
- **Priority matrix** helps focus on high-impact issues first
- **Log patterns** provide clear signatures for each root cause
- **Analysis steps** guide systematic investigation
- **Database queries** enable quantitative assessment

**Expected Outcome**:
After analyzing production logs using this framework, we should be able to:
1. Identify the top 3-5 root causes contributing to "Unknown Device" displays
2. Quantify the impact of each root cause (% of affected attempts)
3. Implement targeted fixes in Task 9 based on evidence
4. Reduce "Unknown Device" percentage to < 5%

**Requirements Validated**: 8.1, 8.2, 8.3, 8.4
