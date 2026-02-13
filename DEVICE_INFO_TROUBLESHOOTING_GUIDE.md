# Device Info Troubleshooting Guide

## For Administrators

This guide helps administrators diagnose and resolve "Unknown Device" issues in the exam results.

## Quick Diagnostic Steps

### 1. Check Device Info Health

Use the bulk health check endpoint to get an overview:

```bash
# Check all recent attempts
GET /api/admin/device-info/health?limit=100

# Check specific exam
GET /api/admin/device-info/health?examId=<exam-id>&limit=50
```

**Response**:
```json
{
  "stats": {
    "total": 100,
    "withDeviceInfo": 95,
    "withoutDeviceInfo": 5,
    "enhanced": 90,
    "legacy": 5,
    "invalid": 0,
    "healthPercentage": 95
  },
  "results": [...]
}
```

**Health Indicators**:
- ✅ **Good**: healthPercentage > 95%
- ⚠️ **Warning**: healthPercentage 80-95%
- ❌ **Critical**: healthPercentage < 80%

### 2. Inspect Specific Attempt

Open browser console on any admin page and run:

```javascript
inspectDeviceInfo('attempt-id-here')
```

This will show:
- Raw device_info data
- Parsed device info object
- Validation results (format, missing fields, warnings)
- IP address information
- Timestamps

### 3. Check Browser Console Logs

Look for device info pipeline logs in the browser console:

**Collection Stage**:
```
[Device Collection] Starting device info collection
[Device Collection] Device info collected successfully
```

**Storage Stage**:
```
[Device Info storage] Success
```

**Display Stage**:
```
[Device Info display] Success
```


## Common Failure Scenarios

### Scenario 1: "Unknown Device" with No Data Badge

**Symptoms**:
- Device shows as "Unknown Device"
- Yellow "⚠️ No Data" badge displayed
- Only IP address visible

**Possible Causes**:

#### A. Client-Side Collection Failed

**Check**: Look for collection errors in browser console
```
[Device Collection] Failed to collect device info: {error: "..."}
```

**Common Reasons**:
1. **Unsupported Browser**: Very old browsers without Promise support
2. **JavaScript Disabled**: Rare, but possible
3. **Network Timeout**: WebRTC IP discovery timed out
4. **Permission Denied**: Geolocation blocked (non-critical)

**Solutions**:
- Ensure students use modern browsers (Chrome 89+, Firefox 88+, Safari 14+)
- Check if browser extensions are blocking JavaScript
- Increase timeout in `collectDeviceInfo.ts` if network is slow
- Geolocation failure is expected and doesn't affect core functionality

#### B. Client Didn't Send Device Info

**Check**: Look for storage logs
```
[Device Info storage] Success {
  hasData: false,
  reason: "No client or fallback device info available"
}
```

**Common Reasons**:
1. **Old Client Version**: Student using cached old version without device collection
2. **Form Submission Error**: Device info not included in POST body
3. **Network Interruption**: Request sent without device info payload

**Solutions**:
- Clear browser cache and reload exam entry page
- Check network tab for POST request to `/api/public/exams/[examId]/access`
- Verify `deviceInfo` field is present in request body
- Force refresh (Ctrl+F5 / Cmd+Shift+R) to get latest client code

#### C. Server-Side Merge Failed

**Check**: Look for merge errors
```
[Device Info merge] Failure {
  error: "Merge operation failed: ..."
}
```

**Common Reasons**:
1. **Malformed Client Data**: Invalid JSON structure
2. **Missing Required Fields**: Client sent incomplete data
3. **Server Exception**: Unexpected error in merge logic

**Solutions**:
- Check server logs for detailed error stack traces
- Validate client device info structure matches expected format
- Review recent code changes to `mergeDeviceInfo.ts`
- Check if database schema changed


#### D. Database Storage Failed

**Check**: Look for storage errors
```
[Device Info storage] Failure {
  error: "Database connection timeout",
  operation: "database-update",
  retriesAttempted: 2
}
```

**Common Reasons**:
1. **Database Connection Issues**: Supabase connection timeout
2. **JSONB Column Error**: Invalid JSON for PostgreSQL JSONB
3. **Row Level Security**: RLS policy blocking update
4. **Database Overload**: Too many concurrent writes

**Solutions**:
- Check Supabase dashboard for connection issues
- Verify `device_info` column is JSONB type
- Review RLS policies on `exam_attempts` table
- Scale database if under heavy load
- Check if retry logic is working (should retry 2 times)

**Fallback Behavior**:
Even if device info storage fails, the system will:
1. Retry 2 times with exponential backoff
2. Fall back to storing IP address only
3. Never block exam access

#### E. Display Parsing Failed

