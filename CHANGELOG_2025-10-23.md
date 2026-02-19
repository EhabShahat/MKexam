# Changelog - October 23, 2025

## Summary
Major improvements to attendance system, extra scores calculation, and admin results display.

---

## 🗄️ Database Changes

### 1. Automatic Tuesday Attendance Merging ✨
**File**: `db/attendance_auto_tuesday_merge.sql`

Added automatic weekly attendance grouping that merges all scans from Tue-Mon to that week's Tuesday.

**New Functions:**
- `get_last_tuesday(DATE)` - Calculates most recent Tuesday
- `auto_set_session_date_to_last_tuesday()` - Trigger to auto-adjust dates
- `set_attended_at_utc()` - Ensures UTC timestamps

**New Triggers:**
- `set_session_date_to_tuesday` - Runs before INSERT/UPDATE on attendance_records
- `ensure_attended_at_utc` - Ensures UTC timestamps

**Impact:**
- Attendance now automatically groups by week
- Scan on Thu Oct 23 → Stored as Tue Oct 21
- Completely timezone-safe

### 2. Data Corrections (Applied via Supabase MCP)

**a. Fixed exam_attempts.completion_status**
- Updated 909 records from `'completed'` to `'submitted'`
- Reason: Extra scores sync only processes submitted attempts

**b. Recalculated all extra_scores**
- Fixed quiz scores for 309 students
- Fixed homework scores for 309 students
- Fixed attendance percentages for 309 students
- Calculation now based on all exams (including 0 for non-attempted)

**c. Merged duplicate attendance sessions**
- Merged 2025-10-15 and 2025-10-16 into 2025-10-14
- Deleted 3 duplicate records
- Updated 18 records
- Result: Clean 2-session structure (Oct 14, Oct 21)

---

## 💻 Frontend Changes

### 1. Admin Results Page - Filter Exam Types
**File**: `src/app/admin/results/page.tsx`

**Changes:**
- All Exams view now shows only `exam_type='exam'` columns
- Quiz and homework scores appear in extra fields columns only
- Select Exam dropdown still shows all types (exam, quiz, homework)
- Handles case with no actual exams by showing students with extra fields

**New Computed Values:**
- `visibleActualExams` - Filters to only exam-type exams
- Updated `columnsAll` to use filtered list
- Updated export functions (CSV/XLSX)
- Updated aggregation query

### 2. Fixed Timezone Display in Attendance History
**File**: `src/app/admin/scanner/history/page.tsx`

**Change in `formatDayLabel()` function:**
```javascript
// Before (timezone-affected):
const d = new Date(`${dateStr}T00:00:00`);
const day = d.getDate();

// After (timezone-safe):
const d = new Date(`${dateStr}T00:00:00Z`);
const day = d.getUTCDate();
```

**Impact:**
- Dates display correctly: Oct-14 (not Oct-13), Oct-21 (not Oct-20)
- Works correctly in all timezones

---

## 📊 Results Display Improvements

### Before:
**All Exams View Table:**
| Student | Quiz 1 | Quiz 2 | Homework 1 | Exam 1 | Attendance | Final |
|---------|--------|--------|------------|--------|------------|-------|
| Mixed exam types in columns | | | | | | |

**Issues:**
- Too many columns
- Quiz/homework mixed with actual exams
- Confusing layout

### After:
**All Exams View Table:**
| Student | Attendance % | Homework Score | Quiz Score | Final |
|---------|--------------|----------------|------------|-------|
| Ahmed | 0% | 50% | 24% | 37% |
| Sara | 50% | 50% | 78% | 59% |

**When actual exams exist:**
| Student | Exam 1 | Exam 2 | Attendance % | Homework Score | Quiz Score | Final |
|---------|--------|--------|--------------|----------------|------------|-------|

**Benefits:**
- Clean separation of exam types
- Auto-calculated scores in dedicated columns
- Scalable (works with 0 or 100 exams)

---

## 🔧 Technical Details

### Extra Scores Calculation Logic

**Quiz Score:**
```sql
-- Get all quiz exams (status = done or published)
-- For each student: AVG(scores across all quizzes, 0 if not attempted)
-- Example: Student attempted 2 of 5 quizzes with 100% and 18.18%
-- Score = (100 + 18.18 + 0 + 0 + 0) / 5 = 24%
```

**Homework Score:**
```sql
-- Get all homework exams (status = done or published)
-- For each student: AVG(scores across all homework, 0 if not attempted)
-- Example: Student attempted 2 of 4 homework with 100% and 100%
-- Score = (100 + 100 + 0 + 0) / 4 = 50%
```

**Attendance Percentage:**
```sql
-- Count unique session_date values
-- For each student: (sessions_attended / total_sessions) * 100
-- With Tuesday merging: Only Tuesdays count as unique sessions
-- Example: Attended 1 of 2 sessions = 50%
```

### Timezone Safety

All date handling uses:
- PostgreSQL `DATE` type (no timezone component)
- `EXTRACT(DOW FROM DATE)` (timezone-independent)
- UTC timestamps with `AT TIME ZONE 'UTC'`
- Frontend parses with `'Z'` suffix and `getUTCDate()`

---

## 📝 Migration Notes

### For Fresh Database Setup:
1. Run all existing migration files in order
2. Add `db/attendance_auto_tuesday_merge.sql` at the end

### For Existing Database:
1. Run `db/attendance_auto_tuesday_merge.sql` only
2. All data corrections already applied to production

### Verification:
```sql
-- Should show triggers are active
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'attendance_records'::regclass;

-- Should only show Tuesdays
SELECT session_date, COUNT(*) 
FROM attendance_records 
GROUP BY session_date;
```

---

## 🎯 Impact Summary

### Students:
- ✅ Accurate quiz/homework scores in results
- ✅ Correct attendance percentage
- ✅ Proper date display in all timezones

### Admins:
- ✅ Clean results table with proper grouping
- ✅ Automatic weekly attendance consolidation
- ✅ No manual Tuesday merging needed
- ✅ Timezone-proof system

### System:
- ✅ Data integrity improved
- ✅ Consistent weekly attendance tracking
- ✅ Scalable exam type separation
- ✅ Production-ready

---

## 🚀 Deployment Checklist

- [x] Database migrations created
- [x] Frontend code updated
- [x] Timezone issues fixed
- [x] Data corrections applied
- [x] Documentation updated
- [ ] Git commit and push
- [ ] Deploy to production
- [ ] Verify in production
- [ ] Notify users of updated scores

---

**Total Changes:**
- 2 new database migration files
- 2 frontend files modified
- 1,200+ database records corrected
- 0 breaking changes
