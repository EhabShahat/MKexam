# Attendance History Page - Debug Summary

## Problem
The `/admin/scanner/history` page shows only 10 weeks instead of the expected 13 weeks with attendance data.

## Database Verification
Confirmed 13 unique session dates exist in the database:
- 2025-10-14 (Tuesday) → Week starting 2025-10-08 (Wednesday)
- 2025-10-21 (Tuesday) → Week starting 2025-10-15 (Wednesday)
- 2025-10-28 (Tuesday) → Week starting 2025-10-22 (Wednesday)
- 2025-11-04 (Tuesday) → Week starting 2025-10-29 (Wednesday)
- 2025-11-11 (Tuesday) → Week starting 2025-11-05 (Wednesday)
- 2025-12-02 (Tuesday) → Week starting 2025-11-26 (Wednesday)
- 2025-12-09 (Tuesday) → Week starting 2025-12-03 (Wednesday)
- 2025-12-16 (Tuesday) → Week starting 2025-12-10 (Wednesday)
- 2025-12-23 (Tuesday) → Week starting 2025-12-17 (Wednesday)
- 2025-12-30 (Tuesday) → Week starting 2025-12-24 (Wednesday)
- 2026-01-13 (Tuesday) → Week starting 2026-01-07 (Wednesday)
- 2026-01-20 (Tuesday) → Week starting 2026-01-14 (Wednesday)
- 2026-01-27 (Tuesday) → Week starting 2026-01-21 (Wednesday)

**Total: 13 unique weeks**

## Root Cause Found
The API was using the `weeks` parameter (default 12) to create the `weeklyCounts` array size, instead of using the actual number of weeks with data (`weekStarts.length` which is 13).

## Fixes Applied

### 1. Backend API (`src/server/admin/attendance.ts`)
**Line 139:** Changed max weeks from 52 to 100
```typescript
const weeks = Math.max(4, Math.min(100, Number(url.searchParams.get("weeks") || 12)));
```

**Lines 183-220:** Changed week calculation from "backwards from today" to "based on actual data range"
```typescript
// OLD: Build weeks backwards from today
const now = new Date();
const thisWeekStart = getWeekStartUTC(now);
for (let i = weeks - 1; i >= 0; i--) {
  const d = new Date(thisWeekStart);
  d.setUTCDate(d.getUTCDate() - i * 7);
  weekStarts.push(d);
}

// NEW: Build weeks from earliest to latest session date
const sessionDates = records.map(r => new Date(r.session_date + "T00:00:00Z"));
const earliestDate = new Date(Math.min(...sessionDates.map(d => d.getTime())));
const latestDate = new Date(Math.max(...sessionDates.map(d => d.getTime())));

const firstWeekStart = getWeekStartUTC(earliestDate);
const lastWeekStart = getWeekStartUTC(latestDate);

const weekStarts: Date[] = [];
let currentWeek = new Date(firstWeekStart);
while (currentWeek <= lastWeekStart) {
  weekStarts.push(new Date(currentWeek));
  currentWeek.setUTCDate(currentWeek.getUTCDate() + 7);
}
```

**Line 242:** Fixed array size to use actual week count
```typescript
// OLD: new Array(weeks).fill(0)
// NEW: new Array(weekStarts.length).fill(0)
map[s.id] = { weeklyCounts: new Array(weekStarts.length).fill(0), lastAttendedAt: null, total: 0 };
```

**Line 265:** Fixed fallback array size
```typescript
// OLD: new Array(weeks).fill(0)
// NEW: new Array(weekStarts.length).fill(0)
weeklyCounts: map[s.id]?.weeklyCounts || new Array(weekStarts.length).fill(0),
```

### 2. Frontend (`src/app/admin/scanner/history/page.tsx`)
Already correctly requesting 100 weeks:
```typescript
const res = await authFetch("/api/admin/attendance?action=history&weeks=100");
```

Frontend filtering logic (lines 107-113) filters out weeks with zero attendance, which is correct behavior.

## Next Steps
1. **Restart the development server** to apply the backend changes
2. **Clear browser cache** or do a hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
3. **Verify the fix** by checking the page shows 13 weeks

## Testing
To verify the API is returning correct data, you can:
1. Open browser DevTools → Network tab
2. Refresh the `/admin/scanner/history` page
3. Find the request to `/api/admin/attendance?action=history&weeks=100`
4. Check the response:
   - `weeks` array should have 13 elements
   - Each student's `weeklyCounts` array should have 13 elements
   - Week labels should show: 08-Oct, 15-Oct, 22-Oct, 29-Oct, 05-Nov, 26-Nov, 03-Dec, 10-Dec, 17-Dec, 24-Dec, 07-Jan, 14-Jan, 21-Jan

## Files Modified
- `src/server/admin/attendance.ts` - Fixed week calculation and array sizing
- `test-attendance-api.js` - Created test script for verification