**Check**: Look for display errors
```
[Device Info display] Success {
  operation: "fallback",
  reason: "JSON parsing failed: Unexpected token",
  displayValue: "Unknown Device"
}
```

**Common Reasons**:
1. **Corrupted JSON**: Database returned malformed JSON string
2. **Encoding Issues**: Special characters not properly escaped
3. **Truncated Data**: JSON string cut off mid-structure

**Solutions**:
- Check raw `device_info` value in database
- Look for trailing commas, unescaped quotes, or invalid characters
- Verify database encoding is UTF-8
- Check if JSON sanitization in `DeviceInfoCell.tsx` is working
- Manually fix corrupted records in database

### Scenario 2: "Unknown Device" with Valid Data

**Symptoms**:
- Device info is stored in database
- Validation shows format is "enhanced" or "legacy"
- Still displays as "Unknown Device"

**Possible Causes**:

#### A. Missing Display Fields

**Check**: Inspect device info structure
```javascript
inspectDeviceInfo('attempt-id')
// Look at parsed device info
```

**Common Reasons**:
1. **No friendlyName**: Enhanced format missing friendlyName
2. **No OEM Data**: Both brand and model are null
3. **No Browser/Platform**: All display fields are null

**Solutions**:
- Check why `generateFriendlyName()` returned empty string
- Verify User-Agent Client Hints are being collected (Chromium only)
- Check if User-Agent parsing is working for non-Chromium browsers
- Review `extractBrowserDetails()` and `extractPlatformDetails()` logic


#### B. Display Component Logic Error

**Check**: Look for display path logs
```
[Device Info display] Success {
  operation: "display_path",
  path: "friendlyName",
  value: "Samsung Galaxy S21..."
}
```

**Common Reasons**:
1. **Fallback Chain Broken**: Logic error in fallback priority
2. **Null Check Missing**: Accessing property of null/undefined
3. **Type Mismatch**: Expected string but got object

**Solutions**:
- Review `DeviceInfoCell.tsx` fallback chain logic
- Add null checks for all property accesses
- Verify data types match expected format
- Test with various device info formats

### Scenario 3: High "Unknown Device" Percentage

**Symptoms**:
- Health check shows < 80% with device info
- Many attempts showing "Unknown Device"
- Pattern across multiple exams

**Possible Causes**:

#### A. Systematic Collection Failure

**Check**: Review collection logs across multiple attempts

**Common Reasons**:
1. **Browser Compatibility**: Students using unsupported browsers
2. **Network Issues**: Slow network causing timeouts
3. **Client Code Error**: Bug in collection logic
4. **Ad Blockers**: Extensions blocking WebRTC or other APIs

