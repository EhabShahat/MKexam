# Device Info Common Failure Scenarios and Fixes

## Overview

This document catalogs common failure scenarios in the device info pipeline, their root causes, and proven fixes.

## Collection Stage Failures

### Failure 1: WebRTC IP Discovery Timeout

**Symptoms**:
```javascript
[Device Collection] WebRTC IP discovery failed: {
  error: "Timeout after 5000ms",
  name: "TimeoutError"
}
```

**Root Cause**:
- Slow network connection
- Firewall blocking WebRTC
- Browser doesn't support WebRTC
- STUN server unreachable

**Impact**: Partial - device info still collected without local/public IPs

**Fix**:
1. Increase timeout in `webrtcIpDiscovery.ts`:
   ```typescript
   const ipDiscoveryPromise = discoverIPs(10000); // 10s instead of 5s
   ```

2. Add fallback STUN servers:
   ```typescript
   const servers = [
     { urls: 'stun:stun.l.google.com:19302' },
     { urls: 'stun:stun1.l.google.com:19302' },
     { urls: 'stun:stun2.l.google.com:19302' }
   ];
   ```

3. Make IP discovery truly optional (already implemented)

**Prevention**:
- WebRTC failure is expected and handled gracefully
- No action needed unless affecting > 50% of attempts

### Failure 2: Client Hints API Not Available

**Symptoms**:
```javascript
[Device Collection] Client Hints API not available
```

**Root Cause**:
- Non-Chromium browser (Firefox, Safari)
- Old Chromium version (< 89)
- API disabled by browser policy

**Impact**: Partial - falls back to User-Agent parsing

**Fix**:
No fix needed - this is expected behavior. The system automatically falls back to User-Agent string parsing.

**Prevention**:
- Document browser compatibility
- User-Agent parsing provides adequate fallback


### Failure 3: Geolocation Permission Denied

**Symptoms**:
```javascript
{
  latitude: null,
  longitude: null,
  accuracy: null,
  timestamp: null,
  error: "User denied Geolocation"
}
```

**Root Cause**:
- User denied permission prompt
- Browser doesn't support Geolocation API
- HTTPS required but using HTTP

**Impact**: None - geolocation is optional

**Fix**:
No fix needed - this is expected behavior. Geolocation is optional and permission denial is normal.

**Prevention**:
- Don't require geolocation for exam access
- Already handled gracefully in code

### Failure 4: Battery API Not Available

**Symptoms**:
```javascript
[Device Collection] Battery API not available
```

**Root Cause**:
- Chrome 103+ removed Battery API
- Browser never supported it (Safari)
- API disabled for privacy

**Impact**: None - battery info is optional

**Fix**:
No fix needed - this is expected behavior. Battery API is deprecated and optional.

**Prevention**:
- Consider removing battery collection in future
- Already handled gracefully

### Failure 5: Complete Collection Failure

**Symptoms**:
```javascript
[Device Collection] Failed to collect device info: {
  error: "Promise is not defined",
  userAgent: "unavailable"
}
```

**Root Cause**:
- Very old browser (IE11, old Android browser)
- JavaScript disabled
- Critical error in collection code

**Impact**: High - no device info collected

**Fix**:
1. Return minimal fallback data (already implemented):
   ```typescript
   return {
     collectedAt: new Date().toISOString(),
     friendlyName: "Unsupported Browser",
     userAgent: nav.userAgent || "Unknown",
     platform: nav.platform || null,
     unsupportedBrowser: true
   };
   ```

2. Add browser compatibility check on exam entry page

**Prevention**:
- Document minimum browser requirements
- Show warning for unsupported browsers
- Never block exam access


## Merge Stage Failures

### Failure 6: Null Client Device Info

**Symptoms**:
```javascript
[Device Info merge] Success {
  hasData: false,
  dataFormat: "null",
  reason: "Client device info is null or invalid"
}
```

**Root Cause**:
- Client didn't send device info in POST body
- Collection failed on client side
- Network error during submission
- Old client version without device collection

**Impact**: Medium - only server IP available

**Fix**:
1. Ensure client sends device info (already implemented in exam entry form)
2. Add version check to detect old clients
3. Force cache refresh for students

**Prevention**:
- Monitor percentage of null device info
- Alert if > 10% of attempts have null device info
- Implement client version tracking

### Failure 7: Malformed Client Data

**Symptoms**:
```javascript
[Device Info merge] Failure {
  error: "Cannot read property 'ips' of undefined"
}
```

**Root Cause**:
- Client sent incomplete data structure
- JSON serialization error
- Network corruption
- Bug in client collection code

**Impact**: Medium - falls back to minimal structure

**Fix**:
1. Add comprehensive null checks (already implemented):
   ```typescript
   const ipsArray = Array.isArray(clientDeviceInfo?.ips?.ips) 
     ? clientDeviceInfo.ips.ips 
     : [];
   ```

2. Validate client data structure before merge
3. Add schema validation with Zod

**Prevention**:
- Use TypeScript interfaces
- Validate data on client before sending
- Add integration tests for merge function

