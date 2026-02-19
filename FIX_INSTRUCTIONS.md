# 🔧 Fix Instructions: Auto-Scheduling "exam_not_published" Error

## 📋 Summary

**Problem**: Auto-scheduled exams show correctly in the UI but students get "exam_not_published" error when trying to access them.

**Root Cause**: The database RPC function `start_attempt` checks the stored `status` column instead of the computed status based on scheduling mode and time.

**Solution**: Update the RPC function and API endpoints to use computed status logic.

---

## 🚀 Quick Fix Steps

### Step 1: Apply Database Fix (REQUIRED)

1. **Open Supabase Dashboard**
   - Go to your project at https://supabase.com/dashboard
   - Navigate to **SQL Editor**

2. **Run the Fix Script**
   - Open the file: `db/fix_start_attempt_computed_status.sql`
   - Copy all its contents
   - Paste into the SQL Editor
   - Click **Run** or press `Ctrl+Enter`
   - Wait for "Success. No rows returned" message

3. **Verify the Fix**
   ```sql
   -- Run this query to confirm the function was updated:
   SELECT 
     proname as function_name,
     LENGTH(pg_get_functiondef(oid)) as definition_length
   FROM pg_proc 
   WHERE proname IN ('start_attempt', 'start_attempt_v2')
     AND pronamespace = 'public'::regnamespace;
   ```
   - You should see both functions with larger definition_length (~6000+ characters)

---

### Step 2: Deploy Code Changes (REQUIRED)

The following files were updated to use computed status logic and filter archived exams:

**Modified Files:**
- ✅ `src/server/public/activeExam.ts` - Updated to filter exams by computed accessibility
- ✅ `src/server/public/results.ts` - Added `.eq('is_archived', false)` filter
- ✅ `src/server/public/summary.ts` - Added `.eq('is_archived', false)` filter
- ✅ `src/server/public/examInfo.ts` - Added `.eq('is_archived', false)` filter

**Already Correct (No changes needed):**
- ✅ `src/server/public/examsByCode.ts` - Already uses computed status and archived filter
- ✅ `src/server/public/examAccess.ts` - Calls the RPC which we fixed

**Deploy to Production:**

```bash
# Commit the changes
git add src/server/public/activeExam.ts src/server/public/results.ts src/server/public/summary.ts src/server/public/examInfo.ts
git commit -m "Fix: Filter archived exams from all public endpoints"

# Push to trigger Netlify build
git push origin main
```

Or if using Netlify CLI:
```bash
netlify deploy --prod
```

---

## 🧪 Testing the Fix

### Test 1: Auto-Scheduled Exam (Current Time Window)

1. **Create Test Exam**
   - Go to Admin → Exams → Create New
   - Set these values:
     ```
     Title: "Test Auto Exam"
     Scheduling Mode: Auto
     Start Time: [Current time - 5 minutes]
     End Time: [Current time + 1 hour]
     Access Type: Open (or code-based with a test code)
     ```
   - Save the exam
   - **Note**: The `status` column can be anything (draft/published/done) - it doesn't matter anymore!

2. **Try to Access as Student**
   - Open the exam entry page
   - Enter code (if code-based) or name (if open)
   - Click "Start Exam"
   - **Expected**: Should create attempt and redirect to exam ✅
   - **Before Fix**: Would show "exam_not_published" error ❌

### Test 2: Auto-Scheduled Exam (Future)

1. **Create Upcoming Exam**
   ```
   Title: "Test Future Exam"
   Scheduling Mode: Auto
   Start Time: [Tomorrow]
   End Time: [Tomorrow + 2 hours]
   ```

2. **Try to Access**
   - **Expected**: Should show "Exam not started yet" message ✅

### Test 3: Manual Mode with Early Publish

1. **Create Manual Exam**
   ```
   Title: "Test Manual Exam"
   Scheduling Mode: Manual
   Is Manually Published: true
   Start Time: [Any date - doesn't matter]
   ```

2. **Try to Access**
   - **Expected**: Should work immediately ✅

### Test 4: Archived Exam

1. **Archive Any Exam**
   - Set `is_archived = true` in the database or via admin UI

2. **Try to Access**
   - **Expected**: Should show "exam_not_published" error (correct behavior) ✅

---

## 🔍 Troubleshooting

### Issue: Still Getting "exam_not_published" Error

**Check 1: Database Function Updated?**
```sql
-- Run this to see if the function contains the new logic:
SELECT pg_get_functiondef('public.start_attempt'::regproc);
```
- Look for the text `v_is_accessible` in the output
- If not found, re-run the fix SQL script