**Solutions**:
- Analyze browser distribution from User-Agent logs
- Increase collection timeout from 5s to 10s
- Test collection on various browsers and networks
- Add user-facing message about disabling ad blockers
- Implement progressive enhancement (collect what's available)

#### B. Systematic Storage Failure

**Check**: Review storage logs for patterns

**Common Reasons**:
1. **Database Performance**: Slow writes causing timeouts
2. **RLS Policy Issue**: Blocking legitimate updates
3. **Connection Pool Exhaustion**: Too many concurrent connections
4. **Schema Migration**: Recent database change broke compatibility

**Solutions**:
- Monitor Supabase performance metrics
- Review and optimize RLS policies
- Increase connection pool size
- Verify schema matches expected structure
- Add database indexes for performance


## Diagnostic Tools

### 1. Browser Console Inspector

**Location**: Available on any admin page

**Usage**:
```javascript
// Inspect specific attempt
inspectDeviceInfo('attempt-id-here')

// Output shows:
// - Raw data from database
// - Parsed device info object
// - Validation results
// - IP addresses
// - Timestamps
```

**When to Use**:
- Investigating specific "Unknown Device" cases
- Verifying data structure
- Checking for parsing errors

### 2. Health Check Endpoint

**Location**: `/api/admin/device-info/health`

**Usage**:
```bash
# All recent attempts
curl -H "Authorization: Bearer <token>" \
  "https://your-domain.com/api/admin/device-info/health?limit=100"

# Specific exam
curl -H "Authorization: Bearer <token>" \
  "https://your-domain.com/api/admin/device-info/health?examId=<id>&limit=50"
```

**Response Fields**:
- `stats.total`: Total attempts checked
- `stats.withDeviceInfo`: Attempts with valid device info
- `stats.healthPercentage`: Overall health score
- `stats.enhanced`: Attempts using enhanced format
- `stats.legacy`: Attempts using legacy format
- `stats.invalid`: Attempts with invalid/corrupted data
- `results[]`: Per-attempt health details

**When to Use**:
- Getting overview of device info health
- Identifying patterns across multiple attempts
- Monitoring after fixes deployed

### 3. Device Info Statistics Dashboard

**Location**: Admin dashboard (if implemented)

**Features**:
- Real-time health percentage
- Format distribution (enhanced vs legacy)
- Missing data indicators
- Trend over time

**When to Use**:
- Regular monitoring
- Identifying degradation trends
- Validating improvements after fixes

### 4. Browser Console Logs

**How to Access**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Filter by "Device" to see device info logs

**Log Prefixes**:
- `[Device Collection]` - Client-side collection
- `[Device Info merge]` - Server-side merge
- `[Device Info storage]` - Database storage
- `[Device Info retrieval]` - Database query
- `[Device Info display]` - UI rendering

**When to Use**:
- Real-time debugging during exam
- Reproducing issues
- Understanding pipeline flow


## Step-by-Step Troubleshooting Process

### For Individual "Unknown Device" Cases

1. **Identify the Attempt**
   - Note the attempt ID from results table
   - Note the student name and exam

2. **Inspect Device Info**
   ```javascript
   inspectDeviceInfo('attempt-id')
   ```
   - Check if device_info exists in database
   - Check validation results
   - Note the format (enhanced/legacy/null/invalid)

3. **Check Browser Console Logs**
   - Ask student to reproduce issue if possible
   - Look for collection errors
   - Look for storage errors
   - Note any warnings

4. **Analyze Root Cause**
   - No device_info in DB → Collection or storage failure
   - Invalid format → Parsing or merge failure
   - Valid data but "Unknown Device" → Display logic issue

5. **Apply Fix**
   - Collection failure → Check browser compatibility
   - Storage failure → Check database logs
   - Display failure → Review DeviceInfoCell logic

### For Widespread Issues

1. **Run Health Check**
   ```bash
   GET /api/admin/device-info/health?limit=100
   ```
   - Note health percentage
   - Check format distribution
   - Identify patterns

2. **Analyze Patterns**
   - Is it affecting all exams or specific ones?
   - Is it affecting all students or specific browsers?
   - Did it start after a deployment?

3. **Check Recent Changes**
   - Review recent code deployments
   - Check database schema changes
   - Verify environment variables

4. **Test Collection**
   - Open exam entry page in various browsers
   - Check console for collection logs
   - Verify device info is sent in POST request

5. **Monitor After Fix**
   - Deploy fix to staging first
   - Run health check before and after
   - Monitor logs for 24-48 hours


## Prevention Best Practices

### 1. Regular Monitoring

- Run health checks weekly
- Set up alerts for health percentage < 90%
- Monitor logs for error patterns
- Track format distribution trends

### 2. Browser Compatibility Testing

- Test on Chrome, Firefox, Safari, Edge
- Test on mobile browsers (iOS Safari, Chrome Mobile)
- Test on older browser versions
- Document minimum supported versions

### 3. Graceful Degradation

- Never block exam access due to device info failure
- Always fall back to IP address
- Log failures but continue operation
- Provide meaningful error messages

### 4. Data Validation

- Validate device info before storage
- Sanitize JSON before parsing
- Add null checks for all property accesses
- Use TypeScript for type safety

### 5. Performance Optimization

- Keep collection timeout reasonable (5-10s)
- Use retry logic for transient failures
- Implement exponential backoff
- Monitor database performance

### 6. Documentation

- Keep this guide updated
- Document all format changes
- Maintain changelog for device info pipeline
- Share knowledge with team

## Emergency Procedures

### Critical: All Attempts Showing "Unknown Device"

1. **Immediate Actions**:
   - Check if exam access is blocked (should not be)
   - Verify students can still take exams
   - Check Supabase status page

2. **Quick Diagnosis**:
   - Run health check endpoint
   - Check browser console on exam entry page
   - Review recent deployments

3. **Rollback Decision**:
   - If recent deployment caused issue → Rollback
   - If database issue → Check Supabase
   - If client issue → Deploy hotfix

4. **Communication**:
   - Notify administrators
   - Document issue and resolution
   - Update monitoring alerts

### Non-Critical: Gradual Increase in "Unknown Device"

1. **Monitor Trend**:
   - Run health checks daily
   - Track percentage over time
   - Identify affected exams/browsers

2. **Investigate Root Cause**:
   - Review logs for patterns
   - Test on affected browsers
   - Check for environmental changes

3. **Plan Fix**:
   - Develop fix in staging
   - Test thoroughly
   - Deploy during low-traffic period

4. **Validate Fix**:
   - Run health check before/after
   - Monitor for 48 hours
   - Document resolution

## Support Contacts

For technical issues with device info pipeline:
- Review this guide first
- Check browser console logs
- Run diagnostic tools
- Document findings before escalating