### Failure 8: Missing allIPs Structure

**Symptoms**:
```javascript
[Device Info merge] Success {
  hasData: true,
  addedDefaults: { allIPs: true }
}
```

**Root Cause**:
- Legacy client data without allIPs
- Merge logic didn't create structure
- Database migration incomplete

**Impact**: Low - automatically fixed by merge

**Fix**:
Already implemented - merge function always creates allIPs structure:
```typescript
allIPs: {
  local: localIPs,
  public: publicIPs,
  server: safeServerIP
}
```

**Prevention**:
- Ensure all code paths create allIPs
- Add validation after merge
- Test with legacy data formats


## Storage Stage Failures

### Failure 9: Database Connection Timeout

**Symptoms**:
```javascript
[Device Info storage] Failure {
  error: "Database connection timeout",
  operation: "database-update",
  retriesAttempted: 2
}
```

**Root Cause**:
- Supabase connection pool exhausted
- Network latency to database
- Database under heavy load
- Firewall blocking connection

**Impact**: Medium - falls back to IP-only storage

**Fix**:
1. Retry logic already implemented (2 retries with backoff)
2. Increase connection pool size in Supabase settings
3. Add database performance monitoring
4. Scale database if consistently slow

**Prevention**:
- Monitor database performance metrics
- Set up alerts for slow queries
- Optimize database indexes
- Consider read replicas for high traffic

### Failure 10: JSONB Validation Error

**Symptoms**:
```javascript
[Device Info storage] Failure {
  error: "invalid input syntax for type json",
  errorCode: "22P02"
}
```

**Root Cause**:
- Invalid JSON structure
- Special characters not escaped
- Circular references in object
- NaN or Infinity values

**Impact**: Medium - falls back to IP-only storage

**Fix**:
1. Add JSON validation before storage:
   ```typescript
   try {
     JSON.stringify(mergedDeviceInfo);
   } catch (e) {
     // Handle circular references or invalid values
   }
   ```

2. Sanitize data before storage:
   ```typescript
   const sanitized = JSON.parse(JSON.stringify(mergedDeviceInfo));
   ```

3. Replace invalid values:
   ```typescript
   const cleaned = replaceInvalidValues(mergedDeviceInfo);
   ```

**Prevention**:
- Validate data structure before storage
- Use JSON.stringify test before database write
- Add schema validation with Zod
- Test with edge cases

### Failure 11: Row Level Security Block

**Symptoms**:
```javascript
[Device Info storage] Failure {
  error: "new row violates row-level security policy",
  errorCode: "42501"
}
```

**Root Cause**:
- RLS policy too restrictive
- Missing authentication context
- Policy logic error
- Attempt ID doesn't match policy

**Impact**: High - device info not stored

**Fix**:
1. Review RLS policies on `exam_attempts` table
2. Ensure service role is used for updates (bypasses RLS)
3. Add policy exception for device_info updates
4. Test RLS policies thoroughly

**Prevention**:
- Use service role for system operations
- Document RLS policy requirements
- Test policies with various scenarios
- Monitor for RLS-related errors


## Display Stage Failures

### Failure 12: JSON Parse Error

**Symptoms**:
```javascript
[Device Info display] Success {
  operation: "fallback",
  reason: "JSON parsing failed: Unexpected token } in JSON",
  displayValue: "Unknown Device"
}
```

**Root Cause**:
- Trailing commas in JSON
- Unescaped quotes
- Truncated JSON string
- Invalid escape sequences

**Impact**: Low - falls back to "Unknown Device"

**Fix**:
Already implemented - JSON sanitization in DeviceInfoCell:
```typescript
// Remove trailing commas
sanitizedDeviceInfo = sanitizedDeviceInfo.replace(/,(\s*[}\]])/g, '$1');
```

Additional fixes:
1. Add more sanitization rules
2. Use JSON5 parser for lenient parsing
3. Store as JSONB (already done) to prevent corruption

**Prevention**:
- Always use JSONB column type
- Validate JSON before storage
- Use proper JSON serialization
- Test with malformed data

### Failure 13: Missing Display Fields

**Symptoms**:
```javascript
[Device Info display] Success {
  operation: "display_path",
  path: "fallback",
  value: "Unknown Device"
}
```

**Root Cause**:
- All display fields are null/undefined
- User-Agent parsing failed
- Client Hints not available
- Device model not recognized

**Impact**: Low - shows "Unknown Device" but data exists

**Fix**:
1. Improve User-Agent parsing for more devices
2. Add more device model patterns
3. Enhance fallback chain (already implemented)
4. Show browser/OS as last resort before "Unknown"

**Prevention**:
- Test with various User-Agent strings
- Maintain device model database
- Update parsing logic regularly
- Log unrecognized patterns

### Failure 14: Component Render Error

**Symptoms**:
```javascript
TypeError: Cannot read property 'brand' of undefined
```

**Root Cause**:
- Missing null check
- Unexpected data structure
- Type mismatch
- React rendering error

**Impact**: High - component crashes

**Fix**:
Add comprehensive null checks (already implemented):
```typescript
enhancedInfo?.oem?.brand && enhancedInfo?.oem?.model
```

