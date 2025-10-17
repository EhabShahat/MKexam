# Auto-Grading Feature for Essay and Photo Upload Questions

## Overview

This feature allows **paragraph (essay)** and **photo upload** questions to be automatically graded if the student provides any answer. When enabled, students receive full points simply for submitting a response, eliminating the need for manual grading.

## How It Works

### For Administrators

1. **Creating/Editing Questions**
   - When adding or editing a paragraph or photo upload question, you'll see a new option:
   - ✅ **"Auto-grade if answer provided"**
   - Enable this checkbox to automatically award full points to any student who submits an answer

2. **Question Behavior**
   - **Auto-grade enabled**: Students get full points for any non-empty answer
   - **Auto-grade disabled**: Manual grading required in `/admin/results/[attemptId]`

3. **Results Page**
   - Auto-graded questions are scored automatically
   - Only questions requiring manual grading appear in the "Manual grading (paragraph / photo)" section
   - Scores are calculated and displayed immediately after submission

### For Students

No changes to the student experience:
- Essay questions: Enter text in the text area
- Photo upload questions: Upload an image
- Auto-graded questions award full points upon submission

## Use Cases

### ✅ Best for Auto-Grading
- Attendance verification (submit any photo)
- Participation credit (submit any text response)
- Completion-based assignments
- Draft submissions
- Practice exercises

### ❌ Not Suitable for Auto-Grading
- Essays requiring quality assessment
- Photo submissions requiring accuracy verification
- Graded written responses
- Critical thinking exercises

## Installation

### Step 1: Run Database Migration

Execute the migration script in your Supabase SQL editor:

```bash
# From the project root
cat db/migration_auto_grade.sql
```

Or manually run the SQL commands in Supabase Dashboard → SQL Editor.

### Step 2: Deploy Application

The TypeScript and React changes are already included in the codebase. Simply deploy your application:

```bash
npm run build
# Deploy to your hosting platform
```

### Step 3: Regrade Existing Attempts (Optional)

If you want to apply auto-grading to existing exam attempts after enabling the feature on questions:

1. Go to `/admin/results/[attemptId]`
2. Click **"Regrade This Attempt"** button
3. The system will recalculate the score with the new auto-grade settings

## Technical Details

### Database Schema

**New Column**: `questions.auto_grade_on_answer`
- Type: `boolean`
- Default: `false`
- Nullable: No

### Updated Functions

**`calculate_result_for_attempt(p_attempt_id uuid)`**
- Now checks `auto_grade_on_answer` flag
- Awards full points if:
  - Question type is `paragraph` or `photo_upload`
  - `auto_grade_on_answer` is `true`
  - Student provided a non-empty answer

### Grading Logic

```sql
-- For paragraph questions
WHEN question_type = 'paragraph' AND auto_grade_on_answer = true THEN
  -- Award points if text is not empty
  CASE WHEN trim(answer) <> '' THEN full_points ELSE 0 END

-- For photo upload questions  
WHEN question_type = 'photo_upload' AND auto_grade_on_answer = true THEN
  -- Award points if photo URL exists
  CASE WHEN photo_url IS NOT NULL AND photo_url <> '' THEN full_points ELSE 0 END
```

### Frontend Changes

**Components Updated**:
- `src/components/admin/QuestionsSection.tsx`
  - Added `auto_grade_on_answer` to `QuestionRow` interface
  - Added checkbox in question modal for paragraph/photo upload types
  - Updated form initialization and submission

- `src/app/admin/results/[attemptId]/page.tsx`
  - Filters out auto-graded questions from manual grading section
  - Only shows questions requiring manual intervention

**API Updates**:
- `src/server/admin/attempts.ts`
  - Includes `auto_grade_on_answer` in question queries
  - Returns field to frontend for filtering

## Example Workflow

### Creating an Auto-Graded Question

1. Navigate to **Admin → Exams → [Your Exam] → Questions**
2. Click **"Add Question"**
3. Select question type: **"Essay/Paragraph"** or **"Photo Upload"**
4. Enter your question text
5. ✅ Check **"Auto-grade if answer provided"**
6. Set points value (e.g., 5 points)
7. Click **"Add Question"**

### Viewing Results

1. Navigate to **Admin → Results**
2. Select an exam and view a specific attempt
3. **Auto-graded questions**:
   - Score calculated automatically
   - Shown in the per-question table
   - No manual grading required
4. **Manual grading questions**:
   - Appear in "Manual grading (paragraph / photo)" section
   - Require admin to assign points

## FAQ

**Q: Can I change auto-grade setting after students have submitted?**
A: Yes, but you'll need to click "Regrade This Attempt" to recalculate scores.

**Q: What if a student submits an empty answer?**
A: They receive 0 points, same as other question types.

**Q: Can I mix auto-graded and manually-graded essay questions?**
A: Yes, each question has its own auto-grade setting.

**Q: Does this affect existing questions?**
A: No, the default is `false` (manual grading). Existing questions remain unchanged.

**Q: Can I see what the student submitted for auto-graded questions?**
A: Yes, expand the "Per-question responses" section in the attempt details page.

## Troubleshooting

### Auto-grading not working

1. **Verify database column exists**:
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'questions' 
   AND column_name = 'auto_grade_on_answer';
   ```

2. **Check RPC function is updated**:
   ```sql
   SELECT prosrc 
   FROM pg_proc 
   WHERE proname = 'calculate_result_for_attempt';
   ```
   Should contain `auto_grade_on_answer` logic.

3. **Clear cache and reload**:
   - Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)
   - Restart your development server

### Questions still showing in manual grading section

- Verify `auto_grade_on_answer` is set to `true` in the database:
  ```sql
  SELECT id, question_text, auto_grade_on_answer 
  FROM questions 
  WHERE question_type IN ('paragraph', 'photo_upload');
  ```

## Support

For issues or questions:
1. Check the migration was applied successfully
2. Verify you're using the latest code
3. Review browser console for errors
4. Check Supabase logs for database errors

---

**Created**: 2025-01-17
**Version**: 1.0.0
