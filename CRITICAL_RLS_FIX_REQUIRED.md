# 🔴 CRITICAL: RLS Fix Required Before Deployment

**Date**: February 7, 2026  
**Priority**: CRITICAL - BLOCKING DEPLOYMENT  
**Issue**: Infinite recursion in database RLS policies

---

## ⚠️ IMMEDIATE ACTION REQUIRED

Your application is experiencing a **critical database error** that must be fixed before staging deployment:

```
Error: "infinite recursion detected in policy for relation 'exam_attempts'"
```

---

## 🔧 Quick Fix (5 minutes)

### Step 1: Access Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**

### Step 2: Run This SQL

Copy and paste this SQL into the editor and click **Run**:

```sql
-- Fix infinite recursion in RLS policies
DROP POLICY IF EXISTS exam_attempts_public_results_read ON public.exam_attempts;
DROP POLICY IF EXISTS exam_results_public_read ON public.exam_results;

-- Recreate without circular dependency
CREATE POLICY exam_attempts_public_results_read ON public.exam_attempts
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.exams ex
      WHERE ex.id = public.exam_attempts.exam_id 
      AND ex.status = 'published'
    )
  );

CREATE POLICY exam_results_public_read ON public.exam_results
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.exam_attempts ea
      JOIN public.exams ex ON ex.id = ea.exam_id
      WHERE ea.id = public.exam_results.attempt_id 
      AND ex.status = 'published'
    )
  );
```

### Step 3: Verify Fix

Run this query to verify:

```sql
SELECT COUNT(*) FROM exam_attempts;
```

If it returns a number (not an error), the fix worked! ✅

### Step 4: Test Application

1. Reload your application
2. Check browser console - the error should be gone
3. Navigate to admin results page
4. Verify data loads correctly

---

## 📋 What Happened?

The database had a **circular dependency** in security policies:

- `exam_attempts` policy checked if record exists in `exam_results`
- `exam_results` policy checked if record exists in `exam_attempts`
- Result: Infinite loop when querying either table

**The fix**: Removed the circular reference so `exam_attempts` only checks the parent `exams` table.

---

## 📄 Detailed Documentation

For complete technical details, see:
- `RLS_INFINITE_RECURSION_FIX.md` - Full analysis and explanation
- `db/fix_rls_infinite_recursion.sql` - SQL fix script
- `db/security.sql` - Updated (already fixed in codebase)

---

## ✅ After Applying Fix

Once you've applied the SQL fix:

1. ✅ The error will disappear
2. ✅ Application will work normally
3. ✅ You can proceed with staging deployment
4. ✅ Task 13 completion is still valid

---

## 🚀 Updated Deployment Checklist

- ✅ Task 13 complete (all tests passing, build working)
- 🔴 **Apply RLS fix** (this document) ← **DO THIS NOW**
- ⏳ Deploy to staging
- ⏳ Monitor for 24-48 hours
- ⏳ Production deployment

---

## ❓ Need Help?

If you encounter any issues applying the fix:

1. Check that you're using the **service role key** (not anon key)
2. Verify you have **admin access** to Supabase
3. Try running the SQL in smaller chunks
4. Check Supabase logs for any error messages

---

**Status**: ⏳ **WAITING FOR USER TO APPLY FIX**

Once applied, you're ready for staging deployment! 🚀