Use optional chaining throughout:
```typescript
const localIP = enhancedInfo.allIPs?.local?.[0]?.ip || null;
```

**Prevention**:
- Use TypeScript strict mode
- Add null checks for all property accesses
- Use optional chaining (?.)
- Add error boundaries
- Test with null/undefined data


## Cross-Stage Failures

### Failure 15: End-to-End Data Loss

**Symptoms**:
- Collection succeeds
- Storage succeeds
- Retrieval returns null

**Root Cause**:
- Database transaction rollback
- Concurrent update conflict
- Cache invalidation issue
- Query filtering out data

**Impact**: High - data collected but not accessible

**Fix**:
1. Check database transaction logs
2. Verify no concurrent updates on same attempt
3. Clear query cache
4. Check WHERE clauses in retrieval queries

**Prevention**:
- Use database transactions properly
- Add optimistic locking if needed
- Monitor for data consistency issues
- Add end-to-end tests

### Failure 16: Format Migration Issues

**Symptoms**:
- Old attempts show "Unknown Device"
- New attempts work fine
- Mixed format in database

**Root Cause**:
- Legacy data not migrated
- Display logic doesn't handle legacy format
- Validation too strict for old data

**Impact**: Medium - affects historical data

**Fix**:
1. Ensure backward compatibility (already implemented)
2. Add data migration script if needed
3. Update validation to accept both formats
4. Test with legacy data

**Prevention**:
- Always maintain backward compatibility
- Version data formats
- Test migrations thoroughly
- Document format changes

### Failure 17: Performance Degradation

**Symptoms**:
- Collection takes > 10 seconds
- Storage times out frequently
- Display is slow

**Root Cause**:
- WebRTC timeout too long
- Database queries not optimized
- Large device info objects
- Network latency

**Impact**: Medium - affects user experience

**Fix**:
1. Optimize collection timeout (5s is reasonable)
2. Add database indexes on device_info queries
3. Compress large objects
4. Use CDN for static assets

**Prevention**:
- Monitor performance metrics
- Set performance budgets
- Optimize critical paths
- Load test regularly


## Quick Reference: Error Codes and Solutions

| Error Code | Stage | Severity | Quick Fix |
|------------|-------|----------|-----------|
| WebRTC Timeout | Collection | Low | Increase timeout or ignore |
| Client Hints N/A | Collection | Low | Expected for non-Chromium |
| Geolocation Denied | Collection | Low | Expected, no action needed |
| Null Client Data | Merge | Medium | Check client code, force refresh |
| Malformed Data | Merge | Medium | Add validation, null checks |
| DB Timeout | Storage | Medium | Retry logic, scale database |
| JSONB Error | Storage | Medium | Validate JSON before storage |
| RLS Block | Storage | High | Review policies, use service role |
| JSON Parse Error | Display | Low | Sanitize JSON, use JSONB |
| Missing Fields | Display | Low | Improve parsing, enhance fallback |
| Component Crash | Display | High | Add null checks, error boundary |
| Data Loss | Cross-stage | High | Check transactions, query logic |
| Format Migration | Cross-stage | Medium | Maintain backward compatibility |
| Performance | Cross-stage | Medium | Optimize timeouts, add indexes |

## Testing Checklist

### Before Deployment

- [ ] Test collection on Chrome, Firefox, Safari, Edge
- [ ] Test collection on mobile browsers
- [ ] Test with WebRTC blocked
- [ ] Test with geolocation denied
- [ ] Test with null client data
- [ ] Test with malformed JSON
- [ ] Test with legacy format data
- [ ] Test with missing display fields
- [ ] Test database connection failure
- [ ] Test JSON parse errors
- [ ] Run health check on staging
- [ ] Verify logs are working
- [ ] Check error handling paths
- [ ] Validate backward compatibility

### After Deployment

- [ ] Run health check immediately
- [ ] Monitor logs for 1 hour
- [ ] Check error rate
- [ ] Verify collection success rate
- [ ] Validate storage success rate
- [ ] Check display rendering
- [ ] Run health check after 24 hours
- [ ] Compare before/after metrics
- [ ] Document any issues found
- [ ] Update this guide if needed

## Monitoring Metrics

### Key Performance Indicators

1. **Health Percentage**: Should be > 95%
   - Alert if < 90%
   - Critical if < 80%

2. **Collection Success Rate**: Should be > 98%
   - Alert if < 95%
   - Critical if < 90%

3. **Storage Success Rate**: Should be > 99%
   - Alert if < 98%
   - Critical if < 95%

4. **Format Distribution**:
   - Enhanced: Should increase over time
   - Legacy: Should decrease over time
   - Invalid: Should be < 1%
   - Null: Should be < 5%

5. **Performance**:
   - Collection time: < 5s average
   - Storage time: < 500ms average
   - Display render: < 100ms average

### Alert Thresholds

- **Warning**: Health < 90%, investigate within 24h
- **Critical**: Health < 80%, investigate immediately
- **Emergency**: Health < 50%, rollback and investigate

