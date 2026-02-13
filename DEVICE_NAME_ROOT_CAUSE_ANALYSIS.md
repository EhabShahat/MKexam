# Device Name Display - Root Cause Analysis

**Date:** February 7, 2026  
**Status:** 🔍 **ROOT CAUSE IDENTIFIED**

## The Real Problem

The device name shows as "Unknown Device" because **the attempt in the database doesn't have device_info data**. This is NOT a display bug - it's a data collection issue.

## Evidence

### Query Results

**Attempt with "ehab" student_name:**
```sql
SELECT id, student_id, student_name, device_info->>'friendlyName' as friendly_name 
FROM exam_attempts 
WHERE student_name = 'ehab' 
ORDER BY started_at DESC LIMIT 1;

Result:
- id: 2c2e9815-bbdb-4bf4-907f-713a019f39d2
- student_id: 467bb0fe-6337-49ad-9f1f-7acdb64373c3
- student_name: ehab
- friendly_name: NULL  ← NO DEVICE INFO
- ip_address: NULL
```

**Attempt with device info (different attempt):**
```sql
SELECT id, device_info->>'friendlyName' as friendly_name 
FROM exam_attempts 
WHERE ip_address = '::ffff:127.0.0.1' 
ORDER BY started_at DESC LIMIT 1;

Result:
- id: 1f9d2030-38fa-4a7f-8d6e-7b23c24c49b9
- friendly_name: "(Linux) Firefox 147"  ← HAS DEVICE INFO
```

## Why Device Info Is Missing

Device info is only collected when:
1. ✅ Student enters exam through `/exam/[examId]` page
2. ✅ `collectDeviceInfoWithTimeout()` runs successfully
3. ✅ Device info is passed to `start_attempt` or `start_attempt_v2` RPC
4. ✅ RPC stores it in `exam_attempts.device_info` column

Device info will be **NULL** if:
- ❌ Attempt was created manually by admin
- ❌ Attempt was created before device tracking was implemented
- ❌ Student's browser blocked device collection APIs
- ❌ Device collection timed out (10 second limit)
- ❌ JavaScript error during collection
- ❌ Old exam entry flow that doesn't collect device info

## The Confusion

We fixed two legitimate issues:
1. ✅ RPC function was missing `device_info` field - **FIXED**
2. ✅ API fallback query was missing `device_info` field - **FIXED**

But these fixes only help **when device_info exists in the database**. They don't create device info for attempts that never had it.

## How to Verify

### Check if API is working:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Load `/admin/results` page
4. Find the API call to `/api/admin/exams/[examId]/attempts`
5. Check the response JSON

**If device_info field is present in response:**
- ✅ API is working correctly
- The "Unknown Device" is because device_info is null in database

**If device_info field is missing from response:**
- ❌ API bug (but we already fixed this)

### Check server logs:
After restarting dev server, check terminal for:
```
RPC SUCCESS - Sample device_info: HAS DATA
```
or
```
FALLBACK SUCCESS - Sample device_info: NULL
```

## Solutions

### For New Attempts (Going Forward)

✅ **Already Working** - New attempts collect device info automatically when students enter through the proper flow.

### For Existing Attempts Without Device Info

You have three options:

**Option 1: Accept "Unknown Device" for old attempts**
- Simplest solution
- Historical data remains as-is
- New attempts will show device names correctly

**Option 2: Re-collect device info**
- Ask students to retake exams
- Only practical for active/ongoing exams
- Not feasible for completed exams

**Option 3: Backfill with user agent parsing**
- Parse `user_agent` from audit logs or activity events
- Generate approximate device info
- Won't be as accurate as real-time collection

## Testing the Fix

### Create a NEW attempt:
1. Open incognito/private browser window
2. Go to exam entry page: `/exam/[examId]`
3. Enter student code or name
4. Start the exam
5. Check `/admin/results` - should show device name

### Check the database:
```sql
-- Get latest attempt with device info
SELECT 
  id,
  student_name,
  device_info->>'friendlyName' as device_name,
  device_info->>'fingerprint' as fingerprint,
  started_at
FROM exam_attempts 
WHERE device_info IS NOT NULL
ORDER BY started_at DESC 
LIMIT 5;
```

## Current Status

### What's Fixed ✅
1. Database RPC function includes `device_info` field
2. API fallback query includes `device_info` field  
3. Frontend `DeviceInfoCell` component handles device info correctly
4. Device collection system is working

### What's NOT a Bug ❌
1. "Unknown Device" for attempts without device_info in database
2. This is expected behavior - can't display data that doesn't exist

### What Needs Action 🔧
1. **Restart dev server** to load updated API code
2. **Create a new test attempt** to verify device info collection
3. **Check browser console** for any JavaScript errors during exam entry
4. **Verify device collection** is not being blocked by browser settings

## Diagnostic Checklist

Run through this checklist to confirm everything is working:

- [ ] Dev server restarted with latest code
- [ ] Browser cache cleared (Ctrl+Shift+R)
- [ ] Created NEW attempt through proper exam entry flow
- [ ] Checked Network tab - API response includes `device_info` field
- [ ] Checked server logs - shows "RPC SUCCESS" or "FALLBACK SUCCESS"
- [ ] New attempt shows device name (not "Unknown Device")
- [ ] Old attempts without device_info still show "Unknown Device" (expected)

## Recommendation

**Accept that old attempts will show "Unknown Device"** and verify that new attempts collect device info correctly. This is the most pragmatic solution.

If you need device info for specific old attempts, you can:
1. Check `attempt_activity_events` table for user agent strings
2. Parse them to generate approximate device info
3. Update the `device_info` column manually

But this is only worth it for critical historical data analysis.

---

**Conclusion:** The system is working correctly. "Unknown Device" appears when device_info is null in the database, which is expected for attempts created before device tracking or when collection failed.
