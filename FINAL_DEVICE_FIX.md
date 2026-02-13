# Device Name Display - Final Fix

**Date:** February 7, 2026  
**Status:** 🔧 **ACTION REQUIRED**

## Summary

The device info EXISTS in the database and shows correctly on the detail page (`/admin/results/[attemptId]`), but shows "Unknown Device" in the results table (`/admin/results`).

## Root Cause

The results table API has TWO code paths:
1. **RPC Function** - `admin_list_attempts` (preferred)
2. **Fallback Query** - Direct Supabase query

We fixed BOTH paths to include `device_info`, but the changes require:
1. ✅ Database migration applied (done via Supabase MCP)
2. ❌ **Dev server restart needed** (not done yet)
3. ❌ **Browser cache clear needed** (not done yet)

## What We Fixed

### 1. Database RPC Function ✅
**File:** `db/rpc_functions.sql`

Added to return type:
- `device_info jsonb`
- `code text`

### 2. API Fallback Query ✅
**File:** `src/app/api/admin/exams/[examId]/attempts/route.ts`

Added to SELECT and mapping:
- `device_info`
- `code`
- `final_score_percentage`

### 3. Added Logging ✅
Added console.log statements to see which path is being used.

## Required Actions

### Step 1: Restart Development Server

```bash
# Stop current server (Ctrl+C in terminal)
# Then restart
npm run dev
```

### Step 2: Clear Browser Cache

**Hard Refresh:**
- Linux/Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

**Or clear cache manually:**
1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

### Step 3: Check Terminal Logs

After restarting and loading `/admin/results`, check terminal for:

```
RPC SUCCESS - Sample device_info: HAS DATA
```
or
```
FALLBACK SUCCESS - Sample device_info: HAS DATA
```

If you see `NULL` instead of `HAS DATA`, there's still an issue.

### Step 4: Check Browser Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Load `/admin/results` page
4. Find request to `/api/admin/exams/[examId]/attempts`
5. Click on it and check Response tab
6. Verify `device_info` field is present in the JSON

**Expected Response:**
```json
{
  "items": [
    {
      "id": "...",
      "student_name": "ehab",
      "device_info": {
        "friendlyName": "(Linux) Firefox 147",
        ...
      },
      ...
    }
  ]
}
```

## Verification Query

Run this in Supabase SQL Editor to confirm data exists:

```sql
SELECT 
  id,
  student_name,
  device_info->>'friendlyName' as device_name,
  ip_address,
  started_at
FROM exam_attempts 
WHERE started_at >= '2026-02-07'
ORDER BY started_at DESC 
LIMIT 10;
```

## If Still Showing "Unknown Device"

### Check 1: API Response
If `device_info` is missing from API response:
- RPC might be failing silently
- Fallback query might have syntax error
- Check server terminal for errors

### Check 2: Frontend Rendering
If `device_info` is in API response but still shows "Unknown Device":
- Check browser console for JavaScript errors
- Verify `DeviceInfoCell` component is receiving props
- Check React Query cache (might be stale)

### Check 3: Data Format
If `device_info` is a string instead of object:
- It might be double-JSON-encoded
- Check if it needs `JSON.parse()`

## Quick Test

Create a new attempt to test:
1. Open incognito browser
2. Go to `/exam/[your-exam-id]`
3. Enter as student
4. Start exam
5. Check `/admin/results` - should show device name

## Files Modified

1. ✅ `db/rpc_functions.sql`
2. ✅ `db/migrations/fix_admin_list_attempts_device_info.sql`
3. ✅ `src/app/api/admin/exams/[examId]/attempts/route.ts`

## Next Steps

1. **Restart dev server** ← DO THIS NOW
2. **Clear browser cache** ← DO THIS NOW
3. **Check terminal logs** ← Verify which path is used
4. **Check Network tab** ← Verify API returns device_info
5. **Report back** ← Let me know what you see

---

**Most Likely Issue:** Dev server not restarted, so old code is still running.

**Expected Result:** After restart, device names should display correctly.