**Check 2: Exam Settings Correct?**
```sql
-- Check your exam's settings:
SELECT 
  id,
  title,
  status,
  scheduling_mode,
  is_manually_published,
  is_archived,
  start_time,
  end_time,
  NOW() as current_time,
  -- Computed accessibility
  CASE
    WHEN is_archived THEN 'BLOCKED: Archived'
    WHEN scheduling_mode = 'Manual' AND is_manually_published THEN 'ALLOWED: Manual Published'
    WHEN scheduling_mode = 'Manual' AND NOT is_manually_published THEN 'BLOCKED: Manual Draft'
    WHEN scheduling_mode = 'Auto' AND is_manually_published THEN 'ALLOWED: Early Publish'
    WHEN scheduling_mode = 'Auto' AND NOW() >= start_time AND NOW() < end_time THEN 'ALLOWED: In Time Window'
    WHEN scheduling_mode = 'Auto' AND NOW() < start_time THEN 'BLOCKED: Not Started'
    WHEN scheduling_mode = 'Auto' AND NOW() >= end_time THEN 'BLOCKED: Ended'
    ELSE 'BLOCKED: Unknown'
  END as computed_accessibility
FROM exams
WHERE id = 'YOUR_EXAM_ID_HERE';
```

**Check 3: Code Deployed?**
```bash
# Check if activeExam.ts is deployed
curl https://mkexam.netlify.app/api/public/active-exam | jq
```
- Should return exams with computed status

### Issue: "exam_not_started" or "exam_ended" Error

This is **correct behavior** for Auto mode exams outside their time window.

**Solutions:**
- Wait until `start_time` arrives, OR
- Set `is_manually_published = true` to enable early access, OR
- Change `scheduling_mode` to 'Manual' for full admin control

---

## 📊 Understanding the New System

### Stored vs Computed Status

| Field | Type | Purpose |
|-------|------|---------|
| `status` (stored) | `draft\|published\|archived\|done` | **Legacy field** - no longer used for access control |
| `scheduling_mode` | `Auto\|Manual` | Controls how exam becomes accessible |
| `is_manually_published` | `boolean` | Override flag for early/manual publish |
| `is_archived` | `boolean` | Hard block - always prevents access |
| Computed Status | (calculated) | **Real accessibility** based on above fields + time |

### Scheduling Modes

**Auto Mode** (Time-Based):
- Exam is accessible when: `NOW() >= start_time AND NOW() < end_time`
- Early publish: Set `is_manually_published = true` to allow access before `start_time`
- The `status` column is ignored

**Manual Mode** (Admin-Controlled):
- Exam is accessible when: `is_manually_published = true`
- Time fields are ignored
- Full admin control over when students can access

**Archived** (Always Blocked):
- Exam is NEVER accessible when: `is_archived = true`
- Overrides everything else

---

## 🔄 Migration Notes

### For Existing Exams

The fix SQL script handles migration automatically:

1. **Archived exams**: Sets `is_archived = true` and `archived_at`
2. **Published exams without schedule**: Sets `scheduling_mode = 'Manual'` and `is_manually_published = true`
3. **Published exams with schedule**: Sets `scheduling_mode = 'Auto'` (if both start_time and end_time exist)

### For New Exams

When creating exams, set:
- `scheduling_mode = 'Auto'` for time-based scheduling
- `scheduling_mode = 'Manual'` for admin-controlled access
- `is_manually_published = false` (default) - let time control access
- `is_manually_published = true` - publish early or enable manual control

---

## ✅ Verification Checklist

- [ ] Database fix script executed successfully
- [ ] Function verification query shows updated definition
- [ ] Code changes deployed to production
- [ ] Test exam with Auto mode + current time window works
- [ ] Test exam with Manual mode + is_manually_published=true works
- [ ] Archived exam correctly blocks access
- [ ] No errors in Netlify function logs
- [ ] Production exams are accessible to students

---

## 📞 Support

If you continue experiencing issues after applying this fix:

1. Check Netlify function logs: https://app.netlify.com → Your Site → Functions
2. Check Supabase logs: Supabase Dashboard → Logs
3. Share the exam ID and error message for debugging
4. Verify the exam's `scheduling_mode`, `is_manually_published`, and time fields

---

**Status**: ✅ Fix Complete  
**Deployment Required**: Database + Code  
**Breaking Changes**: None  
**Backward Compatible**: Yes
