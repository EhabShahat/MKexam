# Attendance Week Calculation Fix - Complete ✓

## Date Applied
February 1, 2026

## Summary
Successfully fixed attendance calculations to use **Wednesday-to-Tuesday weeks** instead of individual dates or Monday-based weeks.

## Changes Made

### 1. Database Functions Updated ✓
Updated all attendance calculation functions to group by week (Wed-Tue):

**Functions Modified:**
- `sync_all_attendance_percentages()` - Counts unique weeks (Wed-Tue)
- `sync_all_extra_scores()` - Uses week-based attendance calculation
- `sync_student_extra_scores(uuid)` - Single student sync with week-based calculation

**Week Calculation Formula:**
```sql
-- Calculate Wednesday start date for any given date
CASE 
  WHEN EXTRACT(DOW FROM session_date) >= 3 THEN  -- Wed(3) to Sat(6)
    session_date - (EXTRACT(DOW FROM session_date) - 3)::int
  ELSE  -- Sun(0) to Tue(2) - belongs to previous week
    session_date - (EXTRACT(DOW FROM session_date) + 4)::int
END as week_start_wednesday
```

### 2. API Endpoint Fixed ✓
Updated `src/server/admin/attendance.ts`:

**Before:**
```typescript
// Made Monday the start of the week
const diff = (day === 0 ? -6 : 1) - day;
```

**After:**
```typescript
// Make Wednesday the start of the week (Wed-Tue)
const diff = day >= 3 ? (day - 3) : (day + 4);
```

### 3. Week Labels Updated ✓
Changed week labels from "W1-Oct" format to "08-Oct" format (showing Wednesday date):

**Before:**
```typescript
return `W${wn}-${month}`;  // e.g., "W1-Oct"
```

**After:**
```typescript
const day = w.getUTCDate();
const month = w.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
return `${day.toString().padStart(2, '0')}-${month}`;  // e.g., "08-Oct"
```

## Verification Results

### Total Weeks in Database: 13 weeks ✓

**Week List (Wednesday start dates):**
1. **08-Oct** (session: Oct-14 Tue)
2. **15-Oct** (session: Oct-21 Tue)
3. **22-Oct** (session: Oct-28 Tue)
4. **29-Oct** (session: Nov-04 Tue)
5. **05-Nov** (session: Nov-11 Tue)
6. **26-Nov** (session: Dec-02 Tue) - Gap of 3 weeks
7. **03-Dec** (session: Dec-09 Tue)
8. **10-Dec** (session: Dec-16 Tue)
9. **17-Dec** (session: Dec-23 Tue)
10. **24-Dec** (session: Dec-30 Tue)
11. **07-Jan** (session: Jan-13 Tue) - Gap of 2 weeks
12. **14-Jan** (session: Jan-20 Tue)
13. **21-Jan** (session: Jan-27 Tue)

### Student 3422 (ehab) - Final Scores:
- **Attendance**: 8% (1 week out of 13 weeks) ✓
- **Homework**: 23% (total score / 14 total exams) ✓
- **Quiz**: 3% (total score / 101 total exams) ✓

## How It Works Now

### Week Definition
- **Week starts**: Wednesday
- **Week ends**: Tuesday (next week)
- **Example**: Oct-14 (Tuesday) belongs to the week starting Oct-8 (Wednesday)

### Attendance Calculation
```
Attendance % = (Number of weeks attended / Total weeks) × 100
```

**Example:**
- Student attended 1 week out of 13 total weeks
- Attendance = (1 / 13) × 100 = 7.69% ≈ 8%

### Scanner History Page
The `/admin/scanner/history` page now displays:
- Week headers as "08-Oct", "15-Oct", etc. (Wednesday dates)
- Each column represents one week (Wed-Tue)
- Checkmarks (✓) show if student attended that week
- Total attendance count shows weeks attended / total weeks

## Files Modified

### Database (via Supabase MCP):
- ✓ `sync_all_attendance_percentages()` function
- ✓ `sync_all_extra_scores()` function
- ✓ `sync_student_extra_scores(uuid)` function

### Frontend/Backend:
- ✓ `src/server/admin/attendance.ts` - Week calculation and labels
- ✓ `src/app/admin/scanner/history/page.tsx` - Already compatible (no changes needed)

## Testing Checklist

- [x] Database functions use Wed-Tue week calculation
- [x] API endpoint calculates weeks from Wednesday
- [x] Week labels show Wednesday date (e.g., "08-Oct")
- [x] Scanner history page displays correct week headers
- [x] Attendance percentages calculate correctly
- [x] All 338 students updated successfully
- [x] No TypeScript errors

## Expected Behavior

### When Viewing Scanner History:
1. Week headers show Wednesday dates: "08-Oct", "15-Oct", etc.
2. Each column represents a full week (Wed-Tue)
3. Student attendance shows ✓ if they attended any day in that week
4. Total shows: "attended weeks / total weeks"

### When Recording New Attendance:
1. New attendance record is created with session_date
2. System automatically groups it into the correct week (Wed-Tue)
3. If it's a new week, total week count increases
4. All student percentages recalculate automatically

### When Syncing Scores:
1. `sync_all_extra_scores()` counts unique weeks (Wed-Tue)
2. Each student's attendance = weeks attended / total weeks
3. Homework/Quiz scores = total score / total exams (non-attempted = 0%)

## Notes

- **13 weeks found**: This is correct based on the actual attendance records
- **Gaps in weeks**: Weeks 6-7 (Nov 12-25) and weeks 10-11 (Dec 31-Jan 6) have no records
- **All Tuesdays**: All session dates are Tuesdays, which is expected
- **Week grouping**: Each Tuesday belongs to the week starting on the previous Wednesday

## Success Criteria Met ✓

- ✓ Weeks calculated from Wednesday to Tuesday
- ✓ Week labels show Wednesday date (e.g., "08-Oct")
- ✓ Scanner history page displays correct headers
- ✓ Attendance percentages use week-based calculation
- ✓ All 338 students updated successfully
- ✓ Database and API are in sync
- ✓ No TypeScript errors

## Future Enhancements

If you want to exclude certain weeks (holidays, breaks), you can:
1. Add an `excluded_weeks` table with start dates
2. Update the calculation functions to filter out excluded weeks
3. Or manually adjust the total week count in the calculation

For now, all 13 weeks are counted as valid attendance weeks.
